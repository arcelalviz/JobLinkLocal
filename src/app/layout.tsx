import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ToastProvider';
import './globals.css';
import './final.css';
import './professional.css';

export const metadata:Metadata={
 title:{default:'JobLinkLocal — Local opportunity, clearly connected',template:'%s · JobLinkLocal'},
 description:'JobLinkLocal connects verified local jobseekers and employers through clear application tracking, secure LGU review, and professional hiring workflows.',
 applicationName:'JobLinkLocal',
 icons:{icon:'/images/joblinklocal-icon.png',apple:'/images/joblinklocal-icon.png'},
 robots:{index:true,follow:true}
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><ToastProvider>{children}</ToastProvider></body></html>;
}
