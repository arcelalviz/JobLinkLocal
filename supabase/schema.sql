create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 role text not null default 'jobseeker' check(role in ('jobseeker','employer','lgu_admin','sys_admin')),
 full_name text not null,
 phone text,
 city text,
 province text,
 bio text,
 avatar_url text,
 lgu_status text not null default 'pending' check(lgu_status in ('pending','approved','rejected','suspended')),
 suspended_from text check(suspended_from in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.seeker_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 education text,
 experience_years integer not null default 0 check(experience_years between 0 and 65),
 skills text[] not null default '{}',
 desired_role text,
 preferred_work_setup text,
 portfolio_url text,
 linkedin_url text,
 resume_path text,
 updated_at timestamptz not null default now()
);

create table public.employer_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 business_name text not null,
 industry text,
 business_type text,
 registration_number text,
 team_size text,
 website text,
 business_description text,
 contact_position text,
 updated_at timestamptz not null default now()
);

create table public.categories (
 id bigint generated always as identity primary key,
 name text not null unique,
 icon text not null default 'briefcase'
);

create table public.jobs (
 id uuid primary key default gen_random_uuid(),
 employer_id uuid not null references public.profiles(id),
 company_name text not null,
 title text not null,
 category text not null,
 description text not null,
 requirements text not null,
 benefits text,
 location text not null,
 work_setup text not null check(work_setup in ('On-site','Remote','Hybrid')),
 employment_type text not null check(employment_type in ('Full-time','Part-time','Contract','Internship','Temporary')),
 experience_level text not null default 'Entry level',
 salary_min integer check(salary_min is null or salary_min >= 0),
 salary_max integer check(salary_max is null or salary_max >= 0),
 vacancies integer not null default 1 check(vacancies between 1 and 10000),
 schedule text,
 deadline date,
 screening_questions text,
 status text not null default 'pending' check(status in ('pending','published','rejected','closed')),
 review_note text,
 reviewed_by uuid references public.profiles(id),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(salary_min is null or salary_max is null or salary_max >= salary_min)
);

create index jobs_public_idx on public.jobs(status, published_at desc);
create index jobs_owner_idx on public.jobs(employer_id, created_at desc);

create table public.saved_jobs (
 user_id uuid not null references public.profiles(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id, job_id)
);

create table public.applications (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id),
 seeker_id uuid not null references public.profiles(id),
 cover_letter text,
 screening_response text,
 resume_path text,
 status text not null default 'applied' check(status in ('applied','reviewing','shortlisted','interviewing','accepted','rejected','hired','employment_ended','withdrawn')),
 employer_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(job_id,seeker_id)
);

create index applications_seeker_idx on public.applications(seeker_id, created_at desc);
create index applications_job_idx on public.applications(job_id, created_at desc);

create table public.application_events (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.applications(id) on delete cascade,
 actor_id uuid references public.profiles(id),
 status text not null,
 note text,
 created_at timestamptz not null default now()
);

create table public.employment_records (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null unique references public.applications(id),
 employer_id uuid not null references public.profiles(id),
 seeker_id uuid not null references public.profiles(id),
 started_on date not null default current_date,
 ended_on date,
 status text not null default 'active' check(status in ('active','ended')),
 hire_note text,
 end_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.verification_submissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('jobseeker','employer')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 statement text,
 reviewer_note text,
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);

create index verification_queue_idx on public.verification_submissions(status, created_at desc);

create table public.verification_documents (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.verification_submissions(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 bucket text not null check(bucket = 'verification-documents'),
 path text not null unique,
 filename text not null,
 media_type text not null,
 bytes integer not null,
 created_at timestamptz not null default now()
);

create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null,
 title text not null,
 body text not null,
 link text,
 read_at timestamptz,
 created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications(user_id, created_at desc);

create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references public.profiles(id),
 action text not null,
 target_id uuid,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create index audit_latest_idx on public.audit_logs(created_at desc);

create table public.email_delivery_logs (
 id uuid primary key default gen_random_uuid(),
 recipient text not null,
 kind text not null,
 status text not null check(status in ('sent','failed','skipped')),
 error_code text,
 created_at timestamptz not null default now()
);

create table public.rate_limits (
 key_hash text not null,
 window_start timestamptz not null,
 count integer not null default 1,
 primary key(key_hash,window_start)
);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
 new.updated_at = now();
 return new;
end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger seeker_updated before update on public.seeker_profiles for each row execute function public.touch_updated_at();
create trigger employer_updated before update on public.employer_profiles for each row execute function public.touch_updated_at();
create trigger jobs_updated before update on public.jobs for each row execute function public.touch_updated_at();
create trigger applications_updated before update on public.applications for each row execute function public.touch_updated_at();
create trigger employment_updated before update on public.employment_records for each row execute function public.touch_updated_at();

create or replace function public.new_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
 v_role text;
 v_full_name text;
begin
 v_role := case when new.raw_user_meta_data->>'role' = 'employer' then 'employer' else 'jobseeker' end;
 v_full_name := left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'New member'),120);
 insert into public.profiles (id,email,role,full_name,phone,city,province)
 values (new.id,coalesce(new.email,''),v_role,v_full_name,left(new.raw_user_meta_data->>'phone',30),left(new.raw_user_meta_data->>'city',100),left(new.raw_user_meta_data->>'province',100));
 if v_role = 'employer' then
  insert into public.employer_profiles (user_id,business_name,industry,business_type,registration_number,team_size,website,business_description,contact_position)
  values (new.id,left(coalesce(nullif(new.raw_user_meta_data->>'business_name',''),'Unnamed business'),160),left(new.raw_user_meta_data->>'industry',120),left(new.raw_user_meta_data->>'business_type',90),left(new.raw_user_meta_data->>'registration_number',100),left(new.raw_user_meta_data->>'team_size',40),left(new.raw_user_meta_data->>'website',255),left(new.raw_user_meta_data->>'business_description',1200),left(new.raw_user_meta_data->>'contact_position',100));
 else
  insert into public.seeker_profiles (user_id,education,experience_years,skills,desired_role,preferred_work_setup)
  values (new.id,left(new.raw_user_meta_data->>'education',100),greatest(0,least(65,coalesce(nullif(new.raw_user_meta_data->>'experience_years','')::integer,0))),string_to_array(coalesce(new.raw_user_meta_data->>'skills',''),','),left(new.raw_user_meta_data->>'desired_role',120),left(new.raw_user_meta_data->>'preferred_work_setup',40));
 end if;
 return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_auth_user();

create or replace function public.check_rate_limit(p_key_hash text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 v_start timestamptz;
 v_count integer;
begin
 if p_limit < 1 or p_window_seconds < 1 or length(p_key_hash) > 128 then return false; end if;
 v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
 insert into public.rate_limits(key_hash,window_start,count) values(p_key_hash,v_start,1)
 on conflict(key_hash,window_start) do update set count=public.rate_limits.count+1
 returning count into v_count;
 return v_count <= p_limit;
end;
$$;

create or replace function public.review_verification(p_actor uuid,p_submission uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_sub public.verification_submissions%rowtype;
 v_role text;
begin
 select role into v_role from public.profiles where id=p_actor and lgu_status='approved';
 if v_role <> 'lgu_admin' or v_role is null then raise exception 'Not authorized'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 if p_decision = 'rejected' and length(trim(coalesce(p_note,''))) < 4 then raise exception 'A review note is required'; end if;
 select * into v_sub from public.verification_submissions where id=p_submission for update;
 if not found or v_sub.status <> 'pending' then raise exception 'Review request unavailable'; end if;
 if exists (select 1 from public.profiles where id=v_sub.user_id and lgu_status='suspended') then raise exception 'The account is suspended'; end if;
 if not exists (select 1 from public.verification_documents where submission_id=p_submission) then raise exception 'Documents are missing'; end if;
 update public.verification_submissions set status=p_decision,reviewer_note=left(p_note,1200),reviewed_by=p_actor,reviewed_at=now() where id=p_submission;
 update public.profiles set lgu_status=p_decision where id=v_sub.user_id and lgu_status <> 'suspended';
 insert into public.notifications(user_id,kind,title,body,link)
 values(v_sub.user_id,'verification','Account review ' || p_decision,
  case when p_decision='approved' then 'Your documents were approved. Your account features are now available.' else 'Your documents need attention. ' || left(coalesce(p_note,''),250) end,'/app?tab=verification');
 insert into public.audit_logs(actor_id,action,target_id,details) values(p_actor,'verification.'||p_decision,v_sub.user_id,jsonb_build_object('submission',p_submission));
 return jsonb_build_object('user_id',v_sub.user_id,'decision',p_decision);
end;
$$;

create or replace function public.review_job(p_actor uuid,p_job uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_job public.jobs%rowtype;
 v_role text;
begin
 select role into v_role from public.profiles where id=p_actor and lgu_status='approved';
 if v_role <> 'lgu_admin' or v_role is null then raise exception 'Not authorized'; end if;
 if p_decision not in ('published','rejected') then raise exception 'Invalid decision'; end if;
 if p_decision='rejected' and length(trim(coalesce(p_note,''))) < 4 then raise exception 'Rejection note is required'; end if;
 select * into v_job from public.jobs where id=p_job for update;
 if not found or v_job.status <> 'pending' then raise exception 'Job no longer pending'; end if;
 if not exists (select 1 from public.profiles where id=v_job.employer_id and lgu_status='approved' and role='employer') then raise exception 'Employer is not approved'; end if;
 update public.jobs set status=p_decision,review_note=left(p_note,1200),reviewed_by=p_actor,published_at=case when p_decision='published' then now() else null end where id=p_job;
 insert into public.notifications(user_id,kind,title,body,link)
 values(v_job.employer_id,'job','Job posting ' || case when p_decision='published' then 'approved' else 'returned' end,
  v_job.title || case when p_decision='published' then ' is now publicly visible.' else ': ' || left(coalesce(p_note,''),250) end,'/app?tab=jobs');
 insert into public.audit_logs(actor_id,action,target_id,details) values(p_actor,'job.'||p_decision,p_job,'{}'::jsonb);
 return jsonb_build_object('employer_id',v_job.employer_id,'job_title',v_job.title,'decision',p_decision);
end;
$$;

create or replace function public.record_application_decision(p_actor uuid,p_application uuid,p_decision text,p_note text,p_start_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_app public.applications%rowtype;
 v_owner uuid;
 v_title text;
begin
 if p_decision not in ('reviewing','shortlisted','interviewing','accepted','rejected','hired') then raise exception 'Invalid application status'; end if;
 select * into v_app from public.applications where id=p_application for update;
 if not found then raise exception 'Application unavailable'; end if;
 select employer_id,title into v_owner,v_title from public.jobs where id=v_app.job_id;
 if v_owner is distinct from p_actor or not exists(select 1 from public.profiles where id=p_actor and role='employer' and lgu_status='approved') then raise exception 'Not authorized'; end if;
 if v_app.status in ('rejected','hired','employment_ended','withdrawn') then raise exception 'Decision already finalized'; end if;
 if p_decision in ('accepted','hired','rejected') and length(trim(coalesce(p_note,''))) < 4 then raise exception 'An explanatory note is required'; end if;
 update public.applications set status=p_decision,employer_note=left(p_note,1500) where id=p_application;
 insert into public.application_events(application_id,actor_id,status,note) values(p_application,p_actor,p_decision,left(p_note,1500));
 if p_decision='hired' then
  insert into public.employment_records(application_id,employer_id,seeker_id,started_on,hire_note)
  values(p_application,p_actor,v_app.seeker_id,coalesce(p_start_date,current_date),left(p_note,1500));
 end if;
 insert into public.notifications(user_id,kind,title,body,link)
 values(v_app.seeker_id,'application',case when p_decision='hired' then 'You have been hired' when p_decision='accepted' then 'Application accepted' else 'Application update: '||p_decision end,
  v_title||'. '||left(coalesce(nullif(p_note,''),'Your status has changed.'),250),'/app?tab=applications');
 insert into public.audit_logs(actor_id,action,target_id,details) values(p_actor,'application.'||p_decision,p_application,'{}'::jsonb);
 return jsonb_build_object('seeker_id',v_app.seeker_id,'status',p_decision,'job_title',v_title);
end;
$$;

create or replace function public.end_employment(p_actor uuid,p_employment uuid,p_ended_on date,p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_emp public.employment_records%rowtype;
 v_job_title text;
begin
 if length(trim(coalesce(p_note,''))) < 8 then raise exception 'A clear employment-ending note is required'; end if;
 select * into v_emp from public.employment_records where id=p_employment for update;
 if not found or v_emp.status <> 'active' then raise exception 'Employment record unavailable'; end if;
 if v_emp.employer_id is distinct from p_actor or not exists(select 1 from public.profiles where id=p_actor and role='employer' and lgu_status='approved') then raise exception 'Not authorized'; end if;
 if p_ended_on is null or p_ended_on < v_emp.started_on or p_ended_on > current_date + 30 then raise exception 'Invalid end date'; end if;
 update public.employment_records set status='ended',ended_on=p_ended_on,end_note=left(p_note,1800) where id=p_employment;
 update public.applications set status='employment_ended',employer_note=left(p_note,1500) where id=v_emp.application_id;
 insert into public.application_events(application_id,actor_id,status,note) values(v_emp.application_id,p_actor,'employment_ended',left(p_note,1500));
 select j.title into v_job_title from public.jobs j join public.applications a on a.job_id=j.id where a.id=v_emp.application_id;
 insert into public.notifications(user_id,kind,title,body,link) values(v_emp.seeker_id,'employment','Employment status updated',coalesce(v_job_title,'Your position')||': '||left(p_note,250),'/app?tab=applications');
 insert into public.audit_logs(actor_id,action,target_id,details) values(p_actor,'employment.ended',p_employment,jsonb_build_object('end_date',p_ended_on));
 return jsonb_build_object('seeker_id',v_emp.seeker_id,'job_title',v_job_title,'status','ended');
end;
$$;

create or replace function public.set_account_status(p_actor uuid,p_target uuid,p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_role text;
 v_target_role text;
 v_current_status text;
begin
 select role into v_role from public.profiles where id=p_actor and lgu_status='approved';
 if v_role <> 'sys_admin' or v_role is null then raise exception 'Not authorized'; end if;
 if p_target=p_actor then raise exception 'You cannot change your own account status'; end if;
 if p_status not in ('restore','suspended') then raise exception 'Invalid status'; end if;
 select role,lgu_status into v_target_role,v_current_status from public.profiles where id=p_target for update;
 if v_target_role is null then raise exception 'Account unavailable'; end if;
 if v_target_role in ('lgu_admin','sys_admin') then raise exception 'Administrator account changes require manual oversight'; end if;
 if p_status='restore' and v_current_status<>'suspended' then raise exception 'Account is not suspended'; end if;
 if p_status='suspended' and v_current_status='suspended' then raise exception 'Account is already suspended'; end if;
 if p_status='suspended' then
  update public.profiles set suspended_from=lgu_status,lgu_status='suspended' where id=p_target and lgu_status<>'suspended';
 else
  update public.profiles set lgu_status=coalesce(suspended_from,'pending'),suspended_from=null where id=p_target and lgu_status='suspended';
 end if;
 insert into public.notifications(user_id,kind,title,body,link) values(p_target,'account','Account '||p_status,'Your account status was changed by the system administrator.','/app?tab=profile');
 insert into public.audit_logs(actor_id,action,target_id,details) values(p_actor,'account.'||p_status,p_target,'{}'::jsonb);
 return jsonb_build_object('user_id',p_target,'status',(select lgu_status from public.profiles where id=p_target));
end;
$$;

alter table public.profiles enable row level security;
alter table public.seeker_profiles enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.jobs enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.employment_records enable row level security;
alter table public.verification_submissions enable row level security;
alter table public.verification_documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.email_delivery_logs enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.profiles,public.seeker_profiles,public.employer_profiles,public.categories,public.jobs,public.saved_jobs,public.applications,public.application_events,public.employment_records,public.verification_submissions,public.verification_documents,public.notifications,public.audit_logs,public.email_delivery_logs,public.rate_limits from anon,authenticated;
grant select on public.categories to anon,authenticated;
grant select on public.jobs to anon,authenticated;
create policy categories_are_visible on public.categories for select to anon,authenticated using (true);
create policy public_approved_jobs on public.jobs for select to anon,authenticated using (status='published');
revoke execute on function public.check_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke execute on function public.review_verification(uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.review_job(uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.record_application_decision(uuid,uuid,text,text,date) from public,anon,authenticated;
revoke execute on function public.end_employment(uuid,uuid,date,text) from public,anon,authenticated;
revoke execute on function public.set_account_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.check_rate_limit(text,integer,integer) to service_role;
grant execute on function public.review_verification(uuid,uuid,text,text) to service_role;
grant execute on function public.review_job(uuid,uuid,text,text) to service_role;
grant execute on function public.record_application_decision(uuid,uuid,text,text,date) to service_role;
grant execute on function public.end_employment(uuid,uuid,date,text) to service_role;
grant execute on function public.set_account_status(uuid,uuid,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('verification-documents','verification-documents',false,5242880,array['application/pdf','image/jpeg','image/png']),
 ('resumes','resumes',false,5242880,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.categories(name,icon) values
 ('Technology','code'),('Healthcare','heart'),('Education','book'),('Retail','store'),('Hospitality','coffee'),('Construction','building'),('Transport','truck'),('Administration','folder'),('Creative','palette'),('Finance','chart'),('Engineering','wrench'),('Other','briefcase')
on conflict(name) do nothing;
