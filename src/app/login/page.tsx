import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;portal?:string;job?:string}>}){
 const params=await searchParams;
 const portal=params.portal==='employer'||params.portal==='admin'?params.portal:'jobseeker';
 const jobId=typeof params.job==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(params.job)?params.job:undefined;
 return <LoginForm invalidConfirmation={params.error==='confirmation'} initialPortal={portal} returnJobId={jobId}/>;
}
