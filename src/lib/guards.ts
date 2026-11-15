import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { adminClient } from './supabase/admin';
import { userClient } from './supabase/server';
import type { Profile, Role } from '@/types';

export class ApiError extends Error {
  constructor(public status:number, message:string) { super(message); }
}

export async function currentUser(roles?:Role[], requireApproved = false, skipAdminMfa = false) {
  const auth = await userClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'Please sign in to continue.');
  const { data:profile, error:profileError } = await adminClient().from('profiles').select('*').eq('id', data.user.id).single();
  if (profileError || !profile) throw new ApiError(403, 'Your account profile is unavailable.');
  const p = profile as Profile;
  if (p.lgu_status === 'suspended') throw new ApiError(403, 'This account has been suspended. Contact support.');
  if (!skipAdminMfa && (p.role==='lgu_admin' || p.role==='sys_admin')) {
    const {data:assurance,error:mfaError}=await auth.auth.mfa.getAuthenticatorAssuranceLevel();
    if(mfaError || assurance.currentLevel!=='aal2') throw new ApiError(403,'Administrator authenticator verification is required.');
  }
  if (roles && !roles.includes(p.role)) throw new ApiError(403, 'You do not have permission to perform this action.');
  if (requireApproved && p.lgu_status !== 'approved') throw new ApiError(403, 'LGU account approval is required before this action.');
  if (requireApproved && !data.user.email_confirmed_at) throw new ApiError(403, 'Please confirm your email address first.');
  return { user:data.user, profile:p, auth };
}

export function requireSameOrigin(req:NextRequest) {
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new ApiError(403, 'Cross-site requests are not accepted.');
  if (origin) {
    let host:string;
    try { host = new URL(origin).host; } catch { throw new ApiError(403, 'Invalid request origin.'); }
    if (host !== req.nextUrl.host) throw new ApiError(403, 'Request origin does not match this website.');
  }
}

export async function checkLimit(req:NextRequest, label:string, limit:number, seconds:number) {
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unidentified';
  const key = createHash('sha256').update(`${label}:${ip}:${process.env.SUPABASE_SECRET_KEY || ''}`).digest('hex');
  const { data, error } = await adminClient().rpc('check_rate_limit',{ p_key_hash:key, p_limit:limit, p_window_seconds:seconds });
  if (error) throw new ApiError(503, 'Rate limiting is temporarily unavailable.');
  if (!data) throw new ApiError(429, 'Too many requests. Please try again shortly.');
}

export async function readJson(req:NextRequest) {
  if (Number(req.headers.get('content-length') || 0) > 120000) throw new ApiError(413,'Request is too large.');
  try {
    const text = await req.text();
    if (text.length > 120000) throw new ApiError(413,'Request is too large.');
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400,'Invalid request data.');
  }
}

export function asResponse(error:unknown) {
  if (error instanceof ApiError) return NextResponse.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
  console.error('[JobLinkLocal API]',error);
  return NextResponse.json({error:'Unable to complete this request. Please try again.'},{status:500,headers:{'Cache-Control':'no-store'}});
}

export function ok(data:unknown, status=200) {
  return NextResponse.json({data},{status,headers:{'Cache-Control':'no-store'}});
}

export function dbError(error:{code?:string;message?:string}|null, fallback='Unable to save your changes.') {
  if (!error) return;
  if (error.code === '23505') throw new ApiError(409, 'This record already exists.');
  if (error.code === '23503') throw new ApiError(400, 'Related record could not be found.');
  if (error.code === 'P0001') throw new ApiError(400, error.message || fallback);
  console.error('[Database operation]',error.code,error.message);
  throw new ApiError(500, fallback);
}

export async function recordAudit(actor_id:string,action:string,target_id?:string, details:Record<string,unknown> = {}) {
  const {error} = await adminClient().from('audit_logs').insert({actor_id,action,target_id,details});
  if (error) console.error('[Audit error]',error.code);
}

export async function notify(user_id:string,kind:string,title:string,body:string,link='/app?tab=notifications') {
  const { error } = await adminClient().from('notifications').insert({user_id,kind,title,body,link});
  if(error) console.error('[Notification write]',error.code);
}
