import { randomUUID } from 'node:crypto';
import { adminClient } from './supabase/admin';
import { ApiError } from './guards';
import { uploadFileError,validStagedPath,type UploadPurpose } from './upload-rules';
import { validateFile } from './uploads';
export const STAGING_BUCKET='upload-staging';
export async function prepareUpload(owner:string,purpose:UploadPurpose,size:number,mime:string){
 const problem=uploadFileError(size,mime,purpose);if(problem)throw new ApiError(400,problem);
 const ext=mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg';
 const path=`${owner}/${purpose}/${randomUUID()}.${ext}`;
 const {data,error}=await adminClient().storage.from(STAGING_BUCKET).createSignedUploadUrl(path,{upsert:false});
 if(error||!data){console.error('[Upload staging]',error?.message);throw new ApiError(503,'Unable to prepare a private upload. Check the upload-staging bucket configuration.');}
 return {path,token:data.token};
}
export async function readStaged(owner:string,purpose:UploadPurpose,entry:unknown){
 const ref=entry as {path?:unknown;filename?:unknown}|null;
 if(!ref||!validStagedPath(ref.path,owner,purpose))throw new ApiError(400,'Invalid upload reference. Select the file again.');
 const {data,error}=await adminClient().storage.from(STAGING_BUCKET).download(ref.path);
 if(error||!data)throw new ApiError(400,'The temporary upload is unavailable. Select the file again.');
 const name=typeof ref.filename==='string'?ref.filename.slice(0,160):'document';
 const file=new File([data],name,{type:data.type});
 await validateFile(file,purpose==='resume');
 return file;
}
export async function cleanupStaged(owner:string,purpose:UploadPurpose,paths:unknown[]){
 const valid=paths.filter((p):p is string=>validStagedPath(p,owner,purpose));
 if(valid.length){const {error}=await adminClient().storage.from(STAGING_BUCKET).remove(valid);if(error)console.error('[Staging cleanup]',error.message);}
}
