/** Transparent, non-predictive skill overlap. Never used to accept, reject, or rank candidates. */
const CANONICAL_SKILLS = [
 'Administrative Support','Bookkeeping','Communication','Computer Literacy','Customer Service',
 'Data Entry','Data Analysis','Digital Marketing','Driving','Electrical Maintenance',
 'Excel','Graphic Design','Inventory Management','Leadership','Microsoft Office',
 'Organization','Problem Solving','Programming','Project Management','Sales','Teamwork',
 'Technical Support','Time Management','Writing',
];
const ALIASES: Record<string,string[]> = {
 'Excel':['ms excel','spreadsheets'],'Programming':['software development','coding','javascript','python','java'],
 'Data Analysis':['data analytics','data analyst'],'Microsoft Office':['ms office','word processor'],
 'Graphic Design':['graphic designer','photoshop','illustrator'],'Customer Service':['customer support','customer relations'],
 'Technical Support':['it support','help desk','helpdesk'],'Driving':['driver','delivery rider'],
 'Bookkeeping':['accounting','bookkeeper'],'Communication':['verbal communication','written communication'],
 'Sales':['sales representative','retail sales'], 'Administrative Support':['administrative assistant','office admin'],
 'Digital Marketing':['social media marketing','seo'],
};
const cleaned=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const includesPhrase=(source:string,phrase:string)=>Boolean(phrase)&&(` ${source} `).includes(` ${cleaned(phrase)} `);
export function normalizeSkills(value:unknown):string[] {
 if(Array.isArray(value))return value.filter((item):item is string=>typeof item==='string').map(item=>item.trim()).filter(Boolean).slice(0,25);
 if(typeof value==='string')return value.split(',').map(item=>item.trim()).filter(Boolean).slice(0,25);
 return [];
}
export function matchJobSkills(skills:string[],requirements:string,title='') {
 const text=cleaned(`${requirements} ${title}`);
 const required=CANONICAL_SKILLS.filter(skill=>[skill,...(ALIASES[skill]||[])].some(term=>includesPhrase(text,term)));
 const skillTexts=skills.map(cleaned);
 const matched=required.filter(skill=>[skill,...(ALIASES[skill]||[])].some(term=>skillTexts.some(entry=>entry===cleaned(term)||includesPhrase(entry,term))));
 return {required,matched,missing:required.filter(skill=>!matched.includes(skill)),basis:'Exact skill and synonym phrases mentioned in the listing. Not an eligibility score.'};
}
