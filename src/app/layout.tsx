import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ToastProvider';
import './globals.css';

export const metadata:Metadata={
 title:{default:'JobLinkLocal — Work is closer than you think',template:'%s · JobLinkLocal'},
 description:'A new kind of local opportunity network for people, businesses, and communities.',
 applicationName:'JobLinkLocal',
 robots:{index:true,follow:true}
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><ToastProvider>{children}</ToastProvider></body></html>;
}
