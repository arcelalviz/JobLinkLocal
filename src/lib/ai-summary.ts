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
// The model chooses which verified fact to lead with, rather than inventing prose.
// Both sentences are rendered from the original trusted counts, never from model text.
function factSentence(fact:string):string {
 const match=/^([A-Za-z ]+): (\d+)\.$/.exec(fact);
 if(!match)throw new Error('Invalid summary fact.');
 const n=Number(match[2]);
 if(!Number.isSafeInteger(n)||n<0)throw new Error('Invalid summary count.');
 const plural=(word:string)=>n===1?word:word+'s';
 switch(match[1]){
  case 'Published job openings':return `There ${n===1?'is':'are'} ${n} published job ${plural('opening')}.`;
  case 'Your submitted applications':return `You have submitted ${n} job ${plural('application')}.`;
  case 'Your job postings':return `You have ${n} job ${plural('posting')}.`;
  case 'Applications to your jobs':return `Your job postings have received ${n} ${plural('application')}.`;
  case 'Pending verification requests':return `${n} verification ${plural('request')} ${n===1?'is':'are'} awaiting review.`;
  case 'Pending job reviews':return `${n} job ${plural('posting')} ${n===1?'is':'are'} awaiting review.`;
  case 'Registered accounts':return `The platform has ${n} registered ${plural('account')}.`;
  case 'Total applications':return `The platform has recorded ${n} job ${plural('application')}.`;
  default:throw new Error('Unknown summary fact.');
 }
}
export function summaryOptions(facts:string[]):[string,string] {
 if(facts.length!==2)throw new Error('Summary facts are incomplete.');
 const [first,second]=facts.map(factSentence);
 return [`${first} ${second}`,`${second} ${first}`];
}
export function validatedModelSummary(output:unknown, facts:string[]):string|null {
 if(typeof output!=='string'||facts.length!==2||output.length>500)return null;
 const clean=(value:string)=>value.trim().replace(/\s+/g,' ').toLowerCase();
 const selected=clean(output);
 let options:[string,string];
 try{options=summaryOptions(facts);}catch{return null;}
 for(const i of [0,1] as const){
  const letter=i===0?'a':'b';
  const fact=clean(facts[i]);
  const full=clean(i===0?facts.join(' '):[...facts].reverse().join(' '));
  // A copied fact is a valid selection, not a complete summary: always append the other fact.
  const choices=[letter,letter+'.',`(${letter})`,`option ${letter}`,`option ${letter}.`,fact,`${letter}: ${fact}`,`${letter}. ${fact}`,full,clean(options[i])];
  if(choices.includes(selected))return options[i];
 }
 return null;
}
