'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Mail, UserRound, Building2 } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';
import { useToast } from '@/components/ToastProvider';
import { request } from '@/lib/http';

export function LoginForm({invalidConfirmation=false}:{invalidConfirmation?:boolean}) {
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [role,setRole]=useState<'jobseeker'|'employer'>('jobseeker');
 const router=useRouter();
 const toast=useToast();
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!email.trim()||!password){toast.show('Enter your email and password.','warning');return;}
  setBusy(true);
  try{
    await request('auth/login','POST',{email,password});
    toast.show('Welcome back.','success','Your workspace is ready.');
    router.replace('/app');router.refresh();
  }catch(err){toast.show(err instanceof Error?err.message:'Sign in failed.','error');}
  finally{setBusy(false);}
 };
 return <AuthLayout eyebrow="WELCOME BACK / 01" title="Good to see you again." subtitle="Your next opportunity is right where you left it.">
  <div className="auth-role-switch"><button className={role==='jobseeker'?'active':''} onClick={()=>setRole('jobseeker')}><UserRound size={18}/> Jobseeker</button><button className={role==='employer'?'active':''} onClick={()=>setRole('employer')}><Building2 size={18}/> Employer</button></div>
  <p className="auth-role-help">{role==='jobseeker'?'Discover opportunities and follow your applications.':'Manage your company, jobs and candidates.'} LGU and System Admins sign in here too.</p>
  {invalidConfirmation&&<div className="form-notice">The confirmation link could not be verified. Request a new email below.</div>}
  <form noValidate onSubmit={submit} className="form-stack">
   <label className="form-field"><span>Email address</span><input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label className="form-field"><span>Password</span><div className="input-wrap"><input type={visible?'text':'password'} minLength={8} autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="eye-button" onClick={()=>setVisible(!visible)} aria-label={visible?'Hide password':'Show password'}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
   <div className="form-between"><span>Protected with secure login</span><Link href="/forgot">Forgot password?</Link></div>
   <button disabled={busy} className="btn btn-ink btn-form" type="submit">{busy?'Signing you in…':'Sign in'} <ArrowRight size={19}/></button>
  </form>
  <div className="auth-alt">New around here? <Link href="/register">Create your account <ArrowRight size={16}/></Link></div>
  <div className="auth-resend"><Mail size={16}/> Didn't receive your confirmation? <button onClick={async()=>{if(!email){toast.show('Enter your email first.','warning');return;}try{await request('auth/resend','POST',{email});toast.show('Confirmation email requested.','success');}catch(err){toast.show(err instanceof Error?err.message:'Unable to resend.','error');}}}>Resend email</button></div>
 </AuthLayout>;
}
