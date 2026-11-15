'use client';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';

export function ConfirmDialog({open,title,body,confirmLabel='Confirm',danger=false,onCancel,onConfirm,pending=false}:{open:boolean;title:string;body:string;confirmLabel?:string;danger?:boolean;onCancel:()=>void;onConfirm:()=>void;pending?:boolean}) {
 return <AnimatePresence>
 {open&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget&&!pending)onCancel();}}>
   <motion.div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="confirm-panel" initial={{opacity:0,y:30,scale:.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:16,scale:.97}} transition={{type:'spring',stiffness:340,damping:29}}>
     <div className="dialog-eyebrow"><span className="mini-bullet"/> Action required</div>
     <button className="dialog-close" onClick={onCancel} disabled={pending} aria-label="Close"><X size={18}/></button>
     <h2 id="confirm-title">{title}</h2><p>{body}</p>
     <div className="dialog-actions"><button className="btn btn-quiet" onClick={onCancel} disabled={pending}>Cancel</button><button autoFocus className={`btn ${danger?'btn-danger':'btn-ink'}`} disabled={pending} onClick={onConfirm}>{pending?'Working…':confirmLabel}<ArrowRight size={17}/></button></div>
   </motion.div>
  </motion.div>}
 </AnimatePresence>;
}
