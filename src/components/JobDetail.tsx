'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, MapPin, BriefcaseBusiness } from 'lucide-react';
import { request } from '@/lib/http';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { manilaTimestamp } from '@/lib/olongapo';
import type { Job } from '@/types';

const peso=(amount:number)=>`₱${new Intl.NumberFormat('en-PH').format(amount)}`;
export function JobDetail({id}:{id:string}){
 const [job,setJob]=useState<Job|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);setError('');
  request<Job>(`jobs/${encodeURIComponent(id)}`).then(data=>{if(active)setJob(data);}).catch(reason=>{if(active){setJob(null);setError(reason instanceof Error?reason.message:'Unable to load job.');}}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id,retry]);
 return <main className="professional-site jl-public-job-page" id="top">
  <div className="pro-utility-bar"><div className="pro-container"><span>OLONGAPO CITY</span><ThemeToggle/></div></div>
  <header className="pro-header"><div className="pro-container pro-header-inner">
   <Link href="/" className="pro-logo"><span className="pro-logo-symbol"><BrandMark size={30}/></span><span>joblink<strong>local</strong></span></Link>
   <div className="pro-header-actions"><Link className="pro-link" href="/login">Sign in</Link><Link className="pro-button pro-button-primary" href="/register">Create account</Link></div>
  </div></header>
  <section className="pro-container jl-job-detail-wrap">
   <Link href="/#opportunities" className="pro-inline-link"><ArrowLeft size={16}/> All job listings</Link>
   {loading?<div className="jl-public-job-card" role="status">Loading job details…</div>:error||!job?<div className="jl-public-job-card"><h1>Job details unavailable</h1><p>{error||'The listing may have been closed.'}</p><button type="button" className="btn btn-outline" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:
    <article className="jl-public-job-card"><span className="pro-job-category">{job.category}</span><h1>{job.title}</h1>
     <p className="jl-public-job-company"><Building2 size={18}/>{job.company_name}</p>
     <div className="jl-public-job-tags"><span><MapPin size={16}/>{job.barangay?`Brgy. ${job.barangay}, Olongapo City`:job.location}</span><span><BriefcaseBusiness size={16}/>{job.employment_type} · {job.work_setup}</span><span><CalendarDays size={16}/>Posted {manilaTimestamp(job.published_at||job.created_at)}</span></div>
     <div className="jl-public-job-salary"><strong>Salary</strong><span>{job.salary_visible===false?'Not disclosed':job.salary_min!=null&&job.salary_max!=null?`${peso(job.salary_min)} – ${peso(job.salary_max)} / month`:job.salary_min!=null?`From ${peso(job.salary_min)} / month`:job.salary_max!=null?`Up to ${peso(job.salary_max)} / month`:'Not specified'}</span></div>
     <section className="jl-public-job-section"><h2>Description</h2><p>{job.description}</p></section>
     <section className="jl-public-job-section"><h2>Requirements</h2><p>{job.requirements}</p></section>
     {job.benefits&&<section className="jl-public-job-section"><h2>Benefits</h2><p>{job.benefits}</p></section>}
     <Link href={`/app?tab=discover&job=${encodeURIComponent(job.id)}`} className="pro-button pro-button-primary jl-public-job-apply">View job in workspace <ArrowUpRight size={17}/></Link>
    </article>}
  </section>
 </main>;
}
