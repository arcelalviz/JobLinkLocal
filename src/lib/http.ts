import type { ApiResponse } from '@/types';
import { createBrowserClient } from '@supabase/ssr';

export async function fetchWithSessionRetry(input:string,options:RequestInit={}):Promise<Response> {
 let response=await fetch(input,options);
 if(response.status!==401 || typeof window==='undefined' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    input.startsWith('/api/auth/'))return response;
 try{
   const client=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
   const {data,error}=await client.auth.refreshSession();
   if(!error&&data.session&&!options.signal?.aborted)response=await fetch(input,options);
 }catch{ /* The original response still explains the access issue. */ }
 return response;
}

export async function request<T=any>(path:string,method='GET',body?:unknown):Promise<T> {
 const options:RequestInit={method,credentials:'same-origin',cache:'no-store'};
 if(body instanceof FormData) options.body=body;
 else if(body!==undefined){options.body=JSON.stringify(body);options.headers={'Content-Type':'application/json'};}
 let response:Response;
 try { response=await fetchWithSessionRetry('/api/'+path.replace(/^\//,''),options); }
 catch { throw new Error('Connection interrupted. Check your internet connection.'); }
 const result=await response.json().catch(()=>({error:'Unexpected server response.'})) as ApiResponse<T>;
 if(!response.ok) throw new Error(response.status===413?'Request is too large. Select a smaller file or try again using the updated uploader.':response.status===401?'Your session expired. Sign in again to upload or update files.':result.error||'The request could not be completed.');
 return result.data as T;
}

export async function downloadReport(format:'csv'|'pdf',start:string,end:string,period:'day'|'week'|'month'|'year'='month'){
 const response=await fetchWithSessionRetry(`/api/reports?format=${format}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&period=${period}`,{credentials:'same-origin',cache:'no-store'});
 if(!response.ok) throw new Error('Report download failed.');
 const blob=await response.blob();
 const href=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=href;a.download=`JobLinkLocal-Report.${format}`;a.click();
 setTimeout(()=>URL.revokeObjectURL(href),1000);
}
