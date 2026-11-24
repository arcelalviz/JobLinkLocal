'use client';
import { useEffect, useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { request } from '@/lib/http';
import { useToast } from '@/components/ToastProvider';
import type { Profile } from '@/types';

type Person = {id:string;full_name:string;avatar_url?:string|null};
export function ProfileAvatar({person}:{person:Person}) {
 const [failed,setFailed]=useState('');
 const path=person.avatar_url||'';
 const key=`${person.id}/${path}`;
 const initials=(person.full_name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'?';
 return path&&failed!==key?<img className="jl-avatar-image" src={`/api/files/avatar/${person.id}?v=${encodeURIComponent(path)}`} alt="" onError={()=>setFailed(key)}/>:<span aria-hidden="true">{initials}</span>;
}

export function ProfilePhoto({me,updateMe,bump,disabled=false}:{me:Profile;updateMe:(p:Profile)=>void;bump:()=>void;disabled?:boolean}){
 const toast=useToast();
 const input=useRef<HTMLInputElement>(null);
 const generation=useRef(0);
 const [source,setSource]=useState<{url:string;width:number;height:number}|null>(null);
 const [zoom,setZoom]=useState(1);
 const [x,setX]=useState(50);
 const [y,setY]=useState(50);
 const [busy,setBusy]=useState(false);
 const [drag,setDrag]=useState(false);
 const [confirmRemove,setConfirmRemove]=useState(false);
 useEffect(()=>()=>{if(source)URL.revokeObjectURL(source.url);},[source]);
 useEffect(()=>()=>{generation.current++;},[]);
 const choose=async(file?:File)=>{
  if(!file||busy||disabled)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024||!file.size){toast.show('Choose a JPG, PNG or WebP photo up to 10 MB.','warning');return;}
  const seq=++generation.current;
  const url=URL.createObjectURL(file);
  try{
   const img=new Image();img.src=url;await img.decode();
   if(seq!==generation.current){URL.revokeObjectURL(url);return;}
   if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>40_000_000)throw new Error('Choose a photo smaller than 40 megapixels.');
   setSource({url,width:img.naturalWidth,height:img.naturalHeight});setZoom(1);setX(50);setY(50);setConfirmRemove(false);
  }catch(error){URL.revokeObjectURL(url);if(seq===generation.current)toast.show(error instanceof Error&&error.message.startsWith('Choose')?error.message:'This image could not be opened. Try a different file.','error');}
 };
 const cancel=()=>{generation.current++;setSource(null);if(input.current)input.current.value='';};
 const crop=source?Math.min(source.width,source.height)/zoom:1;
 const left=source?(source.width-crop)*x/100:0;
 const top=source?(source.height-crop)*y/100:0;
 const save=async()=>{
  if(!source||busy||disabled)return;
  setBusy(true);
  try{
   const img=new Image();img.src=source.url;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image editing is not available in this browser.');
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,512,512);ctx.drawImage(img,left,top,crop,crop,0,0,512,512);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
   if(!blob)throw new Error('Unable to prepare the photo.');
   const data=new FormData();data.set('avatar',new File([blob],'avatar.jpg',{type:'image/jpeg'}));
   updateMe(await request<Profile>('avatar','POST',data));cancel();bump();toast.show('Profile photo updated.','success');
  }catch(error){toast.show(error instanceof Error?error.message:'Unable to upload photo.','error');}finally{setBusy(false);}
 };
 const remove=async()=>{
  if(busy||disabled)return;setBusy(true);
  try{updateMe(await request<Profile>('avatar','DELETE'));setConfirmRemove(false);bump();toast.show('Profile photo removed.','success');}
  catch(error){toast.show(error instanceof Error?error.message:'Unable to remove photo.','error');}finally{setBusy(false);}
 };
 return <section className="jl-photo-editor" aria-label="Profile photo settings">
  <div className="jl-photo-head"><div><h3>Profile photo</h3><p>Choose an image, adjust the crop and save. Your photo is private to authorized accounts.</p></div><span className="jl-photo-status">{me.avatar_url?'Photo on file':'Initials avatar'}</span></div>
  <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy||disabled} onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/>
  {source?<div className="jl-photo-crop"><div className="jl-photo-preview" role="img" aria-label="Cropped photo preview"><img src={source.url} alt="" style={{width:`${source.width/crop*100}%`,height:`${source.height/crop*100}%`,left:`${-left/crop*100}%`,top:`${-top/crop*100}%`}}/></div><div className="jl-photo-controls"><strong>Adjust your crop</strong><label>Zoom <input type="range" min="1" max="3" step=".05" value={zoom} disabled={busy} onChange={e=>setZoom(Number(e.target.value))}/></label><label>Horizontal position <input type="range" min="0" max="100" value={x} disabled={busy} onChange={e=>setX(Number(e.target.value))}/></label><label>Vertical position <input type="range" min="0" max="100" value={y} disabled={busy} onChange={e=>setY(Number(e.target.value))}/></label><div className="jl-photo-actions"><button type="button" className="btn btn-ink btn-small" disabled={busy||disabled} onClick={save}>{busy?'Saving photo…':'Save photo'}</button><button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={cancel}><X size={15}/> Cancel</button></div></div></div>:<><button type="button" className={`jl-photo-drop ${drag?'is-dragging':''}`} disabled={busy||disabled} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();if(!busy&&!disabled)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);void choose(e.dataTransfer.files[0]);}}><UploadCloud size={23}/><span><strong>{me.avatar_url?'Replace photo':'Choose photo'}</strong><small>Drop or browse · JPG, PNG, WebP · up to 10 MB</small></span></button>{me.avatar_url&&<div className="jl-photo-actions">{confirmRemove?<><span>Remove your current photo?</span><button type="button" className="btn btn-outline btn-small" disabled={busy||disabled} onClick={remove}>{busy?'Removing…':'Remove photo'}</button><button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={()=>setConfirmRemove(false)}>Cancel</button></>:<button type="button" className="btn btn-quiet btn-small" disabled={busy||disabled} onClick={()=>setConfirmRemove(true)}>Remove photo</button>}</div>}</>}
 </section>;
}
