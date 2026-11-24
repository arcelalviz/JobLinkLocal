import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { adminClient } from './supabase/admin';
import { ApiError } from './guards';
import { buildInsights, buildActivitySeries, type ActivityEvent, type JobActivity, type Granularity } from './analytics';

type RecordRow = Record<string, any>;
const allowedGranularity = new Set<Granularity>(['day', 'week', 'month', 'year']);
const dateValid = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf());

async function readPeriodRows(table: string, columns: string, from: string, to: string, dateColumn = 'created_at') {
  const admin = adminClient();
  const rows: RecordRow[] = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const { data, error } = await admin.from(table).select(columns).gte(dateColumn, from).lt(dateColumn, to).order(dateColumn, { ascending: true }).range(offset, offset + 999);
    if (error) throw new ApiError(500, `Unable to read ${table} activity.`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export async function reportData(start: string | null, end: string | null, period: string | null = 'month') {
  const granularity: Granularity = allowedGranularity.has(period as Granularity) ? period as Granularity : 'month';
  const since = dateValid(start) ? start : '2020-01-01';
  const until = dateValid(end) ? end : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (since > until) throw new ApiError(400, 'The start date must be before the end date.');
  const startIso = new Date(`${since}T00:00:00+08:00`).toISOString();
  const endNext = new Date(`${until}T00:00:00+08:00`);
  endNext.setUTCDate(endNext.getUTCDate() + 1);
  const endIso = endNext.toISOString();
  const [applicationsResult, jobsResult, profilesResult, verificationResult, employmentResult] = await Promise.all([
    readPeriodRows('applications', 'id,created_at,status', startIso, endIso),
    readPeriodRows('jobs', 'id,created_at,status,category,salary_min,salary_visible,published_at', startIso, endIso),
    readPeriodRows('profiles', 'id,created_at,role', startIso, endIso),
    readPeriodRows('verification_submissions', 'id,created_at,reviewed_at,status', startIso, endIso),
    readPeriodRows('employment_records', 'id,created_at,status', startIso, endIso)
  ]);
  const applications = applicationsResult.rows as ActivityEvent[];
  const jobs = jobsResult.rows as JobActivity[];
  const registrations = profilesResult.rows as ActivityEvent[];
  const verifications = verificationResult.rows as ActivityEvent[];
  const employment = employmentResult.rows as ActivityEvent[];
  const summary = {
    profiles: registrations.length,
    jobs: jobs.length,
    applications: applications.length,
    employment_records: employment.length,
    verification_submissions: verifications.length,
    approved_verifications: verifications.filter(v => v.status === 'approved').length
  };
  const status = applications.reduce<Record<string, number>>((acc, row) => {
    const label = row.status || 'unspecified'; acc[label] = (acc[label] || 0) + 1; return acc;
  }, {});
  const events = { applications, jobs, registrations, verifications, employment };
  const series = buildActivitySeries(events, granularity);
  const monthly = buildActivitySeries(events, 'month').map(x => ({ month: x.period, applications: x.applications, hires: x.hires }));
  const insights = buildInsights({ ...events, granularity });
  const visibleSalary = jobs.filter(j => j.salary_visible !== false && typeof j.salary_min === 'number' && j.salary_min > 0).sort((a, b) => (a.salary_min || 0) - (b.salary_min || 0));
  const categoryCounts = jobs.reduce<Record<string, number>>((acc, row) => {
    if (row.category) acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0] || null;
  const truncated = [applicationsResult, jobsResult, profilesResult, verificationResult, employmentResult].some(x => x.truncated);
  return {
    summary, status, series, monthly, insights, since, until, granularity,
    topCategory: topCategory ? { name: topCategory[0], count: topCategory[1] } : null,
    lowestAdvertisedSalary: visibleSalary[0]?.salary_min ?? null,
    truncated,
    generatedAt: new Date().toISOString(),
    method: 'Explainable rule-based statistical insights, not generative AI or individual hiring recommendations'
  };
}

function escapeCsv(value: unknown) {
  const string = String(value ?? '');
  return `"${string.replace(/"/g, '""')}"`;
}

export function csvReport(report: Awaited<ReturnType<typeof reportData>>) {
  const rows: unknown[][] = [
    ['JobLinkLocal analytics report'], ['From', report.since], ['Through', report.until], ['Time grouping', report.granularity],
    ['Generated UTC', report.generatedAt], ['Method', report.method], [], ['Metric', 'Count']
  ];
  for (const [key, value] of Object.entries(report.summary)) rows.push([key, value]);
  rows.push([], ['Application status', 'Count']);
  for (const [key, value] of Object.entries(report.status)) rows.push([key, value]);
  rows.push([], ['Period', 'Applications', 'Hires', 'Registrations', 'Verified accounts', 'Job posts']);
  for (const x of report.series) rows.push([x.period, x.applications, x.hires, x.registrations, x.verifications, x.jobs]);
  rows.push([], ['Automated insight', 'Value', 'Description', 'Calculation basis']);
  for (const x of report.insights) rows.push([x.title, x.value, x.detail, x.basis]);
  if (report.truncated) rows.push([], ['Warning', 'Some results reached the 50,000-row safety cap']);
  return rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');
}

export async function pdfReport(report: Awaited<ReturnType<typeof reportData>>) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 784;
  const draw = (value: string, size = 11, heavy = false) => {
    if (y < 68) { page = doc.addPage([595, 842]); y = 780; }
    page.drawText(value.replace(/[^\x20-\x7E]/g, '?').slice(0, 103), { x: 52, y, size, font: heavy ? bold : font, color: rgb(.05, .15, .22) });
    y -= size + 11;
  };
  draw('JOBLINKLOCAL', 21, true);
  draw('Employment and recruitment analytics', 13);
  draw(`${report.since} to ${report.until} | Grouped ${report.granularity}`);
  draw(`Generated at ${report.generatedAt} UTC`, 9);
  y -= 12;
  draw('Platform totals', 15, true);
  for (const [key, value] of Object.entries(report.summary)) draw(`${key.replace(/_/g, ' ')}: ${value}`);
  y -= 12; draw('Application status', 15, true);
  for (const [key, value] of Object.entries(report.status)) draw(`${key.replace(/_/g, ' ')}: ${value}`);
  y -= 12; draw('Time-series summary', 15, true);
  for (const x of report.series.slice(-30)) draw(`${x.period} | Applications ${x.applications} | Hires ${x.hires} | New jobs ${x.jobs}`, 9);
  y -= 12; draw('Automated statistical insights', 15, true);
  for (const insight of report.insights) { draw(`${insight.title}: ${insight.value}`, 10, true); draw(insight.detail, 9); }
  draw(report.method, 8);
  if (report.truncated) draw('Warning: the query reached a maximum-row safety cap.', 9);
  return new Uint8Array(await doc.save());
}
