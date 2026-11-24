import type { Role } from '@/types';

const labels = {
 jobseeker: [['available_jobs','Published job openings'],['submitted_applications','Your submitted applications']],
 employer: [['own_job_posts','Your job postings'],['submitted_applications','Applications to your jobs']],
 lgu_admin: [['pending_verifications','Pending verification requests'],['pending_job_reviews','Pending job reviews']],
 sys_admin: [['total_accounts','Registered accounts'],['total_applications','Total applications']],
} as const;
export type SummaryInput = { role:Role; metrics:Record<string,number>; text:string; method:string };
export function summaryFacts(role:Role, metrics:unknown):string[] {
 if (!Object.prototype.hasOwnProperty.call(labels,role) || !metrics || typeof metrics!=='object') throw new Error('Summary data is unavailable.');
 const source=metrics as Record<string,unknown>;
 return labels[role].map(([key,label])=>{
  const n=source[key];
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)throw new Error('Summary data is incomplete.');
  return `${label}: ${n}.`;
 });
}
export function builtInSummary(role:Role, metrics:unknown):string {return summaryFacts(role,metrics).join(' ');}
// Only display the model's factual restatement when every supplied fact is present
// and no additional claims are introduced. The model may choose the sentence order.
export function validatedModelSummary(output:unknown, facts:string[]):string|null {
 if(typeof output!=='string'||facts.length!==2||output.length>500)return null;
 const clean=(value:string)=>value.trim().replace(/\s+/g,' ').toLowerCase();
 const forward=facts.join(' '),reverse=[...facts].reverse().join(' ');
 if(clean(output)===clean(forward))return forward;
 if(clean(output)===clean(reverse))return reverse;
 return null;
}
