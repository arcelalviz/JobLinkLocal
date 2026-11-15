'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck, LogOut, Fingerprint } from 'lucide-react';
import { request } from '@/lib/http';
import { useToast } from '@/components/ToastProvider';

export function AdminMfaGate({onVerified,onLogout}:{onVerified:()=>void;onLogout:()=>void}){
 const toast=useToast();
 const [loading,setLoading]=useState(true);
 const [enrolling,setEnrolling]=useState(false);
 const [factorId,setFactorId]=useState('');
 const [qr,setQr]=useState('');
 const [secret,setSecret]=useState('');
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
   request<any>('auth/mfa').then(data=>{
     if(data.verified){onVerified();return;}
     const existing=(data.factors||[]).find((factor:any)=>factor.status==='verified');
     if(existing)setFactorId(existing.id);
   }).catch(error=>toast.show(error instanceof Error?error.message:'Could not check administrator verification.','error')).finally(()=>setLoading(false));
 },[onVerified,toast]);
 const enroll=async()=>{
   setEnrolling(true);
   try{
     const data=await request<any>('auth/mfa','POST',{action:'enroll'});
     setFactorId(data.factorId);setQr(data.qr_code);setSecret(data.secret);
     toast.show('Authenticator setup started.','info','Scan the QR code in your authenticator app.');
   }catch(error){toast.show(error instanceof Error?error.message:'Authenticator setup failed.','error');}
   finally{setEnrolling(false);}
 };
 const verify=async(e:React.FormEvent)=>{
   e.preventDefault();
   if(!/^\d{6}$/.test(code)){toast.show('Enter the six-digit code from your app.','warning');return;}
   setBusy(true);
   try{
     await request('auth/mfa','POST',{action:'verify',factorId,code});
     toast.show('Administrator access secured.','success');onVerified();
   }catch(error){toast.show(error instanceof Error?error.message:'Authenticator verification failed.','error');}
   finally{setBusy(false);}
 };
 const qrSrc=qr?(qr.startsWith('data:')?qr:`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`):'';
 return <main className="mfa-screen"><div className="mfa-card"><span className="mfa-emblem"><Fingerprint size={35}/></span><p className="eyebrow dark-eyebrow">ONE MORE LAYER OF TRUST</p><h1>Secure your<br/><em>administrator access.</em></h1><p className="mfa-description">LGU and System Administrators use two-step authentication to protect verification documents, account controls and community data.</p>
   {loading?<div className="loading-panel">Checking your security setup…</div>:<>
     {qr&&<div className="mfa-qr"><img src={qrSrc} alt="Authenticator enrollment QR code"/><p>Scan the QR code using Google Authenticator, Microsoft Authenticator or another compatible authenticator app.</p>{secret&&<details><summary>Can't scan? Enter the setup key manually</summary><code>{secret}</code></details>}</div>}
     {!factorId?<button className="btn btn-ink btn-form" onClick={enroll} disabled={enrolling}>{enrolling?'Preparing authenticator…':'Set up authenticator'} <ArrowRight size={18}/></button>:<form noValidate className="form-stack" onSubmit={verify}><label className="form-field"><span>Six-digit authenticator code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></label><button className="btn btn-ink btn-form" type="submit" disabled={busy}>{busy?'Verifying…':qr?'Finish setup & verify':'Verify authenticator'} <ShieldCheck size={18}/></button></form>}
   </>}
   <button className="mfa-signout" onClick={onLogout}><LogOut size={16}/> Sign out</button>
 </div><span className="mfa-footer">PROTECTED ACCOUNTS. SAFER OPPORTUNITIES.</span></main>;
}
