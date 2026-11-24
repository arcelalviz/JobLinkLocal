-- ADDITIVE migration. Apply after earlier schema/migrations. Does not delete accounts or jobs.
alter table public.profiles add column if not exists avatar_url text;
create table if not exists public.resume_removal_requests (
 id uuid primary key default gen_random_uuid(),
 seeker_id uuid not null references public.profiles(id) on delete cascade,
 resume_path text not null,
 reason text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 decision_note text
);
create unique index if not exists resume_removal_one_pending on public.resume_removal_requests(seeker_id) where status='pending';
create index if not exists resume_removal_pending_idx on public.resume_removal_requests(status,created_at);
alter table public.resume_removal_requests enable row level security;
revoke all on public.resume_removal_requests from anon, authenticated;
grant select,insert,update,delete on public.resume_removal_requests to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('avatars','avatars',false,2097152,array['image/png','image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Existing profile records and private storage objects are retained.

-- Atomic LGU review for resume-removal requests. Service-role-only execution.
create or replace function public.review_resume_removal(p_actor uuid,p_request uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_req public.resume_removal_requests%rowtype;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='lgu_admin' and lgu_status='approved') then
  raise exception 'Only an approved LGU administrator can review resume removals';
 end if;
 if p_decision not in ('approved','rejected') or length(trim(coalesce(p_note,'')))<8 then
  raise exception 'Valid review decision and explanation required';
 end if;
 select * into v_req from public.resume_removal_requests where id=p_request for update;
 if v_req.id is null or v_req.status<>'pending' then raise exception 'Request is no longer pending'; end if;
 if p_decision='approved' then
  if not exists (select 1 from public.seeker_profiles where user_id=v_req.seeker_id and resume_path=v_req.resume_path) then
   raise exception 'The applicant replaced the resume. A new removal request is needed';
  end if;
  update public.seeker_profiles set resume_path=null,updated_at=now() where user_id=v_req.seeker_id and resume_path=v_req.resume_path;
  update public.profiles set lgu_status='pending',updated_at=now() where id=v_req.seeker_id and lgu_status='approved';
 end if;
 update public.resume_removal_requests set status=p_decision,reviewed_by=p_actor,reviewed_at=now(),decision_note=p_note where id=p_request;
 return jsonb_build_object('request_id',p_request,'decision',p_decision,'seeker_id',v_req.seeker_id);
end;
$$;
revoke execute on function public.review_resume_removal(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_resume_removal(uuid,uuid,text,text) to service_role;
