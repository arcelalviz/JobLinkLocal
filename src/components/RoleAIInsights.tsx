
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChartNoAxesColumn, ArrowUpRight } from 'lucide-react';
import { request } from '@/lib/http';
import type { Role } from '@/types';
import { builtInSummary, summaryFacts, validatedModelSummary, type SummaryInput } from '@/lib/ai-summary';
import { startLocalSummary, type LocalSummaryTask } from '@/lib/local-summary-client';

type Insight={role:Role;method:string;items:Array<{title?:string;value?:number;job?:{id:string;title:string;company_name:string};required?:string[];matched?:string[];missing?:string[]}>;info:string};
export function RoleAIInsights({role,navigate}:{role:Role;navigate:(tab:string)=>void}){
 const [data,setData]=useState<Insight|null>(null);
 const [error,setError]=useState(false);
 const [aiText,setAiText]=useState('');
 const [aiError,setAiError]=useState('');
 const [aiBusy,setAiBusy]=useState(false);
 const [aiStatus,setAiStatus]=useState('');
 const [aiMethod,setAiMethod]=useState('');
 const task=useRef<LocalSummaryTask|null>(null);
 const attempt=useRef(0);
 useEffect(()=>{
  setAiText('');setAiError('');setAiStatus('');setAiMethod('');setAiBusy(false);
  return()=>{attempt.current++;task.current?.cancel();task.current=null;};
 },[role]);
 async function generate(){
  const id=++attempt.current;
  setAiBusy(true);setAiError('');setAiText('');setAiMethod('');setAiStatus('Loading current counts…');
  try{
   const result=await request<SummaryInput>('ai/explain','POST',{});
   if(attempt.current!==id)return;
   if(result?.role!==role)throw new Error('Summary role did not match your account.');
   const facts=summaryFacts(role,result.metrics);
   setAiText(builtInSummary(role,result.metrics));setAiMethod('Built-in summary');
   try{
    const job=startLocalSummary(facts,status=>{if(attempt.current===id)setAiStatus(status);});task.current=job;
    const output=await job.promise;
    if(attempt.current!==id)return;
    const checked=validatedModelSummary(output,facts);
    if(checked){setAiText(checked);setAiMethod('Local AI-assisted summary (verified counts)');}
    else setAiError('The local model returned unverified text. Showing the accurate built-in summary instead.');
   }catch{if(attempt.current===id)setAiError('Local AI could not finish on this device. Showing the built-in summary instead.');}
  }catch(e){if(attempt.current===id)setAiError(e instanceof Error?e.message:'Unable to load summary counts.');}
  finally{if(attempt.current===id){task.current=null;setAiBusy(false);setAiStatus('');}}
 }
 function cancel(){
  attempt.current++;task.current?.cancel();task.current=null;setAiBusy(false);setAiStatus('');setAiError('Local generation cancelled.');
 }
 useEffect(()=>{let active=true;request<Insight>('ai/insights').then(v=>{if(active){if(!v||!Array.isArray(v.items)){setData(null);setError(true);return;}setData(v);setError(false);}}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[role]);
 return <section className="jl-ai-panel" aria-label="AI-assisted insights"><div className="jl-ai-title"><div><ChartNoAxesColumn size={20}/><h2>{role==='jobseeker'?'Suggested jobs':role==='employer'?'Recruitment overview':role==='lgu_admin'?'LGU review workload':'Platform insights'}</h2></div><small>Explainable insights</small></div>
 {error?<p>Insights are temporarily unavailable.</p>:!data?<p>Loading insights…</p>:<><div className="jl-ai-grid">{data.items.length?data.items.map((item,i)=><article className="jl-ai-item" key={`${item.job?.id||item.title}-${i}`}><strong>{item.job?.title||item.title}</strong>{item.job&&<small>{item.job.company_name}</small>}{typeof item.value==='number'&&<b>{item.value}</b>}{item.matched&&<p>Skills mentioned in the listing that match your profile: {item.matched.join(', ')||'None identified yet'}</p>}{role==='jobseeker'&&item.job&&<Link className="text-action" href={`/app?tab=discover&job=${encodeURIComponent(item.job.id)}`}>View matching job <ArrowUpRight size={15}/></Link>}</article>):<p>{role==='jobseeker'?'Add skills to your profile to see relevant job listings.':'No activity is available for this summary.'}</p>}</div><p className="jl-ai-foot">{data.info} <span>Method: {data.method}.</span></p><div className="jl-ai-extra"><button className="btn btn-outline btn-small" disabled={aiBusy} type="button" onClick={generate}><ChartNoAxesColumn size={15}/> {aiBusy?'Generating…':'Generate AI summary'}</button>{aiBusy&&<button className="btn btn-outline btn-small" type="button" onClick={cancel}>Cancel generation</button>}{aiStatus&&<small role="status">{aiStatus}</small>}{aiText&&<><small>{aiMethod}</small><p className="jl-ai-generated" role="status">{aiText}</p></>}{aiError&&<p role="status" className="jl-ai-foot">{aiError}</p>}<small>Free on-device AI. First use downloads approximately 100 MB of model weights plus runtime files. Your browser may cache them. No API key needed. Only aggregate counts are processed; never used to make hiring decisions.</small></div></>}
 </section>;
}
