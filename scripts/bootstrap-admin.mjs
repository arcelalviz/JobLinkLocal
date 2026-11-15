import { createClient } from '@supabase/supabase-js';

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name, ADMIN_ROLE: role } = process.env;
if(!url || !key || !email || !name || !['lgu_admin','sys_admin'].includes(role)) throw new Error('Required administrator settings are missing.');
if(!password || password.length<14 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) throw new Error('Administrator password must have 14+ characters, uppercase, lowercase, a number and a symbol.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name,role:'jobseeker'}});
if(error||!data.user)throw new Error(error?.message||'Administrator creation failed.');
const {error:updateError}=await client.from('profiles').update({role,full_name:name,lgu_status:'approved'}).eq('id',data.user.id);
if(updateError){await client.auth.admin.deleteUser(data.user.id);throw new Error(updateError.message);}
await client.from('seeker_profiles').delete().eq('user_id',data.user.id);
process.stdout.write(`Created ${role} account for ${email}\n`);
