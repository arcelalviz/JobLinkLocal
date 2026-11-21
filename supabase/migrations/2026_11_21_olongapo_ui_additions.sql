begin;
alter table public.profiles add column if not exists barangay text;
alter table public.profiles add column if not exists address_line text;
alter table public.jobs add column if not exists barangay text;
alter table public.jobs add column if not exists address_line text;
alter table public.jobs add column if not exists salary_visible boolean not null default true;
alter table public.verification_documents add column if not exists document_type text not null default 'supporting';
create or replace function public.new_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
 v_role text;
 v_full_name text;
begin
 v_role := case when new.raw_user_meta_data->>'role' = 'employer' then 'employer' else 'jobseeker' end;
 v_full_name := left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'New member'),120);
 insert into public.profiles (id,email,role,full_name,phone,city,province,barangay,address_line)
 values (new.id,coalesce(new.email,''),v_role,v_full_name,left(new.raw_user_meta_data->>'phone',30),left(new.raw_user_meta_data->>'city',100),left(new.raw_user_meta_data->>'province',100),left(new.raw_user_meta_data->>'barangay',80),left(new.raw_user_meta_data->>'address_line',180));
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

commit;
