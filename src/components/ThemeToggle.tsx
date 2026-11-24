
'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export function ThemeToggle() {
 const { active, setTheme } = useTheme();
 const dark = active === 'dark';
 return <button type="button" role="switch" aria-checked={dark} className="jl-theme-toggle jl-theme-switch" title={dark?'Switch to light mode':'Switch to dark mode'} aria-label="Dark mode" onClick={()=>setTheme(dark?'light':'dark')}>
  {dark?<Moon size={15}/>:<Sun size={15}/>}<span className="jl-mode-label">{dark?'Dark':'Light'}</span><span aria-hidden="true" className={`jl-switch-track ${dark?'is-dark':''}`}><span className="jl-switch-knob"/></span>
 </button>;
}
