'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function ErrorPage({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('[JobLinkLocal page error]',{name:error.name,message:error.message,digest:error.digest});},[error]);
 return <main className="failure-page"><div className="failure-content"><span className="eyebrow dark-eyebrow">PAGE UNAVAILABLE</span><AlertCircle size={36}/><h1>Unable to load this page.</h1><p>Try again. If the issue continues, report the error to the site administrator.</p>{error.digest&&<p>Error reference: <code>{error.digest}</code></p>}<button type="button" className="btn btn-ink" onClick={reset}>Try again</button> <button type="button" className="btn btn-outline" onClick={()=>window.location.reload()}>Reload page</button> <Link href="/" className="text-action">Return home</Link></div></main>;
}
