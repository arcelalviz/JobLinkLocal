
'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export function ThemeToggle() {
 const { active, setTheme } = useTheme();
 const dark = active === 'dark';
 const reduceMotion=useReducedMotion();
 return <button type="button" role="switch" aria-checked={dark} className="jl-theme-toggle jl-theme-switch" title={dark?'Switch to light mode':'Switch to dark mode'} aria-label="Dark mode" onClick={()=>setTheme(dark?'light':'dark')}>
  <span className="jl-mode-icon" aria-hidden="true"><AnimatePresence initial={false} mode="sync"><motion.span key={active} initial={{opacity:0,filter:"blur(3px)",y:2}} animate={{opacity:1,filter:"blur(0px)",y:0}} exit={{opacity:0,filter:"blur(3px)",y:-2,transition:{duration:.16}}} transition={{duration:.20}}>{dark?<Moon size={15}/>:<Sun size={15}/>}</motion.span></AnimatePresence></span><span className="jl-mode-label">{dark?'Dark':'Light'}</span><span aria-hidden="true" className={`jl-switch-track ${dark?'is-dark':''}`}><motion.span className="jl-switch-knob" initial={false} animate={{x:dark?16:0,scaleX:reduceMotion?1:[1,1.12,1]}} transition={{duration:reduceMotion?0:.20,ease:"easeInOut"}}/></span>
 </button>;
}
