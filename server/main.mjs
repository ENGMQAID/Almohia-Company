import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {openDatabase} from './database.mjs';
import {Service} from './service.mjs';
import {createHttpServer} from './http.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8787);
if(process.env.NODE_ENV==='production'&&!process.env.PUBLIC_ORIGIN?.startsWith('https://'))throw Error('Production requires PUBLIC_ORIGIN with HTTPS');
const bootstrap=process.env.ADMIN_BOOTSTRAP_PATH||resolve(root,'auth-bootstrap.local.js');
const db=openDatabase(process.env.DATABASE_PATH||resolve(root,'server/data/group.sqlite'));
const service=new Service(db,{bootstrapPath:existsSync(bootstrap)?bootstrap:undefined,telegramEnabled:process.env.TELEGRAM_ENABLED==='true'});
const server=createHttpServer(service,{root,publicOrigin:process.env.PUBLIC_ORIGIN});
server.listen(port,host,()=>console.log(`Platform ready at ${process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${port}`} | Telegram ${service.telegramEnabled?'enabled':'disabled'}`));
const tick=async()=>{try{service.schedule();await service.dispatch();}catch{console.error('Scheduled processing failed; it will retry on the next cycle.');}};
const timer=setInterval(tick,60000);tick();
async function close(){clearInterval(timer);server.close(()=>{db.close();process.exit(0);});}
process.on('SIGINT',close);process.on('SIGTERM',close);
