'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, LoaderCircle } from 'lucide-react';

type Tone='success'|'error'|'info'|'warning'|'loading';
type Toast={id:number;title:string;description?:string;tone:Tone};
type ToastContext={show:(title:string,tone?:Tone,description?:string)=>number;dismiss:(id:number)=>void};
const Context=createContext<ToastContext>({show:()=>0,dismiss:()=>{}});
let nextId=0;

export function ToastProvider({children}:{children:React.ReactNode}) {
 const [items,setItems]=useState<Toast[]>([]);
 const show=useCallback((title:string,tone:Tone='info',description?:string)=>{
   const id=++nextId;
   setItems(items=>[...items.filter(item=>!(item.title===title&&item.tone===tone&&item.description===description)).slice(-3),{id,title,description,tone}]);
   return id;
 },[]);
 const dismiss=useCallback((id:number)=>setItems(items=>items.filter(t=>t.id!==id)),[]);
 useEffect(()=>{
   const timers=items.filter(t=>t.tone!=='loading').map(t=>setTimeout(()=>dismiss(t.id),t.tone==='error'?6500:4500));
   return ()=>timers.forEach(clearTimeout);
 },[items,dismiss]);
 const icons={success:CheckCircle2,error:AlertCircle,info:Info,warning:AlertTriangle,loading:LoaderCircle};
 const actions=useMemo(()=>({show,dismiss}),[show,dismiss]);
 return <Context.Provider value={actions}>
  {children}
  <div className="toast-stack" aria-live="polite" aria-atomic="false">
   <AnimatePresence initial={false} mode="sync">
    {items.map(t=>{
      const Icon=icons[t.tone];
      return <motion.div key={t.id} layout initial={{opacity:0,y:-10,scale:.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8,scale:.95,transition:{duration:.16,ease:"easeIn"}}} transition={{duration:.20,ease:[0.16,1,0.3,1]}} className={`toast toast-${t.tone}`} role={t.tone==='error'?'alert':'status'}>
       <span className="toast-icon"><Icon size={18} className={t.tone==='loading'?'spin':''}/></span>
       <span className="toast-copy"><strong>{t.title}</strong>{t.description&&<small>{t.description}</small>}</span>
       <button className="toast-close" onClick={()=>dismiss(t.id)} aria-label="Dismiss notification"><X size={15}/></button>
      </motion.div>;
    })}
   </AnimatePresence>
  </div>
 </Context.Provider>;
}

export function useToast(){return useContext(Context);}
