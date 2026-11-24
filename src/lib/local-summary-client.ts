export type LocalSummaryTask = { promise:Promise<string>; cancel:()=>void };
export function startLocalSummary(facts:string[],onProgress:(status:string)=>void):LocalSummaryTask {
 let worker:Worker|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let cancel=()=>{};
 const promise=new Promise<string>((resolve,reject)=>{
  let settled=false;
  const finish=(error?:Error,text?:string)=>{
   if(settled)return;
   settled=true;
   if(timer!==undefined)clearTimeout(timer);
   worker?.terminate();
   if(error)reject(error);else resolve(text||'');
  };
  cancel=()=>finish(new Error('Local generation cancelled.'));
  try{
   worker=new Worker('/workers/local-summary.mjs',{type:'module',name:'joblinklocal-summary'});
   worker.onmessage=({data})=>{
    if(data?.kind==='progress'&&typeof data.text==='string')onProgress(data.text);
    else if(data?.kind==='result'&&typeof data.text==='string')finish(undefined,data.text);
    else finish(new Error('Local model could not generate a summary.'));
   };
   worker.onerror=()=>finish(new Error('Local model could not load.'));
   worker.onmessageerror=()=>finish(new Error('Local model returned an unreadable response.'));
   timer=setTimeout(()=>finish(new Error('Local model timed out.')),180_000);
   worker.postMessage({facts});
  }catch{finish(new Error('Local AI is not supported on this device.'));}
 });
 return {promise,cancel:()=>cancel()};
}
