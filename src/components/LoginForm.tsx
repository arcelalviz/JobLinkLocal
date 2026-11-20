'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Mail, UserRound, Building2, ShieldCheck, Check } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';
import { useToast } from '@/components/ToastProvider';
import { request } from '@/lib/http';

type Portal='jobseeker'|'employer'|'admin';
const portals:{id:Portal;label:string;description:string;icon:typeof UserRound}[]=[
 {id:'jobseeker',label:'Jobseeker',description:'Find work and track applications',icon:UserRound},
 {id:'employer',label:'Employer',description:'Post roles and manage hiring',icon:Building2},
 {id:'admin',label:'Administration',description:'LGU and system administration',icon:ShieldCheck}
];

export function LoginForm({invalidConfirmation=false,initialPortal='jobseeker'}:{invalidConfirmation?:boolean;initialPortal?:Portal}){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [resending,setResending]=useState(false);
 const [verificationNeeded,setVerificationNeeded]=useState(invalidConfirmation);
 const [portal,setPortal]=useState<Portal>(initialPortal);
 const router=useRouter();
 const toast=useToast();
 const resendVerification=async()=>{
  if(!email.trim()){toast.show('Enter your account email address first.','warning');return;}
  if(resending)return;
  setResending(true);
  try{
   await request('auth/resend','POST',{email:email.trim()});
   toast.show('Verification email requested.','success','If your account needs confirmation, check your inbox and spam folder.');
   setVerificationNeeded(false);
  }catch(error){toast.show(error instanceof Error?error.message:'Unable to request a verification email.','error');}
  finally{setResending(false);}
 };
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!email.trim()||!password){toast.show('Enter your email and password.','warning');return;}
  setBusy(true);
  try{
   await request('auth/login','POST',{email,password,portal});
   toast.show('You are signed in.','success',portal==='admin'?'Opening your administration workspace.':'Your workspace is ready.');
   router.replace('/app');
   router.refresh();
  }catch(error){
   const message=error instanceof Error?error.message:'Sign in failed.';
   if(/email confirmation required/i.test(message)) setVerificationNeeded(true);
   toast.show(message,'error');
  }
  finally{setBusy(false);}
 };
 return <AuthLayout eyebrow="SIGN IN / YOUR WORKSPACE" title="Welcome back." subtitle="Choose where you work, then securely access your account.">
  <div className="portal-select" role="group" aria-label="Choose your sign-in area">
   {portals.map(item=>{
    const Icon=item.icon;
    return <button key={item.id} type="button" aria-pressed={portal===item.id} className={`portal-option ${portal===item.id?'is-selected':''}`} onClick={()=>setPortal(item.id)}>
     <span className="portal-symbol"><Icon size={20} strokeWidth={1.7}/></span>
     <span className="portal-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
     <span className="portal-check" aria-hidden="true">{portal===item.id&&<Check size={15}/>}</span>
    </button>;
   })}
  </div>
  <p className="auth-role-help">Your selection is verified against your account. {portal==='admin'?'Your administrator account and access permissions are checked securely.':'Your registered role must match this sign-in area.'}</p>
  {verificationNeeded&&portal!=='admin'&&<div className="verification-help" role="status">
   <div className="verification-help-heading"><Mail size={18}/><strong>Email verification required</strong></div>
   <p>{invalidConfirmation?'Your confirmation link could not be verified. You can request a fresh link below.':'Confirm your email address before signing in. Check your inbox for the verification link.'}</p>
   <button type="button" className="verification-help-action" disabled={resending} onClick={resendVerification}>{resending?'Requesting…':'Resend verification email'} <ArrowRight size={16}/></button>
  </div>}
  <form noValidate onSubmit={submit} className="form-stack">
   <label className="form-field"><span>Email address</span><input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={event=>setEmail(event.target.value)}/></label>
   <label className="form-field"><span>Password</span><div className="input-wrap"><input type={visible?'text':'password'} minLength={8} autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={event=>setPassword(event.target.value)}/><button type="button" className="eye-button" onClick={()=>setVisible(!visible)} aria-label={visible?'Hide password':'Show password'}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
   <div className="form-between form-between-end"><Link href="/forgot">Forgot password?</Link></div>
   <button disabled={busy} className="btn btn-ink btn-form" type="submit">{busy?'Signing in…':`Continue as ${portal==='admin'?'administrator':portal}`} <ArrowRight size={19}/></button>
  </form>
  {portal==='admin'?<div className="auth-alt">Need an administrator account? Contact the existing System Admin.</div>:<div className="auth-alt">New to JobLinkLocal? <Link href={`/register?role=${portal}`}>Create a {portal==='employer'?'business':'jobseeker'} account <ArrowRight size={16}/></Link></div>}
 </AuthLayout>;
}
