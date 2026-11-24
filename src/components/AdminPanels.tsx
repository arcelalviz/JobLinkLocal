'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, ShieldCheck, BriefcaseBusiness, MapPin, CalendarDays, FileDown, Check, X, Users, Activity, FileText, UserRound, Search, ShieldAlert, ClipboardList } from 'lucide-react';
import { request, downloadReport } from '@/lib/http';
import { useToast } from '@/components/ToastProvider';
import type { Profile } from '@/types';
import { manilaTimestamp } from '@/lib/olongapo';
import { PrivateFileViewer } from '@/components/PrivateFileViewer';

const nice=(s:string)=>s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const seekerDetails=(person:any)=>Array.isArray(person?.seeker_profiles)?person.seeker_profiles[0]||{}:person?.seeker_profiles||{};
type ReportPeriod = 'day' | 'week' | 'month' | 'year';
type ReportFilters = {start:string;end:string;period:ReportPeriod};

// Build calendar dates in Manila time; avoid UTC date changes near local midnight.
function manilaDateOffset(daysAgo:number):string {
 const pieces = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const date = Object.fromEntries(pieces.filter(piece=>piece.type!=='literal').map(piece=>[piece.type,piece.value]));
 return new Date(Date.UTC(Number(date.year),Number(date.month)-1,Number(date.day)-daysAgo)).toISOString().slice(0,10);
}

function systemChartStart(period:'day'|'week'|'month'):string {
 if(period==='day')return manilaDateOffset(29);
 const now=new Date(`${manilaDateOffset(0)}T00:00:00Z`);
 if(period==='week'){
  // Current Monday plus the preceding eleven calendar weeks.
  now.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7)-11*7);
 }else{
  // Current calendar month plus the preceding eleven months.
  now.setUTCDate(1);
  now.setUTCMonth(now.getUTCMonth()-11);
 }
 return now.toISOString().slice(0,10);
}

export function AdminPanels({tab,me,refresh,bump}:{tab:string;me:Profile;refresh:number;bump:()=>void}){
 const toast=useToast();
 const loadSequence=useRef(0);
 const [data,setData]=useState<any>(null);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState('');
 const [review,setReview]=useState<any>(null);
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [start,setStart]=useState(()=>me.role==='sys_admin'?systemChartStart('month'):`${manilaDateOffset(0).slice(0,4)}-01-01`);
 const [end,setEnd]=useState(()=>manilaDateOffset(0));
 const [report,setReport]=useState<any>(null);
 const [trendFilter,setTrendFilter]=useState<'both'|'applications'|'hires'|'registrations'|'verifications'|'jobs'>('both');
 const [period,setPeriod]=useState<ReportPeriod>('month');
 const [appliedFilters,setAppliedFilters]=useState<ReportFilters>(()=>({start,end,period:'month'}));
 const [showSummary,setShowSummary]=useState(false);
 const [selectedRecord,setSelectedRecord]=useState<any>(null);
 const [lguReason,setLguReason]=useState('');
 const [lguAction,setLguAction]=useState<'suspend'|'restore'|null>(null);
 const [lguDecision,setLguDecision]=useState<'approved'|'rejected'>('approved');
 const endpoint=tab==='reviews'||tab==='postings'?'lgu':tab==='review-history'?'lgu/review-history':tab==='all-jobs'?'lgu/all-jobs':tab==='jobseekers'?'lgu/jobseekers':tab==='resume-removals'?'lgu/resume-removals':tab==='tracking'?'lgu/application-tracking':tab==='users'?'admin/users':tab==='audit'?'admin/audits':`reports?start=${appliedFilters.start}&end=${appliedFilters.end}&period=${appliedFilters.period}`;
 const load=(silent=false)=>{
  const seq=++loadSequence.current;
  if(!silent){setLoading(true);setLoadError('');if(tab==='reports')setReport(null);}
  request(endpoint)
   .then(result=>{if(seq===loadSequence.current){setData(result);if(tab==='reports')setReport(result);}})
   .catch(e=>{if(seq===loadSequence.current&&!silent){const message=e instanceof Error?e.message:'Unable to load this section.';setLoadError(message);toast.show(message,'error');}})
   .finally(()=>{if(seq===loadSequence.current&&!silent)setLoading(false);});
 };
 useEffect(()=>{load();},[refresh,tab,appliedFilters]);
 const applyReportFilters=()=>{
  if(!start||!end||start>end){toast.show('Select a valid start and end date.','error');return;}
  if(start===appliedFilters.start&&end===appliedFilters.end&&period===appliedFilters.period){load();return;}
  setAppliedFilters({start,end,period});
 };
 const changeSystemChartPeriod=(next:Exclude<ReportPeriod,'year'>)=>{
  // Chart presets keep daily points readable, without changing the saved database records.
  const nextStart=systemChartStart(next);
  const nextEnd=manilaDateOffset(0);
  setStart(nextStart);setEnd(nextEnd);setPeriod(next);
  if(nextStart===appliedFilters.start&&nextEnd===appliedFilters.end&&next===appliedFilters.period){load();return;}
  setAppliedFilters({start:nextStart,end:nextEnd,period:next});
 };
 useEffect(()=>{if(tab!=='reviews'&&tab!=='postings'&&tab!=='review-history'&&tab!=='all-jobs'&&tab!=='jobseekers'&&tab!=='resume-removals'&&tab!=='tracking')return;const timer=window.setInterval(()=>load(true),15000);return ()=>window.clearInterval(timer);},[tab,refresh]);
 const reviewSubmit=async(decision:string)=>{
   if(!review)return;
   setBusy(true);
   try{
     if(tab==='reviews') await request('lgu/review-verification','POST',{id:review.id,decision,note});
     else if(tab==='postings') await request('lgu/review-job','POST',{id:review.id,decision,note});
     else await request('admin/account','POST',{id:review.id,status:decision});
     toast.show('Decision recorded.','success','The action has been saved and a notification created.');
     setReview(null);setNote('');load();bump();
   }catch(e){toast.show(e instanceof Error?e.message:'Unable to record decision.','error');}
   finally{setBusy(false);}
 };
 if(!loading&&loadError)return <div className="jl-data-error" role="alert"><span>{loadError}</span><button type="button" className="btn btn-outline btn-small" onClick={()=>load()}>Retry loading this section</button></div>;
 if(tab==='reports')return <div className="panel-stack">
  <div className="section-topline"><div><h2>Employment activity</h2><p className="jl-scope-note">Aggregated platform records. No applicant documents or private contact details appear in analytics.</p></div></div>
  <div className="report-toolbar jl-filter-controls">
   <label className="form-field"><span>From</span><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label className="form-field"><span>Through</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   {me.role!=='sys_admin'&&<label className="form-field"><span>Group by</span><select value={period} onChange={e=>setPeriod(e.target.value as ReportPeriod)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option></select></label>}
   <button className="btn btn-ink btn-small" onClick={applyReportFilters}>Apply filters <ArrowUpRight size={16}/></button>
   <div className="report-downloads"><button className="btn btn-outline btn-small" onClick={async()=>{try{await downloadReport('csv',appliedFilters.start,appliedFilters.end,appliedFilters.period);toast.show('CSV report downloaded.','success');}catch{toast.show('Download failed.','error');}}}><FileDown size={15}/> CSV</button><button className="btn btn-outline btn-small" onClick={async()=>{try{await downloadReport('pdf',appliedFilters.start,appliedFilters.end,appliedFilters.period);toast.show('PDF report downloaded.','success');}catch{toast.show('Download failed.','error');}}}><FileDown size={15}/> PDF</button></div>
  </div>
  {loading?<div className="loading-panel">Loading reports…</div>:report?<>
   <div className="metrics-grid">{Object.entries(report.summary||{}).map(([key,value],i)=><button type="button" className="metric-card metric-action" onClick={()=>setShowSummary(true)} key={key}><span className="metric-top">0{i+1} / {nice(key)}</span><strong>{String(value)}</strong><small>View analysis <ArrowUpRight size={13}/></small></button>)}</div>
   <div className="section-topline"><div><h2>Data insights</h2></div></div>
   <p className="jl-analytics-disclaimer">These insights use explainable statistical rules, not a generative AI model. They do not score individual applicants or make hiring decisions.</p>
   <div className="jl-analytics-insights">{(report.insights||[]).map((item:any)=><div className="jl-insight-card" data-level={item.level} key={item.id}><h3>{item.title}</h3><strong>{item.value}</strong><p>{item.detail}</p><details><summary>How this was calculated</summary><p>{item.basis}</p></details></div>)}</div>
   <div className="analytics-grid"><div className="analytics-chart"><div className="chart-head jl-chart-head"><div><h3>Activity over time</h3><span>{report.granularity.toUpperCase()} · ASIA/MANILA · {report.since} to {report.until}</span></div><button type="button" className="btn btn-outline btn-small" onClick={()=>setShowSummary(true)}>View summary <ArrowUpRight size={15}/></button></div>
   {<div className="jl-activity-period-row"><div className="jl-activity-period-toggle" role="group" aria-label="Activity over time period">
    {([['day','Daily'],['week','Weekly'],['month','Monthly']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={report.granularity===value} onClick={()=>changeSystemChartPeriod(value)}>{label}</button>)}
   </div><span className="jl-activity-period-caption">Daily: last 30 days · Weekly: last 12 weeks · Monthly: last 12 months</span></div>}
   <label className="form-field chart-series-control"><span>Show metric</span><select value={trendFilter} onChange={e=>setTrendFilter(e.target.value as typeof trendFilter)}><option value="both">Applications and hires</option><option value="applications">Applications</option><option value="hires">Recorded hires</option><option value="registrations">New accounts</option><option value="verifications">Verified accounts</option><option value="jobs">Job postings</option></select></label><Trends points={report.series||[]} show={trendFilter}/></div>
    <div className="analytics-summary"><span className="eyebrow dark-eyebrow">APPLICATION STATUS</span><h3>Recruitment stages</h3>{Object.entries(report.status||{}).length?Object.entries(report.status||{}).map(([key,value])=><div className="analytics-line" key={key}><span>{nice(key)}</span><strong>{String(value)}</strong></div>):<p className="dim">No applications during the selected period.</p>}</div></div>
   <div className="jl-scope-note">Updated {new Date(report.generatedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}. {report.truncated?'Warning: the report hit a maximum-row cap.':''}</div>
   <AnimatePresence>{showSummary&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="form-modal" role="dialog" aria-modal="true" aria-label="Analytics summary" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}><button className="dialog-close" aria-label="Close summary" onClick={()=>setShowSummary(false)}><X size={18}/></button><span className="eyebrow dark-eyebrow">ANALYTICS SUMMARY</span><h2>Report summary</h2><p>{report.since} – {report.until} · {report.granularity} view</p><table className="jl-modal-table"><tbody><tr><th>Top job category</th><td>{report.topCategory?`${report.topCategory.name} (${report.topCategory.count})`:'Not available'}</td></tr><tr><th>Lowest disclosed salary</th><td>{report.lowestAdvertisedSalary==null?'Not available':`₱${Number(report.lowestAdvertisedSalary).toLocaleString('en-PH')}`}</td></tr><tr><th>Total applications</th><td>{report.summary.applications}</td></tr><tr><th>Recorded hires</th><td>{report.summary.employment_records}</td></tr><tr><th>Approved verifications</th><td>{report.summary.approved_verifications}</td></tr></tbody></table><p className="jl-analytics-disclaimer">Only stored and disclosed salary values are included. Figures are descriptive, not predictions.</p><button className="btn btn-ink btn-small" onClick={()=>setShowSummary(false)}>Close</button></motion.div></motion.div>}</AnimatePresence>
  </>:<div className="empty-state"><h3>No report data available.</h3></div>}
 </div>;
 if(tab==='review-history'){
  const rows=(data||[]) as any[];
  return <div className="panel-stack"><div className="section-topline"><p className="jl-scope-note">Timestamps use Philippine time.</p><span className="count-indicator">{rows.length} reviews</span></div>{loading?<div className="loading-panel">Loading review history…</div>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Registrant</th><th>Account</th><th>Decision</th><th>Submitted</th><th>Reviewed</th><th>Details</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.profiles?.full_name||'Member'}</td><td>{nice(row.kind)}</td><td><span className={`stage-badge stage-${row.status}`}>{nice(row.status)}</span></td><td>{manilaTimestamp(row.created_at)}</td><td>{manilaTimestamp(row.reviewed_at)}</td><td><button className="text-action" onClick={()=>setSelectedRecord(row)}>View <ArrowUpRight size={14}/></button></td></tr>)}</tbody></table></div>}{selectedRecord&&<div className="modal-backdrop"><div role="dialog" aria-modal="true" aria-label="LGU verification decision" className="form-modal"><button className="dialog-close" onClick={()=>setSelectedRecord(null)} aria-label="Close"><X size={18}/></button><h2>{selectedRecord.profiles?.full_name||'Registrant'}</h2><p>{nice(selectedRecord.kind)} · {nice(selectedRecord.status)}</p><p>Submitted: {manilaTimestamp(selectedRecord.created_at)}</p><p>Reviewed: {manilaTimestamp(selectedRecord.reviewed_at)}</p><p>LGU note: {selectedRecord.reviewer_note||'No note recorded.'}</p><button className="btn btn-outline" onClick={()=>setSelectedRecord(null)}>Close</button></div></div>}</div>;
 }
 if(tab==='all-jobs'||tab==='tracking'){
  const rows=(data||[]) as any[];
  const found=rows.filter((item:any)=>`${item.title||item.jobs?.title||''} ${item.company_name||item.jobs?.company_name||''} ${item.applicant?.full_name||''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="panel-stack"><div className="section-topline"><div><p className="jl-scope-note">{tab==='all-jobs'?'All posted jobs, including pending and closed.':'Status updates refresh every 15 seconds.'}</p></div><span className="count-indicator">{rows.length} {tab==='all-jobs'?'jobs':'applications'}</span></div>
   <div className="job-search standalone-search"><Search size={18}/><input placeholder={tab==='all-jobs'?'Search jobs':'Search applications'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
   {loading?<div className="loading-panel">{tab==='all-jobs'?'Loading jobs…':'Loading applications…'}</div>:!found.length?<div className="empty-state"><h3>{tab==='all-jobs'?'No matching jobs.':'No matching applications.'}</h3></div>:<div className="table-scroll"><table className="data-table"><thead><tr>{tab==='all-jobs'?<><th>Job</th><th>Employer</th><th>Status</th><th>Submitted</th></>:<><th>Jobseeker</th><th>Opportunity</th><th>Status</th><th>Applied</th></>}<th>Details</th></tr></thead><tbody>{found.map((item:any)=><tr key={item.id}>{tab==='all-jobs'?<><td>{item.title}</td><td>{item.company_name}</td><td><span className={`stage-badge stage-${item.status}`}>{nice(item.status)}</span></td><td>{manilaTimestamp(item.created_at)}</td></>:<><td>{item.applicant?.full_name||'Jobseeker'}</td><td>{item.jobs?.title||'Position'} · {item.jobs?.company_name||''}</td><td><span className={`stage-badge stage-${item.status}`}>{nice(item.status)}</span></td><td>{manilaTimestamp(item.created_at)}</td></>}<td><button type="button" className="text-action" onClick={()=>setSelectedRecord(item)}>View <ArrowUpRight size={14}/></button></td></tr>)}</tbody></table></div>}
   <AnimatePresence>{selectedRecord&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="form-modal" role="dialog" aria-modal="true" aria-label="Record details" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><button className="dialog-close" onClick={()=>setSelectedRecord(null)} aria-label="Close"><X size={18}/></button><span className="eyebrow dark-eyebrow">LGU RECORD DETAILS</span><h2>{selectedRecord.title||selectedRecord.jobs?.title||'Application'}</h2><p>{selectedRecord.company_name||selectedRecord.jobs?.company_name||''}</p><table className="jl-modal-table"><tbody><tr><th>Status</th><td>{nice(selectedRecord.status)}</td></tr><tr><th>Barangay</th><td>{selectedRecord.barangay||selectedRecord.applicant?.barangay||'Not provided'}</td></tr><tr><th>Created / applied</th><td>{manilaTimestamp(selectedRecord.created_at)}</td></tr><tr><th>Last update</th><td>{manilaTimestamp(selectedRecord.updated_at||selectedRecord.published_at||selectedRecord.created_at)}</td></tr></tbody></table>{selectedRecord.application_events?.length>0&&<div className="detail-section"><h4>Application timeline</h4>{selectedRecord.application_events.map((event:any,index:number)=><p key={`${event.status}-${index}`}><strong>{nice(event.status)}</strong> · {manilaTimestamp(event.created_at)}</p>)}</div>}{tab==='all-jobs'&&me.role==='lgu_admin'&&['pending','published'].includes(selectedRecord.status)&&<div className="jl-lgu-control"><h4>Cancel job posting</h4><p>Only jobs that are pending or published can be cancelled. The employer will be notified.</p><label className="form-field"><span>Reason (required)</span><textarea rows={3} value={lguReason} onChange={e=>setLguReason(e.target.value)} placeholder="Explain the reason for cancellation"/></label><button type="button" className="btn btn-danger btn-small" disabled={busy||lguReason.trim().length<10} onClick={async()=>{try{setBusy(true);await request('lgu/close-job','POST',{id:selectedRecord.id,reason:lguReason});toast.show('Job cancelled and employer notified.','success');setSelectedRecord(null);setLguReason('');load();bump();}catch(e){toast.show(e instanceof Error?e.message:'Job cancellation failed.','error');}finally{setBusy(false);}}}>Cancel this job</button></div>}<button className="btn btn-outline" onClick={()=>{setSelectedRecord(null);setLguReason('');}}>Close</button></motion.div></motion.div>}</AnimatePresence>
  </div>;
 }
 if(tab==='jobseekers'){
  const rows=(Array.isArray(data)?data:[]) as any[];
  const found=rows.filter(person=>`${person.full_name} ${person.email} ${person.barangay}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="panel-stack"><div className="section-topline"><span className="count-indicator">{rows.length} jobseekers</span></div><div className="job-search standalone-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search jobseekers by name or barangay" aria-label="Search jobseekers"/></div>{loading?<div className="loading-panel">Loading jobseekers…</div>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Jobseeker</th><th>Barangay</th><th>Verification</th><th>Applications</th><th>Details</th></tr></thead><tbody>{found.map(person=><tr key={person.id}><td><div className="table-person"><span className="table-avatar">{person.avatar_url?<img src={`/api/files/avatar/${person.id}`} alt=""/>:person.full_name.slice(0,1).toUpperCase()}</span><span><strong>{person.full_name}</strong><small>{person.email}</small></span></div></td><td>{person.barangay||'Not provided'}</td><td><span className={`stage-badge stage-${person.lgu_status}`}>{nice(person.lgu_status)}</span></td><td>{person.application_count}</td><td><button type="button" className="text-action" onClick={()=>{setSelectedRecord(person);setLguReason('');setLguAction(null);}}>View profile <ArrowUpRight size={14}/></button></td></tr>)}</tbody></table></div>}
   {selectedRecord&&<div className="modal-backdrop" onClick={()=>setSelectedRecord(null)}><div className="form-modal jl-lgu-jobseeker-modal" role="dialog" aria-modal="true" aria-label="Jobseeker profile" onClick={e=>e.stopPropagation()}><button className="dialog-close" type="button" onClick={()=>setSelectedRecord(null)} aria-label="Close"><X size={18}/></button><h2>{selectedRecord.full_name}</h2><p>{selectedRecord.email}</p>{selectedRecord.avatar_url&&<img className="jl-lgu-avatar" src={`/api/files/avatar/${selectedRecord.id}`} alt="Jobseeker profile photo"/>}<table className="jl-modal-table"><tbody><tr><th>LGU status</th><td>{nice(selectedRecord.lgu_status)}</td></tr><tr><th>Phone</th><td>{selectedRecord.phone||'Not provided'}</td></tr><tr><th>Barangay</th><td>{selectedRecord.barangay||'Not provided'}</td></tr><tr><th>Complete address</th><td>{selectedRecord.address_line||'Not provided'}</td></tr><tr><th>Education</th><td>{seekerDetails(selectedRecord).education||'Not provided'}</td></tr><tr><th>Desired position</th><td>{seekerDetails(selectedRecord).desired_role||'Not provided'}</td></tr><tr><th>Experience</th><td>{seekerDetails(selectedRecord).experience_years??0} years</td></tr><tr><th>Skills</th><td>{(seekerDetails(selectedRecord).skills||[]).join(', ')||'Not provided'}</td></tr><tr><th>Applications</th><td>{selectedRecord.application_count}</td></tr><tr><th>Joined</th><td>{manilaTimestamp(selectedRecord.created_at)}</td></tr></tbody></table><h3>Verification history</h3>{(selectedRecord.verification_submissions||[]).map((entry:any)=><p key={entry.id}>{nice(entry.status)} · {manilaTimestamp(entry.created_at)}{entry.reviewed_at?` · Reviewed ${manilaTimestamp(entry.reviewed_at)}`:''}{entry.reviewer_note?` · ${entry.reviewer_note}`:''}</p>)}<div className="jl-lgu-control"><h3>Account actions</h3><p>Account suspension blocks protected features. Records are retained. Restoration requires renewed verification.</p><div className="jl-inline-actions"><button type="button" className="btn btn-outline btn-small" onClick={()=>{setLguAction(null);setLguReason('');}}>Clear</button><button type="button" className="btn btn-danger btn-small" onClick={()=>{setLguAction(selectedRecord.lgu_status==='suspended'?'restore':'suspend');setLguReason('');}}>{selectedRecord.lgu_status==='suspended'?'Restore account':'Suspend account'}</button></div>{lguAction&&<div><label className="form-field"><span>Reason for {lguAction}</span><textarea value={lguReason} onChange={e=>setLguReason(e.target.value)} rows={3}/></label><div className="dialog-actions"><button type="button" className="btn btn-quiet" onClick={()=>setLguAction(null)}>Cancel</button><button type="button" className="btn btn-ink" disabled={busy||lguReason.trim().length<10} onClick={async()=>{try{setBusy(true);await request('lgu/jobseekers/status','POST',{id:selectedRecord.id,action:lguAction,reason:lguReason});toast.show('Account status updated.','success');setSelectedRecord(null);setLguAction(null);setLguReason('');load();bump();}catch(e){toast.show(e instanceof Error?e.message:'Could not update account.','error');}finally{setBusy(false);}}}>Confirm {lguAction}</button></div></div>}</div></div></div>}
  </div>;
 }
 if(tab==='resume-removals'){
  const rows=(Array.isArray(data)?data:[]) as any[];
  return <div className="panel-stack"><div className="section-topline"><span className="count-indicator">{rows.length} pending requests</span></div>{loading?<div className="loading-panel">Loading requests…</div>:!rows.length?<div className="empty-state"><h3>No pending resume removal requests</h3></div>:<div className="review-list">{rows.map(item=><article className="review-card" key={item.id}><div className="review-main"><UserRound size={22}/><div><h3>{item.profiles?.full_name||'Jobseeker'}</h3><p>Submitted {manilaTimestamp(item.created_at)} · {item.profiles?.barangay||'Olongapo City'}</p><p>Reason: {item.reason}</p></div></div><div className="review-footer"><button type="button" className="btn btn-outline btn-small" onClick={()=>{setSelectedRecord(item);setLguReason('');setLguDecision('approved');}}>Review request <ArrowUpRight size={15}/></button></div></article>)}</div>}
   {selectedRecord&&<div className="modal-backdrop"><div className="form-modal" role="dialog" aria-modal="true" aria-label="Review resume removal"><button className="dialog-close" onClick={()=>setSelectedRecord(null)} aria-label="Close"><X size={18}/></button><h2>Resume removal review</h2><p>{selectedRecord.profiles?.full_name}: {selectedRecord.reason}</p><label className="form-field"><span>Decision</span><select value={lguDecision} onChange={e=>setLguDecision(e.target.value as 'approved'|'rejected')}><option value="approved">Approve removal</option><option value="rejected">Reject request</option></select></label><label className="form-field"><span>Decision note</span><textarea value={lguReason} rows={3} onChange={e=>setLguReason(e.target.value)}/></label><div className="dialog-actions"><button className="btn btn-quiet" onClick={()=>setSelectedRecord(null)}>Cancel</button><button className="btn btn-ink" disabled={busy||lguReason.trim().length<8} onClick={async()=>{try{setBusy(true);await request('lgu/resume-removals','POST',{id:selectedRecord.id,decision:lguDecision,note:lguReason});toast.show('Decision saved.','success');setSelectedRecord(null);setLguReason('');load();bump();}catch(e){toast.show(e instanceof Error?e.message:'Could not review request.','error');}finally{setBusy(false);}}}>Save decision</button></div></div></div>}
  </div>;
 }
 if(tab==='reviews'||tab==='postings'){
   const queue=tab==='reviews'?data?.verifications||[]:data?.jobs||[];
   return <div className="panel-stack"><div className="section-topline jl-section-meta-only"><span className="count-indicator">{queue.length} pending</span></div>{loading?<div className="loading-panel">Loading review queue…</div>:!queue.length?<div className="empty-state"><div className="empty-icon"><ShieldCheck size={36}/></div><h3>No pending reviews</h3><p>New submissions will appear here.</p></div>:<div className="review-list">{queue.map((item:any)=><article className="review-card" key={item.id}><div className="review-main"><div className="review-symbol">{tab==='reviews'?<UserRound size={24}/>:<BriefcaseBusiness size={24}/>}</div><div><span className="item-overline">{tab==='reviews'?(item.kind==='employer'?'EMPLOYER VERIFICATION':'JOBSEEKER VERIFICATION'):`${item.category} / ${item.employment_type}`}</span><h3>{tab==='reviews'?(item.profiles?.full_name||'New applicant'):item.title}</h3><p>{tab==='reviews'?`${item.profiles?.email||''} · ${item.profiles?.city||''}`:`${item.company_name} · ${item.location}`}</p></div></div><div className="review-footer"><div className="review-files">{tab==='reviews'?(item.verification_documents||[]).map((file:any)=><div className="review-document-shortcut" key={file.id}><FileText size={15}/><span>{file.document_type==='business_permit'?'Business permit':file.filename}</span><PrivateFileViewer url={`/api/files/document/${file.id}`} label="Quick view"/></div>):<span className="review-description">{item.description?.slice(0,200)}{item.description?.length>200?'…':''}</span>}</div><button className="btn btn-ink btn-small" onClick={()=>{setReview(item);setNote('');}}>Review request <ArrowUpRight size={16}/></button></div><p className="review-timestamp">Submitted {manilaTimestamp(item.created_at)}</p>{item.statement&&<div className="employer-note"><span>REGISTRANT STATEMENT</span><p>{item.statement}</p></div>}</article>)}</div>}
    <AnimatePresence>{review&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div role="dialog" aria-modal="true" aria-labelledby="review-title" className="form-modal" initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><button className="dialog-close" onClick={()=>setReview(null)}><X size={19}/></button><span className="eyebrow dark-eyebrow">LGU REVIEW</span><h2 id="review-title">{tab==='reviews'?(review.profiles?.full_name||'Account review'):review.title}</h2><p>{tab==='reviews'?'Review the applicant’s identity and submitted documents before approving.':'Review the employer’s job details before publication.'}</p><p className="review-timestamp">Submitted {manilaTimestamp(review.created_at)}</p>{tab==='reviews'&&<><p>{review.profiles?.barangay?`Brgy. ${review.profiles.barangay}, Olongapo City`:'Olongapo City'} · {review.profiles?.email||''}</p><div className="review-popup-files">{(review.verification_documents||[]).map((file:any)=><div key={file.id}><span>{file.document_type==='business_permit'?'Business permit':file.filename}</span><PrivateFileViewer url={`/api/files/document/${file.id}`} label={`View ${file.filename}`}/></div>)}</div></>}{tab==='postings'&&<div className="jl-job-review-details">
  <div className="detail-section"><h4>Job description</h4><p>{review.description||'Not specified'}</p></div>
  <div className="detail-section"><h4>Requirements</h4><p>{review.requirements||'Not specified'}</p></div>
  {review.benefits&&<div className="detail-section"><h4>Benefits</h4><p>{review.benefits}</p></div>}
  <table className="jl-modal-table"><tbody>
    <tr><th>Location</th><td>{review.location||review.barangay||'Not provided'}</td></tr>
    <tr><th>Employment type</th><td>{review.employment_type||'Not provided'}</td></tr>
    <tr><th>Work arrangement</th><td>{review.work_setup||'Not provided'}</td></tr>
    <tr><th>Experience level</th><td>{review.experience_level||'Not provided'}</td></tr>
    <tr><th>Vacancies</th><td>{review.vacancies||1}</td></tr>
    <tr><th>Salary</th><td>{review.salary_min!=null?`₱${Number(review.salary_min).toLocaleString('en-PH')}`:'Not specified'}{review.salary_max!=null?` – ₱${Number(review.salary_max).toLocaleString('en-PH')}`:''}{review.salary_visible===false?' (hidden from applicants)':''}</td></tr>
    <tr><th>Application deadline</th><td>{review.deadline||'Not specified'}</td></tr>
  </tbody></table>
 </div>}<label className="form-field"><span>Reviewer's note</span><textarea rows={5} value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a clear reason, instructions or any information the registrant needs."/></label><div className="dialog-actions"><button className="btn btn-outline" disabled={busy||note.trim().length<4} onClick={()=>reviewSubmit('rejected')}><X size={17}/> Request changes</button><button className="btn btn-ink" disabled={busy} onClick={()=>reviewSubmit(tab==='reviews'?'approved':'published')}><Check size={17}/> {busy?'Saving…':'Approve'}</button></div></motion.div></motion.div>}</AnimatePresence>
   </div>;
 }
 if(tab==='users'){
  const users=(data||[]).filter((u:any)=>`${u.full_name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="panel-stack"><div className="section-topline jl-section-meta-only"><span className="count-indicator">{users.length} accounts</span></div><div className="job-search standalone-search"><Search size={19}/><input placeholder="Search people, email or roles" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Member</th><th>Role</th><th>LGU status</th><th>Joined</th><th>Action</th></tr></thead><tbody>{users.map((u:any)=><tr key={u.id}><td><div className="table-person"><span className="table-avatar">{u.full_name?.[0]?.toUpperCase()||'U'}</span><span><strong>{u.full_name}</strong><small>{u.email}</small></span></div></td><td>{nice(u.role)}</td><td><span className={`stage-badge stage-${u.lgu_status}`}>{nice(u.lgu_status)}</span></td><td>{new Date(u.created_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</td><td>{['lgu_admin','sys_admin'].includes(u.role)?<span className="dim">Restricted</span>:<button className="text-action" onClick={()=>{setReview(u);setNote('');}}>{u.lgu_status==='suspended'?'Restore':'Suspend'} <ArrowUpRight size={15}/></button>}</td></tr>)}</tbody></table></div><AnimatePresence>{review&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="form-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title" initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}}><button className="dialog-close" onClick={()=>setReview(null)}><X size={18}/></button><span className="eyebrow dark-eyebrow">SYSTEM ADMINISTRATION</span><h2 id="admin-title">{review.lgu_status==='suspended'?'Restore':'Suspend'} {review.full_name}?</h2><p>{review.lgu_status==='suspended'?'Restore the account to its status before suspension.':'Suspended users lose access to protected actions until restored. Their account data remains intact.'}</p><div className="dialog-actions"><button className="btn btn-quiet" onClick={()=>setReview(null)}>Cancel</button><button className={`btn ${review.lgu_status==='suspended'?'btn-ink':'btn-danger'}`} disabled={busy} onClick={()=>reviewSubmit(review.lgu_status==='suspended'?'restore':'suspended')}>{busy?'Working…':review.lgu_status==='suspended'?'Restore account':'Suspend account'} <ArrowUpRight size={17}/></button></div></motion.div></motion.div>}</AnimatePresence></div>;
 }
 if(tab==='audit')return <div className="panel-stack">{loading?<div className="loading-panel">Reading activity logs…</div>:!data?.length?<div className="empty-state"><h3>No activity recorded yet.</h3></div>:<div className="audit-timeline">{data.map((a:any)=><div className="audit-item" key={a.id}><span className="audit-marker"><Activity size={17}/></span><div><strong>{nice(a.action)}</strong><p>Actor {a.actor_id?.slice(0,8)||'System'} · Target {a.target_id?.slice(0,8)||'—'}</p></div><time>{new Date(a.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</time></div>)}</div>}</div>;
 return null;
}

function Trends({points,show='both'}:{points:Array<{period:string;applications:number;hires:number;registrations:number;verifications:number;jobs:number}>;show:'both'|'applications'|'hires'|'registrations'|'verifications'|'jobs'}) {
 const values=points.length?points:[{period:'No data',applications:0,hires:0,registrations:0,verifications:0,jobs:0}];
 const series=(show==='both'?['applications','hires']:[show]) as Array<'applications'|'hires'|'registrations'|'verifications'|'jobs'>;
 const width=700,height=260,pad=32;
 const max=Math.max(1,...values.flatMap(item=>series.map(key=>item[key])));
 const coord=(index:number,value:number)=>({x:pad+(index/Math.max(1,values.length-1))*(width-2*pad),y:height-pad-value/max*(height-2*pad)});
 const colors=['var(--chart-series-primary)','var(--chart-series-secondary)'];
 return <div className="trend-chart"><svg role="img" aria-label={`Recorded ${show} activity by selected period`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">{[0,1,2,3,4].map(i=><line key={i} x1={pad} x2={width-pad} y1={pad+(i/4)*(height-2*pad)} y2={pad+(i/4)*(height-2*pad)} stroke="currentColor" opacity=".15" strokeDasharray="4 6"/>)}{series.map((key,j)=><polyline key={key} points={values.map((v,i)=>{const c=coord(i,v[key]);return `${c.x},${c.y}`;}).join(' ')} fill="none" stroke={colors[j%colors.length]} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>)}{values.map((v,i)=>series.map((key,j)=>{const point=coord(i,v[key]);return <circle key={`${i}-${key}`} cx={point.x} cy={point.y} r="4.8" fill={colors[j%colors.length]}><title>{`${v.period}: ${v[key]} ${key}`}</title></circle>}))}</svg><div className="chart-labels"><span>{values[0].period}</span><span>{values[Math.floor(values.length/2)].period}</span><span>{values[values.length-1].period}</span></div><div className="chart-legend">{series.join(' / ')}</div></div>;
}
