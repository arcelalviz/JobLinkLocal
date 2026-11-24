'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Building2, UserRound, ShieldCheck, ArrowLeft, Eye, EyeOff, Check, Circle } from 'lucide-react';
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
 const passwordRules=[{label:'At least 8 characters',met:form.password.length>=8},{label:'Uppercase and lowercase letters',met:/[A-Z]/.test(form.password)&&/[a-z]/.test(form.password)},{label:'At least one number',met:/[0-9]/.test(form.password)}];
 const update=(name:keyof typeof initial,value:string)=>setForm(old=>({...old,[name]:value}));
 const next=(event:React.FormEvent)=>{
   event.preventDefault();
   if(!form.full_name.trim()||!form.email.includes('@')||!form.phone.trim()||!form.barangay||form.address_line.trim().length<3){toast.show('Complete your contact and Olongapo address details.','warning');return;}
   if(passwordRules.some(rule=>!rule.met)||form.password.length>128){toast.show('Use a stronger password.','warning','Use 8–128 characters with uppercase, lowercase and a number.');return;}
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
 return <AuthLayout variant="register" eyebrow="CREATE ACCOUNT" title={finished?'Confirm your email':role==='employer'?'Employer registration':'Jobseeker registration'} subtitle={finished?'Please complete email confirmation before verification.':role==='employer'?'Enter your business and contact information.':'Enter your personal and career information.'}>
  {finished?<div className="signup-success"><div className="success-orb"><ShieldCheck size={40}/></div><h3>Email confirmation required</h3><p>We requested a verification link for <strong>{form.email}</strong>. After confirming your email, sign in and open <strong>LGU Verification</strong> to {role==='employer'?'upload your business permit and supporting documents':'choose document types and upload identification documents'}. Restricted features remain unavailable until LGU approval.</p><Link className="btn btn-ink btn-form" href="/login">Continue to sign in <ArrowRight size={19}/></Link></div>:<>
   <div className="register-role-label">Account type</div><div className="auth-role-switch" role="group" aria-label="Account type"><button type="button" aria-pressed={role==='jobseeker'} className={role==='jobseeker'?'active':''} onClick={()=>{setRole('jobseeker');setStep(1);}}><UserRound size={20}/><span><strong>Jobseeker</strong><small>Find and apply for jobs</small></span></button><button type="button" aria-pressed={role==='employer'} className={role==='employer'?'active':''} onClick={()=>{setRole('employer');setStep(1);}}><Building2 size={20}/><span><strong>Employer</strong><small>Post jobs and hire locally</small></span></button></div>
   <ol className="register-steps" aria-label="Registration progress">
    <li className={step===1?'current':'complete'} aria-current={step===1?'step':undefined}><span>{step===2?<Check size={15}/>:1}</span> Account details</li>
    <li className={step===2?'current':''} aria-current={step===2?'step':undefined}><span>2</span> {role==='employer'?'Business':'Career'} information</li>
   </ol>
   {step===1?<form noValidate className="form-stack register-form" onSubmit={next}>
      <h2 className="register-section-title">Contact information</h2>
      <div className="form-two">{field('Full name','full_name','Your complete name',true)}{field('Phone number','phone','09xx xxx xxxx',true,'tel')}</div>
      {field('Email address','email','your@email.com',true,'email')}
      <h2 className="register-section-title">Account security</h2>
      <div className="form-two">
       <label className="form-field"><span>Password</span><div className="input-wrap"><input type={showPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={128} required aria-describedby="register-password-rules" value={form.password} onChange={e=>update('password',e.target.value)} placeholder="Minimum 8 characters"/><button type="button" className="eye-button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
       <label className="form-field"><span>Confirm password</span><div className="input-wrap"><input type={showConfirm?'text':'password'} autoComplete="new-password" minLength={8} maxLength={128} required aria-describedby="register-password-match" value={form.confirm_password} onChange={e=>update('confirm_password',e.target.value)} placeholder="Re-enter password"/><button type="button" className="eye-button" onClick={()=>setShowConfirm(v=>!v)} aria-label={showConfirm?'Hide confirmation password':'Show confirmation password'}>{showConfirm?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
      </div>
      <div className="register-password-info" id="register-password-rules"><p>Password requirements</p><ul>{passwordRules.map(rule=><li key={rule.label} className={rule.met?'met':''}>{rule.met?<Check size={15} aria-hidden="true"/>:<Circle size={13} aria-hidden="true"/>}<span>{rule.label}</span><span className="register-sr">{rule.met?' — met':' — not met'}</span></li>)}</ul><p id="register-password-match" className={form.confirm_password&&form.password===form.confirm_password?'met':''} aria-live="polite">{form.confirm_password?(form.password===form.confirm_password?'Passwords match.':'Passwords do not match.'):'Re-enter your password to confirm.'}</p></div>
      <h2 className="register-section-title">Local address</h2>
      <AddressFields barangay={form.barangay} addressLine={form.address_line} onBarangayChange={value=>update('barangay',value)} onAddressLineChange={value=>update('address_line',value)}/>
      <button className="btn btn-ink btn-form" type="submit">Continue <ArrowRight size={18}/></button>
   </form>:<form noValidate className="form-stack register-form" onSubmit={submit}>
      <h2 className="register-section-title">{role==='jobseeker'?'Career profile':'Business profile'}</h2>
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
      <div className="form-two register-actions"><button type="button" disabled={busy} onClick={()=>setStep(1)} className="btn btn-quiet"><ArrowLeft size={17}/> Back</button><button type="submit" disabled={busy} className="btn btn-ink">{busy?'Creating…':'Create account'} <ArrowRight size={17}/></button></div>
   </form>}
   <div className="auth-alt">Already have an account? <Link href={`/login?portal=${role}`}>Sign in <ArrowRight size={16}/></Link></div>
  </>}
 </AuthLayout>;
}
