import nodemailer from 'nodemailer';
import { adminClient } from './supabase/admin';

const clean = (value:string) => value.replace(/[\r\n]/g,' ').trim();

export async function sendSystemEmail(to:string,subject:string,message:string,kind:string) {
  const user=process.env.SMTP_USER;
  const pass=process.env.SMTP_PASSWORD;
  let status:'sent'|'failed'|'skipped'='skipped';
  let code:string|null=null;
  if (user && pass && to && /.+@.+\..+/.test(to)) {
    try {
      const transport = nodemailer.createTransport({
        host:process.env.SMTP_HOST || 'smtp.gmail.com',
        port:Number(process.env.SMTP_PORT || 465),
        secure:Number(process.env.SMTP_PORT || 465)===465,
        auth:{user,pass},
        connectionTimeout:9000,
        greetingTimeout:9000,
        socketTimeout:12000
      });
      const from=process.env.MAIL_FROM || `JobLinkLocal <${user}>`;
      await transport.sendMail({from,to,subject:clean(subject),text:message});
      status='sent';
    } catch (error) {
      status='failed';
      code=error instanceof Error ? error.name : 'SMTP_ERROR';
      console.error('[Email delivery failed]',code);
    }
  }
  try {
    await adminClient().from('email_delivery_logs').insert({recipient:to,kind,status,error_code:code});
  } catch {}
  return status;
}

export async function emailPerson(userId:string, title:string, text:string, kind:string) {
  const { data } = await adminClient().from('profiles').select('email').eq('id',userId).maybeSingle();
  if (data?.email) await sendSystemEmail(data.email,title,`${text}\n\nView updates in your JobLinkLocal dashboard.`,kind);
}
