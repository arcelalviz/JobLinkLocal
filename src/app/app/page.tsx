import { redirect } from 'next/navigation';
import { userClient } from '@/lib/supabase/server';
import { Workspace } from '@/components/Workspace';

export const dynamic='force-dynamic';
export default async function AppPage(){
 const auth=await userClient();
 const {data}=await auth.auth.getUser();
 if(!data.user)redirect('/login');
 return <Workspace/>;
}
