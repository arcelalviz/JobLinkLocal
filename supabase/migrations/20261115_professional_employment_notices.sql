begin;

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
 values(v_app.seeker_id,'application',
  case p_decision
   when 'rejected' then 'Application outcome: Not selected'
   when 'accepted' then 'Application accepted'
   when 'hired' then 'Hiring confirmation'
   when 'shortlisted' then 'Application shortlisted'
   when 'interviewing' then 'Interview stage update'
   else 'Application under review'
  end,
  case p_decision
   when 'rejected' then 'The employer has decided not to proceed with your application for '||v_title||'.'
   when 'accepted' then 'Your application for '||v_title||' has been accepted. Employment has not yet been confirmed.'
   when 'hired' then 'Your employer has recorded your hiring for '||v_title||'.'
   when 'shortlisted' then 'You have been shortlisted for '||v_title||'.'
   when 'interviewing' then 'Your application for '||v_title||' has moved to the interview stage.'
   else 'Your application for '||v_title||' is under review.'
  end || case when length(trim(coalesce(p_note,''))) > 0 then ' Employer note: '||left(trim(p_note),1500) else '' end,
  '/app?tab=applications');
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
 insert into public.notifications(user_id,kind,title,body,link)
 values(v_emp.seeker_id,'employment','Employment status notice',
  'Your employer has recorded the end of your employment for '||coalesce(v_job_title,'your position')||', effective '||to_char(p_ended_on,'FMMonth DD, YYYY')||'. Employer explanation: '||left(p_note,1800)||'. This platform update does not replace any separately required formal employment notice.',
  '/app?tab=applications');
 insert into public.audit_logs(actor_id,action,target_id,details) values(p_actor,'employment.ended',p_employment,jsonb_build_object('end_date',p_ended_on));
 return jsonb_build_object('seeker_id',v_emp.seeker_id,'job_title',v_job_title,'status','ended');
end;
$$;


commit;
