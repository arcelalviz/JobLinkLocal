'use client';
import Link from 'next/link';
import { ArrowLeft, BriefcaseBusiness, Check, LockKeyhole } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

export function AuthLayout({children,eyebrow,title,subtitle}:{children:React.ReactNode;eyebrow:string;title:string;subtitle:string}) {
 return <main className="auth-shell">
   <aside className="auth-art"><div className="auth-art-top"><Link href="/" className="brand auth-brand"><span className="brand-icon"><BrandMark size={34}/></span><span>joblinklocal</span></Link><span>OLONGAPO CITY</span></div>
     <div className="auth-art-main"><h2>Jobs and recruitment</h2><div className="auth-service-list"><div><Check size={17}/> Verified local accounts</div><div><Check size={17}/> Application tracking</div><div><Check size={17}/> Recruitment management</div></div></div>
     <div className="auth-art-bottom"><BriefcaseBusiness size={20}/></div>
   </aside>
   <section className="auth-main"><header className="auth-header"><Link href="/" className="text-back"><ArrowLeft size={17}/> Back to home</Link></header><div className="auth-content">{eyebrow.trim().toLowerCase()!==title.trim().toLowerCase()&&<p className="eyebrow dark-eyebrow">{eyebrow}</p>}<h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}</div><div className="auth-mobile-foot">JOBLINKLOCAL</div></section>
 </main>;
}
