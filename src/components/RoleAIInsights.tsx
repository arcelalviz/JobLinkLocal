
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChartNoAxesColumn, ArrowUpRight } from 'lucide-react';
import { request } from '@/lib/http';
import type { Role } from '@/types';

type Insight={role:Role;method:string;items:Array<{title?:string;value?:number;job?:{id:string;title:string;company_name:string};required?:string[];matched?:string[];missing?:string[]}>;info:string};
export function RoleAIInsights({role,navigate}:{role:Role;navigate:(tab:string)=>void}){
 const [data,setData]=useState<Insight|null>(null);
 const [error,setError]=useState(false);
 const [aiText,setAiText]=useState('');
 const [aiError,setAiError]=useState('');
 const [aiBusy,setAiBusy]=useState(false);
 useEffect(()=>{let active=true;request<Insight>('ai/insights').then(v=>{if(active){if(!v||!Array.isArray(v.items)){setData(null);setError(true);return;}setData(v);setError(false);}}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[role]);
 return <section className="jl-ai-panel" aria-label="AI-assisted insights"><div className="jl-ai-title"><div><ChartNoAxesColumn size={20}/><h2>{role==='jobseeker'?'Suggested jobs':role==='employer'?'Recruitment overview':role==='lgu_admin'?'LGU review workload':'Platform insights'}</h2></div><small>Explainable insights</small></div>
 {error?<p>Insights are temporarily unavailable.</p>:!data?<p>Loading insights…</p>:<><div className="jl-ai-grid">{data.items.length?data.items.map((item,i)=><article className="jl-ai-item" key={`${item.job?.id||item.title}-${i}`}><strong>{item.job?.title||item.title}</strong>{item.job&&<small>{item.job.company_name}</small>}{typeof item.value==='number'&&<b>{item.value}</b>}{item.matched&&<p>Skills mentioned in the listing that match your profile: {item.matched.join(', ')||'None identified yet'}</p>}{role==='jobseeker'&&item.job&&<Link className="text-action" href={`/app?tab=discover&job=${encodeURIComponent(item.job.id)}`}>View matching job <ArrowUpRight size={15}/></Link>}</article>):<p>{role==='jobseeker'?'Add skills to your profile to see relevant job listings.':'No activity is available for this summary.'}</p>}</div><p className="jl-ai-foot">{data.info} <span>Method: {data.method}.</span></p><div className="jl-ai-extra"><button className="btn btn-outline btn-small" disabled={aiBusy} type="button" onClick={async()=>{setAiBusy(true);setAiError('');try{const result=await request<{text:string}>('ai/explain','POST',{});setAiText(result.text);}catch(e){setAiError(e instanceof Error?e.message:'AI summary unavailable.');}finally{setAiBusy(false);}}}><ChartNoAxesColumn size={15}/> {aiBusy?'Generating…':'Generate AI summary'}</button>{aiError&&<p role="status" className="jl-ai-foot">{aiError}</p>}{aiText&&<p className="jl-ai-generated" role="status">{aiText}</p>}<small>Optional: requires an API key configured by the site administrator. Only aggregate counts are sent to the AI provider.</small></div></>}
 </section>;
}
