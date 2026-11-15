'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, Check, ChevronRight, CircleCheck, FileCheck2, MapPin, Menu, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { request } from '@/lib/http';
import type { Job } from '@/types';

const setup = [
  { number: '01', title: 'Create your account', description: 'Build a detailed profile as a jobseeker or employer.' },
  { number: '02', title: 'Complete verification', description: 'Submit the required credentials for LGU review.' },
  { number: '03', title: 'Take the next step', description: 'Discover positions or recruit candidates with clarity.' }
];

function formatSalary(job: Job) {
  if (job.salary_min == null && job.salary_max == null) return 'Compensation discussed with employer';
  const number = (value: number) => `₱${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(value)}`;
  if (job.salary_min != null && job.salary_max != null) return `${number(job.salary_min)}–${number(job.salary_max)} / month`;
  return job.salary_min != null ? `From ${number(job.salary_min)} / month` : `Up to ${number(job.salary_max!)} / month`;
}

export function Landing() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
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
    <div className="pro-utility-bar"><div className="pro-container"><span>JOBLINKLOCAL <span className="pro-utility-separator">/</span> LOCAL EMPLOYMENT PLATFORM</span><span className="pro-utility-right"><ShieldCheck size={14} /> Account and job verification through LGU review</span></div></div>
    <header className="pro-header">
      <div className="pro-container pro-header-inner">
        <Link href="/" className="pro-logo" aria-label="JobLinkLocal home"><span className="pro-logo-symbol"><BriefcaseBusiness size={19}/></span><span>joblink<strong>local</strong></span></Link>
        <nav className={`pro-nav ${menu ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#opportunities" onClick={() => setMenu(false)}>Explore jobs</a>
          <a href="#how-it-works" onClick={() => setMenu(false)}>How it works</a>
          <a href="#employers" onClick={() => setMenu(false)}>For employers</a>
        </nav>
        <div className="pro-header-actions"><Link href="/login" className="pro-link">Sign in</Link><Link href="/register" className="pro-button pro-button-primary pro-header-cta">Create account <ArrowUpRight size={16}/></Link></div>
        <button type="button" className="pro-menu-button" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(v => !v)}>{menu ? <X size={22}/> : <Menu size={22}/>}</button>
      </div>
    </header>

    <section className="pro-hero" aria-labelledby="hero-title">
      <div className="pro-container pro-hero-grid">
        <div className="pro-hero-copy"><div className="pro-tag"><span className="pro-tag-line"/> BETTER LOCAL HIRING</div>
          <h1 id="hero-title">The right opportunity.<br/><span>Closer than you think.</span></h1>
          <p>Find meaningful work in your community. Connect with local employers, track every application, and move forward through one trusted platform.</p>
          <div className="pro-hero-actions"><Link className="pro-button pro-button-primary pro-button-large" href="#opportunities">Explore opportunities <ArrowRight size={18}/></Link><Link className="pro-text-link" href="/register?role=employer">I'm looking to hire <ArrowUpRight size={17}/></Link></div>
          <div className="pro-trust-line"><span><CircleCheck size={17}/> Clear application updates</span><span><FileCheck2 size={17}/> LGU review process</span></div>
        </div>
        <div className="pro-hero-panel" aria-label="Latest employment opportunities preview">
          <div className="pro-panel-head"><div><span className="pro-overline">JOBLINKLOCAL / OPPORTUNITIES</span><h2>Latest openings</h2></div><span className="pro-panel-status"><span/> Live listings</span></div>
          <div className="pro-panel-body">
            {loading ? <div className="pro-panel-message">Loading available positions…</div> : loadError ? <div className="pro-panel-message">Open positions could not be loaded right now.</div> : jobs.length === 0 ? <div className="pro-panel-message">No published positions yet. Explore JobLinkLocal as new opportunities arrive.</div> : jobs.slice(0, 3).map(job => <div className="pro-preview-job" key={job.id}>
              <span className="pro-preview-company"><Building2 size={18}/></span>
              <div><strong>{job.title}</strong><span>{job.company_name} · {job.location}</span></div>
              <ChevronRight size={18} className="pro-preview-arrow"/>
            </div>)}
          </div>
          <div className="pro-panel-footer"><span>{!loading && !loadError ? `${jobs.length} published ${jobs.length === 1 ? 'position' : 'positions'}` : 'Current listings'}</span><a href="#opportunities">Browse roles <ArrowUpRight size={16}/></a></div>
        </div>
      </div>
    </section>

    <section className="pro-value-strip"><div className="pro-container"><div><ShieldCheck size={20}/><span><strong>Account verification</strong><small>LGU credential review</small></span></div><div><BriefcaseBusiness size={20}/><span><strong>Recruitment management</strong><small>From application to hiring</small></span></div><div><FileCheck2 size={20}/><span><strong>Clear records</strong><small>Track status and decisions</small></span></div></div></section>

    <section className="pro-section pro-opportunities" id="opportunities">
      <div className="pro-container">
        <div className="pro-section-heading"><div><span className="pro-overline">DISCOVER OPPORTUNITIES</span><h2>Explore available positions.</h2></div><p>Local opportunities, organized to help you find work that matches your experience and goals.</p></div>
        <label className="pro-search"><Search size={20}/><span className="sr-only">Search available jobs</span><input aria-label="Search jobs by title, employer or location" placeholder="Search by job title, employer, or location" value={search} onChange={event => setSearch(event.target.value)}/><span className="pro-search-result">{loading ? 'Loading' : `${visibleJobs.length} ${visibleJobs.length===1?'result':'results'}`}</span></label>
        <div className="pro-job-grid">
          {loading ? <div className="pro-no-jobs">Loading current openings…</div> : loadError ? <div className="pro-no-jobs">We couldn't load job listings. Please try again later.</div> : visibleJobs.length === 0 ? <div className="pro-no-jobs">{search ? 'No openings match that search. Try another keyword.' : 'There are no published openings at the moment.'}</div> : visibleJobs.slice(0, 6).map(job => <article className="pro-job-card" key={job.id}>
            <div className="pro-job-card-top"><span className="pro-job-category">{job.category || 'Opportunity'}</span><span className="pro-job-work">{job.work_setup}</span></div>
            <div className="pro-job-company"><Building2 size={17}/>{job.company_name}</div><h3>{job.title}</h3>
            <p className="pro-job-location"><MapPin size={16}/>{job.location}</p>
            <div className="pro-job-footer"><div><strong>{formatSalary(job)}</strong><span>{job.employment_type}</span></div><Link href="/login?portal=jobseeker" className="pro-job-action" aria-label={`Sign in to apply for ${job.title}`}><ArrowUpRight size={19}/></Link></div>
          </article>)}
        </div>
        <div className="pro-section-bottom"><span>All applications are managed through your personal workspace.</span><Link href="/register?role=jobseeker" className="pro-inline-link">Create a jobseeker account <ArrowRight size={17}/></Link></div>
      </div>
    </section>

    <section className="pro-section pro-process" id="how-it-works"><div className="pro-container">
      <div className="pro-process-heading"><div><span className="pro-overline">SIMPLE BY DESIGN</span><h2>A clearer path to opportunity.</h2></div><p>JobLinkLocal brings every important step together, from setting up an account to making informed hiring decisions.</p></div>
      <div className="pro-process-grid">{setup.map(item => <div className="pro-process-step" key={item.number}><span className="pro-step-number">{item.number}</span><h3>{item.title}</h3><p>{item.description}</p></div>)}</div>
    </div></section>

    <section className="pro-section pro-employer" id="employers"><div className="pro-container pro-employer-inner">
      <div><span className="pro-overline">FOR LOCAL EMPLOYERS</span><h2>Build the team behind your next milestone.</h2><p>Publish detailed roles, review applicants, record decisions, and keep candidates informed—all in one recruitment workspace.</p><Link href="/register?role=employer" className="pro-button pro-button-white">Create an employer account <ArrowUpRight size={18}/></Link></div>
      <div className="pro-employer-checklist" aria-label="Employer platform capabilities"><div><Check size={19}/> Job postings with clear requirements</div><div><Check size={19}/> Organized candidate pipeline</div><div><Check size={19}/> Professional application notifications</div><div><Check size={19}/> Recorded hiring and employment updates</div></div>
    </div></section>

    <footer className="pro-footer"><div className="pro-container"><div className="pro-footer-main"><Link href="/" className="pro-logo"><span className="pro-logo-symbol"><BriefcaseBusiness size={18}/></span><span>joblink<strong>local</strong></span></Link><p>Better connections for local talent and businesses.</p><div><Link href="/login">Sign in</Link><Link href="/register">Create account</Link><a href="#top">Back to top</a></div></div><div className="pro-footer-bottom"><span>© {new Date().getFullYear()} JobLinkLocal</span><span>Local opportunity, professionally connected.</span></div></div></footer>
  </main>;
}
