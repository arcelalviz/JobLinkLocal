'use client';
import { useEffect,useState } from 'react';
import { AnimatePresence,motion } from 'motion/react';
import { ArrowUpRight, Plus, Building2, Clock3, MapPin, Edit3, X, BriefcaseBusiness, Users, CalendarDays, CircleCheck, ArrowRight, Archive, Filter, FileText } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { request } from '@/lib/http';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Profile,Job } from '@/types';

const todayInManila=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=(name:string)=>parts.find(item=>item.type===name)?.value||'';
 return `${part('year')}-${part('month')}-${part('day')}`;
};
const newJob={title:'',category:'Technology',description:'',requirements:'',benefits:'',location:'',work_setup:'On-site',employment_type:'Full-time',experience_level:'Entry level',salary_min:'',salary_max:'',vacancies:'1',schedule:'',deadline:'',screening_questions:''};
const statuses=['reviewing','shortlisted','interviewing','accepted','rejected','hired'];
const statusNames:Record<string,string>={applied:'New applicant',reviewing:'Under review',shortlisted:'Shortlisted',interviewing:'Interviewing',accepted:'Accepted',rejected:'Not selected',hired:'Hired',employment_ended:'Employment ended',withdrawn:'Withdrawn'};

export function EmployerPanels({tab,me,refresh,bump}:{tab:string;me:Profile;refresh:number;bump:()=>void}){
 const toast=useToast();
 const [data,setData]=useState<any>({jobs:[],applications:[],employment:[]});
 const [form,setForm]=useState(newJob);
 const [editing,setEditing]=useState<string|null>(null);
 const [formOpen,setFormOpen]=useState(false);
 const [decision,setDecision]=useState<any>(null);
 const [decisionValue,setDecisionValue]=useState('reviewing');
 const [note,setNote]=useState('');
 const [startDate,setStartDate]=useState(todayInManila());
 const [endRecord,setEndRecord]=useState<any>(null);
 const [endDate,setEndDate]=useState(todayInManila());
 const [closeJob,setCloseJob]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [filter,setFilter]=useState('All');
 const load=()=>{setLoading(true);request('employer').then(setData).catch(e=>toast.show(e instanceof Error?e.message:'Could not load hiring data.','error')).finally(()=>setLoading(false));};
 useEffect(load,[refresh]);
 const update=(key:keyof typeof newJob,value:string)=>setForm(v=>({...v,[key]:value}));
 const startPost=()=>{if(me.lgu_status!=='approved'){toast.show('LGU approval required.','warning','Submit business credentials before posting.');return;}setEditing(null);setForm(newJob);setFormOpen(true);};
 const editPost=(job:Job)=>{setEditing(job.id);setForm(Object.fromEntries(Object.keys(newJob).map(k=>[k,(job as any)[k]==null?'':String((job as any)[k])])) as typeof newJob);setFormOpen(true);};
 const submitJob=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!form.title.trim()||form.description.trim().length<60||form.requirements.trim().length<20||!form.location.trim()){toast.show('Complete the job title, description, requirements and location.','warning','Description needs 60 characters, requirements 20.');return;}
  setBusy(true);
  try{
   const payload={...form,salary_min:form.salary_min?Number(form.salary_min):null,salary_max:form.salary_max?Number(form.salary_max):null,vacancies:Number(form.vacancies)};
   await request(editing?`jobs/${editing}`:'jobs',editing?'PATCH':'POST',payload);
   toast.show('Job sent for LGU review.','success','You can track its status in My job posts.');setFormOpen(false);load();bump();
  }catch(err){toast.show(err instanceof Error?err.message:'Could not submit job.','error');}
  finally{setBusy(false);}
 };
 const submitDecision=async()=>{
  if(!decision)return;
  if(note.trim().length<4){toast.show('Please add an explanation.','warning','Provide a professional note of at least 4 characters.');return;}
  setBusy(true);
  try{
   await request('employer/decision','POST',{id:decision.id,decision:decisionValue,note,start_date:decisionValue==='hired'?startDate:null});
   toast.show('Decision recorded.','success','The applicant can review your decision and message in their account.');setDecision(null);setNote('');load();bump();
  }catch(e){toast.show(e instanceof Error?e.message:'Decision failed.','error');}
  finally{setBusy(false);}
 };
 const submitEnd=async()=>{
  if(!endRecord)return;
  if(note.trim().length<8){toast.show('Please explain the employment change.','warning','Provide an explanation of at least 8 characters.');return;}
  setBusy(true);
  try{
   await request('employer/end','POST',{id:endRecord.id,ended_on:endDate,note});
   toast.show('Employment separation recorded.','success','The employee can review the date and explanatory note in their account.');setEndRecord(null);setNote('');load();bump();
  }catch(e){toast.show(e instanceof Error?e.message:'Employment update failed.','error');}
  finally{setBusy(false);}
 };
 const field=(label:string,key:keyof typeof newJob,placeholder:string,required=false,type='text')=><label key={key} className="form-field"><span>{label}</span><input required={required} value={form[key]} type={type} placeholder={placeholder} onChange={e=>update(key,e.target.value)}/></label>;
 if(tab==='candidates'){
  const filtered=data.applications.filter((a:any)=>filter==='All'||a.status===filter);
  return <div className="panel-stack"><div className="section-topline"><div><span className="eyebrow dark-eyebrow">RECRUITMENT PIPELINE</span><h2>The people behind the potential.</h2></div><span className="count-indicator">{data.applications.length} candidate applications</span></div>
   <div className="job-filters"><label className="filter-control"><Filter size={17}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{Object.keys(statusNames).map(v=><option key={v} value={v}>{statusNames[v]}</option>)}</select></label></div>
   {loading?<div className="loading-panel">Loading candidate pipeline…</div>:!filtered.length?<Empty title="Your hiring journey starts here." detail="Applications will appear when verified jobseekers apply for your approved postings."/>:<div className="candidate-list">{filtered.map((a:any)=><div className="candidate-card" key={a.id}><div className="candidate-main"><div className="candidate-avatar">{(a.seeker?.full_name||'A').slice(0,1).toUpperCase()}</div><div><span className="item-overline">APPLICANT / {a.job?.title}</span><h3>{a.seeker?.full_name||'Candidate'}</h3><p>{a.seeker?.city||'Local candidate'} · {a.seeker?.seeker_profiles?.[0]?.desired_role||'Open to opportunities'}</p><div className="candidate-skills">{(a.seeker?.seeker_profiles?.[0]?.skills||[]).filter(Boolean).slice(0,4).map((s:string)=><span key={s}>{s}</span>)}</div></div></div><div className="candidate-right"><span className={`stage-badge stage-${a.status}`}>{statusNames[a.status]||a.status}</span><span className="candidate-date">Applied {new Date(a.created_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</span><div className="candidate-actions">{a.screening_response&&<div className="candidate-screening"><strong>Screening response</strong><p>{a.screening_response}</p></div>}{a.resume_path&&<a className="text-action" href={`/api/files/resume?application=${encodeURIComponent(a.id)}`} target="_blank" rel="noopener noreferrer"><FileText size={15}/> Resume</a>}{!['rejected','hired','employment_ended','withdrawn'].includes(a.status)&&<button className="btn btn-ink btn-small" onClick={()=>{setDecision(a);setDecisionValue(a.status==='applied'?'reviewing':a.status);setNote(a.employer_note||'');}}>Record decision <ArrowUpRight size={15}/></button>}</div></div></div>)}
   </div>}
   {!!data.employment.length&&<div className="employment-section"><div className="section-topline"><div><span className="eyebrow dark-eyebrow">EMPLOYMENT RECORDS</span><h2>Beyond the hire.</h2></div></div><div className="record-grid">{data.employment.map((emp:any)=><article className="record-card" key={emp.id}><div className="record-top"><CircleCheck size={20}/><span className={`stage-badge stage-${emp.status}`}>{emp.status}</span></div><h3>{data.applications.find((a:any)=>a.id===emp.application_id)?.seeker?.full_name||'Team member'}</h3><p>Started {emp.started_on}{emp.ended_on?` · Ended ${emp.ended_on}`:''}</p>{emp.hire_note&&<small>{emp.hire_note}</small>}{emp.end_note&&<div className="employer-note"><span>SEPARATION NOTE</span><p>{emp.end_note}</p></div>}{emp.status==='active'&&<button className="text-action danger-text" onClick={()=>{setEndRecord(emp);setEndDate(todayInManila());setNote('');}}>Record employment separation <ArrowUpRight size={15}/></button>}</article>)}</div></div>}
   <AnimatePresence>{decision&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div role="dialog" aria-modal="true" aria-labelledby="decision-title" className="form-modal" initial={{opacity:0,y:25}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><button className="dialog-close" onClick={()=>setDecision(null)}><X size={18}/></button><span className="eyebrow dark-eyebrow">YOUR DECISION MATTERS</span><h2 id="decision-title">Update {decision.seeker?.full_name||'candidate'}</h2><p>{decision.job?.title}. Your note will be visible to the candidate.</p><label className="form-field"><span>New application status</span><select value={decisionValue} onChange={e=>setDecisionValue(e.target.value)}>{statuses.map(s=><option key={s} value={s}>{statusNames[s]}</option>)}</select></label>{decisionValue==='hired'&&<label className="form-field"><span>Employment start date</span><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>}<label className="form-field"><span>Note to the candidate</span><textarea rows={5} value={note} onChange={e=>setNote(e.target.value)} placeholder="Share clear, respectful feedback and any next steps."/></label><div className="dialog-actions"><button className="btn btn-quiet" onClick={()=>setDecision(null)}>Cancel</button><button className="btn btn-ink" disabled={busy} onClick={submitDecision}>{busy?'Saving…':'Record decision'} <ArrowUpRight size={17}/></button></div></motion.div></motion.div>}</AnimatePresence>
   <AnimatePresence>{endRecord&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div role="dialog" aria-modal="true" aria-labelledby="end-title" className="form-modal" initial={{opacity:0,y:25}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><button className="dialog-close" onClick={()=>setEndRecord(null)}><X size={18}/></button><span className="eyebrow dark-eyebrow">EMPLOYMENT LIFECYCLE</span><h2 id="end-title">Record employment separation</h2><p>This is a platform status record, not a substitute for any legally required employment notice. Your note will be shared with the jobseeker.</p><label className="form-field"><span>Effective end date</span><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label><label className="form-field"><span>Reason and explanatory note</span><textarea required rows={6} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain the status update clearly and respectfully."/></label><div className="dialog-actions"><button className="btn btn-quiet" onClick={()=>setEndRecord(null)}>Cancel</button><button className="btn btn-danger" disabled={busy||note.trim().length<8} onClick={submitEnd}>{busy?'Recording…':'Record separation'} <ArrowUpRight size={17}/></button></div></motion.div></motion.div>}</AnimatePresence>
  </div>;
 }
 return <div className="panel-stack"><div className="section-topline"><div><span className="eyebrow dark-eyebrow">HIRING OPPORTUNITIES</span><h2>Put your next opening out there.</h2></div><button className="btn btn-ink" onClick={startPost}><Plus size={17}/> Create job posting</button></div>
   {loading?<div className="loading-panel">Loading job postings…</div>:!data.jobs.length?<Empty title="Your hiring story starts with a post." detail="Describe your opportunity, submit it for LGU review, and connect with local candidates."/>:<div className="employer-job-grid">{data.jobs.map((job:Job)=><article className="employer-job-card" key={job.id}><div className="employer-job-top"><span className="company-mark"><BriefcaseBusiness size={21}/></span><span className={`stage-badge stage-${job.status}`}>{job.status==='published'?'Live':job.status==='pending'?'LGU review':job.status==='rejected'?'Changes required':'Closed'}</span></div><span className="item-overline">{job.category} / {job.employment_type}</span><h3>{job.title}</h3><p><MapPin size={15}/>{job.location}</p><div className="employer-job-bottom"><span>{data.applications.filter((a:any)=>a.job_id===job.id).length} applicants</span><div>{['rejected','pending'].includes(job.status)&&<button className="icon-btn" title="Edit job" onClick={()=>editPost(job)}><Edit3 size={17}/></button>}{['published','pending'].includes(job.status)&&<button title="Close job" className="icon-btn" onClick={()=>setCloseJob(job.id)}><Archive size={17}/></button>}</div></div>{job.review_note&&<div className="employer-note"><span>LGU FEEDBACK</span><p>{job.review_note}</p></div>}</article>)}</div>}
   <AnimatePresence>{formOpen&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div role="dialog" aria-modal="true" aria-labelledby="post-title" className="form-modal form-modal-wide" initial={{opacity:0,y:25}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><button className="dialog-close" onClick={()=>setFormOpen(false)}><X size={18}/></button><span className="eyebrow dark-eyebrow">A GREAT ROLE DESERVES GREAT DETAILS</span><h2 id="post-title">{editing?'Refine your opening.':'Create a new opening.'}</h2><p>Every posting goes through LGU approval before becoming public.</p><form noValidate className="form-stack" onSubmit={submitJob}><div className="form-two">{field('Job title','title','e.g. Customer Support Specialist',true)}<label className="form-field"><span>Category</span><select value={form.category} onChange={e=>update('category',e.target.value)}>{['Technology','Healthcare','Education','Retail','Hospitality','Construction','Transport','Administration','Creative','Finance','Engineering','Other'].map(v=><option key={v}>{v}</option>)}</select></label></div><label className="form-field"><span>About the opportunity</span><textarea rows={5} required minLength={60} value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Describe what this person will do, the mission and expectations."/></label><label className="form-field"><span>Requirements and qualifications</span><textarea rows={4} required minLength={20} value={form.requirements} onChange={e=>update('requirements',e.target.value)} placeholder="Skills, qualifications and experience needed."/></label><label className="form-field"><span>Benefits and what you offer</span><textarea rows={3} value={form.benefits} onChange={e=>update('benefits',e.target.value)} placeholder="Insurance, training, allowances, schedule flexibility…"/></label><div className="form-two">{field('Job location','location','Olongapo City, Zambales',true)}{field('Available positions','vacancies','1',true,'number')}</div><div className="form-three"><label className="form-field"><span>Work setup</span><select value={form.work_setup} onChange={e=>update('work_setup',e.target.value)}>{['On-site','Remote','Hybrid'].map(v=><option key={v}>{v}</option>)}</select></label><label className="form-field"><span>Employment type</span><select value={form.employment_type} onChange={e=>update('employment_type',e.target.value)}>{['Full-time','Part-time','Contract','Internship','Temporary'].map(v=><option key={v}>{v}</option>)}</select></label><label className="form-field"><span>Experience level</span><select value={form.experience_level} onChange={e=>update('experience_level',e.target.value)}>{['Entry level','Mid level','Senior level','Any level'].map(v=><option key={v}>{v}</option>)}</select></label></div><div className="form-three">{field('Minimum monthly salary (PHP)','salary_min','Optional',false,'number')}{field('Maximum monthly salary (PHP)','salary_max','Optional',false,'number')}{field('Application deadline','deadline','',false,'date')}</div>{field('Working schedule','schedule','e.g. Mon–Fri, 9 AM–6 PM')}{field('Screening questions','screening_questions','Optional candidate screening prompts')}<div className="dialog-actions"><button className="btn btn-quiet" type="button" onClick={()=>setFormOpen(false)}>Cancel</button><button disabled={busy} className="btn btn-ink" type="submit">{busy?'Submitting…':'Submit for LGU review'} <ArrowUpRight size={17}/></button></div></form></motion.div></motion.div>}</AnimatePresence>
   <ConfirmDialog open={!!closeJob} title="Close this job listing?" body="The listing will stop accepting applications. Existing applications will remain available in your candidate pipeline." danger confirmLabel="Close job" onCancel={()=>setCloseJob(null)} onConfirm={async()=>{if(!closeJob)return;try{await request(`jobs/${closeJob}`,'PATCH',{action:'close'});toast.show('Job listing closed.','success');load();}catch(e){toast.show(e instanceof Error?e.message:'Could not close job.','error');}setCloseJob(null);}}/>
 </div>;
}

function Empty({title,detail}:{title:string;detail:string}){return <div className="empty-state"><div className="empty-icon"><Building2 size={35}/></div><h3>{title}</h3><p>{detail}</p></div>;}
