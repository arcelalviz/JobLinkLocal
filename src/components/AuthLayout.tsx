'use client';
import Link from 'next/link';
import { ArrowLeft, BriefcaseBusiness, Check, LockKeyhole } from 'lucide-react';

export function AuthLayout({children,eyebrow,title,subtitle}:{children:React.ReactNode;eyebrow:string;title:string;subtitle:string}) {
 return <main className="auth-shell">
   <aside className="auth-art"><div className="auth-art-top"><Link href="/" className="brand auth-brand"><span className="brand-icon"><BriefcaseBusiness size={19}/></span><span>joblinklocal</span></Link><span>LOCAL EMPLOYMENT PLATFORM</span></div>
     <div className="auth-art-main"><span className="auth-edition">A better connection to local work</span><h2>Find your place.<br/><em>Move forward.</em></h2><p>One secure workspace for local opportunities and professional hiring.</p><div className="auth-service-list"><div><Check size={17}/> Verified local accounts</div><div><Check size={17}/> Transparent application tracking</div><div><Check size={17}/> Secure recruitment management</div></div></div>
     <div className="auth-art-bottom"><span>JOBLINKLOCAL / WORK WITH CONFIDENCE</span><BriefcaseBusiness size={20}/></div>
   </aside>
   <section className="auth-main"><header className="auth-header"><Link href="/" className="text-back"><ArrowLeft size={17}/> Back to home</Link><span className="secure-note"><LockKeyhole size={14}/> SECURE ACCESS</span></header><div className="auth-content"><p className="eyebrow dark-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}</div><div className="auth-mobile-foot">JOBLINKLOCAL / CONNECTING LOCAL TALENT</div></section>
 </main>;
}
