'use client';
import Link from 'next/link';
import { CircleDot, ArrowLeft, Sparkles, Orbit, LockKeyhole } from 'lucide-react';

export function AuthLayout({children,eyebrow,title,subtitle}:{children:React.ReactNode;eyebrow:string;title:string;subtitle:string}) {
 return <main className="auth-shell">
   <aside className="auth-art"><div className="auth-art-top"><Link href="/" className="brand auth-brand"><span className="brand-icon"><CircleDot size={19}/></span><span>joblinklocal<sup>®</sup></span></Link><span>THE OPPORTUNITY NETWORK</span></div><div className="auth-art-main"><div className="auth-graphic"><div className="auth-orbit auth-orbit-1"/><div className="auth-orbit auth-orbit-2"/><div className="auth-graphic-core"><Orbit size={86} strokeWidth={.8}/></div><span className="auth-orbit-label a">MAKE A MOVE.</span><span className="auth-orbit-label b">FIND YOUR PEOPLE.</span></div><h2>There’s more<br/>out <em>there.</em></h2><p>And sometimes, it’s closer than you think.</p></div><div className="auth-art-bottom"><span>FIND YOUR PLACE. FIND YOUR PEOPLE.</span><Sparkles size={22}/></div></aside>
   <section className="auth-main"><header className="auth-header"><Link href="/" className="text-back"><ArrowLeft size={17}/> Back to home</Link><span className="secure-note"><LockKeyhole size={14}/> SECURE CONNECTION</span></header><div className="auth-content"><p className="eyebrow dark-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}</div><div className="auth-mobile-foot">JOBLINKLOCAL / LOCAL ROOTS, LIMITLESS OPPORTUNITIES</div></section>
 </main>;
}
