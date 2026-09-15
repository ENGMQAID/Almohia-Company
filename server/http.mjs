import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fail} from './validation.mjs';
const STATIC=new Set(['index.html','portal.html','styles.css','portal.css','features.css','public-updates.css','app.js','portal.js','auth.js','import.js','features.js','public-updates.js','server-connect.js','assets/almohia.png','assets/anesthesia.png','assets/forever52.png']);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
export function createHttpServer(service,{root=process.cwd(),publicOrigin}={}){
 const limits=new Map();
 return createServer(async(req,res)=>{
  const origin=publicOrigin||`http://127.0.0.1:${req.socket.localPort}`;
  const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  try{
   const url=new URL(req.url,origin),path=url.pathname;
   if(path==='/runtime-config.js'){res.setHeader('Content-Type','application/javascript');res.end('window.SERVER_MODE=true;');return;}
   if(path==='/auth-bootstrap.local.js'||path==='/auth-bootstrap.example.js'){res.setHeader('Content-Type','application/javascript');res.end('window.LOCAL_ADMIN_BOOTSTRAP=null;');return;}
   if(!path.startsWith('/api/')){if(req.method!=='GET'&&req.method!=='HEAD')fail('غير مسموح.',405);const file=path==='/'?'index.html':path.slice(1);if(!STATIC.has(file))fail('غير موجود.',404);const data=await readFile(resolve(root,file));res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:data);return;}
   if(req.headers.host!==new URL(origin).host)fail('عنوان الخادم غير صالح.',403);
   if(req.method!=='GET'&&req.headers.origin!==origin)fail('مصدر الطلب غير مسموح.',403);
   let body={};if(req.method!=='GET'){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))fail('يلزم JSON.',415);let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)fail('الطلب أكبر من الحجم المسموح.',413);parts.push(chunk);}try{body=JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');}catch{fail('JSON غير صالح.');}if(!body||typeof body!=='object'||Array.isArray(body))fail('بيانات غير صالحة.');
   }
   const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('group_session='))?.slice(14);
   if(path==='/api/login'||path==='/api/activate'){
    if(req.method!=='POST')fail('غير مسموح.',405);const key=req.socket.remoteAddress+':'+path;let rate=limits.get(key);if(!rate||rate.until<Date.now())rate={count:0,until:Date.now()+600000};if(++rate.count>20)fail('محاولات كثيرة. انتظر عشر دقائق.',429);limits.set(key,rate);if(limits.size>5000)for(const [k,v] of limits)if(v.until<Date.now())limits.delete(k);
    if(path==='/api/activate'){json(200,await service.activate(body));return;}const result=await service.login(body);if(token)service.logout(token);res.setHeader('Set-Cookie',`group_session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:')?'; Secure':''}`);json(200,{account:result.account,csrf:result.csrf});return;
   }
   const user=service.session(token);if(!user)fail('سجّل الدخول أولًا.',401);
   if(req.method!=='GET'&&req.headers['x-csrf-token']!==user.csrf)fail('جلسة الطلب غير صالحة.',403);
   if(path==='/api/logout'&&req.method==='POST'){service.logout(token);res.setHeader('Set-Cookie',`group_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${origin.startsWith('https:')?'; Secure':''}`);json(200,{ok:true});return;}
   if(path==='/api/session'&&req.method==='GET'){json(200,{account:{role:user.role,...(user.role==='employee'?{company:user.company,id:user.employee_id}:{})},csrf:user.csrf});return;}
   if(path==='/api/state'&&req.method==='GET'){json(200,service.snapshot(user));return;}
   if(path==='/api/state'&&req.method==='PUT'){json(200,service.put(user,body));return;}
   if(path==='/api/accounts/issue'&&req.method==='POST'){json(200,await service.issue(user,body));return;}
   if(path==='/api/telegram/status'&&req.method==='GET'){if(user.role!=='admin')fail('غير مسموح.',403);json(200,service.status());return;}
   fail('غير موجود.',404);
  }catch(error){json(error.status||500,{error:error.status?error.message:'تعذر إكمال العملية في الخادم.'});}
 });
}
