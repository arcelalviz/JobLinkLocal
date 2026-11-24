'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { Compass, Grid2X2, Bookmark, BriefcaseBusiness, Users, ShieldCheck, ClipboardCheck, BarChart3, Bell, UserRound, LogOut, Menu, X, ArrowUpRight, Activity, FileCheck2, Settings2, ScrollText } from 'lucide-react';
import { request } from '@/lib/http';
import { useToast } from '@/components/ToastProvider';
import type { Profile, Role } from '@/types';
import { SeekerPanels } from '@/components/SeekerPanels';
import { EmployerPanels } from '@/components/EmployerPanels';
import { AdminPanels } from '@/components/AdminPanels';
import { AccountPanels } from '@/components/AccountPanels';
import { ProfileAvatar } from '@/components/ProfilePhoto';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { createBrowserClient } from '@supabase/ssr';
import { ManilaClock } from '@/components/ManilaClock';
import { RoleAIInsights } from '@/components/RoleAIInsights';

const tabDefinitions=[
 {id:'overview',label:'Overview',icon:Grid2X2,roles:['jobseeker','employer','lgu_admin','sys_admin']},
 {id:'discover',label:'Find opportunities',icon:Compass,roles:['jobseeker']},
 {id:'applications',label:'My applications',icon:BriefcaseBusiness,roles:['jobseeker']},
 {id:'saved',label:'Saved positions',icon:Bookmark,roles:['jobseeker']},
 {id:'jobs',label:'My job posts',icon:BriefcaseBusiness,roles:['employer']},
 {id:'candidates',label:'Candidate pipeline',icon:Users,roles:['employer']},
 {id:'reviews',label:'Verify people',icon:ShieldCheck,roles:['lgu_admin']},
 {id:'postings',label:'Approve jobs',icon:ClipboardCheck,roles:['lgu_admin']},
 {id:'review-history',label:'Verification history',icon:ClipboardCheck,roles:['lgu_admin']},
 {id:'all-jobs',label:'View all jobs',icon:BriefcaseBusiness,roles:['lgu_admin','sys_admin']},
 {id:'jobseekers',label:'View all jobseekers',icon:Users,roles:['lgu_admin']},
 {id:'resume-removals',label:'Resume removal requests',icon:FileCheck2,roles:['lgu_admin']},
 {id:'tracking',label:'Application tracking',icon:Activity,roles:['lgu_admin']},
 {id:'users',label:'Account control',icon:Settings2,roles:['sys_admin']},
 {id:'audit',label:'Activity log',icon:ScrollText,roles:['sys_admin']},
 {id:'reports',label:'Reports & insights',icon:BarChart3,roles:['lgu_admin','sys_admin']},
 {id:'verification',label:'LGU verification',icon:FileCheck2,roles:['jobseeker','employer']},
 {id:'profile',label:'My profile',icon:UserRound,roles:['jobseeker','employer','lgu_admin','sys_admin']},
 {id:'notifications',label:'Notifications',icon:Bell,roles:['jobseeker','employer','lgu_admin','sys_admin']}
];

const roleNames:Record<Role,string>={jobseeker:'Jobseeker',employer:'Employer',lgu_admin:'LGU Admin',sys_admin:'System Admin'};

function WorkspaceStage({children}:{children:React.ReactNode}){
 const present=useIsPresent();
 return <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4,transition:{duration:.16,ease:"easeIn"}}} transition={{duration:.20,ease:[0.16,1,0.3,1]}} className="jl-workspace-stage" inert={!present} aria-hidden={!present}>{children}</motion.div>;
}

export function Workspace(){
 const router=useRouter();
 const searchParams=useSearchParams();
 const toast=useToast();
 const [me,setMe]=useState<Profile|null>(null);
 const [loading,setLoading]=useState(true);
 const [tab,setTab]=useState('overview');
 const [menu,setMenu]=useState(false);
 const [accountMenu,setAccountMenu]=useState(false);
 const [confirmLogout,setConfirmLogout]=useState(false);
 const accountRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!accountMenu&&!menu)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setAccountMenu(false);setMenu(false);if(accountMenu)accountRef.current?.querySelector<HTMLButtonElement>('button.profile-avatar')?.focus();}};
  const outside=(event:PointerEvent)=>{if(accountMenu&&event.target instanceof Node&&!accountRef.current?.contains(event.target))setAccountMenu(false);};
  document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);
  return ()=>{document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);};
 },[accountMenu,menu]);
 const [refresh,setRefresh]=useState(0);
 const [unread,setUnread]=useState(0);
 const seenNotifications=useRef<Set<string>|null>(null);
 const bump=()=>setRefresh(x=>x+1);
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
   const poll=()=>request<any>('dashboard').then(v=>{if(active){setUnread(v.unread||0);if(v.profile?.lgu_status)setMe(current=>current&&current.lgu_status!==v.profile.lgu_status?{...current,lgu_status:v.profile.lgu_status}:current);}}).catch(()=>{});
   poll();const interval=setInterval(poll,15000);
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
   check();const interval=setInterval(check,15000);
   return ()=>{active=false;clearInterval(interval);};
 },[me,toast]);
 useEffect(() => {
   if (!me || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
   const browser = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
   const channel = browser.channel(`private-notifications-${me.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` }, payload => {
      const incoming = payload.new as { id?: string; title?: string; body?: string };
      if (!incoming.id) return;
      if (seenNotifications.current?.has(incoming.id)) return;
      seenNotifications.current?.add(incoming.id);
      setUnread(count => count + 1);
      toast.show(incoming.title || 'New update', 'info', incoming.body || 'Check your notifications.');
    }).subscribe();
   return () => { void browser.removeChannel(channel); };
 }, [me, toast]);
 const navigate=(id:string)=>{setTab(id);setMenu(false);if(window.location.search!==`?tab=${encodeURIComponent(id)}`)window.history.pushState(null,'',`/app?tab=${encodeURIComponent(id)}`);};
 // Next.js Link navigation, native history updates, and browser Back/Forward all sync the active panel.
 useEffect(()=>{const requested=searchParams.get('tab')||'overview';setTab(previous=>previous===requested?previous:requested);setMenu(false);},[searchParams]);
 useEffect(()=>{const handleBack=()=>{const value=new URLSearchParams(window.location.search).get('tab')||'overview';setTab(value);setMenu(false);};window.addEventListener('popstate',handleBack);return ()=>window.removeEventListener('popstate',handleBack);},[]);
 const logout=async()=>{
   try{await request('auth/logout','POST');toast.show('Signed out.','success');router.replace('/');router.refresh();}
   catch(e){toast.show(e instanceof Error?e.message:'Sign out failed.','error');}
 };
 const role=me?.role;
 const tabs=useMemo(()=>tabDefinitions.filter(i=>role&&i.roles.includes(role)),[role]);
 useEffect(()=>{if(role&&!tabs.some(t=>t.id===tab))navigate('overview');},[role,tabs,tab]);
 if(loading)return <div className="workspace-loading" role="status" aria-live="polite"><div className="loader-logo"><BriefcaseBusiness size={48}/></div><span>Loading your workspace…</span></div>;
 if(!me)return null;
 const active=tabs.find(t=>t.id===tab);
 const date=new Intl.DateTimeFormat('en-PH',{dateStyle:'full',timeZone:'Asia/Manila'}).format(new Date());
 return <div className={`workspace role-${me.role}`}>
  {menu&&<div className="mobile-menu-shade" onClick={()=>setMenu(false)}/>}
  <aside className={`workspace-sidebar ${menu?'is-open':''}`}>
   <div className="side-logo"><Link href="/" className="brand"><span className="brand-icon"><BrandMark size={34}/></span><span>joblink<span className="brand-soft">local</span></span></Link><button className="mobile-side-close" onClick={()=>setMenu(false)}><X size={20}/></button></div>
   <div className="side-identity"><span className="workspace-bullet"/> <span>WORKSPACE / {roleNames[me.role].toUpperCase()}</span></div>
   <nav className="side-navigation" aria-label="Workspace navigation">
    <div className="side-group-label">NAVIGATION</div>
    {tabs.filter(t=>!['profile','verification','notifications'].includes(t.id)).map(t=><button key={t.id} className={`side-link ${tab===t.id?'selected':''}`} aria-current={tab===t.id?'page':undefined} onClick={()=>navigate(t.id)}><t.icon size={19}/><span>{t.label}</span>{t.id==='reports'&&<ArrowUpRight size={14} className="side-trail"/>}</button>)}
    <div className="side-group-label side-group-second">ACCOUNT</div>
    {tabs.filter(t=>['profile','verification','notifications'].includes(t.id)).map(t=><button key={t.id} className={`side-link ${tab===t.id?'selected':''}`} aria-current={tab===t.id?'page':undefined} onClick={()=>navigate(t.id)}><t.icon size={19}/><span>{t.label}</span>{t.id==='notifications'&&unread>0&&<span className="notification-counter">{unread}</span>}</button>)}
   </nav>
   
  </aside>
  <div className="workspace-main">
   <header className="workspace-topbar"><button className="mobile-menu-button" onClick={()=>setMenu(true)} aria-label="Open navigation"><Menu size={22}/></button><span className="breadcrumb">WORKSPACE</span><div className="topbar-right"><span className="topbar-date">{date}</span><ManilaClock/><div className="jl-theme-in-header"><ThemeToggle/></div><button className="notification-trigger" onClick={()=>navigate('notifications')} aria-label="Notifications"><Bell size={20}/>{unread>0&&<span className="notification-indicator"/>}</button><div className="jl-topbar-account" ref={accountRef}><button type="button" className="profile-avatar" onClick={()=>{setAccountMenu(v=>!v);setConfirmLogout(false);}} aria-label="Account menu" aria-expanded={accountMenu}><ProfileAvatar person={me}/></button><AnimatePresence>{accountMenu&&<motion.div className="jl-account-popover" initial={{opacity:0,scale:.95,y:-6}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.95,y:-6,transition:{duration:.16,ease:"easeIn"}}}><strong>{me.full_name}</strong><small>{roleNames[me.role]}</small><button type="button" onClick={()=>{navigate('profile');setAccountMenu(false);}}><UserRound size={16}/> My profile</button>{confirmLogout?<div className="jl-signout-confirm"><p>Are you sure you want to sign out?</p><div><button type="button" onClick={()=>setConfirmLogout(false)}>Cancel</button><button type="button" onClick={()=>{setAccountMenu(false);setConfirmLogout(false);void logout();}}>Sign out</button></div></div>:<button type="button" onClick={()=>setConfirmLogout(true)}><LogOut size={16}/> Sign out</button>}</motion.div>}</AnimatePresence></div></div></header>
   <div className="workspace-content"><AnimatePresence mode="wait"><WorkspaceStage key={tab}>
    <div className="page-intro"><div><p className="eyebrow dark-eyebrow">{roleNames[me.role]}</p><h1>{tab==='overview'?'Dashboard':active?.label||'Dashboard'}</h1></div><div className={`status-chip status-${me.lgu_status}`}><span/>{me.lgu_status==='approved'?'LGU verified':me.lgu_status==='pending'?'Awaiting LGU approval':me.lgu_status==='rejected'?'Needs resubmission':'Account suspended'}</div></div>
    {tab==='overview'&&<Overview role={me.role} me={me} navigate={navigate} refresh={refresh}/>}
    {['discover','applications','saved'].includes(tab)&&<SeekerPanels tab={tab} me={me} refresh={refresh} bump={bump}/>}
    {['jobs','candidates'].includes(tab)&&<EmployerPanels tab={tab} me={me} refresh={refresh} bump={bump}/>}
    {['reviews','postings','review-history','all-jobs','jobseekers','resume-removals','tracking','users','audit','reports'].includes(tab)&&<AdminPanels tab={tab} me={me} refresh={refresh} bump={bump}/>}
    {['profile','verification','notifications'].includes(tab)&&<AccountPanels tab={tab} me={me} refresh={refresh} bump={bump} updateMe={setMe}/>}
   </WorkspaceStage></AnimatePresence></div>
  </div>

 </div>;
}

function Overview({role,me,navigate,refresh}:{role:Role;me:Profile;navigate:(tab:string)=>void;refresh:number}){
 const [data,setData]=useState<any>(null);
 const [error,setError]=useState('');
 const [reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setError('');request('dashboard').then(value=>{if(active)setData(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Dashboard unavailable.');});return()=>{active=false;};},[refresh,reload]);
 const stats=data?.stats||{};
 const copy:Record<Role,{one:string;action:string;tab:string}>={
   jobseeker:{one:'Job search',action:'Browse jobs',tab:'discover'},
   employer:{one:'Recruitment',action:'My job posts',tab:'jobs'},
   lgu_admin:{one:'LGU reviews',action:'Verify people',tab:'reviews'},
   sys_admin:{one:'Administration',action:'Account controls',tab:'users'}
 };
 return <div className="overview-layout">
   {error&&<div className="jl-data-error" role="alert"><span>{error}</span><button type="button" className="btn btn-outline btn-small" onClick={()=>setReload(v=>v+1)}>Retry dashboard</button></div>}
   <div className="metrics-grid">{Object.entries(stats).slice(0,4).map(([key,value])=>{const target=role==='jobseeker'?(key==='applications'?'applications':key==='saved'?'saved':'discover'):role==='employer'?(key==='applicants'?'candidates':'jobs'):role==='lgu_admin'?(key==='pending_reviews'?'reviews':key==='jobseekers'?'jobseekers':key==='jobs'?'all-jobs':key==='applications'?'tracking':'reports'):key==='users'?'users':key==='jobs'?'all-jobs':'reports';return role==='employer'&&key==='jobseekers'?<div className="metric-card" key={key}><span className="metric-top">Total registered jobseekers</span><strong>{String(value)}</strong><small>Platform-wide account count</small></div>:<button type="button" className="metric-card metric-action" onClick={()=>navigate(target)} key={key}><span className="metric-top"><span>{key.replace(/_/g,' ')}</span><Activity size={16}/></span><strong>{String(value)}</strong><small>Open <ArrowUpRight size={13}/></small></button>;})}{!Object.keys(stats).length&&[1,2,3].map(i=><div className="metric-card" key={i}><span className="metric-top">LOADING</span><strong>—</strong><small>Loading dashboard data</small></div>)}</div>
   <div className="overview-spotlight"><div className="spotlight-copy"><h2>{copy[role].one}</h2><button onClick={()=>navigate(copy[role].tab)} className="btn btn-lime">{copy[role].action} <ArrowUpRight size={18}/></button></div></div>
   <RoleAIInsights role={role} navigate={navigate}/>
   {me.lgu_status!=='approved'&&['jobseeker','employer'].includes(role)&&<div className="approval-banner"><ShieldCheck size={22}/><div><strong>{me.lgu_status==='rejected'?'Your documents need a new review.':'Your account needs LGU verification.'}</strong><p>Submit your credentials to unlock job applications and employer posting.</p></div><button onClick={()=>navigate('verification')}>Start verification <ArrowUpRight size={17}/></button></div>}
   
 </div>;
}
