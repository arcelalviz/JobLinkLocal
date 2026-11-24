import { summaryOptions, validatedModelSummary } from './ai-summary';

export const reportFocuses = [
 {value:'recruitment',label:'Recruitment'},
 {value:'verification',label:'Verification'},
 {value:'accounts',label:'Account activity'},
] as const;
export type ReportFocus = typeof reportFocuses[number]['value'];
const fields = {
 applications:'Report applications', jobs:'Report job postings', employment_records:'Report employment records',
 verification_submissions:'Report verification submissions', approved_verifications:'Report approved submissions', profiles:'Report new accounts',
} as const;
type Metric = keyof typeof fields;
const pairs:Record<ReportFocus,[Metric,Metric]> = {
 recruitment:['applications','jobs'], verification:['verification_submissions','approved_verifications'], accounts:['profiles','employment_records'],
};
export function reportSummaryData(report:unknown, focus:ReportFocus) {
 if(!report || typeof report!=='object' || !Object.prototype.hasOwnProperty.call(pairs,focus)) throw Error('Report data is unavailable.');
 const source=report as Record<string,unknown>;
 const metrics=source.summary;
 if(!metrics || typeof metrics!=='object') throw Error('Report counts are unavailable.');
 const counts=metrics as Record<string,unknown>;
 const fact=(key:Metric)=>{
  const n=counts[key];
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)throw Error('Report counts are incomplete.');
  return `${fields[key]}: ${n}.`;
 };
 const allFacts=(Object.keys(fields) as Metric[]).map(fact);
 const pair=pairs[focus];
 const facts=pair.map(fact);
 const other=(Object.keys(fields) as Metric[]).filter(key=>!pair.includes(key)).map(fact);
 // Preserve the same trusted wording for every metric, including zero counts.
 const tail=summaryOptions(other.slice(0,2))[0]+' '+summaryOptions(other.slice(2,4))[0];
 return {facts,allFacts,tail,builtIn:summaryOptions(facts)[0]+' '+tail,truncated:source.truncated===true};
}
export function verifiedReportSummary(output:unknown,data:ReturnType<typeof reportSummaryData>):string|null {
 const selected=validatedModelSummary(output,data.facts);
 return selected?`${selected} ${data.tail}`:null;
}
