export type Role = 'jobseeker' | 'employer' | 'lgu_admin' | 'sys_admin';
export type Approval = 'pending' | 'approved' | 'rejected' | 'suspended';
export type Profile = { id:string; email:string; role:Role; full_name:string; phone:string|null; city:string|null; province:string|null; bio:string|null; lgu_status:Approval; avatar_url:string|null; created_at:string; seeker_profiles?:any; employer_profiles?:any };
export type Job = { id:string; employer_id:string; title:string; company_name:string; category:string; description:string; requirements:string; benefits:string|null; location:string; work_setup:string; employment_type:string; experience_level:string; salary_min:number|null; salary_max:number|null; vacancies:number; schedule:string|null; deadline:string|null; screening_questions:string|null; status:'pending'|'published'|'rejected'|'closed'; created_at:string; published_at:string|null; review_note:string|null };
export type Application = { id:string; job_id:string; seeker_id:string; cover_letter:string|null; resume_path:string|null; status:string; employer_note:string|null; created_at:string; updated_at:string; jobs?:Job; seeker?:Profile };
export type Notification = { id:string; user_id:string; title:string; body:string; kind:string; read_at:string|null; created_at:string; link:string|null };
export type ApiResponse<T=any> = { data?:T; message?:string; error?:string };
