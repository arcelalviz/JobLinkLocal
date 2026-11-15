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

export function applicationDecisionNotice(status:string, title:string, note:string) {
  const outcomes:Record<string,{subject:string;message:string}>={
    reviewing:{subject:'Application under review',message:'The employer has started reviewing your application.'},
    shortlisted:{subject:'Application shortlisted',message:'The employer has shortlisted your application for further consideration.'},
    interviewing:{subject:'Interview stage update',message:'Your application has moved to the interview stage. Please check with the employer for scheduling details.'},
    accepted:{subject:'Application accepted',message:'The employer has accepted your application. This status does not confirm that employment has started; the employer will record a separate hiring update.'},
    rejected:{subject:'Application outcome: Not selected',message:'Thank you for your interest in this opportunity. The employer has decided not to proceed with your application at this time.'},
    hired:{subject:'Hiring confirmation',message:'The employer has recorded your hiring for this position. Please confirm your employment terms and start arrangements directly with the employer.'}
  };
  const outcome=outcomes[status]||{subject:'Application status update',message:'The employer has updated your application status.'};
  const noteText=note.trim()?`

Message from the employer:
${note.trim()}`:'';
  return {
    subject:`${outcome.subject} — ${title} | JobLinkLocal`,
    body:`Dear JobLinkLocal Applicant,

We are writing regarding your application for ${title}.

${outcome.message}${noteText}

You may review your current status and the employer's note in the JobLinkLocal application dashboard.

Sincerely,
JobLinkLocal Notifications

This is an automated platform update.`
  };
}

export function employmentStatusNotice(title:string, endDate:string, note:string) {
  const noteText=note.trim();
  return {
    subject:`Employment status notice — ${title} | JobLinkLocal`,
    body:`Dear JobLinkLocal Member,

This is to inform you that your employer has recorded the end of your employment in the ${title} position, effective ${endDate}.

Reason or explanation provided by the employer:
${noteText}

You can view this update in your JobLinkLocal application and employment records. This platform notification does not replace any formal notice or process required by applicable employment law or your employment agreement. If you have questions about this record, please contact your employer directly.

Sincerely,
JobLinkLocal Notifications`
  };
}
