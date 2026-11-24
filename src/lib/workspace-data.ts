import type { Profile } from '@/types';

export function isWorkspaceProfile(value: unknown): value is Profile {
 if (!value || typeof value !== 'object') return false;
 const p = value as Record<string, unknown>;
 return typeof p.id === 'string' && p.id.length > 0 && typeof p.full_name === 'string' &&
   typeof p.role === 'string' && ['jobseeker','employer','lgu_admin','sys_admin'].includes(p.role) &&
   typeof p.lgu_status === 'string' && ['pending','approved','rejected','suspended'].includes(p.lgu_status);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
 return !!value && typeof value === 'object' && !Array.isArray(value);
}
