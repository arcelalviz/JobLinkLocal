import { NextRequest } from 'next/server';
import { api } from '@/lib/api';
import { asResponse } from '@/lib/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params:Promise<{route:string[]}> };

async function handler(req:NextRequest,context:Context) {
  try {
    const {route}=await context.params;
    return await api(req,route);
  } catch(error) { return asResponse(error); }
}

export { handler as GET,handler as POST,handler as PATCH,handler as DELETE };
