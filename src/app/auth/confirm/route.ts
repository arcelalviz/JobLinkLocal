import { NextRequest, NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest) {
  const url=new URL(request.url);
  const code=url.searchParams.get('code');
  const tokenHash=url.searchParams.get('token_hash');
  const type=url.searchParams.get('type') as EmailOtpType|null;
  const next=url.searchParams.get('next');
  const auth=await userClient();
  let error:null|Error=null;
  if(code){
    const result=await auth.auth.exchangeCodeForSession(code);
    error=result.error;
  } else if(tokenHash && type){
    const result=await auth.auth.verifyOtp({token_hash:tokenHash,type});
    error=result.error;
  } else {
    error=new Error('Confirmation link is incomplete.');
  }
  if(error)return NextResponse.redirect(new URL('/login?error=confirmation',url.origin));
  return NextResponse.redirect(new URL(next==='/auth/reset'?'/auth/reset':'/app',url.origin));
}
