'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';
import { useToast } from '@/components/ToastProvider';
import { request } from '@/lib/http';

export function RecoveryForm({update=false}:{update?:boolean}){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [success,setSuccess]=useState(false);
 const toast=useToast();
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(update?password.length<12:!email.includes('@')){toast.show(update?'Choose a password of at least 12 characters.':'Enter a valid email address.','warning');return;}
  setBusy(true);
  try{
    await request(update?'auth/password':'auth/reset','POST',update?{password}:{email});
    setSuccess(true);toast.show(update?'Password updated.':'Recovery email requested.','success');
  }catch(error){toast.show(error instanceof Error?error.message:'Unable to continue.','error');}
  finally{setBusy(false);}
 };
 return <AuthLayout eyebrow="ACCOUNT RECOVERY" title={update?'A fresh start.':'Let’s get you back.'} subtitle={update?'Set a new, secure password for your account.':'We’ll help you find your way back in.'}>
  {success?<div className="signup-success"><h3>{update?'Password updated':'Check your email'}</h3><p>{update?'Your account is ready for a secure sign in.':'If the account exists, you’ll receive a password reset link shortly.'}</p><Link href="/login" className="btn btn-ink btn-form">Return to sign in <ArrowRight size={18}/></Link></div>:<form noValidate className="form-stack" onSubmit={submit}>
   <label className="form-field"><span>{update?'New password':'Your email address'}</span><input type={update?'password':'email'} required minLength={update?12:undefined} value={update?password:email} onChange={e=>update?setPassword(e.target.value):setEmail(e.target.value)} placeholder={update?'Choose a strong password':'name@example.com'} autoComplete={update?'new-password':'email'}/></label>
   {update&&<div className="form-note">Use at least 12 characters, including uppercase, lowercase, and a number.</div>}
   <button className="btn btn-ink btn-form" disabled={busy}>{busy?'Please wait…':update?'Update password':'Send recovery email'} <ArrowRight size={18}/></button>
  </form>}
 </AuthLayout>;
}
