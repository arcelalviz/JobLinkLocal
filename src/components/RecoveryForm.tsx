'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';
import { useToast } from '@/components/ToastProvider';
import { request } from '@/lib/http';

export function RecoveryForm({update=false,invalidLink=false}:{update?:boolean;invalidLink?:boolean}){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [passwordVisible,setPasswordVisible]=useState(false);
 const [confirmVisible,setConfirmVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [success,setSuccess]=useState(false);
 const toast=useToast();
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(update){
   if(password.length<8||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)){toast.show('Use at least 8 characters with upper- and lowercase letters and a number.','warning');return;}
   if(password!==confirmPassword){toast.show('Passwords do not match.','warning');return;}
  }else if(!email.includes('@')){toast.show('Enter a valid email address.','warning');return;}
  setBusy(true);
  try{
    await request(update?'auth/password':'auth/reset','POST',update?{password}:{email});
    setSuccess(true);toast.show(update?'Password updated.':'Recovery email requested.','success');
  }catch(error){toast.show(error instanceof Error?error.message:'Unable to continue.','error');}
  finally{setBusy(false);}
 };
 return <AuthLayout eyebrow="ACCOUNT RECOVERY" title={update?'Set a new password':'Reset password'} subtitle={update?'Set a new, secure password for your account.':'Enter your account email to receive a reset link.'}>
  {invalidLink&&!update&&<div className="form-notice" role="alert">The password recovery link has expired or is invalid. Request a new link below.</div>}
  {success?<div className="signup-success"><h3>{update?'Password updated':'Check your email'}</h3><p>{update?'You can now sign in with the new password.':'If the account exists, you’ll receive a password reset link shortly.'}</p><Link href="/login" className="btn btn-ink btn-form">Return to sign in <ArrowRight size={18}/></Link></div>:<form noValidate className="form-stack" onSubmit={submit}>
   {update?<>
    <label className="form-field"><span>New password</span><div className="input-wrap"><input type={passwordVisible?'text':'password'} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choose a strong password" autoComplete="new-password"/><button type="button" className="eye-button" aria-label={passwordVisible?'Hide password':'Show password'} onClick={()=>setPasswordVisible(value=>!value)}>{passwordVisible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
    <label className="form-field"><span>Confirm new password</span><div className="input-wrap"><input type={confirmVisible?'text':'password'} required minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat your new password" autoComplete="new-password"/><button type="button" className="eye-button" aria-label={confirmVisible?'Hide confirmation password':'Show confirmation password'} onClick={()=>setConfirmVisible(value=>!value)}>{confirmVisible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
   </>:<label className="form-field"><span>Your email address</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></label>}
   {update&&<div className="form-note">Use at least 8 characters, including uppercase, lowercase, and a number.</div>}
   <button className="btn btn-ink btn-form" disabled={busy}>{busy?'Please wait…':update?'Update password':'Send recovery email'} <ArrowRight size={18}/></button>
  </form>}
 </AuthLayout>;
}
