'use client';

import Link from 'next/link';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, Check, ChevronRight, FileCheck2, MapPin, Menu, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { request } from '@/lib/http';
import type { Job } from '@/types';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { manilaTimestamp } from '@/lib/olongapo';

const setup = [
  { number: '01', title: 'Create your account', description: 'Build a detailed profile as a jobseeker or employer.' },
  { number: '02', title: 'Complete verification', description: 'Submit the required credentials for LGU review.' },
  { number: '03', title: 'Apply or hire', description: 'Browse jobs or review candidates.' }
];

function formatSalary(job: Job) {
  if (job.salary_visible===false) return 'Salary disclosed upon application';
  if (job.salary_min == null && job.salary_max == null) return 'Compensation discussed with employer';
  const number = (value: number) => `₱${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(value)}`;
  if (job.salary_min != null && job.salary_max != null) return `${number(job.salary_min)}–${number(job.salary_max)} / month`;
  return job.salary_min != null ? `From ${number(job.salary_min)} / month` : `Up to ${number(job.salary_max!)} / month`;
}

export function Landing() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [businesses, setBusinesses] = useState<{id:string;business_name:string;industry:string|null;business_type:string|null}[]>([]);
  const [audience, setAudience] = useState<'jobseeker'|'employer'>('jobseeker');
  const [search, setSearch] = useState('');
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    request<typeof businesses>('businesses').then(data => { if (active) setBusinesses(Array.isArray(data) ? data : []); }).catch(() => {});
    request<Job[]>('jobs')
      .then(data => { if (active) setJobs(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleJobs = useMemo(() => jobs.filter(job =>
    `${job.title} ${job.company_name} ${job.category} ${job.location}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [jobs, search]);

  return <main className="professional-site" id="top">
    <a className="pro-skip" href="#opportunities">Skip to job opportunities</a>
    <div className="pro-utility-bar"><div className="pro-container"><span>OLONGAPO CITY</span><span className="pro-utility-right"><ThemeToggle/></span></div></div>
    <header className="pro-header">
      <div className="pro-container pro-header-inner">
        <Link href="/" className="pro-logo" aria-label="JobLinkLocal home"><span className="pro-logo-symbol"><BrandMark size={34}/></span><span>joblink<strong>local</strong></span></Link>
        <nav className={`pro-nav ${menu ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#opportunities" onClick={() => setMenu(false)}>Explore jobs</a>
          <a href="#how-it-works" onClick={() => setMenu(false)}>How it works</a>
          <a href="#business-directory" onClick={() => setMenu(false)}>Verified businesses</a><a href="#employers" onClick={() => setMenu(false)}>For employers</a>
        </nav>
        <div className="pro-header-actions"><Link href="/login" className="pro-link">Sign in</Link><Link href="/register" className="pro-button pro-button-primary pro-header-cta">Create account <ArrowUpRight size={16}/></Link></div>
        <button type="button" className="pro-menu-button" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(v => !v)}>{menu ? <X size={22}/> : <Menu size={22}/>}</button>
      </div>
    </header>

    <section className="pro-hero" aria-labelledby="hero-title">
      <div className="pro-container pro-hero-grid">
        <div className="pro-hero-copy"><LayoutGroup id="landing-audience"><div className="pro-audience-toggle" role="group" aria-label="Choose what you're here to do"><button type="button" className={audience==='jobseeker'?'active':''} aria-pressed={audience==='jobseeker'} onClick={()=>setAudience('jobseeker')}>{audience==='jobseeker'&&<motion.span className="jl-audience-indicator" layoutId="audience-selection" transition={{duration:.20,ease:"easeInOut"}}/>}<span>I'm looking for a job</span></button><button type="button" className={audience==='employer'?'active':''} aria-pressed={audience==='employer'} onClick={()=>setAudience('employer')}>{audience==='employer'&&<motion.span className="jl-audience-indicator" layoutId="audience-selection" transition={{duration:.20,ease:"easeInOut"}}/>}<span>I'm hiring</span></button></div></LayoutGroup>
          <div id="hero-title" className="jl-hero-title-wrap"><AnimatePresence initial={false} mode="sync"><motion.h1 key={audience} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4,transition:{duration:.16}}}>{audience==='jobseeker'?<>Jobs in<br/><span>Olongapo City.</span></>:<>Hiring in<br/><span>Olongapo City.</span></>}</motion.h1></AnimatePresence></div>
          <p>{audience==='jobseeker'?'Explore job openings in Olongapo City and track your applications.':'Post vacancies in Olongapo City, review applicants and manage hiring.'}</p>
          <div className="pro-hero-actions"><Link className="pro-button pro-button-primary pro-button-large" href={audience==='jobseeker'?'#opportunities':'/register?role=employer'}>{audience==='jobseeker'?'Explore jobs':'Register your business'} <ArrowRight size={18}/></Link><a className="pro-text-link" href={audience==='jobseeker'?'#business-directory':'#how-it-works'}>{audience==='jobseeker'?'Verified businesses':'How employer approval works'} <ArrowUpRight size={17}/></a></div>
          
        </div>
        <div className="pro-hero-panel" aria-label={audience==='jobseeker'?'Latest employment opportunities preview':'Verified businesses preview'}>
          <div className="pro-panel-head"><div><p className="jl-panel-kicker">LOCAL DIRECTORY</p><h2>{audience==='jobseeker'?'Latest openings':'Verified local businesses'}</h2></div></div>
          <div className="pro-panel-body">
            {audience==='employer' ? (businesses.length?businesses.slice(0,3).map(business=><div className="pro-preview-job" key={business.id}><span className="pro-preview-company"><Building2 size={18}/></span><div><strong>{business.business_name}</strong><span>{business.industry||'Registered employer'} · LGU-verified account</span></div><ChevronRight size={18} className="pro-preview-arrow"/></div>):<div className="pro-panel-message">Verified businesses will appear as they join.</div>) : loading ? <div className="pro-panel-message">Loading available positions…</div> : loadError ? <div className="pro-panel-message">Open positions could not be loaded right now.</div> : jobs.length === 0 ? <div className="pro-panel-message">No published jobs available.</div> : jobs.slice(0, 3).map(job => <Link href={`/jobs/${job.id}`} className="pro-preview-job jl-preview-clickable" key={job.id}>
              <span className="pro-preview-company"><Building2 size={18}/></span>
              <div><strong>{job.title}</strong><span>{job.company_name} · {job.location}</span></div>
              <ChevronRight size={18} className="pro-preview-arrow"/>
            </Link>)}
          </div>
          <div className="pro-panel-footer"><span>{audience==='employer'?`${businesses.length} verified platform employers`:!loading&&!loadError?`${jobs.length} published ${jobs.length===1?'position':'positions'}`:'Current listings'}</span><a href={audience==='employer'?'#business-directory':'#opportunities'}>{audience==='employer'?'View businesses':'Browse roles'} <ArrowUpRight size={16}/></a></div>
        </div>
      </div>
    </section>

    <section className="pro-value-strip"><div className="pro-container"><div><ShieldCheck size={20}/><span><strong>LGU verification</strong></span></div><div><BriefcaseBusiness size={20}/><span><strong>Applications and hiring</strong></span></div><div><FileCheck2 size={20}/><span><strong>Status history</strong></span></div></div></section>

    <section className="pro-section pro-opportunities" id="opportunities">
      <div className="pro-container">
        <div className="pro-section-heading"><div><h2>Job listings</h2></div></div>
        <label className="pro-search"><Search size={20}/><span className="sr-only">Search available jobs</span><input aria-label="Search jobs by title, employer or location" placeholder="Search by job title, employer, or location" value={search} onChange={event => setSearch(event.target.value)}/><span className="pro-search-result">{loading ? 'Loading' : `${visibleJobs.length} ${visibleJobs.length===1?'result':'results'}`}</span></label>
        <div className="pro-job-grid">
          {loading ? <div className="pro-no-jobs">Loading current openings…</div> : loadError ? <div className="pro-no-jobs">We couldn't load job listings. Please try again later.</div> : visibleJobs.length === 0 ? <div className="pro-no-jobs">{search ? 'No openings match that search. Try another keyword.' : 'There are no published openings at the moment.'}</div> : visibleJobs.slice(0, 6).map(job => <article className="pro-job-card" key={job.id}>
            <div className="pro-job-card-top"><span className="pro-job-category">{job.category || 'Opportunity'}</span><span className="pro-job-work">{job.work_setup}</span></div>
            <div className="jl-job-summary"><div className="pro-job-company"><Building2 size={17}/>{job.company_name}</div><h3><Link href={`/jobs/${job.id}`} className="jl-job-title-link">{job.title}</Link></h3>
            <p className="pro-job-location"><MapPin size={16}/>{job.barangay?`Brgy. ${job.barangay}, Olongapo City`:job.location}</p><p className="pro-posted-time">Posted {manilaTimestamp(job.published_at||job.created_at)}</p></div>
            <div className="pro-job-footer"><div><strong>{formatSalary(job)}</strong><span>{job.employment_type}</span></div><Link href={`/jobs/${job.id}`} className="pro-job-action" aria-label={`View details for ${job.title}`}><ArrowUpRight size={19}/></Link></div>
          </article>)}
        </div>
        <div className="pro-section-bottom"><span>All applications are managed through your personal workspace.</span><Link href="/register?role=jobseeker" className="pro-inline-link">Create a jobseeker account <ArrowRight size={17}/></Link></div>
      </div>
    </section>

    <section className="pro-section pro-business-directory" id="business-directory"><div className="pro-container"><div className="pro-section-heading"><div><h2>Verified businesses</h2></div><p>Organizations below have approved employer accounts on this platform. This is not the official Olongapo City business registry.</p></div><div className="pro-business-grid">{businesses.length?businesses.map(business=><article className="pro-business-card" key={business.id}><div className="pro-business-symbol"><Building2 size={22}/></div><strong>{business.business_name}</strong><span>{business.industry||business.business_type||'Local business'}</span><small><ShieldCheck size={14}/> LGU-verified platform account</small></article>):<p className="pro-no-jobs">No verified employers listed yet.</p>}</div></div></section>

    <section className="pro-section pro-process" id="how-it-works"><div className="pro-container">
      <div className="pro-process-heading"><div><h2>Registration and verification</h2></div></div>
      <div className="pro-process-grid">{setup.map(item => <div className="pro-process-step" key={item.number}><span className="pro-step-number">{item.number}</span><h3>{item.title}</h3><p>{item.description}</p></div>)}</div>
    </div></section>

    <section className="pro-section pro-employer" id="employers"><div className="pro-container pro-employer-inner">
      <div><h2>Employer registration</h2><Link href="/register?role=employer" className="pro-button pro-button-white">Create an employer account <ArrowUpRight size={18}/></Link></div>
      <div className="pro-employer-checklist" aria-label="Employer platform capabilities"><div><Check size={19}/> Job postings with clear requirements</div><div><Check size={19}/> Organized candidate pipeline</div><div><Check size={19}/> Professional application notifications</div><div><Check size={19}/> Recorded hiring and employment updates</div></div>
    </div></section>

    <footer className="pro-footer"><div className="pro-container"><div className="pro-footer-main"><Link href="/" className="pro-logo"><span className="pro-logo-symbol"><BriefcaseBusiness size={18}/></span><span>joblink<strong>local</strong></span></Link><p>Olongapo City jobs and recruitment.</p><div><Link href="/login">Sign in</Link><Link href="/register">Create account</Link><a href="#top">Back to top</a></div></div><div className="pro-footer-bottom"><span>© {new Date().getFullYear()} JobLinkLocal</span><span>Olongapo City</span></div></div></footer>
  </main>;
}
