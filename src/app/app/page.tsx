import { redirect } from 'next/navigation';
import { userClient } from '@/lib/supabase/server';
import { Workspace } from '@/components/Workspace';

export const dynamic='force-dynamic';
export default async function AppPage({searchParams}:{searchParams:Promise<{job?:string}>}){
 const auth=await userClient();
 const {data}=await auth.auth.getUser();
 if(!data.user){
  const query=await searchParams;
  const job=typeof query.job==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(query.job)?query.job:null;
  redirect(job?`/login?portal=jobseeker&job=${encodeURIComponent(job)}`:'/login');
 }
 return <Workspace/>;
}
