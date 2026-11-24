export const MAX_DOCUMENT_BYTES=5*1024*1024;
export const DOCUMENT_TYPES=['application/pdf','image/png','image/jpeg'] as const;
export type UploadPurpose='resume'|'verification';
export type StagedUpload={path:string;filename:string};
export function documentMime(bytes:Uint8Array){
 if(bytes.length>5&&[37,80,68,70,45].every((b,i)=>bytes[i]===b))return 'application/pdf';
 if(bytes.length>8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
 if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 return null;
}
export function uploadFileError(size:number,mime:string,purpose:UploadPurpose){
 if(!Number.isInteger(size)||size<=0||size>MAX_DOCUMENT_BYTES)return 'Choose a non-empty file up to 5 MB.';
 if(purpose==='resume'?mime!=='application/pdf':!DOCUMENT_TYPES.some(t=>t===mime))return purpose==='resume'?'Upload a valid PDF resume.':'Only PDF, JPG and PNG documents are accepted.';
 return null;
}
export function validStagedPath(path:unknown,owner:string,purpose:UploadPurpose):path is string{
 return typeof path==='string'&&path.startsWith(`${owner}/${purpose}/`)&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(pdf|png|jpg)$/i.test(path.slice(`${owner}/${purpose}/`.length));
}
export function fileMime(file:{name:string;type:string}){return file.type||(/\.pdf$/i.test(file.name)?'application/pdf':/\.png$/i.test(file.name)?'image/png':/\.jpe?g$/i.test(file.name)?'image/jpeg':'');}
