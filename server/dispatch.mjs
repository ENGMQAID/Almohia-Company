// Single-process outbox example. Production: replace JSON with a transactional database outbox.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {sendTelegram} from './telegram.mjs';
const path=process.env.OUTBOX_PATH;
if(!path)throw Error('Set OUTBOX_PATH to a server-side queue JSON file');
const queue=JSON.parse(await readFile(path,'utf8'));if(!Array.isArray(queue))throw Error('Invalid queue');
const sent=new Set(queue.filter(e=>e.sentAt).map(e=>e.id));
for(const event of queue){if(sent.has(event.id)||Date.parse(event.retryAt||'')>Date.now())continue;try{const result=await sendTelegram(event);event.sentAt=new Date().toISOString();event.messageId=result.messageId;delete event.error;delete event.retryAt;sent.add(event.id);}catch(error){event.attempts=(event.attempts||0)+1;event.retryAt=new Date(Date.now()+Math.max(error.retryAfter||60,Math.min(3600,60*2**Math.min(event.attempts,6)))*1000).toISOString();event.error=error.message;}
await writeFile(path+'.tmp',JSON.stringify(queue,null,2));await rename(path+'.tmp',path);
}
console.log('Outbox processing finished.');
