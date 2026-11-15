import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;portal?:string}>}){
 const params=await searchParams;
 const portal=params.portal==='employer'||params.portal==='admin'?params.portal:'jobseeker';
 return <LoginForm invalidConfirmation={params.error==='confirmation'} initialPortal={portal}/>;
}
