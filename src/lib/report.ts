import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { adminClient } from './supabase/admin';
import { ApiError } from './guards';

export async function reportData(start:string|null,end:string|null) {
  const admin=adminClient();
  const since=start && /^\d{4}-\d{2}-\d{2}$/.test(start)?start:'2020-01-01';
  const until=end && /^\d{4}-\d{2}-\d{2}$/.test(end)?end:'2099-12-31';
  if(since>until) throw new ApiError(400,'The start date must be before the end date.');
  const tables=['profiles','jobs','applications','employment_records','verification_submissions'] as const;
  const summary:Record<string,number>={};
  for(const table of tables){
    const {count,error}=await admin.from(table).select('id',{count:'exact',head:true}).gte('created_at',since+'T00:00:00Z').lte('created_at',until+'T23:59:59Z');
    if(error) throw new ApiError(500,'Unable to generate report totals.');
    summary[table]=count||0;
  }
  const status:Record<string,number>={};
  const monthly:Record<string,{applications:number;hires:number}>={};
  for(let offset=0;offset<100000;offset+=1000) {
    const {data,error}=await admin.from('applications').select('status,created_at').gte('created_at',since+'T00:00:00Z').lte('created_at',until+'T23:59:59Z').order('created_at',{ascending:true}).range(offset,offset+999);
    if(error) throw new ApiError(500,'Unable to read application history.');
    for(const a of data||[]){
      status[a.status]=(status[a.status]||0)+1;
      const month=a.created_at.slice(0,7);
      monthly[month] ||= {applications:0,hires:0};
      monthly[month].applications++;
      if(a.status==='hired'||a.status==='employment_ended') monthly[month].hires++;
    }
    if((data||[]).length<1000) break;
  }
  return {summary,status,monthly:Object.entries(monthly).sort(([a],[b])=>a.localeCompare(b)).map(([month,counts])=>({month,...counts})),since,until,generatedAt:new Date().toISOString()};
}

export function csvReport(report:Awaited<ReturnType<typeof reportData>>) {
  const lines=['JobLinkLocal report','Generated,'+report.generatedAt,'From,'+report.since,'To,'+report.until,'','Metric,Count'];
  for(const [key,value] of Object.entries(report.summary)) lines.push(`${key},${value}`);
  lines.push('','Application status,Count');
  for(const [key,value] of Object.entries(report.status)) lines.push(`${key},${value}`);
  lines.push('','Month,Applications,Hires');
  for(const m of report.monthly) lines.push(`${m.month},${m.applications},${m.hires}`);
  return lines.join('\r\n');
}

export async function pdfReport(report:Awaited<ReturnType<typeof reportData>>) {
  const doc=await PDFDocument.create();
  const page=doc.addPage([595,842]);
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  let y=782;
  const draw=(s:string,size=11,isBold=false)=>{
    page.drawText(s.replace(/[^\x20-\x7E]/g,'?').slice(0,95),{x:56,y,size,font:isBold?bold:font,color:rgb(0.11,0.17,0.19)});
    y-=size+12;
  };
  draw('JOBLINKLOCAL 4.0',22,true);
  draw('Employment and platform activity report',14);
  y-=12;
  draw(`Period: ${report.since} to ${report.until}`);
  draw(`Created: ${report.generatedAt.slice(0,19).replace('T',' ')} UTC`);
  y-=14;
  draw('Platform overview',15,true);
  for(const [key,value] of Object.entries(report.summary)) draw(`${key.replace(/_/g,' ')}: ${value}`);
  y-=12;
  draw('Applications by status',15,true);
  for(const [key,value] of Object.entries(report.status)) if(y>110) draw(`${key}: ${value}`);
  y-=10;
  if(y>110) draw('Monthly trend',15,true);
  for(const m of report.monthly.slice(-12)) if(y>60) draw(`${m.month}   Applications: ${m.applications}    Hires: ${m.hires}`);
  return new Uint8Array(await doc.save());
}
