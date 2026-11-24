import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/admin';
import { userClient } from '@/lib/supabase/server';
import { ApiError, currentUser, requireSameOrigin, checkLimit, readJson, dbError, recordAudit, notify, ok } from '@/lib/guards';
import { sendSystemEmail, emailPerson, applicationDecisionNotice, employmentStatusNotice } from '@/lib/mail';
import { uploadPrivate, avatarMime } from '@/lib/uploads';
import { prepareUpload,readStaged,cleanupStaged } from '@/lib/staged-uploads';
import { matchJobSkills, normalizeSkills } from '@/lib/skillMatching';
import { signUpSchema, jobSchema, applicationSchema, decisionSchema, validated } from '@/lib/validators';
import { reportData, csvReport, pdfReport } from '@/lib/report';
import { isOlongapoBarangay } from '@/lib/olongapo';
import { generateSummary, SummaryError } from '@/lib/ai-summary';

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
 const {data,error}=await db().from('profiles').select('id,email,role,full_name,phone,city,province,barangay,address_line,bio,avatar_url,lgu_status,created_at,seeker_profiles(*),employer_profiles(*)').eq('id',id).single();
 dbError(error,'Profile unavailable.');
 return data;
};

export async function api(req:NextRequest,parts:string[]) {
 const method=req.method;
 const url=req.nextUrl;
 const q=(s:string)=>url.searchParams.get(s);
 // Same-origin POSTs are checked below; avoid stale configured deployment URLs.
 const confirmationUrl=(recovery=false)=>{
   const target=new URL('/auth/confirm',req.nextUrl.origin);
   if(recovery)target.searchParams.set('next','/auth/reset');
   return target.toString();
 };
 if(!['GET','POST','PATCH','DELETE'].includes(method)) fail('Method not allowed.',405);
 if(method!=='GET') requireSameOrigin(req);

 if((routeIs(parts,'uploads','prepare')||routeIs(parts,'uploads','cleanup'))&&method==='POST') {
   const {user,profile}=await currentUser(['jobseeker','employer']);
   const body=await readJson(req);
   const purpose=body?.purpose;
   if(purpose!=='verification'&&purpose!=='resume')fail('Invalid upload purpose.');
   if(purpose==='resume'&&profile.role!=='jobseeker')fail('Not authorized.',403);
   if(parts[1]==='prepare'){
     await checkLimit(req,'document_upload:'+user.id,30,900);
     return ok(await prepareUpload(user.id,purpose,body.size,body.mime));
   }
   if(!Array.isArray(body.paths)||body.paths.length>3)fail('Invalid upload references.');
   await cleanupStaged(user.id,purpose,body.paths);return ok({message:'Temporary uploads cleared.'});
 }

 if(routeIs(parts,'health')&&method==='GET') {
   const {error}=await db().from('categories').select('id').limit(1);
   if(error) fail('Database connection or schema is unavailable.',503);
   return ok({status:'ok',database:'connected',transport:'Supabase HTTPS'});
 }

 if(routeIs(parts,'auth','signup')&&method==='POST') {
   await checkLimit(req,'signup',6,3600);
   const data=parse(signUpSchema,await readJson(req));
   const client=await userClient();
   const {data:auth,error}=await client.auth.signUp({email:data.email.toLowerCase(),password:data.password,
     options:{emailRedirectTo:confirmationUrl(),data:{...data,password:undefined,email:undefined}}});
   if(error) fail(error.message,400);
   return ok({message:'Check your inbox for the confirmation link.',requires_confirmation:!auth.session},201);
 }

 if(routeIs(parts,'auth','login')&&method==='POST') {
   const body=await readJson(req);
   if(!body || typeof body!=='object' || Array.isArray(body)) fail('Enter a valid email and password.');
   await checkLimit(req,body.portal==='admin'?'admin_login':'login',body.portal==='admin'?8:18,900);
   const email=z.email().safeParse(body.email);
   if(!email.success||typeof body.password!=='string') fail('Enter a valid email and password.');
   const client=await userClient();
   const {data,error}=await client.auth.signInWithPassword({email:email.data,password:body.password});
   if(error){
     if(error.code==='email_not_confirmed'||/email not confirmed/i.test(error.message)) fail('Email confirmation required. Check your inbox to verify your email address.',403);
     fail('Invalid email or password.',401);
   }
   if(!data.user) fail('Invalid email or password.',401);
   const {data:profile}=await db().from('profiles').select('role,lgu_status,full_name').eq('id',data.user.id).maybeSingle();
   if(!profile || profile.lgu_status==='suspended'){
      await client.auth.signOut();
      fail('This account cannot sign in. Contact support.',403);
   }
   const requestedPortal=body.portal;
   if(requestedPortal!==undefined){
      if(!['jobseeker','employer','admin'].includes(requestedPortal)){
        await client.auth.signOut();
        fail('Choose a valid sign-in area.');
      }
      const allowed=requestedPortal==='admin'
        ? ['lgu_admin','sys_admin'].includes(profile.role)
        : requestedPortal===profile.role;
      if(!allowed){
        await client.auth.signOut();
        fail('This account belongs to a different sign-in area. Select the correct account type.',403);
      }
   }
   return ok({role:profile.role,full_name:profile.full_name});
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
   const {error}=await client.auth.resetPasswordForEmail(body.email,{redirectTo:confirmationUrl(true)});
   if(error){console.error('[Recovery email]',error.code,error.status);if(error.status===429)fail('Too many recovery requests. Try again later.',429);fail('Recovery email could not be sent. Please try again.',503);}
   return ok({message:'If the address exists, you will receive password recovery instructions.'});
 }

 if(routeIs(parts,'auth','password')&&method==='POST') {
   const {user,auth}=await currentUser();
   const body=await readJson(req);
   if(typeof body.password!=='string'||body.password.length<8||!/[A-Z]/.test(body.password)||!/[a-z]/.test(body.password)||!/[0-9]/.test(body.password)) fail('Choose a password with at least 8 characters, upper and lowercase letters, and a number.');
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
   const {error}=await client.auth.resend({type:'signup',email:body.email,options:{emailRedirectTo:confirmationUrl()}});
   if(error){
     if(error.status===429||/rate limit|too many/i.test(error.message)) fail('Too many verification email requests. Please try again later.',429);
     fail('Verification email is temporarily unavailable. Please try again later.',503);
   }
   return ok({message:'If verification is pending, a new email has been requested.'});
 }

 if(routeIs(parts,'me')&&method==='GET') {
   const {user}=await currentUser();
   const profile=await findProfile(user.id);
   return ok({...profile,email_confirmed:!!user.email_confirmed_at});
 }

 if(routeIs(parts,'profile')&&method==='PATCH') {
   const {user,profile}=await currentUser();
   const body=await readJson(req);
   const allowed=['full_name','phone','bio','barangay','address_line'];
   const patch:Record<string,string|null>={};
   for(const key of allowed) if(typeof body[key]==='string') {
     const val=body[key].trim();
     const limit=key==='bio'?1200:key==='address_line'?180:120;
     if((key==='full_name'&&val.length<2)||val.length>limit) fail(`Invalid ${key.replace('_',' ')}.`);
     if(key==='barangay' && val && !isOlongapoBarangay(val)) fail('Select an Olongapo barangay.');
     if(key==='address_line' && val.length>180) fail('The address is too long.');
     patch[key]=val;
   }
   if(profile.role==='jobseeker'&&body.experience_years!==undefined){const years=typeof body.experience_years==='string'&&body.experience_years.trim()!==''?Number(body.experience_years):body.experience_years;if(typeof years!=='number'||!Number.isInteger(years)||years<0||years>65)fail('Enter years of experience between 0 and 65.');}
   if(Object.keys(patch).length) { const {error}=await db().from('profiles').update(patch).eq('id',user.id); dbError(error); }
   if(profile.role==='jobseeker'){
     const extras:Record<string,unknown>={};
     for(const key of ['education','desired_role','preferred_work_setup','portfolio_url','linkedin_url']) if(typeof body[key]==='string') extras[key]=take(body[key].trim(),255);
     if(body.experience_years!==undefined){const years=typeof body.experience_years==='string'&&body.experience_years.trim()!==''?Number(body.experience_years):body.experience_years;if(typeof years!=='number'||!Number.isInteger(years)||years<0||years>65)fail('Enter years of experience between 0 and 65.');extras.experience_years=years;}
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

 if(routeIs(parts,'avatar')&&method==='POST') {
   const {user}=await currentUser();
   if(Number(req.headers.get('content-length')||0)>3*1024*1024) fail('Photo must be smaller than 2 MB.',413);
   const form=await req.formData();const file=form.get('avatar');
   if(!(file instanceof File)||file.size>2*1024*1024) fail('Choose a PNG or JPG photo below 2 MB.');
   const {data:previous,error:previousError}=await db().from('profiles').select('avatar_url').eq('id',user.id).single();
   dbError(previousError,'Unable to read your profile photo. Contact support.');
   const item=await uploadPrivate('avatars',user.id,file);
   const {error}=await db().from('profiles').update({avatar_url:item.path}).eq('id',user.id);
   if(error){await db().storage.from('avatars').remove([item.path]);dbError(error);}
   if(previous?.avatar_url&&previous.avatar_url.startsWith(`${user.id}/`))await db().storage.from('avatars').remove([previous.avatar_url]);
   await recordAudit(user.id,'profile.avatar_updated');
   return ok(await findProfile(user.id));
 }
 if(routeIs(parts,'avatar')&&method==='DELETE') {
   const {user}=await currentUser();
   const {data:previous,error:previousError}=await db().from('profiles').select('avatar_url').eq('id',user.id).single();
   dbError(previousError,'Unable to read your profile photo.');
   const {error}=await db().from('profiles').update({avatar_url:null}).eq('id',user.id);dbError(error);
   if(previous?.avatar_url?.startsWith(`${user.id}/`))await db().storage.from('avatars').remove([previous.avatar_url]);
   await recordAudit(user.id,'profile.avatar_removed');
   return ok(await findProfile(user.id));
 }
 if(parts[0]==='files'&&parts[1]==='avatar'&&parts.length===3&&method==='GET') {
   const {user,profile}=await currentUser();const ownerId=idOrFail(parts[2]);
   if(ownerId!==user.id){
     if(profile.role==='lgu_admin'&&profile.lgu_status==='approved'){
       const {data:target}=await db().from('profiles').select('role').eq('id',ownerId).maybeSingle();
       if(target?.role!=='jobseeker'&&target?.role!=='employer')fail('Not authorized.',403);
     }else if(profile.role==='employer'&&profile.lgu_status==='approved'){
       const {data:owned}=await db().from('jobs').select('id').eq('employer_id',user.id);
       const ids=(owned||[]).map((j:any)=>j.id);
       if(!ids.length)fail('Not authorized.',403);
       const {data:app}=await db().from('applications').select('id').eq('seeker_id',ownerId).in('job_id',ids).limit(1);
       if(!app?.length)fail('Not authorized.',403);
     }else fail('Not authorized.',403);
   }
   const {data:person,error:personError}=await db().from('profiles').select('avatar_url').eq('id',ownerId).maybeSingle();dbError(personError);
   if(!person?.avatar_url||!person.avatar_url.startsWith(`${ownerId}/`))fail('Photo unavailable.',404);
   const {data:file,error}=await db().storage.from('avatars').download(person.avatar_url);
   if(error||!file)fail('Photo unavailable.',404);
   const bytes=await file.arrayBuffer();
   const mime=avatarMime(new Uint8Array(bytes));
   if(!mime)fail('Photo unavailable.',404);
   return new NextResponse(bytes,{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }

 if(routeIs(parts,'businesses')&&method==='GET') {
   const {data,error}=await db().from('employer_profiles')
    .select('user_id,business_name,industry,business_type,profiles!inner(lgu_status,role)')
    .eq('profiles.lgu_status','approved').eq('profiles.role','employer')
    .order('business_name',{ascending:true}).limit(100);
   dbError(error,'Unable to load verified businesses.');
   return ok((data||[]).map(({user_id,business_name,industry,business_type}:any)=>({id:user_id,business_name,industry,business_type})));
 }

 if(routeIs(parts,'jobs')&&method==='GET') {
   let query=db().from('jobs').select('id,employer_id,company_name,title,category,description,requirements,benefits,location,barangay,address_line,work_setup,employment_type,experience_level,salary_min,salary_max,salary_visible,vacancies,schedule,deadline,screening_questions,status,published_at,created_at').eq('status','published').order('published_at',{ascending:false}).limit(60);
   const text=take(str(q('q')),80);
   if(text) query=query.ilike('title',`%${text.replace(/[%_]/g,'\\$&')}%`);
   if(q('category')&&q('category')!=='All') query=query.eq('category',take(str(q('category')),80));
   if(q('type')&&q('type')!=='All') query=query.eq('employment_type',take(str(q('type')),40));
   if(q('setup')&&q('setup')!=='All') query=query.eq('work_setup',take(str(q('setup')),40));
   const {data,error}=await query;
   dbError(error,'Unable to load jobs.');
   return ok((data||[]).map((job:any)=>job.salary_visible===false?{...job,salary_min:null,salary_max:null}:job));
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
   return ok(data.status==='published'&&data.salary_visible===false?{...data,salary_min:null,salary_max:null}:data);
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
   const {data,error}=await db().from('verification_submissions').select('*,verification_documents(id,filename,document_type,media_type,bytes)').eq('user_id',user.id).order('created_at',{ascending:false}).limit(10);
   dbError(error,'Unable to load verification records.');
   return ok(data||[]);
 }

 if(routeIs(parts,'verification')&&method==='POST') {
   const {user,profile}=await currentUser(['jobseeker','employer']);
   if(profile.lgu_status==='approved' && q('replace')!=='approved') fail('To replace approved evidence, start a new LGU review request.',409);
   const {data:existing,error:existingError}=await db().from('verification_submissions').select('id').eq('user_id',user.id).eq('status','pending').limit(1);
   dbError(existingError,'Unable to check existing verification requests.');
   if(existing?.length) fail('Your previous documents are already awaiting review.',409);
   const body=await readJson(req);
   const refs=body?.documents;
   const selectedTypes=body?.document_types;
   if(!Array.isArray(refs)||refs.length>(profile.role==='employer'?2:3)||!Array.isArray(selectedTypes)||selectedTypes.length!==refs.length||selectedTypes.some((item:unknown)=>typeof item!=='string'))fail('Select a document type for every supporting file.');
   if(profile.role==='employer'&&!body.business_permit)fail('Upload your business permit for LGU verification.');
   if(profile.role==='jobseeker'&&!refs.length)fail('Provide at least one identity document.');
   const allRefs=profile.role==='employer'?[body.business_permit,...refs]:refs;
   if(new Set(allRefs.map((ref:any)=>ref?.path)).size!==allRefs.length)fail('Select distinct documents.');
   const files:File[]=[];
   for(const ref of allRefs)files.push(await readStaged(user.id,'verification',ref));
   const allowedTypes=new Set(['government_id','birth_certificate','resume','certificate','supporting','business_registration','representative_id']);
   if(selectedTypes.some((type:string)=>!allowedTypes.has(type))) fail('Select a valid document type.');
   const supportingTypes=selectedTypes as string[];
   if(profile.role==='jobseeker'&&!supportingTypes.some(type=>['government_id','birth_certificate'].includes(type)))fail('Include a government ID or birth certificate for identity verification.');
   if(profile.role==='jobseeker'){
     const {data:resumeProfile,error:resumeError}=await db().from('seeker_profiles').select('resume_path').eq('user_id',user.id).maybeSingle();
     dbError(resumeError,'Unable to confirm your resume.');
     if(!resumeProfile?.resume_path) fail('Upload your resume through the Resume section before LGU verification.');
   }
   const statement=take(str(body.statement),1200);
   const {data:sub,error:subError}=await db().from('verification_submissions').insert({user_id:user.id,kind:profile.role,statement}).select('id').single();
   dbError(subError,'Could not open a verification request.');
   const uploaded:string[]=[];
   try {
     for(const [index,file] of files.entries()){
       const item=await uploadPrivate('verification-documents',user.id,file);
       uploaded.push(item.path);
       const {error}=await db().from('verification_documents').insert({submission_id:sub!.id,owner_id:user.id,bucket:'verification-documents',path:item.path,filename:item.filename,media_type:item.mime,bytes:item.bytes,document_type:profile.role==='employer'&&index===0?'business_permit':supportingTypes[profile.role==='employer'?index-1:index]});
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

 if(parts[0]==='verification'&&parts[1]==='documents'&&parts[2]&&method==='DELETE') {
   const {user}=await currentUser(['jobseeker','employer']);
   const documentId=idOrFail(parts[2]);
   const {data:doc,error:docError}=await db().from('verification_documents').select('id,owner_id,submission_id,path,bucket').eq('id',documentId).maybeSingle();
   dbError(docError,'Unable to load document.');
   if(!doc||doc.owner_id!==user.id) fail('Document not available.',404);
   const {data:submission,error:submissionError}=await db().from('verification_submissions').select('id,status').eq('id',doc.submission_id).maybeSingle();
   dbError(submissionError);
   if(!submission||submission.status!=='rejected') fail('Only documents from rejected submissions can be removed.',409);
   const {error:removeError}=await db().from('verification_documents').delete().eq('id',doc.id).eq('owner_id',user.id);
   dbError(removeError,'Could not remove document record.');
   const {error:fileError}=await db().storage.from('verification-documents').remove([doc.path]);
   if(fileError) console.error('[Private document cleanup]',fileError.message);
   await recordAudit(user.id,'verification.document_removed',documentId);
   return ok({message:'Document removed.'});
 }

 if(routeIs(parts,'resume')&&method==='POST') {
   const {user}=await currentUser(['jobseeker']);
   const body=await readJson(req);
   const file=await readStaged(user.id,'resume',body?.resume);
   const {data:old,error:oldError}=await db().from('seeker_profiles').select('resume_path').eq('user_id',user.id).single();
   dbError(oldError,'Unable to load your current resume.');
   if(!old)fail('Your career profile is unavailable.',409);
   const item=await uploadPrivate('resumes',user.id,file,true);
   const {data:updated,error}=await db().from('seeker_profiles').update({resume_path:item.path}).eq('user_id',user.id).select('user_id').maybeSingle();
   if(error||!updated){await db().storage.from('resumes').remove([item.path]);dbError(error);fail('Could not save your resume.',409);}

   // Preserve prior files: applications and pending removal requests may still reference them.
   return ok({path:item.path,message:'Resume uploaded securely.'});
 }

 if(routeIs(parts,'resume')&&method==='DELETE') {
   await currentUser(['jobseeker']);
   fail('LGU approval is required. Use Request Resume Removal instead.',409);
 }
 if(routeIs(parts,'resume','removal-request')&&method==='POST') {
   const {user}=await currentUser(['jobseeker']);
   const {data:current,error:lookupError}=await db().from('seeker_profiles').select('resume_path').eq('user_id',user.id).maybeSingle();
   dbError(lookupError);
   if(!current?.resume_path)fail('There is no resume to remove.');
   const body=await readJson(req);const reason=take(str(body.reason),800);
   if(reason.length<8)fail('Provide a short reason for LGU review.');
   const {data:pending,error:pendingError}=await db().from('resume_removal_requests').select('id').eq('seeker_id',user.id).eq('status','pending').limit(1);
   dbError(pendingError,'Unable to check pending resume removal requests.');
   if(pending?.length)fail('Your resume-removal request is already awaiting LGU review.',409);
   const {error}=await db().from('resume_removal_requests').insert({seeker_id:user.id,resume_path:current.resume_path,reason});dbError(error,'Unable to submit the request.');
   await recordAudit(user.id,'resume.removal_requested');
   return ok({message:'Resume removal sent to LGU for approval.'});
 }
 if(routeIs(parts,'resume','removal-request')&&method==='GET') {
   const {user}=await currentUser(['jobseeker']);
   const {data,error}=await db().from('resume_removal_requests').select('id,status,created_at,reviewed_at,decision_note').eq('seeker_id',user.id).order('created_at',{ascending:false}).limit(5);
   dbError(error,'Unable to load your resume removal requests.');return ok(data||[]);
 }
 if(parts[0]==='files'&&parts[1]==='document'&&parts[2]&&method==='GET') {
   const {user,profile}=await currentUser();
   const {data:doc,error}=await db().from('verification_documents').select('*').eq('id',idOrFail(parts[2])).maybeSingle();
   dbError(error);
   if(!doc) fail('File unavailable.',404);
   if(doc.owner_id!==user.id && !(profile.role==='lgu_admin' && profile.lgu_status==='approved')) fail('Not authorized.',403);
   if(q('ticket')==='1'){const {data,error}=await db().storage.from('verification-documents').createSignedUrl(doc.path,60);if(error||!data)fail('Document could not be downloaded.',404);return ok({url:data.signedUrl});}
   const {data,error:storageError}=await db().storage.from('verification-documents').download(doc.path);
   if(storageError||!data) fail('Document could not be downloaded.',404);
   return new NextResponse(await data.arrayBuffer(),{headers:{'Content-Type':doc.media_type,'Content-Disposition':`${q('download')==='1'?'attachment':'inline'}; filename="document-${doc.id}.${doc.media_type==='application/pdf'?'pdf':doc.media_type==='image/png'?'png':'jpg'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
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
   if(q('ticket')==='1'){const {data,error}=await db().storage.from('resumes').createSignedUrl(path,60);if(error||!data)fail('The attached resume is unavailable.',404);return ok({url:data.signedUrl});}
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
   if(body.remove===true){
     const {error}=await db().from('saved_jobs').delete().eq('user_id',user.id).eq('job_id',jobId);dbError(error);
     return ok({saved:false});
   }
   const {data:job}=await db().from('jobs').select('id').eq('id',jobId).eq('status','published').maybeSingle();
   if(!job) fail('This listing is no longer accepting saved jobs.',404);
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
   const {data:job}=await db().from('jobs').select('employer_id,title').eq('id',app.job_id).maybeSingle();
   if(job?.employer_id) await notify(job.employer_id,'application','Application withdrawn',`An applicant withdrew from ${job.title}.`,'/app?tab=candidates');
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
   const {data:seekers}=seekerIds.length?await db().from('profiles').select('id,full_name,city,province,barangay,created_at,seeker_profiles(education,experience_years,skills,desired_role)').in('id',seekerIds):{data:[]};
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
   if(data?.seeker_id) { const notice=applicationDecisionNotice(body.decision,data.job_title||'the position',body.note||''); await emailPerson(data.seeker_id,notice.subject,notice.body,'application_decision'); }
   return ok({message:'Application status saved and notification recorded.',result:data});
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
   if(data?.seeker_id) { const notice=employmentStatusNotice(data.job_title||'the position',endDate,note); await emailPerson(data.seeker_id,notice.subject,notice.body,'employment_end'); }
   return ok({message:'Employment separation saved and notification recorded.',result:data});
 }

 if(routeIs(parts,'lgu')&&method==='GET') {
   await currentUser(['lgu_admin'],true);
   const [verifications,jobs]=await Promise.all([
     db().from('verification_submissions').select('id,user_id,kind,status,statement,created_at,profiles!verification_submissions_user_id_fkey(id,full_name,email,role,city,province,barangay),verification_documents(id,filename,document_type,media_type,bytes)').eq('status','pending').order('created_at',{ascending:true}).limit(100),
     db().from('jobs').select('id,title,company_name,category,location,barangay,employment_type,work_setup,experience_level,description,requirements,benefits,salary_min,salary_max,salary_visible,deadline,vacancies,screening_questions,created_at,employer_id').eq('status','pending').order('created_at',{ascending:true}).limit(100)
   ]);
   dbError(verifications.error);
   dbError(jobs.error);
   return ok({verifications:verifications.data||[],jobs:jobs.data||[]});
 }

 if(routeIs(parts,'lgu','review-history')&&method==='GET') {
   await currentUser(['lgu_admin'],true);
   const {data,error}=await db().from('verification_submissions')
     .select('id,user_id,kind,status,created_at,reviewed_at,reviewed_by,reviewer_note,profiles!verification_submissions_user_id_fkey(full_name,barangay,role)')
     .order('created_at',{ascending:false}).limit(200);
   dbError(error,'Unable to load LGU verification history.');
   return ok(data||[]);
 }

 if(routeIs(parts,'lgu','all-jobs')&&method==='GET') {
   await currentUser(['lgu_admin','sys_admin'],true);
   const {data,error}=await db().from('jobs').select('id,title,company_name,category,barangay,location,status,created_at,published_at,review_note,reviewed_by,employer_id,employment_type').order('created_at',{ascending:false}).limit(250);
   dbError(error,'Unable to load Olongapo job postings.');
   return ok(data||[]);
 }

 if(routeIs(parts,'lgu','jobseekers')&&method==='GET') {
   await currentUser(['lgu_admin'],true);
   const {data,error}=await db().from('profiles')
     .select('id,full_name,email,phone,barangay,address_line,bio,avatar_url,lgu_status,created_at,seeker_profiles(education,experience_years,skills,desired_role,preferred_work_setup),verification_submissions!verification_submissions_user_id_fkey(id,status,created_at,reviewed_at,reviewer_note)')
     .eq('role','jobseeker').order('created_at',{ascending:false}).limit(300);
   dbError(error,'Unable to load jobseekers.');
   const ids=(data||[]).map((p:any)=>p.id);
   const counts=new Map<string,number>();
   if(ids.length){const {data:applications,error:appsError}=await db().from('applications').select('seeker_id').in('seeker_id',ids).limit(4000);dbError(appsError);(applications||[]).forEach((a:any)=>counts.set(a.seeker_id,(counts.get(a.seeker_id)||0)+1));}
   return ok((data||[]).map((p:any)=>({...p,application_count:counts.get(p.id)||0})));
 }
 if(routeIs(parts,'lgu','jobseekers','status')&&method==='POST') {
   const {user}=await currentUser(['lgu_admin'],true);const body=await readJson(req);
   const id=idOrFail(str(body.id));const action=str(body.action);const reason=take(str(body.reason),800);
   if(!['suspend','restore'].includes(action))fail('Invalid account action.');
   if(reason.length<10)fail('Provide a reason of at least 10 characters.');
   const {data:target,error:targetError}=await db().from('profiles').select('id,role,lgu_status').eq('id',id).maybeSingle();dbError(targetError);
   if(!target||target.role!=='jobseeker')fail('Only jobseeker accounts can be managed here.',403);
   if(action==='suspend'&&target.lgu_status==='suspended')fail('The account is already suspended.',409);
   if(action==='restore'&&target.lgu_status!=='suspended')fail('The account is not suspended.',409);
   // Restoring requires renewed LGU verification; never silently re-approve an account.
   const next=action==='suspend'?'suspended':'pending';
   const {data:updated,error}=await db().from('profiles').update({lgu_status:next,suspended_from:action==='suspend'?target.lgu_status:null}).eq('id',id).eq('role','jobseeker').eq('lgu_status',target.lgu_status).select('id').maybeSingle();
   dbError(error);if(!updated)fail('Account status changed. Refresh before retrying.',409);
   await recordAudit(user.id,`lgu.jobseeker.${action}`,id,{reason,previous_status:target.lgu_status});
   await notify(id,'verification',action==='suspend'?'LGU account suspended':'LGU account restored',`${reason} ${action==='restore'?'Complete LGU verification again.':''}`,'/app?tab=verification');
   return ok({status:next,message:action==='suspend'?'Jobseeker account suspended.':'Account restored to pending verification.'});
 }
 if(routeIs(parts,'lgu','close-job')&&method==='POST') {
   const {user}=await currentUser(['lgu_admin'],true);const body=await readJson(req);
   const id=idOrFail(str(body.id));const note=take(str(body.reason),1000);
   if(note.length<10)fail('Provide a reason of at least 10 characters.');
   const {data:job,error:lookupError}=await db().from('jobs').select('id,title,status,employer_id').eq('id',id).maybeSingle();dbError(lookupError);
   if(!job||!['pending','published'].includes(job.status))fail('Only pending or published jobs can be cancelled.',409);
   const {data:updated,error}=await db().from('jobs').update({status:'closed',review_note:note,reviewed_by:user.id}).eq('id',id).eq('status',job.status).select('id').maybeSingle();dbError(error);
   if(!updated)fail('Job status changed. Refresh the list.',409);
   await recordAudit(user.id,'lgu.job.cancelled',id,{reason:note,previous_status:job.status});
   await notify(job.employer_id,'job_review','Job listing cancelled by LGU',`${job.title}: ${note}`,'/app?tab=jobs');
   return ok({message:'Job listing cancelled and employer notified.'});
 }
 if(routeIs(parts,'lgu','resume-removals')&&method==='GET') {
   await currentUser(['lgu_admin'],true);
   const {data,error}=await db().from('resume_removal_requests').select('id,seeker_id,reason,status,created_at,reviewed_at,decision_note').eq('status','pending').order('created_at',{ascending:true}).limit(150);
   if(error&&['42P01','PGRST205'].includes(error.code||'')){
     console.error('[LGU resume removal schema]',error.code);
     fail('Resume removal requests are not configured in the database. Contact the system administrator.',503);
   }
   dbError(error,'Unable to load resume removal requests.');
   const rows=data||[];
   const ids=[...new Set(rows.map(row=>row.seeker_id))];
   if(!ids.length)return ok([]);
   const {data:people,error:peopleError}=await db().from('profiles').select('id,full_name,barangay').in('id',ids);
   dbError(peopleError,'Unable to load jobseeker details for resume requests.');
   const byId=new Map((people||[]).map(person=>[person.id,person] as const));
   return ok(rows.map(row=>({...row,profiles:byId.get(row.seeker_id)||null})));
 }
 if(routeIs(parts,'lgu','resume-removals')&&method==='POST') {
   const {user}=await currentUser(['lgu_admin'],true);const body=await readJson(req);
   const id=idOrFail(str(body.id));const decision=str(body.decision);const note=take(str(body.note),1000);
   if(!['approved','rejected'].includes(decision))fail('Invalid decision.');
   if(note.length<8)fail('Enter an LGU review reason of at least 8 characters.');
   const {data:entry,error:entryError}=await db().from('resume_removal_requests').select('*').eq('id',id).maybeSingle();dbError(entryError);
   if(!entry||entry.status!=='pending')fail('Request is no longer pending.',409);
   const {data:resume,error:resumeError}=await db().from('seeker_profiles').select('resume_path').eq('user_id',entry.seeker_id).maybeSingle();dbError(resumeError);
   if(decision==='approved'&&resume?.resume_path!==entry.resume_path)fail('The applicant has replaced this resume. Ask for a new removal request.',409);
   const {error}=await db().rpc('review_resume_removal',{p_actor:user.id,p_request:id,p_decision:decision,p_note:note});dbError(error,'Unable to complete the LGU resume review.');
   if(decision==='approved'){
     const {count}=await db().from('applications').select('id',{head:true,count:'exact'}).eq('resume_path',entry.resume_path);
     if(!count)await db().storage.from('resumes').remove([entry.resume_path]);
   }
   await recordAudit(user.id,`lgu.resume_removal.${decision}`,entry.seeker_id,{request_id:id,note});
   await notify(entry.seeker_id,'verification',`Resume removal ${decision}`,`${note}${decision==='approved'?' Upload a new resume and complete LGU review before using restricted features.':''}`,'/app?tab=verification');
   return ok({message:`Resume removal ${decision}.`});
 }

 if(routeIs(parts,'lgu','application-tracking')&&method==='GET') {
   await currentUser(['lgu_admin'],true);
   const {data,error}=await db().from('applications').select('id,job_id,seeker_id,status,created_at,updated_at,jobs(id,title,company_name,barangay),application_events(status,created_at)').order('created_at',{ascending:false}).limit(200);
   dbError(error,'Unable to load application tracking.');
   const ids=[...new Set((data||[]).map((row:any)=>row.seeker_id))];
   let profiles:any[]=[];
   if(ids.length){
     const {data:matched,error:profileError}=await db().from('profiles').select('id,full_name,barangay,lgu_status').in('id',ids);
     dbError(profileError,'Unable to load applicants.');profiles=matched||[];
   }
   const byId=new Map(profiles.map((profile:any)=>[profile.id,profile]));
   return ok((data||[]).map((row:any)=>({ ...row, applicant:byId.get(row.seeker_id)||null })));
 }

 if(routeIs(parts,'lgu','review-verification')&&method==='POST') {
   const {user}=await currentUser(['lgu_admin'],true);
   const body=parse(decisionSchema,await readJson(req));
   if(body.decision==='approved') {
     const {data:submission,error:submissionError}=await db().from('verification_submissions').select('id,user_id,kind,status,verification_documents(document_type)').eq('id',body.id).maybeSingle();
     dbError(submissionError,'Unable to check verification evidence.');
     if(!submission||submission.status!=='pending') fail('This review request is unavailable.',409);
     const types=(submission.verification_documents||[]).map((doc:any)=>doc.document_type);
     if(submission.kind==='jobseeker') {
       if(!types.some((type:string)=>['government_id','birth_certificate'].includes(type))) fail('An identity document is required before LGU approval.');
       const {data:resume,error:resumeError}=await db().from('seeker_profiles').select('resume_path').eq('user_id',submission.user_id).maybeSingle();
       dbError(resumeError,'Unable to confirm resume.');
       if(!resume?.resume_path) fail('A saved resume is required before jobseeker approval.');
     }
     if(submission.kind==='employer'&&!types.includes('business_permit')) fail('The business permit must be submitted before approval.');
   }
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

 if(routeIs(parts,'ai','explain')&&method==='POST') {
   const {user,profile}=await currentUser();
   await checkLimit(req,`ai_explain_${user.id}`,8,3600);
   const key=process.env.OPENAI_API_KEY?.trim();
   if(!key)fail('AI summaries are not configured. Built-in skill matching and analytics are still available.',503);
   let metrics:Record<string,number>={};
   // Transmit only role-level counts, no names, identities, resumes, addresses, or credentials.
   if(profile.role==='jobseeker'){
     const {count:jobs}=await db().from('jobs').select('id',{head:true,count:'exact'}).eq('status','published');
     const {count:apps}=await db().from('applications').select('id',{head:true,count:'exact'}).eq('seeker_id',user.id);
     metrics={available_jobs:jobs||0,submitted_applications:apps||0};
   }else if(profile.role==='employer'){
     const {data:jobs}=await db().from('jobs').select('id').eq('employer_id',user.id);
     const ids=(jobs||[]).map((j:any)=>j.id);
     const {count:apps}=ids.length?await db().from('applications').select('id',{head:true,count:'exact'}).in('job_id',ids):{count:0};
     metrics={own_job_posts:ids.length,submitted_applications:apps||0};
   }else if(profile.role==='lgu_admin'){
     const {count:verifications}=await db().from('verification_submissions').select('id',{head:true,count:'exact'}).eq('status','pending');
     const {count:jobs}=await db().from('jobs').select('id',{head:true,count:'exact'}).eq('status','pending');
     metrics={pending_verifications:verifications||0,pending_job_reviews:jobs||0};
   }else{
     const {count:accounts}=await db().from('profiles').select('id',{head:true,count:'exact'});
     const {count:apps}=await db().from('applications').select('id',{head:true,count:'exact'});
     metrics={total_accounts:accounts||0,total_applications:apps||0};
   }
   let answer:string;
   try{
     answer=await generateSummary(key,process.env.OPENAI_MODEL?.trim()||'gpt-6.1-terra',profile.role,metrics);
   }catch(error){if(error instanceof SummaryError)fail(error.message,503);throw error;}
   await recordAudit(user.id,'ai.summary_generated',undefined,{role:profile.role});
   return ok({text:answer,method:'External AI summary of aggregated counts',metrics});
 }
 if(routeIs(parts,'ai','insights')&&method==='GET') {
   const {user,profile}=await currentUser();
   if(profile.role==='jobseeker'){
     const {data:seeker,error:seekerError}=await db().from('seeker_profiles').select('skills,desired_role').eq('user_id',user.id).maybeSingle();dbError(seekerError);
     const {data:jobs,error}=await db().from('jobs').select('id,title,company_name,requirements,description,category').eq('status','published').order('published_at',{ascending:false}).limit(60);dbError(error);
     const matches=(jobs||[]).map((job:any)=>({...matchJobSkills(normalizeSkills(seeker?.skills),job.requirements,job.title),job:{id:job.id,title:job.title,company_name:job.company_name}}));
     return ok({role:profile.role,method:'Keyword-based skill overlap (not a trained AI model)',items:matches.filter(item=>item.required.length).sort((a,b)=>b.matched.length-a.matched.length).slice(0,5),info:'Suggestions use profile skills and published job requirements. Matching does not determine eligibility.'});
   }
   if(profile.role==='employer'){
     const {data:jobs,error}=await db().from('jobs').select('id').eq('employer_id',user.id);dbError(error);
     const ids=(jobs||[]).map((job:any)=>job.id);
     const {count}=ids.length?await db().from('applications').select('id',{head:true,count:'exact'}).in('job_id',ids):{count:0};
     return ok({role:profile.role,method:'Descriptive workflow insights',items:[{title:'Submitted applications',value:count||0},{title:'Your job postings',value:ids.length}],info:'Open Candidate Pipeline to see transparent skill overlaps. Matching does not make hiring decisions.'});
   }
   if(profile.role==='lgu_admin'){
     const {count:pending}=await db().from('verification_submissions').select('id',{head:true,count:'exact'}).eq('status','pending');
     const {count:jobs}=await db().from('jobs').select('id',{head:true,count:'exact'}).eq('status','pending');
     const {count:removals}=await db().from('resume_removal_requests').select('id',{head:true,count:'exact'}).eq('status','pending');
     return ok({role:profile.role,method:'Queue monitoring',items:[{title:'People pending review',value:pending||0},{title:'Jobs pending approval',value:jobs||0},{title:'Resume removal requests',value:removals||0}],info:'Counts come from live records. LGU staff review every case manually.'});
   }
   const {count:accounts}=await db().from('profiles').select('id',{head:true,count:'exact'});
   const {count:applications}=await db().from('applications').select('id',{head:true,count:'exact'});
   return ok({role:profile.role,method:'Platform activity summary',items:[{title:'Registered accounts',value:accounts||0},{title:'Applications',value:applications||0}],info:'Open Reports & Insights for transparent time-series analytics and forecasts.'});
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
     stats={jobseekers:await count('profiles','role','jobseeker'),jobs:ids.length,applicants:appCount||0,published:(await db().from('jobs').select('id',{count:'exact',head:true}).eq('employer_id',user.id).eq('status','published')).count||0};
   }
   if(profile.role==='lgu_admin') {
     stats={pending_reviews:await count('verification_submissions','status','pending'),jobseekers:await count('profiles','role','jobseeker'),jobs:await count('jobs'),applications:await count('applications')};
   }
   if(profile.role==='sys_admin') {
     stats={users:await count('profiles'),jobs:await count('jobs'),applications:await count('applications'),hires:await count('employment_records')};
   }
   const {count:unread}=await db().from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null);
   return ok({stats,unread:unread||0,profile:{id:profile.id,full_name:profile.full_name,role:profile.role,lgu_status:profile.lgu_status}});
 }

 if(routeIs(parts,'reports')&&method==='GET') {
   await currentUser(['lgu_admin','sys_admin'],true);
   const data=await reportData(q('start'),q('end'),q('period'));
   if(q('format')==='csv')return new NextResponse(csvReport(data),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="joblinklocal-report.csv"','Cache-Control':'private, no-store'}});
   if(q('format')==='pdf')return new NextResponse(Uint8Array.from(await pdfReport(data)).buffer as ArrayBuffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="joblinklocal-report.pdf"','Cache-Control':'private, no-store'}});
   return ok(data);
 }

 fail('Endpoint not found.',404);
}
