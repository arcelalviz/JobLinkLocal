export class SummaryError extends Error {
 constructor(public readonly reason:string, message:string){super(message);this.name='SummaryError';}
}
const advice=(status:number,code:string,type:string)=>{
 if(code==='insufficient_quota'||type==='insufficient_quota'||code==='credit_balance_exhausted'||code==='billing_hard_limit_reached'||status===402)return ['quota','AI summary unavailable: the API project has insufficient credits or a billing limit. Contact the site administrator.'];
 if(status===401||code==='invalid_api_key')return ['credentials','AI summary unavailable: API credentials need to be checked by the site administrator.'];
 if(status===404||code==='model_not_found')return ['model','AI summary unavailable: the configured model is not accessible to the API project.'];
 if(status===403)return ['permission','AI summary unavailable: the API project does not have the required permissions.'];
 if(status===429)return ['rate_limit','AI summary is rate limited. Try again later.'];
 if(status===400)return ['request','AI summary unavailable: the provider rejected the request configuration. Contact the site administrator.'];
 return ['provider','AI summary service temporarily unavailable. Use the built-in insights instead.'];
};
export async function generateSummary(key:string,model:string,role:string,metrics:Record<string,number>):Promise<string>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
 try{
  const result=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:1024,...(model==='gpt-6.1-terra'?{reasoning:{effort:'none'}}:{}),instructions:'Summarize the supplied aggregate employment metrics in two short factual English sentences. Use only the supplied counts; do not invent trends or qualifications. Do not recommend automated hiring, rejection, acceptance or account suspension. Do not infer protected traits or individual competence.',input:JSON.stringify({role,metrics})})});
  const data=await result.json().catch(()=>null);
  if(!result.ok){
   const code=typeof data?.error?.code==='string'?data.error.code:'';
   const type=typeof data?.error?.type==='string'?data.error.type:'';
   const [reason,message]=advice(result.status,code,type);
   console.error('[JobLinkLocal OpenAI]',{status:result.status,reason,model,requestId:result.headers.get('x-request-id')});
   throw new SummaryError(reason,message);
  }
  const answer=(Array.isArray(data?.output)?data.output:[]).flatMap((item:any)=>Array.isArray(item?.content)?item.content:[]).filter((part:any)=>part?.type==='output_text'&&typeof part.text==='string').map((part:any)=>part.text).join(' ').trim();
  if(!answer||data?.status==='incomplete'||data?.status==='failed'){
   console.error('[JobLinkLocal OpenAI]',{status:result.status,reason:'incomplete_or_empty',model,requestId:result.headers.get('x-request-id')});
   throw new SummaryError('incomplete','The AI summary was incomplete. Try again or use the built-in insights.');
  }
  return answer.slice(0,1000);
 }catch(error){
  if(error instanceof SummaryError)throw error;
  const timeout=controller.signal.aborted;
  console.error('[JobLinkLocal OpenAI]',{reason:timeout?'timeout':'connection',model});
  throw new SummaryError(timeout?'timeout':'connection',timeout?'AI summary request timed out. Try again later.':'AI summary could not connect to the provider. Try again later.');
 }finally{clearTimeout(timer);}
}
