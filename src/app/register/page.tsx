import { RegisterForm } from '@/components/RegisterForm';
export default async function RegisterPage({searchParams}:{searchParams:Promise<{role?:string}>}){
 const params=await searchParams;
 return <RegisterForm initialRole={params.role==='employer'?'employer':'jobseeker'}/>;
}
