'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { CircleDot, Compass, Grid2X2, Bookmark, BriefcaseBusiness, Users, ShieldCheck, ClipboardCheck, BarChart3, Bell, UserRound, LogOut, Menu, X, ArrowUpRight, Sparkles, Activity, FileCheck2, Settings2, ScrollText } from 'lucide-react';
import { request } from '@/lib/http';
import { useToast } from '@/components/ToastProvider';
import type { Profile, Role } from '@/types';
import { SeekerPanels } from '@/components/SeekerPanels';
import { EmployerPanels } from '@/components/EmployerPanels';
import { AdminPanels } from '@/components/AdminPanels';
import { AccountPanels } from '@/components/AccountPanels';
import { AdminMfaGate } from '@/components/AdminMfaGate';

const tabDefinitions=[
 {id:'overview',label:'Overview',icon:Grid2X2,roles:['jobseeker','employer','lgu_admin','sys_admin']},
 {id:'discover',label:'Find opportunities',icon:Compass,roles:['jobseeker']},
 {id:'applications',label:'My applications',icon:BriefcaseBusiness,roles:['jobseeker']},
 {id:'saved',label:'Saved positions',icon:Bookmark,roles:['jobseeker']},
 {id:'jobs',label:'My job posts',icon:BriefcaseBusiness,roles:['employer']},
 {id:'candidates',label:'Candidate pipeline',icon:Users,roles:['employer']},
 {id:'reviews',label:'Verify people',icon:ShieldCheck,roles:['lgu_admin']},
 {id:'postings',label:'Approve jobs',icon:ClipboardCheck,roles:['lgu_admin']},
 {id:'users',label:'Account control',icon:Settings2,roles:['sys_admin']},
 {id:'audit',label:'Activity log',icon:ScrollText,roles:['sys_admin']},
 {id:'reports',label:'Reports & insights',icon:BarChart3,roles:['lgu_admin','sys_admin']},
 {id:'verification',label:'LGU verification',icon:FileCheck2,roles:['jobseeker','employer']},
 {id:'profile',label:'My profile',icon:UserRound,roles:['jobseeker','employer','lgu_admin','sys_admin']},
 {id:'notifications',label:'Notifications',icon:Bell,roles:['jobseeker','employer','lgu_admin','sys_admin']}
];

const roleNames:Record<Role,string>={jobseeker:'Career studio',employer:'Hiring room',lgu_admin:'LGU review desk',sys_admin:'System control'};

export function Workspace(){
 const router=useRouter();
 const toast=useToast();
 const [me,setMe]=useState<Profile|null>(null);
 const [loading,setLoading]=useState(true);
 const [tab,setTab]=useState('overview');
 const [menu,setMenu]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const [unread,setUnread]=useState(0);
 const [adminMfaPassed,setAdminMfaPassed]=useState(false);
 const seenNotifications=useRef<Set<string>|null>(null);
 const bump=()=>setRefresh(x=>x+1);
 const completeMfa=useCallback(()=>setAdminMfaPassed(true),[]);
 useEffect(()=>{
   const query=new URLSearchParams(window.location.search);
   setTab(query.get('tab')||'overview');
   request<Profile>('me').then(setMe).catch(e=>{
     toast.show(e instanceof Error?e.message:'Please sign in.','error');router.replace('/login');
   }).finally(()=>setLoading(false));
 },[router,toast]);
 useEffect(()=>{
   if(!me)return;
   let active=true;
   const poll=()=>request<any>('dashboard').then(v=>{if(active)setUnread(v.unread||0);}).catch(()=>{});
   poll();const interval=setInterval(poll,60000);
   return ()=>{active=false;clearInterval(interval);};
 },[me,refresh]);
 useEffect(()=>{
   if(!me)return;
   let active=true;
   const check=async()=>{
     try{
       const incoming=await request<any[]>('notifications');
       if(!active)return;
       const unread=incoming.filter(item=>!item.read_at);
       if(seenNotifications.current!==null){
         for(const notification of unread.filter(item=>!seenNotifications.current!.has(item.id)).slice(0,2)){
           toast.show(notification.title,'info',notification.body);
         }
       }
       seenNotifications.current=new Set(incoming.map(item=>item.id));
     }catch{}
   };
   check();const interval=setInterval(check,30000);
   return ()=>{active=false;clearInterval(interval);};
 },[me,toast]);
 const navigate=(id:string)=>{setTab(id);setMenu(false);window.history.replaceState(null,'',`/app?tab=${id}`);};
 const logout=async()=>{
   try{await request('auth/logout','POST');toast.show('Signed out.','success');router.replace('/');router.refresh();}
   catch(e){toast.show(e instanceof Error?e.message:'Sign out failed.','error');}
 };
 const role=me?.role;
 const tabs=useMemo(()=>tabDefinitions.filter(i=>role&&i.roles.includes(role)),[role]);
 useEffect(()=>{if(role&&!tabs.some(t=>t.id===tab))navigate('overview');},[role,tabs,tab]);
 if(loading)return <div className="workspace-loading"><div className="loader-logo"><CircleDot size={48}/></div><span>Building your workspace…</span></div>;
 if(!me)return null;
 if((me.role==='lgu_admin'||me.role==='sys_admin')&&!adminMfaPassed){
   return <AdminMfaGate onVerified={completeMfa} onLogout={logout}/>;
 }
 const active=tabs.find(t=>t.id===tab);
 const greeting=me.role==='employer'?'Let’s find your next great hire.':me.role==='lgu_admin'?'Good work starts with trust.':me.role==='sys_admin'?'Keep things running beautifully.':'Your next chapter is taking shape.';
 const date=new Intl.DateTimeFormat('en-PH',{dateStyle:'full',timeZone:'Asia/Manila'}).format(new Date());
 return <div className={`workspace role-${me.role}`}>
  {menu&&<div className="mobile-menu-shade" onClick={()=>setMenu(false)}/>}
  <aside className={`workspace-sidebar ${menu?'is-open':''}`}>
   <div className="side-logo"><Link href="/" className="brand"><span className="brand-icon"><CircleDot size={18}/></span><span>joblink<span className="brand-soft">local</span><sup>®</sup></span></Link><button className="mobile-side-close" onClick={()=>setMenu(false)}><X size={20}/></button></div>
   <div className="side-identity"><span className="workspace-bullet"/> <span>YOUR SPACE / {roleNames[me.role].toUpperCase()}</span></div>
   <nav className="side-navigation" aria-label="Workspace navigation">
    <div className="side-group-label">YOUR WORKSPACE</div>
    {tabs.filter(t=>!['profile','verification','notifications'].includes(t.id)).map(t=><button key={t.id} className={`side-link ${tab===t.id?'selected':''}`} onClick={()=>navigate(t.id)}><t.icon size={19}/><span>{t.label}</span>{t.id==='reports'&&<ArrowUpRight size={14} className="side-trail"/>}</button>)}
    <div className="side-group-label side-group-second">ACCOUNT & SUPPORT</div>
    {tabs.filter(t=>['profile','verification','notifications'].includes(t.id)).map(t=><button key={t.id} className={`side-link ${tab===t.id?'selected':''}`} onClick={()=>navigate(t.id)}><t.icon size={19}/><span>{t.label}</span>{t.id==='notifications'&&unread>0&&<span className="notification-counter">{unread}</span>}</button>)}
   </nav>
   <div className="sidebar-bottom"><div className="side-message"><Sparkles size={22}/><p>Small steps create<br/><strong>big opportunities.</strong></p><span>KEEP MOVING FORWARD ↗</span></div><button className="side-logout" onClick={logout}><LogOut size={18}/> Sign out <ArrowUpRight size={16}/></button></div>
  </aside>
  <div className="workspace-main">
   <header className="workspace-topbar"><button className="mobile-menu-button" onClick={()=>setMenu(true)} aria-label="Open navigation"><Menu size={22}/></button><span className="breadcrumb">WORKSPACE <span>/</span> {active?.label.toUpperCase()}</span><div className="topbar-right"><span className="topbar-date">{date}</span><button className="notification-trigger" onClick={()=>navigate('notifications')} aria-label="Notifications"><Bell size={20}/>{unread>0&&<span className="notification-indicator"/>}</button><button className="profile-avatar" onClick={()=>navigate('profile')}>{me.full_name.slice(0,1).toUpperCase()}</button></div></header>
   <div className="workspace-content"><AnimatePresence mode="wait"><motion.div key={tab} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.22}}>
    <div className="page-intro"><div><p className="eyebrow dark-eyebrow">{roleNames[me.role]} / {tab.replace(/_/g,' ').toUpperCase()}</p><h1>{tab==='overview'?`Hello, ${me.full_name.split(' ')[0]}.`:active?.label||'Your workspace'}</h1><p>{tab==='overview'?greeting:tab==='verification'?'One secure step toward meaningful connections.':tab==='notifications'?'Stay close to everything that matters.':'Make each move with clarity and confidence.'}</p></div><div className={`status-chip status-${me.lgu_status}`}><span/>{me.lgu_status==='approved'?'LGU verified':me.lgu_status==='pending'?'Awaiting LGU approval':me.lgu_status==='rejected'?'Needs resubmission':'Account suspended'}</div></div>
    {tab==='overview'&&<Overview role={me.role} me={me} navigate={navigate} refresh={refresh}/>}
    {['discover','applications','saved'].includes(tab)&&<SeekerPanels tab={tab} me={me} refresh={refresh} bump={bump}/>}
    {['jobs','candidates'].includes(tab)&&<EmployerPanels tab={tab} me={me} refresh={refresh} bump={bump}/>}
    {['reviews','postings','users','audit','reports'].includes(tab)&&<AdminPanels tab={tab} me={me} refresh={refresh} bump={bump}/>}
    {['profile','verification','notifications'].includes(tab)&&<AccountPanels tab={tab} me={me} refresh={refresh} bump={bump} updateMe={setMe}/>}
   </motion.div></AnimatePresence></div>
  </div>
 </div>;
}

function Overview({role,me,navigate,refresh}:{role:Role;me:Profile;navigate:(tab:string)=>void;refresh:number}){
 const [data,setData]=useState<any>(null);
 useEffect(()=>{request('dashboard').then(setData).catch(()=>{});},[refresh]);
 const stats=data?.stats||{};
 const copy:Record<Role,{one:string;two:string;action:string;tab:string}>={
   jobseeker:{one:'A little momentum today can change your tomorrow.',two:'Explore opportunities tailored to your goals and keep every application in motion.',action:'Find your next role',tab:'discover'},
   employer:{one:'Your next great teammate might be right around the corner.',two:'Manage postings, review candidates and move hiring forward.',action:'Post an opportunity',tab:'jobs'},
   lgu_admin:{one:'When trust comes first, opportunities follow.',two:'Review credentials and job listings to keep the community safe.',action:'Review pending accounts',tab:'reviews'},
   sys_admin:{one:'Make the entire network work beautifully.',two:'Support your community with oversight, stability and clear accountability.',action:'Manage accounts',tab:'users'}
 };
 return <div className="overview-layout">
   <div className="metrics-grid">{Object.entries(stats).slice(0,4).map(([key,value],i)=><div className="metric-card" key={key}><span className="metric-top"><span>0{i+1} / {key.replace(/_/g,' ').toUpperCase()}</span><Activity size={18}/></span><strong>{String(value)}</strong><small>Live platform data</small></div>)}{!Object.keys(stats).length&&[1,2,3].map(i=><div className="metric-card" key={i}><span className="metric-top">LOADING</span><strong>—</strong><small>Connecting to your workspace</small></div>)}</div>
   <div className="overview-spotlight"><div className="spotlight-copy"><p className="eyebrow">YOUR NEXT CHAPTER</p><h2>{copy[role].one}</h2><p>{copy[role].two}</p><button onClick={()=>navigate(copy[role].tab)} className="btn btn-lime">{copy[role].action} <ArrowUpRight size={18}/></button></div><div className="spotlight-art"><div className="spotlight-ring"><div className="spotlight-center"><Sparkles size={56}/></div></div><span>THE POSSIBILITIES ARE OPEN</span></div></div>
   {me.lgu_status!=='approved'&&['jobseeker','employer'].includes(role)&&<div className="approval-banner"><ShieldCheck size={22}/><div><strong>{me.lgu_status==='rejected'?'Your documents need a new review.':'Your account needs LGU verification.'}</strong><p>Submit your credentials to unlock job applications and employer posting.</p></div><button onClick={()=>navigate('verification')}>Start verification <ArrowUpRight size={17}/></button></div>}
   <div className="overview-foot"><span><span className="signal-dot"/> SYSTEM CONNECTED TO SUPABASE</span><span>EVERY GOOD CAREER BEGINS SOMEWHERE.</span></div>
 </div>;
}
