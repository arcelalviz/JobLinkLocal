'use client';
import { X } from 'lucide-react';

export const EDUCATION_OPTIONS = [
 'Elementary Graduate','Junior High School Graduate','Senior High School Graduate',
 'Technical-Vocational Graduate','College Undergraduate',"Bachelor's Degree",'Postgraduate Diploma',"Master's Degree",'Doctoral Degree','Other'
];
export const POSITION_OPTIONS = [
 'Administrative Assistant','Accountant / Bookkeeper','Business Development Associate','Call Center Agent',
 'Cashier','Construction Worker','Customer Service Representative','Data Analyst','Delivery Rider / Driver',
 'Electrician / Technician','Food Service Crew','Graphic Designer','Healthcare Assistant','Hotel / Hospitality Staff',
 'IT Support Specialist','Office Clerk','Retail Sales Associate','Sales Representative','Security Personnel',
 'Software Developer','Teacher / Tutor','Warehouse Staff','Other'
];
export const SKILL_OPTIONS = [
 'Administrative Support','Bookkeeping','Communication','Computer Literacy','Customer Service',
 'Data Entry','Data Analysis','Digital Marketing','Driving','Electrical Maintenance',
 'Excel','Graphic Design','Inventory Management','Leadership','Microsoft Office',
 'Organization','Problem Solving','Programming','Project Management','Sales','Teamwork',
 'Technical Support','Time Management','Writing','Other'
];

export function CareerSelect({ label, value, options, onChange, placeholder }: {
 label:string; value:string; options:string[]; onChange:(value:string)=>void;placeholder?:string;
}) {
 const known=options.includes(value);
 return <label className="form-field"><span>{label}</span>
   <select value={known?value:value?'Other':''} onChange={event=>onChange(event.target.value==='Other'?'Other':event.target.value)}>
     <option value="">{placeholder||`Select ${label.toLowerCase()}`}</option>
     {options.map(item=><option key={item} value={item}>{item}</option>)}
   </select>
   {(!known&&!!value || value==='Other')&&<input aria-label={`Specify ${label.toLowerCase()}`} value={value==='Other'?'':value} onChange={event=>onChange(event.target.value||'Other')} placeholder={`Specify ${label.toLowerCase()}`}/>}
 </label>;
}

export function SkillsPicker({ value, onChange }: {value:string[];onChange:(value:string[])=>void}) {
 const clean=value.filter(Boolean);
 const add=(entry:string)=>{
   const skill=entry.trim();
   if(skill&&skill!=='Other'&&!clean.some(item=>item.toLowerCase()===skill.toLowerCase())&&clean.length<20)onChange([...clean,skill]);
 };
 return <div className="form-field"><span>Skills</span><select aria-label="Add a skill" value="" onChange={event=>add(event.target.value)}>
   <option value="">Choose a skill to add</option>
   {SKILL_OPTIONS.filter(v=>v!=='Other'&&!clean.includes(v)).map(skill=><option key={skill}>{skill}</option>)}
 </select>
 <div className="skill-chip-list">{clean.map(skill=><span className="skill-chip" key={skill}>{skill}<button type="button" aria-label={`Remove ${skill}`} onClick={()=>onChange(clean.filter(s=>s!==skill))}><X size={13}/></button></span>)}</div>
 <input aria-label="Add another skill" placeholder="Other skill: type and press Enter" maxLength={40} onKeyDown={event=>{
  if(event.key==='Enter'){event.preventDefault();add(event.currentTarget.value);event.currentTarget.value='';}
 }}/>
 <small className="form-hint">Select multiple skills. You can also type a skill and press Enter.</small>
 </div>;
}
