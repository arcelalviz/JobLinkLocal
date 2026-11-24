'use client';
import Link from 'next/link';
import { useState } from 'react';
import { FileText, Trash2, Upload, ShieldCheck } from 'lucide-react';
import { PrivateFileViewer } from '@/components/PrivateFileViewer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { request } from '@/lib/http';
import { useToast } from '@/components/ToastProvider';

export const DOCUMENT_TYPES: Record<string,string> = {
 government_id:'Government-issued ID', birth_certificate:'Birth certificate',
 resume:'Resume / CV', certificate:'Certificate or qualification',
 business_permit:'Business permit', supporting:'Other supporting document'
};

type Submission = {
 id:string; status:string; created_at:string; reviewer_note?:string|null;
 verification_documents?:Array<{id:string;filename:string;document_type?:string|null}>;
};

export function VerificationDocuments({records,onChanged,showUploadLink=true}:{
 records:Submission[];onChanged:()=>void;showUploadLink?:boolean;
}) {
 const toast=useToast();
 const [target,setTarget]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const hasEditable=records.some(row=>row.status==='rejected');
 const hasAny=records.some(row=>(row.verification_documents||[]).length>0);
 return <section className="form-panel document-library">
   <div className="form-panel-title"><div><h3>My documents</h3><p className="form-hint">Private files submitted to the LGU for account verification.</p></div><ShieldCheck size={24}/></div>
   {!hasAny&&<p className="form-hint">No verification documents have been uploaded yet.</p>}
   {records.map(sub=><div className="document-submission" key={sub.id}>
     <div className="document-group-heading"><span className={`stage-badge stage-${sub.status}`}>{sub.status==='approved'?'LGU approved':sub.status==='pending'?'Under LGU review':'Changes requested'}</span><small>{new Date(sub.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</small></div>
     {(sub.verification_documents||[]).map(doc=><div className="document-library-row" key={doc.id}>
       <FileText size={20}/><div className="document-library-label"><strong>{DOCUMENT_TYPES[doc.document_type||'']||'Supporting document'}</strong><small>{doc.filename}</small></div>
       <PrivateFileViewer url={`/api/files/document/${doc.id}`} label="Quick view"/>
       {sub.status==='rejected'&&<button type="button" className="doc-delete" aria-label={`Delete ${doc.filename}`} title="Remove rejected document" onClick={()=>setTarget(doc.id)}><Trash2 size={18}/></button>}
     </div>)}
     {sub.reviewer_note&&<p className="form-hint">LGU note: {sub.reviewer_note}</p>}
   </div>)}
   <p className="form-hint">Submitted documents cannot be removed while under review or after approval. Rejected documents may be removed before resubmission.</p>
   {showUploadLink&&<Link className="btn btn-outline btn-small" href="/app?tab=verification"><Upload size={16}/>{hasEditable?'Upload corrected documents':'Go to LGU verification'}</Link>}
   <ConfirmDialog open={!!target} title="Remove this document?" body="Only documents from a rejected verification request can be removed. This does not remove your account." confirmLabel="Delete document" danger onCancel={()=>setTarget(null)} onConfirm={async()=>{
     if(!target)return;
     setBusy(true);
     try {await request(`verification/documents/${target}`,'DELETE');toast.show('Document removed.','success');onChanged();}
     catch(err){toast.show(err instanceof Error?err.message:'Could not delete document.','error');}
     finally {setBusy(false);setTarget(null);}
   }}/>
 </section>;
}
