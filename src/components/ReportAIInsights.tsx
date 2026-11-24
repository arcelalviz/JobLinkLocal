'use client';
import { useEffect, useRef, useState } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';
import { reportFocuses, reportSummaryData, verifiedReportSummary, type ReportFocus } from '@/lib/report-ai';
import { startLocalSummary, type LocalSummaryTask } from '@/lib/local-summary-client';

export function ReportAIInsights({report}:{report:unknown}){
 const [focus,setFocus]=useState<ReportFocus>('recruitment');
 const [text,setText]=useState('');
 const [method,setMethod]=useState('');
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const task=useRef<LocalSummaryTask|null>(null);
 const sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;task.current?.cancel();task.current=null;},[]);
 function clear(){sequence.current++;task.current?.cancel();task.current=null;setBusy(false);setStatus('');setText('');setMethod('');setNotice('');}
 function cancel(){sequence.current++;task.current?.cancel();task.current=null;setBusy(false);setStatus('');setNotice('Local generation cancelled. The built-in summary remains available.');}
 async function generate(){
  if(task.current)return;
  const id=++sequence.current;
  setText('');setMethod('');setNotice('');setStatus('');setBusy(true);
  try{
   const data=reportSummaryData(report,focus);
   setText(data.builtIn);setMethod('Built-in report summary');
   if(data.truncated){setNotice('The report reached its row limit. These counts may be incomplete; AI generation is disabled for this report.');return;}
   if(data.allFacts.every(f=>f.endsWith(': 0.'))){setNotice('No activity was recorded in this period.');return;}
   try{
    const job=startLocalSummary(data.facts,value=>{if(sequence.current===id)setStatus(value);});task.current=job;
    const output=await job.promise;
    if(sequence.current!==id)return;
    const verified=verifiedReportSummary(output,data);
    if(verified){setText(verified);setMethod('Local AI-assisted report summary (verified facts)');}
    else setNotice('The local model did not select a verified summary. The built-in summary remains available.');
   }catch{if(sequence.current===id)setNotice('Local AI could not finish on this device. The built-in summary remains available.');}
  }catch(error){if(sequence.current===id)setNotice(error instanceof Error?error.message:'Report summary unavailable.');}
  finally{if(sequence.current===id){task.current=null;setBusy(false);setStatus('');}}
 }
 return <section className="jl-ai-panel" aria-label="AI report interpretation">
  <div className="jl-ai-title"><div><ChartNoAxesColumn size={20}/><h2>AI report interpretation</h2></div><small>Selected report period · on-device AI</small></div>
  <p className="jl-ai-foot">Choose which area to emphasize. The summary uses the six aggregate counts in this report; no individual records are analyzed.</p>
  <label className="form-field"><span>Summary focus</span><select value={focus} onChange={e=>{clear();setFocus(e.target.value as ReportFocus);}}>{reportFocuses.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
  <div className="jl-ai-extra">
   <button type="button" className="btn btn-outline btn-small" onClick={generate} disabled={busy}><ChartNoAxesColumn size={15}/> {busy?'Generating…':'Generate AI report summary'}</button>
   {busy&&<button type="button" className="btn btn-outline btn-small" onClick={cancel}>Cancel generation</button>}
   {status&&<small role="status">{status}</small>}
   {text&&<><small>{method}</small><p className="jl-ai-generated" role="status">{text}</p></>}
   {notice&&<p className="jl-ai-foot" role="status">{notice}</p>}
   <small>The model chooses which verified fact to emphasize. Counts and wording come from the application, not model-generated claims. First use may download about 100 MB of model weights plus runtime files. Existing statistical insights and report exports are separate.</small>
  </div>
 </section>;
}
