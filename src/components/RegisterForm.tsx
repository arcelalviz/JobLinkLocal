'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Building2, UserRound, ShieldCheck, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';
import { useToast } from '@/components/ToastProvider';
import { request } from '@/lib/http';

type Role='jobseeker'|'employer';
const initial={full_name:'',email:'',password:'',phone:'',city:'',province:'',education:'',experience_years:'0',skills:'',desired_role:'',preferred_work_setup:'On-site',business_name:'',industry:'',business_type:'',registration_number:'',team_size:'',website:'',business_description:'',contact_position:''};

export function RegisterForm({initialRole='jobseeker'}:{initialRole?:Role}){
 const [role,setRole]=useState<Role>(initialRole);
 const [step,setStep]=useState(1);
 const [form,setForm]=useState(initial);
 const [busy,setBusy]=useState(false);
 const [finished,setFinished]=useState(false);
 const toast=useToast();
 const update=(name:keyof typeof initial,value:string)=>setForm(f=>({...f,[name]:value}));
 const next=(event:React.FormEvent)=>{
   event.preventDefault();
   if(!form.full_name.trim()||!form.email.includes('@')||!form.phone.trim()||!form.city.trim()||!form.province.trim()){toast.show('Complete the essential information first.','warning');return;}
   if(form.password.length<12||!/[A-Z]/.test(form.password)||!/[a-z]/.test(form.password)||!/[0-9]/.test(form.password)) {toast.show('Use a stronger password.','warning','At least 12 characters with uppercase, lowercase and a number.');return;}
   setStep(2);
 };
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(role==='employer'&&!form.business_name.trim()){toast.show('Enter your business name.','warning');return;}
  setBusy(true);
  try{
    await request('auth/signup','POST',{...form,role,experience_years:Number(form.experience_years)});
    setFinished(true);toast.show('Your account was created.','success','Check your email to verify your address.');
  }catch(error){toast.show(error instanceof Error?error.message:'Registration failed.','error');}
  finally{setBusy(false);}
 };
 const field=(label:string,key:keyof typeof initial,placeholder:string,required=false,type='text')=><label className="form-field" key={key}><span>{label}</span><input type={type} value={form[key]} placeholder={placeholder} required={required} onChange={e=>update(key,e.target.value)}/></label>;
 return <AuthLayout eyebrow="JOIN THE NETWORK / 02" title={finished?'You’re almost in.':'Make your next move.'} subtitle={finished?'One email confirmation stands between you and your new workspace.':'Tell us about yourself. Real connections start with a real introduction.'}>
  {finished?<div className="signup-success"><div className="success-orb"><ShieldCheck size={44}/></div><h3>Check your inbox.</h3><p>We sent a verification link to <strong>{form.email}</strong>. Confirm your email, then upload credentials for LGU review.</p><Link className="btn btn-ink btn-form" href="/login">Continue to sign in <ArrowRight size={19}/></Link></div>:<>
   <div className="auth-role-switch"><button className={role==='jobseeker'?'active':''} onClick={()=>{setRole('jobseeker');setStep(1);}}><UserRound size={17}/> I'm seeking work</button><button className={role==='employer'?'active':''} onClick={()=>{setRole('employer');setStep(1);}}><Building2 size={17}/> I'm hiring</button></div>
   <div className="stepper"><span className={step===1?'is-active':''}>01. Essentials</span><div className="stepper-track"><div style={{width:step===1?'50%':'100%'}}/></div><span className={step===2?'is-active':''}>02. Your story</span></div>
   {step===1?<form noValidate className="form-stack" onSubmit={next}>
      <div className="form-two">{field('Full name','full_name','How should we address you?',true)}{field('Phone number','phone','09xx xxx xxxx',true,'tel')}</div>
      {field('Email address','email','your@email.com',true,'email')}
      {field('Password','password','Create a secure password',true,'password')}
      <div className="form-note">At least 12 characters, with uppercase and lowercase letters and a number.</div>
      <div className="form-two">{field('City or municipality','city','Olongapo City',true)}{field('Province','province','Zambales',true)}</div>
      <button className="btn btn-ink btn-form" type="submit">Continue <ArrowRight size={18}/></button>
   </form>:<form noValidate className="form-stack" onSubmit={submit}>
      {role==='jobseeker'?<>
       {field('Highest educational attainment','education','College undergraduate')}
       <div className="form-two">{field('Desired position','desired_role','Frontend Developer')}{field('Years of experience','experience_years','0',false,'number')}</div>
       {field('Skills','skills','Communication, Excel, React')}
       <label className="form-field"><span>Preferred work setup</span><select value={form.preferred_work_setup} onChange={e=>update('preferred_work_setup',e.target.value)}><option>On-site</option><option>Remote</option><option>Hybrid</option></select></label>
      </>:<>
       {field('Business or organization name','business_name','Registered business name',true)}
       <div className="form-two">{field('Industry','industry','Technology')}{field('Business type','business_type','Corporation')}</div>
       {field('Business registration number','registration_number','DTI / SEC registration')}
       <div className="form-two">{field('Your role in the business','contact_position','Hiring manager')}{field('Team size','team_size','1–10 employees')}</div>
       {field('Company website','website','https://example.com')}
       <label className="form-field"><span>Tell us about your company</span><textarea rows={3} value={form.business_description} onChange={e=>update('business_description',e.target.value)} placeholder="What makes your team special?"/></label>
      </>}
      <div className="form-note privacy-note"><ShieldCheck size={18}/> After confirming your email, you’ll upload the documents required for LGU verification. Hiring and applying stay locked until approval.</div>
      <div className="form-two register-actions"><button type="button" onClick={()=>setStep(1)} className="btn btn-quiet"><ArrowLeft size={17}/> Back</button><button type="submit" disabled={busy} className="btn btn-ink">{busy?'Creating…':'Create account'} <ArrowRight size={17}/></button></div>
   </form>}
   <div className="auth-alt">Already part of the network? <Link href="/login">Sign in <ArrowRight size={16}/></Link></div>
  </>}
 </AuthLayout>;
}
