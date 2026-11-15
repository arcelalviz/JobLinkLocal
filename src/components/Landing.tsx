'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowRight, ArrowDown, BriefcaseBusiness, Sparkles, MapPin, Users, Compass, Zap, CheckCircle2, CornerDownRight, Building2, CircleDot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { request } from '@/lib/http';
import type { Job } from '@/types';

const OpportunityCanvas=dynamic(()=>import('@/visuals/OpportunityCanvas'),{ssr:false,loading:()=> <div className="canvas-fallback"><span className="orbit-loading"/></div>});

const reveal={initial:{opacity:0,y:24},whileInView:{opacity:1,y:0},viewport:{once:true,amount:.2},transition:{duration:.6}};

export function Landing(){
 const [jobs,setJobs]=useState<Job[]>([]);
 const [search,setSearch]=useState('');
 const [menu,setMenu]=useState(false);
 useEffect(()=>{request<Job[]>('jobs').then(setJobs).catch(()=>{});},[]);
 return <main id="top" className="landing">
   <div className="hero-zone">
     <nav className="site-nav wrap">
       <Link className="brand" href="/" aria-label="JobLinkLocal home"><span className="brand-icon"><CircleDot size={19} strokeWidth={2.6}/></span><span>joblink<span className="brand-soft">local</span><sup>®</sup></span></Link>
       <div className={`nav-center ${menu?'nav-open':''}`}><a href="#opportunities" onClick={()=>setMenu(false)}>Explore jobs</a><a href="#how-it-works" onClick={()=>setMenu(false)}>How it works</a><a href="#communities" onClick={()=>setMenu(false)}>Our mission</a></div>
       <div className="nav-actions"><Link className="nav-signin" href="/login">Sign in</Link><Link className="btn btn-lime btn-small" href="/register">Join the network <ArrowUpRight size={16}/></Link></div>
       <button className="mobile-toggle" onClick={()=>setMenu(v=>!v)} aria-label="Toggle menu">Menu</button>
     </nav>
     <section className="hero wrap">
       <div className="hero-left">
         <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:.5}} className="hero-kicker"><span className="signal-dot"/> A BETTER KIND OF JOB SEARCH <span className="hero-kicker-number">01 / 04</span></motion.div>
         <motion.h1 initial={{opacity:0,y:34}} animate={{opacity:1,y:0}} transition={{duration:.75,delay:.08}}>
           The future<br/>isn't <span className="outline-word">far.</span><br/><em>It's local.</em>
         </motion.h1>
         <motion.p className="hero-description" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.25}}>Good work changes everything. Discover the people, places, and opportunities shaping what comes next—right where you are.</motion.p>
         <motion.div className="hero-cta-row" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.5,delay:.35}}>
           <Link href="/register?role=jobseeker" className="btn btn-lime btn-large">Find your next role <ArrowUpRight size={18}/></Link>
           <Link href="/register?role=employer" className="hero-secondary">I'm hiring <ArrowRight size={17}/></Link>
         </motion.div>
         <div className="hero-bottom"><span className="tiny-grid"/> BUILT FOR REAL PEOPLE. BUILT FOR HERE.</div>
       </div>
       <div className="hero-art"><div className="orbital-grid"/><OpportunityCanvas/><div className="hero-art-sticker sticker-one"><span className="sticker-icon"><BriefcaseBusiness size={20}/></span><div><strong>New possibilities</strong><small>Made for local talent</small></div></div><div className="hero-art-sticker sticker-two"><span className="map-dot"/> EVERY CONNECTION COUNTS <ArrowUpRight size={13}/></div><span className="hero-art-caption">A NETWORK OF POSSIBILITIES / LIVE 3D</span><span className="shape-index">FIG. 001</span></div>
     </section>
     <div className="hero-tape"><div className="tape-inner"><span>BETTER CONNECTIONS</span><span className="tape-star">✳</span><span>BRIGHTER FUTURES</span><span className="tape-star">✳</span><span>GOOD WORK, CLOSE TO HOME</span><span className="tape-star">✳</span><span>BETTER CONNECTIONS</span><span className="tape-star">✳</span></div></div>
   </div>
   <section className="discover-section wrap" id="opportunities">
     <motion.div {...reveal} className="section-heading"><div><p className="eyebrow dark-eyebrow">02 / THE OPPORTUNITY BOARD</p><h2>Work worth <em>finding.</em></h2></div><p>A curated place for local roles. No endless noise. Just genuine opportunities and a clearer path forward.</p></motion.div>
     <div className="search-rail"><Compass size={22}/><input aria-label="Find jobs" value={search} onChange={e=>setSearch(e.target.value)} placeholder="What kind of work are you looking for?"/><Link href={`/register?role=jobseeker`} className="search-rail-button">Start exploring <ArrowUpRight size={18}/></Link></div>
     <div className="opportunity-grid">
       {jobs.filter(j=>(`${j.title} ${j.company_name} ${j.category}`).toLowerCase().includes(search.toLowerCase())).slice(0,3).map((job,i)=><motion.article {...reveal} className="opportunity-card" key={job.id}>
         <div className="op-top"><span className="op-no">0{i+1}</span><span className="pill pill-quiet">{job.work_setup}</span></div>
         <div className="op-company"><span className="company-mark"><Building2 size={21}/></span>{job.company_name}</div>
         <h3>{job.title}</h3><p><MapPin size={14}/>{job.location}</p><div className="op-bottom"><span>{job.employment_type}</span><Link href={`/login?next=app`} aria-label={`Learn about ${job.title}`}><ArrowUpRight size={21}/></Link></div>
       </motion.article>)}
       {jobs.length===0&&[0,1,2].map((v)=><motion.article {...reveal} className="opportunity-card opportunity-placeholder" key={v}><div className="op-top"><span className="op-no">0{v+1}</span><span className="pill pill-quiet">Your next move</span></div><div className="placeholder-symbol"><Sparkles size={34}/></div><h3>{['A new chapter starts here.','Something good is taking shape.','Your neighborhood. Your future.'][v]}</h3><div className="op-bottom"><span>Opportunities coming soon</span><ArrowUpRight size={21}/></div></motion.article>)}
     </div>
     <div className="section-foot"><span>{jobs.length?`${jobs.length} open opportunities`:'Your opportunity board starts with you.'}</span><Link href="/register">Create an account <ArrowUpRight size={16}/></Link></div>
   </section>
   <section className="feature-stage" id="how-it-works"><div className="wrap feature-stage-grid">
     <motion.div {...reveal} className="feature-art"><div className="feature-art-top"><span>CONNECTIONS, REIMAGINED</span><Sparkles size={24}/></div><div className="feature-circle"><div className="feature-circle-inside"><BriefcaseBusiness size={54} strokeWidth={1.25}/></div><div className="orbit-dot orbit-dot-a"/><div className="orbit-dot orbit-dot-b"/></div><div className="feature-art-bottom"><span>REAL PEOPLE <CornerDownRight size={20}/></span><span>REAL POSSIBILITIES</span></div></motion.div>
     <div className="feature-copy"><p className="eyebrow">03 / HOW IT WORKS</p><h2>Less friction.<br/><em>More future.</em></h2><p>We’ve rebuilt the path from discovering an opportunity to getting hired. Human-first from beginning to end.</p><div className="feature-steps"><div><span>01</span><div><h4>Create your profile</h4><p>Show more than your name. Let your potential speak.</p></div></div><div><span>02</span><div><h4>Get verified</h4><p>Local government verification builds a safer community.</p></div></div><div><span>03</span><div><h4>Make your move</h4><p>Apply, connect, and follow every update in one place.</p></div></div></div></div>
   </div></section>
   <section className="community-section wrap" id="communities"><motion.div {...reveal} className="community-intro"><p className="eyebrow dark-eyebrow">04 / BUILT FOR EVERY SIDE OF THE TABLE</p><h2>Different journeys.<br/><em>One common ground.</em></h2></motion.div><div className="community-cards"><Link href="/register?role=jobseeker" className="community-card seeker-card"><div className="community-top"><Users size={26}/><ArrowUpRight size={22}/></div><span>FOR PEOPLE WITH POTENTIAL</span><h3>Find your<br/>next thing.</h3><p>Put your skills on the map. Discover work. Build momentum.</p><div className="community-figure">01</div></Link><Link href="/register?role=employer" className="community-card employer-card"><div className="community-top"><BriefcaseBusiness size={26}/><ArrowUpRight size={22}/></div><span>FOR TEAMS WITH AMBITION</span><h3>Build with<br/>the best.</h3><p>Meet verified local talent and move hiring forward with clarity.</p><div className="community-figure">02</div></Link></div></section>
   <footer className="site-footer"><div className="wrap"><div className="footer-top"><div><div className="brand footer-brand"><span className="brand-icon"><CircleDot size={19}/></span><span>joblinklocal<sup>®</sup></span></div><h2>Great things<br/><em>start close.</em></h2></div><Link href="/register" className="footer-button">Make your next move <ArrowUpRight size={23}/></Link></div><div className="footer-bottom"><span>© {new Date().getFullYear()} JOBLINKLOCAL</span><span>MADE FOR OUR COMMUNITIES, NOT JUST THE ALGORITHM.</span><a href="#top">BACK TO TOP ↑</a></div></div></footer>
 </main>;
}
