import { randomUUID } from 'node:crypto';
import { adminClient } from './supabase/admin';
import { ApiError, dbError } from './guards';
import { documentMime, uploadFileError } from './upload-rules';

export function avatarMime(bytes:Uint8Array):'image/png'|'image/jpeg'|null {
  if(bytes.length>8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
  if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  return null;
}

export async function validateFile(file:File, pdfOnly=false) {
  if (!(file instanceof File) || file.size === 0 || file.size > 5*1024*1024) throw new ApiError(400,'Choose a file smaller than 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime=documentMime(bytes);
  if(!mime)throw new ApiError(400,pdfOnly?'Upload a valid PDF resume.':'Only PDF, JPG and PNG documents are accepted.');
  const problem=uploadFileError(file.size,mime,pdfOnly?'resume':'verification');
  if(problem)throw new ApiError(400,problem);
  const ext=mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg';
  return {bytes,mime,ext};
}

export async function uploadPrivate(bucket:'verification-documents'|'resumes'|'avatars',ownerId:string,file:File,pdfOnly=false) {
  const {bytes,mime,ext}=await validateFile(file,pdfOnly);
  if(bucket==='avatars'&&(!avatarMime(bytes)||file.size>2*1024*1024))throw new ApiError(400,'Choose a valid PNG or JPG profile photo below 2 MB.');
  const path=`${ownerId}/${randomUUID()}.${ext}`;
  const admin=adminClient();
  const {error}=await admin.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'0'});
  if(error&&bucket==='avatars'){
    console.error('[Avatar storage upload]',error.name,error.message);
    throw new ApiError(503,'Profile photo upload failed. Contact support if the issue continues.');
  }
  dbError(error,'File upload failed. Please try again.');
  return {path,mime,bytes:file.size,filename:file.name.slice(0,160)};
}
