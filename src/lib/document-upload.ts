import { createBrowserClient } from '@supabase/ssr';
import { request } from './http';
import { fileMime,uploadFileError,type UploadPurpose,type StagedUpload } from './upload-rules';
export async function submitDocuments<T>(purpose:UploadPurpose,files:File[],submit:(refs:StagedUpload[])=>Promise<T>,progress?:(done:number,total:number)=>void):Promise<T>{
 if(!files.length||files.length>(purpose==='resume'?1:3))throw new Error('Choose the required files before submitting.');
 for(const file of files){const issue=uploadFileError(file.size,fileMime(file),purpose);if(issue)throw new Error(`${file.name}: ${issue}`);}
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('Storage configuration is unavailable.');
 const client=createBrowserClient(url,key);
 const refs:StagedUpload[]=[];
 try{
  for(const file of files){
   const mime=fileMime(file);
   const ticket=await request<{path:string;token:string}>('uploads/prepare','POST',{purpose,size:file.size,mime});
   refs.push({path:ticket.path,filename:file.name});
   const {error}=await client.storage.from('upload-staging').uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:mime,cacheControl:'0',upsert:false});
   if(error)throw new Error(`Could not upload ${file.name}. ${error.message}`);
   progress?.(refs.length,files.length);
  }
  return await submit(refs);
 }finally{
  if(refs.length)await request('uploads/cleanup','POST',{purpose,paths:refs.map(ref=>ref.path)}).catch(()=>{});
 }
}
