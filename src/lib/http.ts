import type { ApiResponse } from '@/types';

export async function request<T=any>(path:string,method='GET',body?:unknown):Promise<T> {
 const options:RequestInit={method,credentials:'same-origin',cache:'no-store'};
 if(body instanceof FormData) options.body=body;
 else if(body!==undefined){options.body=JSON.stringify(body);options.headers={'Content-Type':'application/json'};}
 let response:Response;
 try { response=await fetch('/api/'+path.replace(/^\//,''),options); }
 catch { throw new Error('Connection interrupted. Check your internet connection.'); }
 const result=await response.json().catch(()=>({error:'Unexpected server response.'})) as ApiResponse<T>;
 if(!response.ok) throw new Error(result.error||'The request could not be completed.');
 return result.data as T;
}

export async function downloadReport(format:'csv'|'pdf',start:string,end:string){
 const response=await fetch(`/api/reports?format=${format}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,{credentials:'same-origin',cache:'no-store'});
 if(!response.ok) throw new Error('Report download failed.');
 const blob=await response.blob();
 const href=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=href;a.download=`JobLinkLocal-Report.${format}`;a.click();
 setTimeout(()=>URL.revokeObjectURL(href),1000);
}
