'use client';
import { useEffect,useState } from 'react';
import { ArrowUpRight, Check, FileText, UploadCloud, ShieldCheck, Bell, BellOff, Inbox, UserRound, BriefcaseBusiness, ExternalLink, Clock3, CircleCheck, AlertCircle } from 'lucide-react';
import { request } from '@/lib/http';
import { useToast } from '@/components/ToastProvider';
import type { Profile } from '@/types';

const val=(v:any)=>Array.isArray(v)?v[0]||{}:v||{};

export function AccountPanels({tab,me,refresh,bump,updateMe}:{tab:string;me:Profile;refresh:number;bump:()=>void;updateMe:(p:Profile)=>void}){
 const toast=useToast();
 const [data,setData]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [docFiles,setDocFiles]=useState<File[]>([]);
 const [resume,setResume]=useState<File|null>(null);
 const [statement,setStatement]=useState('');
 const [form,setForm]=useState<any>({full_name:me.full_name,phone:me.phone||'',city:me.city||'',province:me.province||'',bio:me.bio||'',...val(me.seeker_profiles),...val(me.employer_profiles)});
 useEffect(()=>{
   if(tab==='profile'){setLoading(false);return;}
   setLoading(true);
   request<any[]>(tab==='verification'?'verification':'notifications').then(setData).catch(e=>toast.show(e instanceof Error?e.message:'Could not load records.','error')).finally(()=>setLoading(false));
 },[tab,refresh]);
 const update=(key:string,value:any)=>setForm((old:any)=>({...old,[key]:value}));
 const saveProfile=async(e:React.FormEvent)=>{
   e.preventDefault();setBusy(true);
   try{
     const result=await request<Profile>('profile','PATCH',form);updateMe(result);toast.show('Profile updated.','success','Your information has been saved.');bump();
   }catch(err){toast.show(err instanceof Error?err.message:'Could not update profile.','error');}
   finally{setBusy(false);}
 };
 const sendDocuments=async()=>{
   if(!docFiles.length){toast.show('Choose at least one document.','warning');return;}
   setBusy(true);
   try{
     const form=new FormData();docFiles.forEach(f=>form.append('documents',f));form.set('statement',statement);
     await request('verification','POST',form);
     toast.show('Credentials sent for LGU review.','success');setDocFiles([]);setStatement('');updateMe(await request<Profile>('me'));bump();
   }catch(err){toast.show(err instanceof Error?err.message:'Unable to upload documents.','error');}
   finally{setBusy(false);}
 };
 const sendResume=async()=>{
   if(!resume)return;
   setBusy(true);
   try{
     const form=new FormData();form.set('resume',resume);
     await request('resume','POST',form);toast.show('Resume uploaded.','success','Your next applications will include this PDF.');setResume(null);updateMe(await request<Profile>('me'));bump();
   }catch(err){toast.show(err instanceof Error?err.message:'Resume upload failed.','error');}
   finally{setBusy(false);}
 };
 if(tab==='notifications')return <div className="panel-stack"><div className="section-topline"><div><span className="eyebrow dark-eyebrow">THE THINGS WORTH KNOWING</span><h2>Every update, one calm place.</h2></div><button className="btn btn-outline btn-small" onClick={async()=>{try{await request('notifications','PATCH',{all:true});toast.show('All caught up.','success');bump();}catch(e){toast.show('Unable to mark notifications.','error');}}}><Check size={16}/> Mark all read</button></div>{loading?<div className="loading-panel">Checking your notifications…</div>:!data.length?<div className="empty-state"><div className="empty-icon"><BellOff size={38}/></div><h3>It's quiet for now.</h3><p>When something important happens, it'll appear right here.</p></div>:<div className="notification-list">{data.map(n=><div className={`notification-item ${n.read_at?'':'unread'}`} key={n.id}><div className="notification-kind"><Bell size={21}/></div><div><span className="item-overline">{n.kind.toUpperCase()} / {new Date(n.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</span><h3>{n.title}</h3><p>{n.body}</p>{n.link&&<a href={n.link} className="text-action">See related page <ArrowUpRight size={15}/></a>}</div>{!n.read_at&&<button className="notification-read" title="Mark as read" onClick={async()=>{try{await request('notifications','PATCH',{id:n.id});setData(prev=>prev.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x));bump();}catch{toast.show('Unable to mark read.','error');}}}><CircleCheck size={20}/></button>}</div>)}</div>}</div>;
 if(tab==='verification'){
   const latest=data[0];
   const pending=latest?.status==='pending';
   return <div className="panel-stack"><div className="verification-head"><div className="verification-head-icon"><ShieldCheck size={36}/></div><div><span className="eyebrow dark-eyebrow">VERIFICATION BRINGS TRUST</span><h2>Prove who you are. Go further.</h2><p>To protect our community, both jobseekers and employers must have their credentials checked by the LGU before using restricted features.</p></div></div><div className="verification-layout"><div className="verification-primary"><div className="form-panel"><div className="form-panel-title"><h3>Submit your credentials</h3><span className={`stage-badge stage-${me.lgu_status}`}>{me.lgu_status==='approved'?'LGU approved':me.lgu_status==='rejected'?'Needs changes':me.lgu_status==='pending'?'Review pending':'Suspended'}</span></div>{me.lgu_status==='approved'?<div className="verified-message"><CircleCheck size={26}/><h4>You're verified.</h4><p>Your credentials have been approved. You can now {me.role==='jobseeker'?'apply to jobs':'submit jobs for LGU review'}.</p></div>:pending?<div className="verified-message awaiting"><Clock3 size={26}/><h4>Review in progress.</h4><p>The LGU has received your credentials. You'll receive an in-app notification after review.</p></div>:<div className="form-stack"><p className="form-hint">{me.role==='employer'?'Upload business registration, authorized representative identification and other relevant evidence.':'Upload your valid identification and any additional documents requested by your LGU.'} Supported files: PDF, JPG and PNG, up to 5 MB each.</p><label className="upload-zone"><UploadCloud size={30}/><strong>{docFiles.length?`${docFiles.length} file${docFiles.length>1?'s':''} selected`:'Choose verification documents'}</strong><span>1–3 files, private and securely stored</span><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={e=>setDocFiles(Array.from(e.target.files||[]).slice(0,3))}/></label>{docFiles.map(f=><div className="file-picked" key={f.name}><FileText size={15}/>{f.name}</div>)}<label className="form-field"><span>Additional context for LGU review</span><textarea value={statement} rows={3} onChange={e=>setStatement(e.target.value)} placeholder="Briefly describe your submitted documents."/></label><button className="btn btn-ink" disabled={busy||!docFiles.length} onClick={sendDocuments}>{busy?'Uploading…':'Submit documents'} <ArrowUpRight size={18}/></button></div>}</div>
   {me.role==='jobseeker'&&<div className="form-panel"><div className="form-panel-title"><h3>Your resume</h3><span className="pill pill-quiet">PRIVATE</span></div><p className="form-hint">Upload a PDF resume before you apply. Only employers who receive your application may access the attached version.</p>{val(me.seeker_profiles).resume_path&&<p className="resume-existing"><CircleCheck size={17}/> A resume is on file</p>}<label className="upload-zone upload-zone-small"><UploadCloud size={25}/><strong>{resume?resume.name:'Choose a PDF resume'}</strong><input type="file" accept="application/pdf,.pdf" onChange={e=>setResume(e.target.files?.[0]||null)}/></label><button className="btn btn-outline" disabled={busy||!resume} onClick={sendResume}>{busy?'Uploading…':'Save resume'} <ArrowUpRight size={16}/></button></div>}
   </div><aside className="verification-history"><h3>Verification history</h3>{data.length?data.map(item=><div className="verification-history-row" key={item.id}><span className={`history-dot history-${item.status}`}/><div><strong>{item.status==='pending'?'Awaiting review':item.status==='approved'?'Approved':'Changes requested'}</strong><small>{new Date(item.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</small>{item.reviewer_note&&<p>{item.reviewer_note}</p>}{item.verification_documents?.map((doc:any)=><a key={doc.id} href={`/api/files/document/${doc.id}`} target="_blank" rel="noopener noreferrer"><FileText size={13}/>{doc.filename}</a>)}</div></div>):<p className="dim">No submissions yet.</p>}</aside></div></div>;
 }
 const field=(label:string,key:string,placeholder:string,type='text')=><label className="form-field" key={key}><span>{label}</span><input type={type} value={form[key]??''} placeholder={placeholder} onChange={e=>update(key,e.target.value)}/></label>;
 return <div className="panel-stack"><div className="section-topline"><div><span className="eyebrow dark-eyebrow">WHO YOU ARE MATTERS</span><h2>Your profile. Your story.</h2></div><span className="count-indicator">{me.role.replace('_',' ')}</span></div><form noValidate className="profile-layout" onSubmit={saveProfile}><div className="form-panel"><div className="profile-persona"><div className="large-avatar">{me.full_name.slice(0,1).toUpperCase()}</div><div><h3>{me.full_name}</h3><p>{me.email}</p></div><span className={`stage-badge stage-${me.lgu_status}`}>{me.lgu_status}</span></div><h3>Personal information</h3><div className="form-two">{field('Full name','full_name','Your name')}{field('Phone number','phone','Contact number')}</div><div className="form-two">{field('City or municipality','city','Olongapo City')}{field('Province','province','Zambales')}</div><label className="form-field"><span>A few words about you</span><textarea rows={4} value={form.bio??''} onChange={e=>update('bio',e.target.value)} placeholder="Tell the community a little more about yourself."/></label></div>{me.role==='jobseeker'&&<div className="form-panel"><h3>Your career profile</h3><div className="form-two">{field('Educational attainment','education','College')}{field('Desired role','desired_role','Your ideal role')}</div><div className="form-two">{field('Years of experience','experience_years','0','number')}<label className="form-field"><span>Preferred work setup</span><select value={form.preferred_work_setup??'On-site'} onChange={e=>update('preferred_work_setup',e.target.value)}>{['On-site','Remote','Hybrid'].map(s=><option key={s}>{s}</option>)}</select></label></div><label className="form-field"><span>Skills, separated by commas</span><input value={Array.isArray(form.skills)?form.skills.join(', '):form.skills||''} onChange={e=>update('skills',e.target.value.split(',').map(x=>x.trim()))} placeholder="Microsoft Excel, Customer Service, React"/></label>{field('Portfolio URL','portfolio_url','https://yourportfolio.com')}{field('LinkedIn profile','linkedin_url','https://linkedin.com/in/...')}</div>}{me.role==='employer'&&<div className="form-panel"><h3>Business profile</h3><p className="form-hint">Changing the legal business name or registration number requires renewed LGU verification.</p><div className="form-two">{field('Business name','business_name','Organization name')}{field('Industry','industry','Technology')}</div><div className="form-two">{field('Business type','business_type','Corporation')}{field('Registration number','registration_number','Registration ID')}</div><div className="form-two">{field('Team size','team_size','11–50')}{field('Your position','contact_position','Hiring manager')}</div>{field('Business website','website','https://business.com')}<label className="form-field"><span>About your company</span><textarea rows={5} value={form.business_description??''} onChange={e=>update('business_description',e.target.value)}/></label></div>}<button type="submit" className="btn btn-ink btn-profile-save" disabled={busy}>{busy?'Saving changes…':'Save profile changes'} <ArrowUpRight size={18}/></button></form></div>;
}
