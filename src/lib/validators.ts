import { z } from 'zod';
import { OLONGAPO_BARANGAYS } from '@/lib/olongapo';

const short = z.string().trim().min(2).max(160);
const optional = (max=1000) => z.string().trim().max(max).optional().nullable();

export const signUpSchema = z.object({
  role:z.enum(['jobseeker','employer']),
  full_name:short,
  email:z.email().max(254),
  password:z.string().min(8).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  phone:z.string().trim().min(7).max(30),
  city:z.literal('Olongapo City'),
  province:z.literal('Zambales'),
  barangay:z.enum(OLONGAPO_BARANGAYS),
  address_line:z.string().trim().min(3).max(180),
  education:optional(100),
  experience_years:z.coerce.number().int().min(0).max(65).optional(),
  skills:optional(500),
  desired_role:optional(120),
  preferred_work_setup:optional(40),
  business_name:optional(160),
  industry:optional(120),
  business_type:optional(90),
  registration_number:optional(100),
  team_size:optional(40),
  website:optional(255),
  business_description:optional(1200),
  contact_position:optional(100)
}).superRefine((v,ctx)=>{
  if(v.role==='employer' && (!v.business_name || v.business_name.length<2)) ctx.addIssue({code:'custom',message:'Enter your business name.',path:['business_name']});
});

export const jobSchema = z.object({
 title:short,
 category:short,
 description:z.string().trim().min(16).max(12000),
 requirements:z.string().trim().min(12).max(6000),
 benefits:optional(4000),
 location:short,
 barangay:z.enum(OLONGAPO_BARANGAYS),
 address_line:z.string().trim().min(3).max(180),
 salary_visible:z.boolean().default(true),
 work_setup:z.enum(['On-site','Remote','Hybrid']),
 employment_type:z.enum(['Full-time','Part-time','Contract','Internship','Temporary']),
 experience_level:z.enum(['Entry level','Mid level','Senior level','Any level']),
 salary_min:z.union([z.coerce.number().int().min(0).max(10000000),z.null()]).optional(),
 salary_max:z.union([z.coerce.number().int().min(0).max(10000000),z.null()]).optional(),
 vacancies:z.coerce.number().int().min(1).max(10000),
 schedule:optional(200),
 deadline:optional(20),
 screening_questions:optional(1200)
}).refine(v=>v.salary_min==null || v.salary_max==null || v.salary_max>=v.salary_min,{message:'Maximum salary cannot be below minimum salary.',path:['salary_max']});

export const applicationSchema = z.object({
  job_id:z.uuid(),
  cover_letter:optional(4000),
  screening_response:optional(2000)
});

export const decisionSchema = z.object({
  id:z.uuid(), decision:z.string().min(2).max(40), note:optional(1800), start_date:optional(20)
});

export function validated<T>(schema:z.ZodType<T>,data:unknown):T {
 const result=schema.safeParse(data);
 if(!result.success) throw new Error(result.error.issues[0]?.message || 'Please check your information.');
 return result.data;
}
