import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { randomUUID } from 'node:crypto';

const tag = 'joblinklocal-4-demo-v1';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const inbox = (process.env.DEMO_GMAIL_INBOX || '').trim().toLowerCase();
const password = process.env.DEMO_ACCOUNT_PASSWORD || '';
const confirmation = process.env.DEMO_SEED_CONFIRM;

if (confirmation !== 'CREATE_DEMO_USERS') throw new Error('Set DEMO_SEED_CONFIRM=CREATE_DEMO_USERS in your local environment to opt into test data creation.');
if (!url || !key || !url.startsWith('https://')) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required in .env.local.');
if (!/^[^\s@+]+@(gmail\.com|googlemail\.com)$/.test(inbox)) throw new Error('DEMO_GMAIL_INBOX must be a Gmail inbox without an existing +alias.');
if (password.length < 14 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) throw new Error('DEMO_ACCOUNT_PASSWORD must be at least 14 characters with uppercase, lowercase, a digit and a symbol.');
if (process.env.NEXT_PUBLIC_SITE_URL && !/localhost|127\.0\.0\.1/.test(process.env.NEXT_PUBLIC_SITE_URL)) console.warn('This seed targets your configured Supabase project. Do not use it for real users or an unrestricted public launch.');

const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const [local, domain] = inbox.split('@');
const emailFor = (suffix) => `${local}+jl4-${suffix}@${domain}`;
const users = [
  { key: 'seeker-approved', email: emailFor('seeker-approved'), role: 'jobseeker', status: 'approved', name: 'Alex Rivera', city: 'Olongapo City', province: 'Zambales', phone: '09000000001', education: 'Bachelor of Science in Information Technology', experience: 2, skills: ['Customer service', 'Microsoft Excel', 'Data entry', 'Technical support'], desired: 'Junior IT Support Specialist', setup: 'On-site' },
  { key: 'seeker-pending', email: emailFor('seeker-pending'), role: 'jobseeker', status: 'pending', name: 'Jamie Santos', city: 'Olongapo City', province: 'Zambales', phone: '09000000002', education: 'Senior High School Graduate', experience: 0, skills: ['Communication', 'Organization', 'Basic computer skills'], desired: 'Administrative Assistant', setup: 'Hybrid' },
  { key: 'employer-approved', email: emailFor('employer-approved'), role: 'employer', status: 'approved', name: 'Taylor Cruz', city: 'Olongapo City', province: 'Zambales', phone: '09000000003', business: 'Harborview Demo Services', industry: 'Business Services', companyType: 'Service provider', size: '11-50', contactPosition: 'Recruitment Coordinator' },
  { key: 'employer-pending', email: emailFor('employer-pending'), role: 'employer', status: 'pending', name: 'Morgan Reyes', city: 'Subic', province: 'Zambales', phone: '09000000004', business: 'Coastal Demo Creative Studio', industry: 'Creative Services', companyType: 'Design studio', size: '1-10', contactPosition: 'Owner' }
];

function ensure(result, message) {
  if (result.error) throw new Error(`${message}: ${result.error.message}`);
  return result.data;
}

async function existingUserByEmail(email) {
  for (let page = 1; page <= 100; page++) {
    const result = await client.auth.admin.listUsers({ page, perPage: 1000 });
    ensure(result, 'Unable to inspect Auth users');
    const found = (result.data.users || []).find(u => (u.email || '').toLowerCase() === email);
    if (found) return found;
    if ((result.data.users || []).length < 1000) return null;
  }
  throw new Error('Auth user list is too large to verify account ownership safely.');
}

async function pdfBytes(title, lines) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText('JOBLINKLOCAL 4.0 - TEST DATA', { x: 42, y: 780, size: 18, font: bold, color: rgb(0.1, 0.18, 0.26) });
  page.drawText('DEMO ONLY - NOT AN ID OR OFFICIAL CREDENTIAL', { x: 42, y: 748, size: 11, font: bold, color: rgb(0.65, 0.10, 0.14) });
  page.drawText(title, { x: 42, y: 701, size: 15, font: bold });
  let y = 664;
  for (const line of lines) {
    const segments = String(line).match(/.{1,76}/g) || [];
    for (const segment of segments) {
      page.drawText(segment, { x: 42, y, size: 10, font });
      y -= 19;
    }
    y -= 6;
  }
  page.drawText('This file is an artificial placeholder used only to test LGU document review.', { x: 42, y: 80, size: 10, font });
  return Buffer.from(await pdf.save());
}

async function uploadPdf(bucket, id, fileName, title, lines) {
  const path = `${id}/joblinklocal-demo/${fileName}.pdf`;
  const bytes = await pdfBytes(title, lines);
  ensure(await client.storage.from(bucket).upload(path, bytes, { contentType: 'application/pdf', upsert: true, cacheControl: '0' }), `Unable to upload ${fileName}`);
  return { path, filename: `${fileName}.pdf`, bytes: bytes.length, media_type: 'application/pdf' };
}

async function createDemoUser(def) {
  let user = await existingUserByEmail(def.email);
  let fresh = !user;
  if (user && user.app_metadata?.joblinklocal_demo_seed !== tag) throw new Error(`Existing account ${def.email} is not marked as a demo account; refusing to modify it.`);
  if (!user) {
    const meta = {
      role: def.role,
      full_name: def.name,
      phone: def.phone,
      city: def.city,
      province: def.province,
      education: def.education || '',
      experience_years: String(def.experience || 0),
      skills: (def.skills || []).join(','),
      desired_role: def.desired || '',
      preferred_work_setup: def.setup || '',
      business_name: def.business || '',
      industry: def.industry || '',
      business_type: def.companyType || '',
      registration_number: def.role === 'employer' ? 'DEMO-NOT-A-REAL-REGISTRATION' : '',
      team_size: def.size || '',
      business_description: def.role === 'employer' ? 'Entirely fictional company for JobLinkLocal presentation and system testing.' : '',
      contact_position: def.contactPosition || ''
    };
    const result = await client.auth.admin.createUser({
      email: def.email,
      password,
      email_confirm: true,
      user_metadata: meta,
      app_metadata: { joblinklocal_demo_seed: tag }
    });
    user = ensure(result, `Unable to create ${def.key}`).user;
    if (!user) throw new Error(`Supabase did not return the new ${def.key} user`);
    console.log(`Created Auth account: ${def.email}`);
  } else {
    console.log(`Reusing previously seeded account: ${def.email}`);
  }
  const profile = ensure(await client.from('profiles').select('id,role,lgu_status').eq('id', user.id).maybeSingle(), `Unable to read profile for ${def.email}`);
  if (!profile || profile.role !== def.role) throw new Error(`Account ${def.email} is missing the expected ${def.role} profile. Check the on_auth_user_created database trigger.`);
  if (fresh) {
    ensure(await client.from('profiles').update({
      full_name: def.name,
      phone: def.phone,
      city: def.city,
      province: def.province,
      bio: 'Fictional JobLinkLocal demonstration account. All information is test data.',
      lgu_status: def.status
    }).eq('id', user.id), `Unable to set ${def.key} profile`);
    if (def.role === 'jobseeker') {
      ensure(await client.from('seeker_profiles').update({
        education: def.education,
        experience_years: def.experience,
        skills: def.skills,
        desired_role: def.desired,
        preferred_work_setup: def.setup,
        portfolio_url: null,
        linkedin_url: null
      }).eq('user_id', user.id), `Unable to set ${def.key} seeker details`);
    } else {
      ensure(await client.from('employer_profiles').update({
        business_name: def.business,
        industry: def.industry,
        business_type: def.companyType,
        registration_number: 'DEMO-NOT-A-REAL-REGISTRATION',
        team_size: def.size,
        business_description: 'Entirely fictional company used solely for platform demonstrations.',
        contact_position: def.contactPosition
      }).eq('user_id', user.id), `Unable to set ${def.key} employer details`);
    }
  }
  const existing = ensure(await client.from('verification_submissions').select('id').eq('user_id', user.id).like('statement', `JOBLINKLOCAL DEMO ${tag}%`).limit(1), 'Unable to read seeded verification submissions');
  if (!existing?.length) {
    const credential = await uploadPdf('verification-documents', user.id, 'credential-placeholder', 'Demo verification attachment', [
      `Profile: ${def.name}`,
      `Account type: ${def.role}`,
      `Demo LGU status: ${def.status}`,
      'NOT A LEGAL DOCUMENT. Do not use for real identity or business verification.'
    ]);
    const submission = ensure(await client.from('verification_submissions').insert({
      user_id: user.id,
      kind: def.role,
      status: def.status,
      statement: `JOBLINKLOCAL DEMO ${tag}: sample documents, not a real verification request`,
      reviewer_note: def.status === 'approved' ? 'Seeded approved status for testing; no real LGU verification performed.' : null,
      reviewed_at: def.status === 'approved' ? new Date().toISOString() : null
    }).select('id').single(), `Unable to create verification request for ${def.email}`);
    ensure(await client.from('verification_documents').upsert({
      submission_id: submission.id,
      owner_id: user.id,
      bucket: 'verification-documents',
      path: credential.path,
      filename: credential.filename,
      media_type: credential.media_type,
      bytes: credential.bytes
    }, { onConflict: 'path' }), `Unable to create document metadata for ${def.email}`);
  }
  if (def.role === 'jobseeker') {
    const seeker = ensure(await client.from('seeker_profiles').select('resume_path').eq('user_id', user.id).single(), `Unable to read resume path for ${def.email}`);
    if (!seeker.resume_path) {
      const resume = await uploadPdf('resumes', user.id, 'sample-resume', 'Sample jobseeker resume', [
        `Candidate: ${def.name}`,
        `Location: ${def.city}, ${def.province}`,
        `Education: ${def.education}`,
        `Skills: ${def.skills.join(', ')}`,
        `Preferred role: ${def.desired}`,
        'This resume contains no real contact or employment information.'
      ]);
      ensure(await client.from('seeker_profiles').update({ resume_path: resume.path }).eq('user_id', user.id), `Unable to link demo resume for ${def.email}`);
    }
  }
  if (fresh) ensure(await client.from('notifications').insert({
    user_id: user.id,
    kind: 'verification',
    title: def.status === 'approved' ? 'Demo profile ready' : 'Demo credentials awaiting LGU review',
    body: def.status === 'approved' ? 'This sample profile is pre-approved for demonstration only.' : 'The LGU can review the sample documents for this test account.',
    link: '/app?tab=verification'
  }), `Unable to create notification for ${def.email}`);
  return { user, fresh };
}

async function insertJobsAndApplication(verifiedEmployer, verifiedSeeker) {
  const employerId = verifiedEmployer.user.id;
  const seekerId = verifiedSeeker.user.id;
  const jobDefinitions = [
    { title: 'Junior IT Support Associate', category: 'Technology', description: 'Assist internal staff with device setup, troubleshooting and helpdesk requests. This is an entirely fictional vacancy.', requirements: 'Basic computer troubleshooting, communication skills and documentation.', benefits: 'Mentorship, paid training and a collaborative environment.', location: 'Olongapo City, Zambales', work_setup: 'On-site', employment_type: 'Full-time', experience_level: 'Entry level', salary_min: 18000, salary_max: 26000, vacancies: 2, schedule: 'Monday to Friday', status: 'published' },
    { title: 'Junior Data Coordinator', category: 'Administration', description: 'Organize spreadsheets, validate sample records, and support reporting tasks for a fictional local company.', requirements: 'Spreadsheet knowledge, attention to detail and good written communication.', benefits: 'Training, flexible schedule and team mentoring.', location: 'Olongapo City, Zambales', work_setup: 'Hybrid', employment_type: 'Full-time', experience_level: 'Entry level', salary_min: 19000, salary_max: 28000, vacancies: 1, schedule: 'Monday to Friday', status: 'published' },
    { title: 'Customer Service Trainee', category: 'Retail', description: 'A draft vacancy used to demonstrate the LGU job approval queue.', requirements: 'Friendly communication, willingness to learn and basic computer skills.', benefits: 'Training and mentorship.', location: 'Olongapo City, Zambales', work_setup: 'On-site', employment_type: 'Internship', experience_level: 'Entry level', salary_min: 10000, salary_max: 14000, vacancies: 3, schedule: 'Weekdays', status: 'pending' }
  ];
  const created = new Map();
  for (const job of jobDefinitions) {
    const existing = ensure(await client.from('jobs').select('id,status').eq('employer_id', employerId).eq('title', job.title).limit(1), `Unable to inspect job ${job.title}`);
    if (existing?.length) {
      created.set(job.title, existing[0]);
      continue;
    }
    const deadline = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const row = {
      ...job,
      employer_id: employerId,
      company_name: 'Harborview Demo Services',
      deadline,
      screening_questions: 'What relevant experience or transferable skills would you bring?',
      review_note: job.status === 'published' ? 'Prepublished sample data only, not a real LGU approval.' : null,
      published_at: job.status === 'published' ? new Date().toISOString() : null
    };
    const item = ensure(await client.from('jobs').insert(row).select('id,status').single(), `Unable to create job ${job.title}`);
    created.set(job.title, item);
    console.log(`Created demo job: ${job.title} (${job.status})`);
  }
  const appliedJob = created.get('Junior IT Support Associate');
  if (appliedJob && appliedJob.status === 'published') {
    const existing = ensure(await client.from('applications').select('id').eq('seeker_id', seekerId).eq('job_id', appliedJob.id).limit(1), 'Unable to inspect demo application');
    if (!existing?.length) {
      const seeker = ensure(await client.from('seeker_profiles').select('resume_path').eq('user_id', seekerId).single(), 'Unable to load demo resume');
      const application = ensure(await client.from('applications').insert({
        job_id: appliedJob.id,
        seeker_id: seekerId,
        resume_path: seeker.resume_path,
        cover_letter: 'I am interested in this fictional IT support vacancy. This application was generated for a demonstration.',
        screening_response: 'Basic troubleshooting, clear communication and organized documentation.',
        status: 'applied'
      }).select('id').single(), 'Unable to create demo application');
      ensure(await client.from('application_events').insert({ application_id: application.id, actor_id: seekerId, status: 'applied', note: 'Demo application submission' }), 'Unable to add demo application event');
      ensure(await client.from('notifications').insert({user_id:employerId,kind:'application',title:'Demo candidate applied',body:'A sample candidate applied for Junior IT Support Associate.',link:'/app?tab=candidates'}), 'Unable to add sample employer notification');
      console.log('Created one sample application');
    }
  }
  const savedJob = created.get('Junior Data Coordinator');
  if (savedJob && savedJob.status === 'published') ensure(await client.from('saved_jobs').upsert({ user_id: seekerId, job_id: savedJob.id }, { onConflict: 'user_id,job_id' }), 'Unable to create saved job');
}

const created = new Map();
for (const definition of users) {
  const result = await createDemoUser(definition);
  created.set(definition.key, result);
}
await insertJobsAndApplication(created.get('employer-approved'), created.get('seeker-approved'));
console.log('\nDemo accounts created or preserved:');
for (const definition of users) console.log(`${definition.role.padEnd(10)} ${definition.status.padEnd(8)} ${definition.email}`);
console.log('All four use DEMO_ACCOUNT_PASSWORD from your local .env.local file.');
console.log('Emails are confirmed for login; the approved/pending difference refers to LGU verification only.');
console.log('Demo profiles, documents and vacancies are artificial and not valid real-world credentials or opportunities.');
