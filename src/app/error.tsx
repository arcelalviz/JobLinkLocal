'use client';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight } from 'lucide-react';

export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}){
 return <main className="failure-page"><div className="failure-content"><span className="eyebrow dark-eyebrow">SOMETHING INTERRUPTED THE JOURNEY</span><AlertCircle size={52} color="#9d6655"/><h1>A little detour.<br/><em>Nothing more.</em></h1><p>The page couldn't load just now. Your account and saved records are not intentionally changed.</p><button className="btn btn-ink" onClick={reset}>Try again <ArrowUpRight size={17}/></button><Link href="/" className="text-action">Return home</Link></div></main>;
}
