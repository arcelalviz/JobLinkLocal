import { RecoveryForm } from '@/components/RecoveryForm';

export default async function Forgot({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const params=await searchParams;
 return <RecoveryForm invalidLink={params.error==='expired'}/>;
}
