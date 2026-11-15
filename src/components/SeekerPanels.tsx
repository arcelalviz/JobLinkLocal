'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, MapPin, BriefcaseBusiness, Bookmark, Search, SlidersHorizontal, Clock3, CircleCheck, ArrowRight, FileText, X, CalendarDays, Compass } from 'lucide-react';
import { request } from '@/lib/http';
import { useToast } from '@/components/ToastProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Job, Profile } from '@/types';

const statusLabel:Record<string,string>={applied:'Applied',reviewing:'Under review',shortlisted:'Shortlisted',interviewing:'Interview stage',accepted:'Accepted',rejected:'Not selected',hired:'Hired',employment_ended:'Employment ended',withdrawn:'Withdrawn'};
const money=(v:number|null|undefined)=>v==null?'Not listed':'₱'+v.toLocaleString('en-PH');

export function SeekerPanels({tab,me,refresh,bump}:{tab:string;me:Profile;refresh:number;bump:()=>void}) {
 const toast=useToast();
 const [jobs,setJobs]=useState<Job[]>([]);
 const [saved,setSaved]=useState<any[]>([]);
 const [applications,setApplications]=useState<any[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [search,setSearch]=useState('');
 const [setup,setSetup]=useState('All');
 const [type,setType]=useState('All');
 const [apply,setApply]=useState(false);
 const [cover,setCover]=useState('');
 const [screening,setScreening]=useState('');
 const [busy,setBusy]=useState(false);
 const [withdraw,setWithdraw]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const load=()=>{
   setLoading(true);
   Promise.all([request<Job[]>('jobs'),request<any[]>('saved'),request<any[]>('applications')])
    .then(([j,s,a])=>{setJobs(j);setSaved(s);setApplications(a);setSelected(p=>p||j[0]?.id||null);})
    .catch(e=>toast.show(e instanceof Error?e.message:'Could not load opportunities.','error'))
    .finally(()=>setLoading(false));
 };
 useEffect(load,[refresh]);
 const savedIds=new Set(saved.map(s=>s.job_id));
 const appliedIds=new Set(applications.map(a=>a.job_id));
 const all=tab==='saved'?saved.map(s=>s.jobs).filter(Boolean) as Job[]:jobs;
 const filtered=useMemo(()=>all.filter(j=>`${j.title} ${j.company_name} ${j.location}`.toLowerCase().includes(search.toLowerCase())&&(setup==='All'||j.work_setup===setup)&&(type==='All'||j.employment_type===type)),[all,search,setup,type]);
 const selectedJob=filtered.find(j=>j.id===selected)||filtered[0];
 const toggleSave=async(job:Job)=>{
   try{const wasSaved=savedIds.has(job.id);await request('saved','POST',{job_id:job.id,remove:wasSaved});toast.show(wasSaved?'Removed from saved jobs.':'Opportunity saved.','success');load();}
   catch(e){toast.show(e instanceof Error?e.message:'Could not update saved jobs.','error');}
 };
 const submitApplication=async()=>{
   if(!selectedJob)return;
   setBusy(true);
   try{
     await request('applications','POST',{job_id:selectedJob.id,cover_letter:cover,screening_response:screening});
     toast.show('Application sent.','success','You can follow its progress in My applications.');setApply(false);setCover('');setScreening('');load();bump();
   }catch(e){toast.show(e instanceof Error?e.message:'Application failed.','error');}
   finally{setBusy(false);}
 };
 if(tab==='applications')return <div className="panel-stack"><div className="section-topline"><div><span className="eyebrow dark-eyebrow">YOUR CAREER TIMELINE</span><h2>Every move, accounted for.</h2></div><span className="count-indicator">{applications.length} applications</span></div>
   {!applications.length?<Empty icon={<FileText size={34}/>} title="Your story starts with an application." detail="Find a role that feels right, upload your resume, and take the first step."/>:<div className="application-list">{applications.map(a=><article className="application-card" key={a.id}><div className="application-card-top"><div className="application-logo"><BriefcaseBusiness size={23}/></div><div><span className="item-overline">{a.jobs?.company_name}</span><h3>{a.jobs?.title||'Position'}</h3><p><MapPin size={13}/>{a.jobs?.location||'Local opportunity'} <span className="dot-separator"/> Applied {new Date(a.created_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium'})}</p></div><span className={`stage-badge stage-${a.status}`}>{statusLabel[a.status]||a.status}</span></div><div className="application-stage"><span className="stage-track"><span className={`stage-fill ${a.status==='rejected'?'is-rejected':''}`} style={{width:a.status==='applied'?'20%':a.status==='reviewing'?'40%':a.status==='shortlisted'||a.status==='interviewing'?'60%':a.status==='accepted'?'80%':'100%'}}/></span><span className="stage-caption">APPLICATION → REVIEW → DECISION → EMPLOYMENT</span></div>{a.employer_note&&<div className="employer-note"><span>NOTE FROM EMPLOYER</span><p>{a.employer_note}</p></div>}{a.employment_records?.map((emp:any)=><div className="employment-record" key={emp.id}><CircleCheck size={17}/><div><strong>{emp.status==='active'?'Employment recorded':'Employment completed'}</strong><p>Started {emp.started_on}{emp.ended_on?` · Ended ${emp.ended_on}`:''}</p>{emp.hire_note&&<small>Hiring note: {emp.hire_note}</small>}{emp.end_note&&<small>Employment-ending note: {emp.end_note}</small>}</div></div>)}{['applied','reviewing'].includes(a.status)&&<button className="text-action danger-text" onClick={()=>setWithdraw(a.id)}>Withdraw application <ArrowUpRight size={14}/></button>}</article>)}</div>}
   <ConfirmDialog open={!!withdraw} title="Withdraw this application?" body="The employer will no longer consider this application. This action cannot be undone." confirmLabel="Withdraw application" danger onCancel={()=>setWithdraw(null)} onConfirm={async()=>{if(!withdraw)return;try{await request(`applications/${withdraw}`,'PATCH',{});toast.show('Application withdrawn.','success');load();}catch(e){toast.show(e instanceof Error?e.message:'Unable to withdraw.','error');}setWithdraw(null);}}/>
 </div>;
 return <div className="panel-stack"><div className="section-topline"><div><span className="eyebrow dark-eyebrow">{tab==='saved'?'YOUR SHORTLIST':'EXPLORE WHAT IS POSSIBLE'}</span><h2>{tab==='saved'?'Good opportunities, kept close.':'Find something that fits.'}</h2></div><span className="count-indicator">{filtered.length} opportunities</span></div><div className="job-filters"><div className="job-search"><Search size={20}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search titles, companies, locations" aria-label="Search jobs"/></div><label className="filter-control"><SlidersHorizontal size={17}/><select aria-label="Work arrangement" value={setup} onChange={e=>setSetup(e.target.value)}><option>All</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label><label className="filter-control"><select aria-label="Employment type" value={type} onChange={e=>setType(e.target.value)}><option>All</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option><option>Temporary</option></select></label></div>
  {loading?<div className="loading-panel">Finding your next possibility…</div>:!filtered.length?<Empty icon={<Search size={36}/>} title="Nothing here—yet." detail="Try changing your filters or check back when new employers join the network."/>:<div className="job-browser"><div className="job-browser-list">{filtered.map((job,i)=><button key={job.id} className={`browse-job-card ${selectedJob?.id===job.id?'picked':''}`} onClick={()=>setSelected(job.id)}><div className="browse-top"><span className="mini-icon"><BriefcaseBusiness size={19}/></span><span className="browse-index">{String(i+1).padStart(2,'0')}</span></div><span className="item-overline">{job.company_name}</span><h3>{job.title}</h3><p><MapPin size={14}/>{job.location}</p><div className="browse-meta"><span>{job.employment_type}</span><span>{job.work_setup}</span></div></button>)}</div><div className="job-detail-panel" key={selectedJob?.id}>{selectedJob&&<><div className="detail-head"><span className="detail-symbol"><Compass size={25} strokeWidth={1.6}/></span><button className={`save-trigger ${savedIds.has(selectedJob.id)?'is-saved':''}`} onClick={()=>toggleSave(selectedJob)} aria-label={savedIds.has(selectedJob.id)?'Unsave job':'Save job'}><Bookmark size={20} fill={savedIds.has(selectedJob.id)?'currentColor':'none'}/></button></div><span className="eyebrow dark-eyebrow">{selectedJob.company_name} / {selectedJob.category}</span><h2>{selectedJob.title}</h2><div className="detail-badges"><span><MapPin size={14}/>{selectedJob.location}</span><span><BriefcaseBusiness size={14}/>{selectedJob.employment_type}</span><span><Clock3 size={14}/>{selectedJob.work_setup}</span></div><div className="detail-salary"><span>MONTHLY SALARY RANGE</span><strong>{selectedJob.salary_min!=null?`${money(selectedJob.salary_min)}${selectedJob.salary_max!=null?` – ${money(selectedJob.salary_max)}`:''}`:'To be discussed'}</strong></div><div className="detail-section"><h4>The role</h4><p>{selectedJob.description}</p></div><div className="detail-section"><h4>What they're looking for</h4><p>{selectedJob.requirements}</p></div>{selectedJob.benefits&&<div className="detail-section"><h4>Why you'll love it</h4><p>{selectedJob.benefits}</p></div>}<div className="job-detail-footer"><span>{selectedJob.vacancies} opening{selectedJob.vacancies!==1?'s':''} available</span><button className="btn btn-ink" disabled={appliedIds.has(selectedJob.id)} onClick={()=>{if(me.lgu_status!=='approved'){toast.show('LGU verification required.','warning','Upload your credentials before applying.');return;}setApply(true);}}>{appliedIds.has(selectedJob.id)?'Already applied':'Apply for this role'} <ArrowUpRight size={17}/></button></div></>}</div></div>}
  <AnimatePresence>{apply&&selectedJob&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="form-modal" role="dialog" aria-modal="true" aria-labelledby="apply-title" initial={{y:26,opacity:0}} animate={{y:0,opacity:1}} exit={{y:12,opacity:0}}><button className="dialog-close" onClick={()=>setApply(false)}><X size={18}/></button><span className="eyebrow dark-eyebrow">YOUR NEXT MOVE</span><h2 id="apply-title">Apply for {selectedJob.title}</h2><p>{selectedJob.company_name} · Your most recently uploaded resume will be attached securely.</p><label className="form-field"><span>Introduce yourself to the employer</span><textarea rows={6} placeholder="Share your motivation, relevant skills and what makes you a strong fit." value={cover} onChange={e=>setCover(e.target.value)}/></label>{selectedJob.screening_questions&&<label className="form-field"><span>Employer screening questions</span><p className="form-hint">{selectedJob.screening_questions}</p><textarea rows={4} value={screening} onChange={e=>setScreening(e.target.value)} placeholder="Answer the employer's screening prompts."/></label>}<div className="dialog-actions"><button className="btn btn-quiet" onClick={()=>setApply(false)}>Cancel</button><button className="btn btn-ink" disabled={busy} onClick={submitApplication}>{busy?'Submitting…':'Send application'} <ArrowUpRight size={17}/></button></div></motion.div></motion.div>}</AnimatePresence>
 </div>;
}

function Empty({icon,title,detail}:{icon:React.ReactNode;title:string;detail:string}){
 return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{detail}</p></div>;
}
