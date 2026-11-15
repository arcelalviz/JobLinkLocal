import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ToastProvider';
import './globals.css';
import './final.css';

export const metadata:Metadata={
 title:{default:'JobLinkLocal Final — Local opportunity, clearly connected',template:'%s · JobLinkLocal'},
 description:'JobLinkLocal Final connects verified local jobseekers and employers through clear application tracking, secure LGU review, and professional hiring workflows.',
 applicationName:'JobLinkLocal Final',
 robots:{index:true,follow:true}
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><ToastProvider>{children}</ToastProvider></body></html>;
}
