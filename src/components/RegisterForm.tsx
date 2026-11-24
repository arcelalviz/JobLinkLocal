'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Building2, UserRound, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';
import { AddressFields } from '@/components/AddressFields';
import { CareerSelect, SkillsPicker, EDUCATION_OPTIONS, POSITION_OPTIONS } from '@/components/CareerFields';
import { useToast } from '@/components/ToastProvider';
import { request } from '@/lib/http';

type Role='jobseeker'|'employer';
const initial={full_name:'',email:'',password:'',confirm_password:'',phone:'',city:'Olongapo City',province:'Zambales',barangay:'',address_line:'',education:'',experience_years:'0',skills:'',desired_role:'',preferred_work_setup:'On-site',business_name:'',industry:'',business_type:'',registration_number:'',team_size:'',website:'',business_description:'',contact_position:''};

export function RegisterForm({initialRole='jobseeker'}:{initialRole?:Role}){
 const [role,setRole]=useState<Role>(initialRole);
 const [step,setStep]=useState(1);
 const [form,setForm]=useState(initial);
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [finished,setFinished]=useState(false);
 const toast=useToast();
 const update=(name:keyof typeof initial,value:string)=>setForm(old=>({...old,[name]:value}));
 const next=(event:React.FormEvent)=>{
   event.preventDefault();
   if(!form.full_name.trim()||!form.email.includes('@')||!form.phone.trim()||!form.barangay||form.address_line.trim().length<3){toast.show('Complete your contact and Olongapo address details.','warning');return;}
   if(form.password.length<12||!/[A-Z]/.test(form.password)||!/[a-z]/.test(form.password)||!/[0-9]/.test(form.password)){toast.show('Use a stronger password.','warning','At least 12 characters with uppercase, lowercase and a number.');return;}
   if(form.password!==form.confirm_password){toast.show('Passwords do not match.','warning','Please recheck your confirmation password.');return;}
   setStep(2);
 };
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(role==='employer'&&!form.business_name.trim()){toast.show('Enter your registered business name.','warning');return;}
  setBusy(true);
  try{
    const {confirm_password,...payload}=form;
    await request('auth/signup','POST',{...payload,role,experience_years:Number(form.experience_years)});
    setFinished(true);
    toast.show('Account registration submitted.','success','Check your email to confirm the account.');
  }catch(error){toast.show(error instanceof Error?error.message:'Registration failed.','error');}
  finally{setBusy(false);}
 };
 const field=(label:string,key:keyof typeof initial,placeholder:string,required=false,type='text')=><label className="form-field" key={key}><span>{label}</span><input type={type} value={form[key]} placeholder={placeholder} required={required} onChange={e=>update(key,e.target.value)}/></label>;
 return <AuthLayout eyebrow="JOIN JOBLINKLOCAL / 02" title={finished?'Check your inbox.':role==='employer'?'Build your hiring profile.':'Start your career profile.'} subtitle={finished?'Please complete email confirmation before verification.':role==='employer'?'Register your local organization and connect with jobseekers.':'Tell Olongapo employers where you are and what you do.'}>
  {finished?<div className="signup-success"><div className="success-orb"><ShieldCheck size={40}/></div><h3>Email confirmation required</h3><p>We requested a verification link for <strong>{form.email}</strong>. After confirming your email, sign in and open <strong>LGU Verification</strong> to {role==='employer'?'upload your business permit and supporting documents':'choose document types and upload identification documents'}. Restricted features remain unavailable until LGU approval.</p><Link className="btn btn-ink btn-form" href="/login">Continue to sign in <ArrowRight size={19}/></Link></div>:<>
   <div className="auth-role-switch"><button type="button" className={role==='jobseeker'?'active':''} onClick={()=>{setRole('jobseeker');setStep(1);}}><UserRound size={17}/> I'm looking for work</button><button type="button" className={role==='employer'?'active':''} onClick={()=>{setRole('employer');setStep(1);}}><Building2 size={17}/> I'm hiring</button></div>
   <div className="stepper"><span className={step===1?'is-active':''}>01. Account details</span><div className="stepper-track"><div style={{width:step===1?'50%':'100%'}}/></div><span className={step===2?'is-active':''}>02. {role==='employer'?'Business':'Career'} information</span></div>
   {step===1?<form noValidate className="form-stack" onSubmit={next}>
      <div className="form-two">{field('Full name','full_name','Your complete name',true)}{field('Phone number','phone','09xx xxx xxxx',true,'tel')}</div>
      {field('Email address','email','your@email.com',true,'email')}
      <div className="form-two">
       <label className="form-field"><span>Password</span><div className="input-wrap"><input type={showPassword?'text':'password'} autoComplete="new-password" value={form.password} onChange={e=>update('password',e.target.value)} placeholder="Create a secure password"/><button type="button" className="eye-button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide passwords':'Show passwords'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
       <label className="form-field"><span>Confirm password</span><div className="input-wrap"><input type={showConfirm?'text':'password'} autoComplete="new-password" value={form.confirm_password} onChange={e=>update('confirm_password',e.target.value)} placeholder="Re-enter password"/><button type="button" className="eye-button" onClick={()=>setShowConfirm(v=>!v)} aria-label={showConfirm?'Hide confirmation password':'Show confirmation password'}>{showConfirm?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
      </div>
      <p className="form-note">Use at least 12 characters with upper- and lowercase letters and a number.</p>
      <AddressFields barangay={form.barangay} addressLine={form.address_line} onBarangayChange={value=>update('barangay',value)} onAddressLineChange={value=>update('address_line',value)}/>
      <button className="btn btn-ink btn-form" type="submit">Continue <ArrowRight size={18}/></button>
   </form>:<form noValidate className="form-stack" onSubmit={submit}>
      {role==='jobseeker'?<>
       <CareerSelect label="Highest educational attainment" value={form.education} options={EDUCATION_OPTIONS} onChange={value=>update('education',value)}/>
       <div className="form-two"><CareerSelect label="Desired position" value={form.desired_role} options={POSITION_OPTIONS} onChange={value=>update('desired_role',value)}/>{field('Years of experience','experience_years','0',false,'number')}</div>
       <SkillsPicker value={form.skills.split(',').map(x=>x.trim()).filter(Boolean)} onChange={values=>update('skills',values.join(', '))}/>
       <label className="form-field"><span>Preferred work setup</span><select value={form.preferred_work_setup} onChange={e=>update('preferred_work_setup',e.target.value)}><option>On-site</option><option>Remote</option><option>Hybrid</option></select></label>
      </>:<>
       {field('Registered business or organization name','business_name','Business name',true)}
       <div className="form-two">{field('Industry','industry','Retail')}{field('Business type','business_type','Sole Proprietorship')}</div>
       {field('Business registration number','registration_number','DTI / SEC registration')}
       <div className="form-two">{field('Position in business','contact_position','Hiring manager')}{field('Company size','team_size','1–10 employees')}</div>
       {field('Company website','website','https://example.com')}
       <label className="form-field"><span>Business description</span><textarea rows={3} value={form.business_description} onChange={e=>update('business_description',e.target.value)} placeholder="Describe your local business and hiring needs."/></label>
      </>}
      <div className="form-note privacy-note"><ShieldCheck size={18}/>{role==='employer'?'After email confirmation, go to LGU Verification to upload your business permit.':'After email confirmation, go to LGU Verification to select the type of each document and upload it.'} Job applications and job postings remain restricted until LGU approval.</div>
      <div className="form-two register-actions"><button type="button" onClick={()=>setStep(1)} className="btn btn-quiet"><ArrowLeft size={17}/> Back</button><button type="submit" disabled={busy} className="btn btn-ink">{busy?'Creating…':'Create account'} <ArrowRight size={17}/></button></div>
   </form>}
   <div className="auth-alt">Already have an account? <Link href={`/login?portal=${role}`}>Sign in <ArrowRight size={16}/></Link></div>
  </>}
 </AuthLayout>;
}
