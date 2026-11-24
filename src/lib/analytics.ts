export type Granularity = 'day' | 'week' | 'month' | 'year';
export type ActivityEvent = { created_at: string; status?: string; reviewed_at?: string | null };
export type JobActivity = ActivityEvent & { category?: string | null; salary_min?: number | null; salary_visible?: boolean | null; status?: string };
export type Insight = { id: string; title: string; detail: string; value: string; level: 'positive' | 'neutral' | 'attention'; basis: string };

export function bucketLabel(timestamp: string, granularity: Granularity) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return '';
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  const dateOnly = `${parts.year}-${parts.month}-${parts.day}`;
  if (granularity === 'year') return parts.year;
  if (granularity === 'month') return `${parts.year}-${parts.month}`;
  if (granularity === 'day') return dateOnly;
  const midnight = new Date(`${dateOnly}T00:00:00Z`);
  const weekday = (midnight.getUTCDay() + 6) % 7;
  midnight.setUTCDate(midnight.getUTCDate() - weekday);
  return midnight.toISOString().slice(0, 10);
}

export function buildActivitySeries(events: {
  applications: ActivityEvent[];
  employment: ActivityEvent[];
  registrations: ActivityEvent[];
  verifications: ActivityEvent[];
  jobs: JobActivity[];
}, granularity: Granularity) {
  const map = new Map<string, { period: string; applications: number; hires: number; registrations: number; verifications: number; jobs: number }>();
  const collect = (rows: ActivityEvent[], field: 'applications' | 'hires' | 'registrations' | 'verifications' | 'jobs', dateKey: 'created_at' | 'reviewed_at' = 'created_at') => {
    for (const row of rows) {
      const date = row[dateKey];
      if (!date) continue;
      const period = bucketLabel(date, granularity);
      if (!period) continue;
      if (!map.has(period)) map.set(period, { period, applications: 0, hires: 0, registrations: 0, verifications: 0, jobs: 0 });
      map.get(period)![field]++;
    }
  };
  collect(events.applications, 'applications');
  collect(events.employment, 'hires');
  collect(events.registrations, 'registrations');
  collect(events.verifications.filter(v => v.status === 'approved'), 'verifications', 'reviewed_at');
  collect(events.jobs, 'jobs');
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function changePercent(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildInsights(input: {
  applications: ActivityEvent[];
  employment: ActivityEvent[];
  registrations: ActivityEvent[];
  verifications: ActivityEvent[];
  jobs: JobActivity[];
  granularity: Granularity;
}): Insight[] {
  const { applications, employment, registrations, verifications, jobs, granularity } = input;
  const result: Insight[] = [];
  const series = buildActivitySeries(input, granularity);
  const last = series.at(-1), previous = series.at(-2);
  if (last && previous) {
    const change = changePercent(last.applications, previous.applications);
    if (change !== null) result.push({
      id: 'applications-trend', title: change >= 0 ? 'Application activity increased' : 'Application activity decreased',
      detail: `${last.applications} applications in ${last.period}, compared with ${previous.applications} in ${previous.period}.`,
      value: `${change > 0 ? '+' : ''}${change}%`, level: change >= 0 ? 'positive' : 'attention',
      basis: `Count of applications grouped by ${granularity}; compares the latest two periods represented in your selected date range.`
    });
  }
  if (series.length >= 4) {
    const sample = series.slice(-8).map(item => item.applications);
    const n = sample.length;
    const meanX = (n - 1) / 2;
    const meanY = sample.reduce((a, b) => a + b, 0) / n;
    const numerator = sample.reduce((total, y, i) => total + (i - meanX) * (y - meanY), 0);
    const denominator = sample.reduce((total, _, i) => total + (i - meanX) ** 2, 0);
    const slope = denominator ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;
    const projected = Math.max(0, Math.round(intercept + slope * n));
    const mae = sample.reduce((total, y, i) => total + Math.abs(y - (intercept + slope * i)), 0) / n;
    const uncertainty = Math.ceil(mae + Math.abs(slope));
    result.push({
      id: 'application-forecast', title: 'Experimental next-period forecast',
      detail: `${projected} estimated applications, with a descriptive range of ${Math.max(0, projected - uncertainty)}–${projected + uncertainty}. This is not a guaranteed prediction.`,
      value: `~${projected}`, level: 'neutral',
      basis: `Simple least-squares trend model on the last ${n} observed ${granularity} activity periods; uncertainty is a residual-error heuristic. Empty periods are not imputed. Not suitable for staffing or hiring decisions.`
    });
  }
  const relevantJobs = jobs.filter(j => j.category?.trim());
  const categories = relevantJobs.reduce<Record<string, number>>((acc, job) => {
    const category = job.category!.trim(); acc[category] = (acc[category] || 0) + 1; return acc;
  }, {});
  const leading = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  if (leading) result.push({
    id: 'leading-category', title: 'Most posted job category', detail: `${leading[0]} accounts for ${leading[1]} of ${relevantJobs.length} categorized postings in the selected period.`,
    value: leading[0], level: 'neutral', basis: 'Counts job postings by stored category, including postings that are not currently published.'
  });
  if (applications.length > 0) {
    const conversion = Math.round(100 * employment.length / applications.length);
    result.push({
      id: 'hiring-rate', title: 'Recorded hire-to-application ratio',
      detail: `${employment.length} employment records and ${applications.length} applications in the selected period. These events may come from different application cohorts.`,
      value: `${conversion}%`, level: 'neutral', basis: 'Employment records created during the period divided by applications submitted during the period; not a causal conversion rate.'
    });
  }
  const reviewed = verifications.filter(v => !!v.reviewed_at && !!v.created_at);
  if (reviewed.length) {
    const durations = reviewed.map(v => Math.max(0, (new Date(v.reviewed_at!).getTime() - new Date(v.created_at).getTime()) / 3600000)).filter(Number.isFinite);
    if (durations.length) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      result.push({ id: 'review-time', title: 'Average verification review time', detail: `${durations.length} verification requests had recorded decisions.`, value: `${avg.toFixed(1)} hours`, level: avg > 72 ? 'attention' : 'neutral', basis: 'Arithmetic mean of time elapsed between submission and review timestamps.' });
    }
  }
  if (registrations.length && !result.length) result.push({ id: 'registrations', title: 'Accounts registered', detail: `${registrations.length} new accounts were recorded in the selected period.`, value: String(registrations.length), level: 'neutral', basis: 'Account creation timestamps in the platform database.' });
  if (!result.length) result.push({ id: 'insufficient-data', title: 'Not enough records for insights', detail: 'Expand the selected period or collect more real activity to generate useful comparisons.', value: '—', level: 'neutral', basis: 'No statistical conclusions are generated without data.' });
  return result;
}
