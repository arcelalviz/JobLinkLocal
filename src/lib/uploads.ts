import { randomUUID } from 'node:crypto';
import { adminClient } from './supabase/admin';
import { ApiError, dbError } from './guards';

export async function validateFile(file:File, pdfOnly=false) {
  if (!(file instanceof File) || file.size === 0 || file.size > 5*1024*1024) throw new ApiError(400,'Choose a file smaller than 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = bytes.length > 5 && bytes[0]===37 && bytes[1]===80 && bytes[2]===68 && bytes[3]===70 && bytes[4]===45;
  const png = bytes.length > 8 && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71 && bytes[4]===13 && bytes[5]===10;
  const jpg = bytes.length > 3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if (!pdf && (pdfOnly || (!png && !jpg))) throw new ApiError(400, pdfOnly?'Upload a valid PDF resume.':'Only PDF, JPG and PNG documents are accepted.');
  const mime=pdf?'application/pdf':png?'image/png':'image/jpeg';
  const ext=pdf?'pdf':png?'png':'jpg';
  return {bytes,mime,ext};
}

export async function uploadPrivate(bucket:'verification-documents'|'resumes'|'avatars',ownerId:string,file:File,pdfOnly=false) {
  const {bytes,mime,ext}=await validateFile(file,pdfOnly);
  const path=`${ownerId}/${randomUUID()}.${ext}`;
  const admin=adminClient();
  const {error}=await admin.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'0'});
  dbError(error,'File upload failed. Please try again.');
  return {path,mime,bytes:file.size,filename:file.name.slice(0,160)};
}
