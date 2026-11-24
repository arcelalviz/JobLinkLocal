import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ToastProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';
import './final.css';
import './professional.css';
import './palette.css';
import './theme-dark.css';
import './design-system.css';

export const metadata:Metadata={
 title:{default:'JobLinkLocal — Olongapo City Jobs',template:'%s · JobLinkLocal'},
 description:'JobLinkLocal is an Olongapo City employment platform for verified jobseekers and employers.',
 applicationName:'JobLinkLocal',
 icons:{icon:'/images/joblinklocal-icon.png',apple:'/images/joblinklocal-icon.png'},
 robots:{index:true,follow:true}
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider></body></html>;
}
