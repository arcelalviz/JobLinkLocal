import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/admin';
import { userClient } from '@/lib/supabase/server';
import { ApiError, currentUser, requireSameOrigin, checkLimit, readJson, dbError, recordAudit, notify, ok } from '@/lib/guards';
import { sendSystemEmail, emailPerson, applicationDecisionNotice, employmentStatusNotice } from '@/lib/mail';
import { uploadPrivate } from '@/lib/uploads';
import { signUpSchema, jobSchema, applicationSchema, decisionSchema, validated } from '@/lib/validators';
import { reportData, csvReport, pdfReport } from '@/lib/report';

const db=()=>adminClient();
const isUuid=(id:string)=>z.uuid().safeParse(id).success;
const idOrFail=(id:string)=>{ if(!isUuid(id)) throw new ApiError(400,'Invalid record identifier.'); return id; };
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const take=(v:string,max:number)=>v.slice(0,max);
function fail(message:string,status=400):never { throw new ApiError(status,message); }
const parse=<T>(schema:z.ZodType<T>,body:unknown):T=>{
 try{return validated(schema,body);}catch(e){throw new ApiError(400,e instanceof Error?e.message:'Invalid form data.');}
};
const routeIs=(route:string[],...parts:string[])=>route.join('/')===parts.join('/');
const findProfile=async(id:string)=>{
 const {data,error}=await db().from('profiles').select('id,email,role,full_name,phone,city,province,bio,lgu_status,created_at,seeker_profiles(*),employer_profiles(*)').eq('id',id).single();
 dbError(error,'Profile unavailable.');
 return data;
};

export async function api(req:NextRequest,parts:string[]) {
 const method=req.method;
 const url=req.nextUrl;
 const q=(s:string)=>url.searchParams.get(s);
 if(!['GET','POST','PATCH','DELETE'].includes(method)) fail('Method not allowed.',405);
 if(method!=='GET') requireSameOrigin(req);

 if(routeIs(parts,'health')&&method==='GET') {
   const {error}=await db().from('categories').select('id').limit(1);
   if(error) fail('Database connection or schema is unavailable.',503);
   return ok({status:'ok',database:'connected',transport:'Supabase HTTPS'});
 }

 if(routeIs(parts,'auth','signup')&&method==='POST') {
   await checkLimit(req,'signup',6,3600);
   const data=parse(signUpSchema,await readJson(req));
   const client=await userClient();
   const site=process.env.NEXT_PUBLIC_SITE_URL||url.origin;
   const {data:auth,error}=await client.auth.signUp({email:data.email.toLowerCase(),password:data.password,
     options:{emailRedirectTo:`${site}/auth/confirm`,data:{...data,password:undefined,email:undefined}}});
   if(error) fail(error.message,400);
   return ok({message:'Check your inbox for the confirmation link.',requires_confirmation:!auth.session},201);
 }

 if(routeIs(parts,'auth','login')&&method==='POST') {
   await checkLimit(req,'login',18,900);
   const body=await readJson(req);
   const email=z.email().safeParse(body.email);
   if(!email.success||typeof body.password!=='string') fail('Enter a valid email and password.');
   const client=await userClient();
   const {data,error}=await client.auth.signInWithPassword({email:email.data,password:body.password});
   if(error||!data.user) fail('Invalid credentials or unconfirmed email.',401);
   const {data:profile}=await db().from('profiles').select('role,lgu_status,full_name').eq('id',data.user.id).maybeSingle();
   if(!profile || profile.lgu_status==='suspended'){
      await client.auth.signOut();
      fail('This account cannot sign in. Contact support.',403);
   }
   return ok({role:profile.role,full_name:profile.full_name});
 }


 if(routeIs(parts,'auth','mfa')&&method==='GET') {
   const {auth}=await currentUser(['lgu_admin','sys_admin'],false,true);
   const [levels,factors]=await Promise.all([auth.auth.mfa.getAuthenticatorAssuranceLevel(),auth.auth.mfa.listFactors()]);
   if(levels.error||factors.error) fail('Could not check administrator verification status.',503);
   return ok({verified:levels.data.currentLevel==='aal2',factors:(factors.data.totp||[]).map(f=>({id:f.id,status:f.status,friendly_name:f.friendly_name}))});
 }

 if(routeIs(parts,'auth','mfa')&&method==='POST') {
   await checkLimit(req,'admin_mfa',15,900);
   const {auth}=await currentUser(['lgu_admin','sys_admin'],false,true);
   const body=await readJson(req);
   if(body.action==='enroll') {
     const enrolled=await auth.auth.mfa.enroll({factorType:'totp',friendlyName:'JobLinkLocal Administrator'});
     if(enrolled.error||!enrolled.data?.totp) fail(enrolled.error?.message||'Could not create authenticator enrollment.');
     return ok({factorId:enrolled.data.id,qr_code:enrolled.data.totp.qr_code,secret:enrolled.data.totp.secret});
   }
   if(body.action==='verify') {
     if(typeof body.factorId!=='string'||!/^\d{6}$/.test(String(body.code||''))) fail('Enter a valid six-digit authenticator code.');
     const challenge=await auth.auth.mfa.challenge({factorId:body.factorId});
     if(challenge.error||!challenge.data) fail('Unable to start authenticator verification.');
     const result=await auth.auth.mfa.verify({factorId:body.factorId,challengeId:challenge.data.id,code:body.code});
     if(result.error) fail('The authenticator code was not accepted.');
     return ok({verified:true,message:'Administrator verification completed.'});
   }
   fail('Invalid verification action.');
 }

 if(routeIs(parts,'auth','logout')&&method==='POST') {
   const client=await userClient();
   await client.auth.signOut();
   return ok({message:'Signed out.'});
 }

 if(routeIs(parts,'auth','reset')&&method==='POST') {
   await checkLimit(req,'reset',5,3600);
   const body=await readJson(req);
   if(!z.email().safeParse(body.email).success) fail('Enter a valid email address.');
   const client=await userClient();
   await client.auth.resetPasswordForEmail(body.email,{redirectTo:`${process.env.NEXT_PUBLIC_SITE_URL||url.origin}/auth/confirm?next=/auth/reset`});
   return ok({message:'If the address exists, you will receive password recovery instructions.'});
 }

 if(routeIs(parts,'auth','password')&&method==='POST') {
   const {user,auth}=await currentUser();
   const body=await readJson(req);
   if(typeof body.password!=='string'||body.password.length<12||!/[A-Z]/.test(body.password)||!/[a-z]/.test(body.password)||!/[0-9]/.test(body.password)) fail('Choose a password with at least 12 characters, upper and lowercase letters, and a number.');
   const {error}=await auth.auth.updateUser({password:body.password});
   if(error) fail('Could not update password. Please try again.');
   await recordAudit(user.id,'auth.password.updated');
   return ok({message:'Password updated.'});
 }

 if(routeIs(parts,'auth','resend')&&method==='POST') {
   await checkLimit(req,'resend',5,3600);
   const body=await readJson(req);
   if(!z.email().safeParse(body.email).success) fail('Enter a valid email address.');
   const client=await userClient();
   await client.auth.resend({type:'signup',email:body.email,options:{emailRedirectTo:`${process.env.NEXT_PUBLIC_SITE_URL||url.origin}/auth/confirm`}});
   return ok({message:'If verification is pending, a new email has been requested.'});
 }

 if(routeIs(parts,'me')&&method==='GET') {
   const {user}=await currentUser(undefined,false,true);
   const profile=await findProfile(user.id);
   return ok({...profile,email_confirmed:!!user.email_confirmed_at});
 }

 if(routeIs(parts,'profile')&&method==='PATCH') {
   const {user,profile}=await currentUser();
   const body=await readJson(req);
   const allowed=['full_name','phone','city','province','bio'];
   const patch:Record<string,string|null>={};
   for(const key of allowed) if(typeof body[key]==='string') {
     const val=body[key].trim();
     const limit=key==='bio'?1200:120;
     if((key==='full_name'&&val.length<2)||val.length>limit) fail(`Invalid ${key.replace('_',' ')}.`);
     patch[key]=val;
   }
   if(Object.keys(patch).length) { const {error}=await db().from('profiles').update(patch).eq('id',user.id); dbError(error); }
   if(profile.role==='jobseeker'){
     const extras:Record<string,unknown>={};
     for(const key of ['education','desired_role','preferred_work_setup','portfolio_url','linkedin_url']) if(typeof body[key]==='string') extras[key]=take(body[key].trim(),255);
     if(typeof body.experience_years==='number' && body.experience_years>=0 && body.experience_years<=65) extras.experience_years=Math.floor(body.experience_years);
     if(Array.isArray(body.skills)) extras.skills=body.skills.filter((s:unknown)=>typeof s==='string').slice(0,25).map((s:string)=>take(s.trim(),40));
     if(Object.keys(extras).length){const {error}=await db().from('seeker_profiles').update(extras).eq('user_id',user.id);dbError(error);}
   }
   if(profile.role==='employer'){
     const extras:Record<string,string>={};
     for(const key of ['business_name','industry','business_type','registration_number','team_size','website','business_description','contact_position']) if(typeof body[key]==='string') extras[key]=take(body[key].trim(),key==='business_description'?1200:255);
     const {data:before}=await db().from('employer_profiles').select('business_name,registration_number').eq('user_id',user.id).single();
     const sensitiveChange=(extras.business_name!==undefined&&extras.business_name!==before?.business_name)||(extras.registration_number!==undefined&&extras.registration_number!==(before?.registration_number||''));
     if(Object.keys(extras).length){
       const {error}=await db().from('employer_profiles').update(extras).eq('user_id',user.id);dbError(error);
       if(sensitiveChange && profile.lgu_status==='approved'){
         const {error:statusError}=await db().from('profiles').update({lgu_status:'pending'}).eq('id',user.id);dbError(statusError);
         await notify(user.id,'verification','New verification required','Your business identity details changed. Please resubmit documents.','/app?tab=verification');
       }
     }
   }
   await recordAudit(user.id,'profile.updated');
   return ok(await findProfile(user.id));
 }

 if(routeIs(parts,'jobs')&&method==='GET') {
   let query=db().from('jobs').select('id,employer_id,company_name,title,category,description,requirements,benefits,location,work_setup,employment_type,experience_level,salary_min,salary_max,vacancies,schedule,deadline,screening_questions,status,published_at,created_at').eq('status','published').order('published_at',{ascending:false}).limit(60);
   const text=take(str(q('q')),80);
   if(text) query=query.ilike('title',`%${text.replace(/[%_]/g,'\\$&')}%`);
   if(q('category')&&q('category')!=='All') query=query.eq('category',take(str(q('category')),80));
   if(q('type')&&q('type')!=='All') query=query.eq('employment_type',take(str(q('type')),40));
   if(q('setup')&&q('setup')!=='All') query=query.eq('work_setup',take(str(q('setup')),40));
   const {data,error}=await query;
   dbError(error,'Unable to load jobs.');
   return ok(data||[]);
 }

 if(parts[0]==='jobs'&&parts.length===2&&method==='GET') {
   const id=idOrFail(parts[1]);
   const {data,error}=await db().from('jobs').select('*').eq('id',id).maybeSingle();
   dbError(error);
   if(!data) fail('Job not found.',404);
   if(data.status!=='published'){
     const {user,profile}=await currentUser();
     if(data.employer_id!==user.id&&!['lgu_admin','sys_admin'].includes(profile.role)) fail('Job unavailable.',404);
   }
   return ok(data);
 }

 if(routeIs(parts,'jobs')&&method==='POST') {
   const {user}=await currentUser(['employer'],true);
   const job=parse(jobSchema,await readJson(req));
   const {data:employer,error:empError}=await db().from('employer_profiles').select('business_name').eq('user_id',user.id).single();
   dbError(empError,'Employer profile unavailable.');
   const {data,error}=await db().from('jobs').insert({...job,company_name:employer!.business_name,employer_id:user.id,status:'pending',deadline:job.deadline||null}).select('id,title,status').single();
   dbError(error,'Job submission failed.');
   await recordAudit(user.id,'job.created',data!.id);
   return ok({job:data,message:'Job sent to the LGU for approval.'},201);
 }

 if(parts[0]==='jobs'&&parts.length===2&&method==='PATCH') {
   const {user}=await currentUser(['employer'],true);
   const id=idOrFail(parts[1]);
   const {data:existing}=await db().from('jobs').select('status,employer_id').eq('id',id).maybeSingle();
   if(!existing||existing.employer_id!==user.id) fail('Job unavailable.',404);
   const body=await readJson(req);
   if(body.action==='close') {
     if(!['published','pending'].includes(existing.status)) fail('This job cannot be closed.');
     const {error}=await db().from('jobs').update({status:'closed'}).eq('id',id);dbError(error);
     await recordAudit(user.id,'job.closed',id);
     return ok({message:'Job closed.'});
   }
   if(!['pending','rejected'].includes(existing.status)) fail('Published jobs must be closed before replacing them.');
   const job=parse(jobSchema,body);
   const {error}=await db().from('jobs').update({...job,status:'pending',review_note:null,reviewed_by:null,deadline:job.deadline||null}).eq('id',id);dbError(error);
   await recordAudit(user.id,'job.resubmitted',id);
   return ok({message:'Job submitted for a new LGU review.'});
 }

 if(routeIs(parts,'verification')&&method==='GET') {
   const {user}=await currentUser();
   const {data,error}=await db().from('verification_submissions').select('*,verification_documents(id,filename,media_type,bytes)').eq('user_id',user.id).order('created_at',{ascending:false}).limit(10);
   dbError(error,'Unable to load verification records.');
   return ok(data||[]);
 }

 if(routeIs(parts,'verification')&&method==='POST') {
   const {user,profile}=await currentUser(['jobseeker','employer']);
   if(profile.lgu_status==='approved') fail('This account is already LGU-approved.');
   const {data:existing}=await db().from('verification_submissions').select('id').eq('user_id',user.id).eq('status','pending').limit(1);
   if(existing?.length) fail('Your previous documents are already awaiting review.',409);
   if(Number(req.headers.get('content-length')||0)>18*1024*1024)fail('Upload size exceeds the allowed limit.',413);
   const form=await req.formData();
   const files=form.getAll('documents').filter((file):file is File=>file instanceof File);
   if(files.length<1||files.length>3) fail('Provide one to three verification documents.');
   const statement=take(str(form.get('statement')),1200);
   const {data:sub,error:subError}=await db().from('verification_submissions').insert({user_id:user.id,kind:profile.role,statement}).select('id').single();
   dbError(subError,'Could not open a verification request.');
   const uploaded:string[]=[];
   try {
     for(const file of files){
       const item=await uploadPrivate('verification-documents',user.id,file);
       uploaded.push(item.path);
       const {error}=await db().from('verification_documents').insert({submission_id:sub!.id,owner_id:user.id,bucket:'verification-documents',path:item.path,filename:item.filename,media_type:item.mime,bytes:item.bytes});
       dbError(error,'Could not save document metadata.');
     }
     const {error:statusError}=await db().from('profiles').update({lgu_status:'pending'}).eq('id',user.id);
     dbError(statusError);
   } catch(error) {
     if(uploaded.length) await db().storage.from('verification-documents').remove(uploaded);
     await db().from('verification_submissions').delete().eq('id',sub!.id);
     throw error;
   }
   await recordAudit(user.id,'verification.submitted',sub!.id);
   return ok({message:'Documents submitted. The LGU will review them.',submission_id:sub!.id},201);
 }

 if(routeIs(parts,'resume')&&method==='POST') {
   const {user}=await currentUser(['jobseeker']);
   if(Number(req.headers.get('content-length')||0)>6*1024*1024)fail('Resume exceeds the upload limit.',413);
   const form=await req.formData();
   const file=form.get('resume');
   if(!(file instanceof File)) fail('Select your resume PDF.');
   const item=await uploadPrivate('resumes',user.id,file,true);
   const {data:old}=await db().from('seeker_profiles').select('resume_path').eq('user_id',user.id).single();
   const {error}=await db().from('seeker_profiles').update({resume_path:item.path}).eq('user_id',user.id);
   if(error){await db().storage.from('resumes').remove([item.path]);dbError(error);}
   if(old?.resume_path){
     const {count}=await db().from('applications').select('id',{count:'exact',head:true}).eq('resume_path',old.resume_path);
     if(!count) await db().storage.from('resumes').remove([old.resume_path]);
   }
   return ok({path:item.path,message:'Resume uploaded securely.'});
 }

 if(parts[0]==='files'&&parts[1]==='document'&&parts[2]&&method==='GET') {
   const {user,profile}=await currentUser();
   const {data:doc,error}=await db().from('verification_documents').select('*').eq('id',idOrFail(parts[2])).maybeSingle();
   dbError(error);
   if(!doc) fail('File unavailable.',404);
   if(doc.owner_id!==user.id && !(profile.role==='lgu_admin' && profile.lgu_status==='approved')) fail('Not authorized.',403);
   const {data,error:storageError}=await db().storage.from('verification-documents').download(doc.path);
   if(storageError||!data) fail('Document could not be downloaded.',404);
   return new NextResponse(await data.arrayBuffer(),{headers:{'Content-Type':doc.media_type,'Content-Disposition':`attachment; filename="document-${doc.id}.${doc.media_type==='application/pdf'?'pdf':doc.media_type==='image/png'?'png':'jpg'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }

 if(routeIs(parts,'files','resume')&&method==='GET') {
   const {user,profile}=await currentUser();
   const applicationId=str(q('application'));
   let path:string;
   if(applicationId) {
     idOrFail(applicationId);
     const {data:application,error:applicationError}=await db().from('applications').select('id,seeker_id,job_id,resume_path').eq('id',applicationId).maybeSingle();
     dbError(applicationError,'Could not load the application.');
     if(!application||!application.resume_path) fail('No resume was attached to this application.',404);
     if(application.seeker_id!==user.id) {
       if(profile.role!=='employer'||profile.lgu_status!=='approved') fail('Not authorized.',403);
       const {data:job,error:jobError}=await db().from('jobs').select('id').eq('id',application.job_id).eq('employer_id',user.id).maybeSingle();
       dbError(jobError,'Could not verify the employer.');
       if(!job) fail('Not authorized.',403);
     }
     path=application.resume_path;
   } else {
     const requestedPath=str(q('path'));
     if(!/^[-a-f0-9]{36}\/(?:[-a-f0-9]{36}|joblinklocal-demo\/sample-resume)\.pdf$/i.test(requestedPath)) fail('Invalid resume reference.');
     const owner=requestedPath.split('/')[0];
     let allowed=owner===user.id;
     if(!allowed&&profile.role==='employer'&&profile.lgu_status==='approved') {
       const {data:apps,error:appsError}=await db().from('applications').select('job_id').eq('seeker_id',owner).eq('resume_path',requestedPath);
       dbError(appsError,'Could not verify the application.');
       if(apps?.length){
         const {count,error:jobsError}=await db().from('jobs').select('id',{count:'exact',head:true}).eq('employer_id',user.id).in('id',apps.map((x:any)=>x.job_id));
         dbError(jobsError,'Could not verify the employer.');
         allowed=!!count;
       }
     }
     if(!allowed) fail('Not authorized.',403);
     path=requestedPath;
   }
   const {data,error}=await db().storage.from('resumes').download(path);
   if(error||!data) fail('The attached resume is unavailable. Ask the candidate to check their uploaded file.',404);
   return new NextResponse(await data.arrayBuffer(),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="resume.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }

 if(routeIs(parts,'saved')&&method==='GET') {
   const {user}=await currentUser(['jobseeker']);
   const {data,error}=await db().from('saved_jobs').select('job_id,created_at,jobs(*)').eq('user_id',user.id).order('created_at',{ascending:false});
   dbError(error);
   return ok(data||[]);
 }

 if(routeIs(parts,'saved')&&method==='POST') {
   const {user}=await currentUser(['jobseeker']);
   const body=await readJson(req);
   const jobId=idOrFail(body.job_id);
   const {data:job}=await db().from('jobs').select('id').eq('id',jobId).eq('status','published').maybeSingle();
   if(!job) fail('Job unavailable.',404);
   if(body.remove===true){
     const {error}=await db().from('saved_jobs').delete().eq('user_id',user.id).eq('job_id',jobId);dbError(error);
     return ok({saved:false});
   }
   const {error}=await db().from('saved_jobs').upsert({user_id:user.id,job_id:jobId},{onConflict:'user_id,job_id'});
   dbError(error);
   return ok({saved:true});
 }

 if(routeIs(parts,'applications')&&method==='GET') {
   const {user}=await currentUser(['jobseeker']);
   const {data,error}=await db().from('applications').select('*,jobs(id,title,company_name,location,employment_type,work_setup),employment_records(id,status,started_on,ended_on,hire_note,end_note),application_events(id,status,note,created_at)').eq('seeker_id',user.id).order('created_at',{ascending:false});
   dbError(error,'Could not load applications.');
   return ok(data||[]);
 }

 if(routeIs(parts,'applications')&&method==='POST') {
   const {user}=await currentUser(['jobseeker'],true);
   const body=parse(applicationSchema,await readJson(req));
   const {data:job}=await db().from('jobs').select('id,employer_id,title,deadline').eq('id',body.job_id).eq('status','published').maybeSingle();
   if(!job) fail('This job is no longer accepting applications.',404);
   if(job.deadline && job.deadline < new Date().toISOString().slice(0,10)) fail('Application deadline has passed.');
   const {data:seeker}=await db().from('seeker_profiles').select('resume_path').eq('user_id',user.id).single();
   if(!seeker?.resume_path) fail('Upload a resume PDF before applying.');
   const {data,error}=await db().from('applications').insert({job_id:job.id,seeker_id:user.id,cover_letter:body.cover_letter||null,screening_response:body.screening_response||null,resume_path:seeker.resume_path}).select('id').single();
   dbError(error,'Application could not be submitted.');
   await db().from('application_events').insert({application_id:data!.id,actor_id:user.id,status:'applied',note:'Application submitted'});
   await notify(job.employer_id,'application','New application',`A candidate applied for ${job.title}.`,'/app?tab=candidates');
   await recordAudit(user.id,'application.created',data!.id);
   await emailPerson(job.employer_id,'New JobLinkLocal application',`A new applicant has applied for ${job.title}.`,'application');
   return ok({id:data!.id,message:'Application sent to the employer.'},201);
 }

 if(parts[0]==='applications'&&parts[1]&&parts.length===2&&method==='PATCH') {
   const {user}=await currentUser(['jobseeker']);
   const id=idOrFail(parts[1]);
   const {data:app}=await db().from('applications').select('id,seeker_id,status,job_id').eq('id',id).maybeSingle();
   if(!app||app.seeker_id!==user.id) fail('Application unavailable.',404);
   if(!['applied','reviewing'].includes(app.status)) fail('This application can no longer be withdrawn.');
   const {error}=await db().from('applications').update({status:'withdrawn'}).eq('id',id);dbError(error);
   await db().from('application_events').insert({application_id:id,actor_id:user.id,status:'withdrawn',note:'Withdrawn by applicant'});
   await recordAudit(user.id,'application.withdrawn',id);
   return ok({message:'Application withdrawn.'});
 }

 if(routeIs(parts,'employer')&&method==='GET') {
   const {user}=await currentUser(['employer']);
   const {data:jobs,error:jobsError}=await db().from('jobs').select('*').eq('employer_id',user.id).order('created_at',{ascending:false});
   dbError(jobsError);
   if(!jobs?.length) return ok({jobs:[],applications:[],employment:[]});
   const jobIds=jobs.map((j:any)=>j.id);
   const {data:applications,error:appsError}=await db().from('applications').select('*,application_events(id,status,note,created_at)').in('job_id',jobIds).order('created_at',{ascending:false}).limit(500);
   dbError(appsError);
   const seekerIds=[...new Set((applications||[]).map((a:any)=>a.seeker_id))];
   const {data:seekers}=seekerIds.length?await db().from('profiles').select('id,full_name,city,province,created_at,seeker_profiles(education,experience_years,skills,desired_role)').in('id',seekerIds):{data:[]};
   const seekerMap=new Map((seekers||[]).map((s:any)=>[s.id,s]));
   const enriched=(applications||[]).map((a:any)=>({...a,seeker:seekerMap.get(a.seeker_id),job:jobs.find((j:any)=>j.id===a.job_id)}));
   const appIds=(applications||[]).map((a:any)=>a.id);
   const {data:employment}=appIds.length?await db().from('employment_records').select('*').in('application_id',appIds):{data:[]};
   return ok({jobs,applications:enriched,employment:employment||[]});
 }

 if(routeIs(parts,'employer','decision')&&method==='POST') {
   const {user}=await currentUser(['employer'],true);
   const body=parse(decisionSchema,await readJson(req));
   const {data,error}=await db().rpc('record_application_decision',{p_actor:user.id,p_application:body.id,p_decision:body.decision,p_note:body.note||'',p_start_date:body.start_date||null});
   dbError(error,'Unable to update application.');
   if(data?.seeker_id) {
     const notice=applicationDecisionNotice(body.decision,data.job_title||'the position',body.note||'');
     await emailPerson(data.seeker_id,notice.subject,notice.body,'application_decision');
   }
   return ok({message:'Application status saved and in-app notification recorded.',result:data});
 }

 if(routeIs(parts,'employer','end')&&method==='POST') {
   const {user}=await currentUser(['employer'],true);
   const body=await readJson(req);
   const id=idOrFail(body.id);
   const note=str(body.note);
   const endDate=str(body.ended_on);
   if(note.length<8||note.length>1800) fail('Provide a clear employment-ending note.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) fail('Enter a valid end date.');
   const {data,error}=await db().rpc('end_employment',{p_actor:user.id,p_employment:id,p_ended_on:endDate,p_note:note});
   dbError(error,'Unable to update employment status.');
   if(data?.seeker_id) {
     const notice=employmentStatusNotice(data.job_title||'the position',endDate,note);
     await emailPerson(data.seeker_id,notice.subject,notice.body,'employment_end');
   }
   return ok({message:'Employment separation saved and in-app notification recorded.',result:data});
 }

 if(routeIs(parts,'lgu')&&method==='GET') {
   await currentUser(['lgu_admin'],true);
   const [verifications,jobs]=await Promise.all([
     db().from('verification_submissions').select('id,user_id,kind,status,statement,created_at,profiles!verification_submissions_user_id_fkey(id,full_name,email,role,city,province),verification_documents(id,filename,media_type,bytes)').eq('status','pending').order('created_at',{ascending:true}).limit(100),
     db().from('jobs').select('id,title,company_name,category,location,employment_type,created_at,description,requirements,employer_id').eq('status','pending').order('created_at',{ascending:true}).limit(100)
   ]);
   dbError(verifications.error);
   dbError(jobs.error);
   return ok({verifications:verifications.data||[],jobs:jobs.data||[]});
 }

 if(routeIs(parts,'lgu','review-verification')&&method==='POST') {
   const {user}=await currentUser(['lgu_admin'],true);
   const body=parse(decisionSchema,await readJson(req));
   const {data,error}=await db().rpc('review_verification',{p_actor:user.id,p_submission:body.id,p_decision:body.decision,p_note:body.note||''});
   dbError(error,'Unable to complete LGU review.');
   if(data?.user_id) await emailPerson(data.user_id,'JobLinkLocal verification update',data.decision==='approved'?'Your credentials have been approved by the LGU.':`Your credential review needs changes. ${body.note||''}`,'lgu_verification');
   return ok({message:'Verification reviewed and member notified.',result:data});
 }

 if(routeIs(parts,'lgu','review-job')&&method==='POST') {
   const {user}=await currentUser(['lgu_admin'],true);
   const body=parse(decisionSchema,await readJson(req));
   const {data,error}=await db().rpc('review_job',{p_actor:user.id,p_job:body.id,p_decision:body.decision,p_note:body.note||''});
   dbError(error,'Unable to review job posting.');
   if(data?.employer_id) await emailPerson(data.employer_id,'Your JobLinkLocal posting was reviewed',`${data.job_title}: ${data.decision}. ${body.note||''}`,'job_review');
   return ok({message:'Job review saved and employer notified.',result:data});
 }

 if(routeIs(parts,'admin','users')&&method==='GET') {
   await currentUser(['sys_admin'],true);
   const {data,error}=await db().from('profiles').select('id,email,full_name,role,city,province,lgu_status,created_at').order('created_at',{ascending:false}).limit(500);
   dbError(error,'Unable to load accounts.');
   return ok(data||[]);
 }

 if(routeIs(parts,'admin','audits')&&method==='GET') {
   await currentUser(['sys_admin'],true);
   const {data,error}=await db().from('audit_logs').select('id,actor_id,action,target_id,created_at,details').order('created_at',{ascending:false}).limit(120);
   dbError(error,'Unable to load audit records.');
   return ok(data||[]);
 }

 if(routeIs(parts,'admin','account')&&method==='POST') {
   const {user}=await currentUser(['sys_admin'],true);
   const body=await readJson(req);
   const {data,error}=await db().rpc('set_account_status',{p_actor:user.id,p_target:idOrFail(body.id),p_status:body.status});
   dbError(error,'Unable to update account.');
   if(data?.user_id) await emailPerson(data.user_id,'JobLinkLocal account update',`Your account status is now ${data.status}.`,'admin_account');
   return ok({message:'Account status updated.',result:data});
 }

 if(routeIs(parts,'notifications')&&method==='GET') {
   const {user}=await currentUser();
   const {data,error}=await db().from('notifications').select('id,title,body,kind,link,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
   dbError(error);
   return ok(data||[]);
 }

 if(routeIs(parts,'notifications')&&method==='PATCH') {
   const {user}=await currentUser();
   const body=await readJson(req);
   const query=db().from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);
   const {error}=body.all===true?await query:await query.eq('id',idOrFail(body.id));
   dbError(error);
   return ok({message:'Notification marked as read.'});
 }

 if(routeIs(parts,'dashboard')&&method==='GET') {
   const {user,profile}=await currentUser();
   let stats:Record<string,number>={};
   const count=async(table:string,field?:string,value?:string)=>{
     let query=db().from(table).select('id',{count:'exact',head:true});
     if(field&&value) query=query.eq(field,value);
     const {count:result,error}=await query;
     dbError(error,'Unable to load dashboard statistics.');
     return result||0;
   };
   if(profile.role==='jobseeker') stats={applications:await count('applications','seeker_id',user.id),saved:0,active_jobs:await count('jobs','status','published')};
   if(profile.role==='jobseeker') {
     const {count:saved}=await db().from('saved_jobs').select('job_id',{count:'exact',head:true}).eq('user_id',user.id);
     stats.saved=saved||0;
   }
   if(profile.role==='employer') {
     const {data:owned}=await db().from('jobs').select('id').eq('employer_id',user.id);
     const ids=(owned||[]).map((j:any)=>j.id);
     const {count:appCount}=ids.length?await db().from('applications').select('id',{count:'exact',head:true}).in('job_id',ids):{count:0};
     stats={jobs:ids.length,applicants:appCount||0,published:(await db().from('jobs').select('id',{count:'exact',head:true}).eq('employer_id',user.id).eq('status','published')).count||0};
   }
   if(profile.role==='lgu_admin'||profile.role==='sys_admin') {
     stats={users:await count('profiles'),jobs:await count('jobs'),applications:await count('applications'),hires:await count('employment_records')};
     if(profile.role==='lgu_admin') stats.pending_reviews=await count('verification_submissions','status','pending');
   }
   const {count:unread}=await db().from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null);
   return ok({stats,unread:unread||0,profile:{id:profile.id,full_name:profile.full_name,role:profile.role,lgu_status:profile.lgu_status}});
 }

 if(routeIs(parts,'reports')&&method==='GET') {
   await currentUser(['lgu_admin','sys_admin'],true);
   const data=await reportData(q('start'),q('end'));
   if(q('format')==='csv')return new NextResponse(csvReport(data),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="joblinklocal-report.csv"','Cache-Control':'private, no-store'}});
   if(q('format')==='pdf')return new NextResponse(Uint8Array.from(await pdfReport(data)).buffer as ArrayBuffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="joblinklocal-report.pdf"','Cache-Control':'private, no-store'}});
   return ok(data);
 }

 fail('Endpoint not found.',404);
}
