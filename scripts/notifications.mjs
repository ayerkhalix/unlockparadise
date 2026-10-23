// Schedules idempotent notification records only. No customer email is sent.
import {createClient} from '@supabase/supabase-js';
if(process.env.UPD_ENVIRONMENT!=='staging'||!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)throw new Error('Isolated staging configuration required.');
if(process.env.NOTIFICATION_DELIVERY_ENABLED==='true')throw new Error('An approved transactional email transport must be integrated before delivery is enabled.');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const result=await db.rpc('schedule_membership_notifications');if(result.error)throw new Error('Notification scheduling failed.');
console.log(JSON.stringify({scheduled:true,emails_sent:0}));
