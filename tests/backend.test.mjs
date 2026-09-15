import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,pbkdf2Sync} from 'node:crypto';
import {openDatabase,COMPANIES,emptyCompany} from '../server/database.mjs';
import {Service} from '../server/service.mjs';
import {createHttpServer} from '../server/http.mjs';

test('HTTP authentication, authorization, company isolation, concurrent writes and queued notifications',async t=>{
 const db=openDatabase(':memory:'),salt='synthetic-salt',hash=v=>createHash('sha256').update(v).digest('hex');
 db.prepare('INSERT INTO users(identity_hash,role,salt,password_hash,iterations) VALUES(?,?,?,?,?)').run(hash('1000000001'),'admin',salt,pbkdf2Sync('Synthetic-admin-42',salt,210000,32,'sha256').toString('hex'),210000);
 let deliveries=0;
 const service=new Service(db,{telegramEnabled:true,telegramOptions:{token:'mock-token',chatId:'mock-chat',portalUrl:'https://example.com/portal.html',fetchImpl:async()=>{deliveries++;return{ok:true,json:async()=>({ok:true,result:{message_id:deliveries}})};}}});
 const server=createHttpServer(service);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
 const origin='http://127.0.0.1:'+server.address().port;
 async function request(path,method='GET',body,session={},extra={}){const r=await fetch(origin+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(session.cookie?{Cookie:session.cookie}:{}),...(session.csrf?{'X-CSRF-Token':session.csrf}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 assert.equal((await request('/api/state')).status,401);
 assert.equal((await request('/server/.env')).status,404);
 assert.equal((await request('/server/data/group.sqlite')).status,404);
 assert.equal((await request('/api/login','POST',{identity:'1000000001',password:'bad'})).status,401);
 assert.equal((await request('/api/login','POST',{identity:'1000000001',password:'Synthetic-admin-42'},{},{Origin:'https://attacker.example'})).status,403);
 const adminLogin=await request('/api/login','POST',{identity:'1000000001',password:'Synthetic-admin-42'});assert.equal(adminLogin.status,200);const admin={cookie:adminLogin.cookie,csrf:adminLogin.body.csrf};
 let state=(await request('/api/state','GET',undefined,admin)).body;
 const person=(id,name,company)=>({id,name,company,branch:'الرياض — الفرع 1',dept:'التسويق',job:'موظف',mode:'مكتبي',manager:'مدير الفريق'});
 for(const [i,c] of COMPANIES.entries()){const data=emptyCompany();data.employees.push(person('e'+i,'موظف '+i,c));if(i===0)data.docs.push({id:'d1',name:'وثيقة خاصة',kind:'رخصة',company:c,expiry:'2026-09-22'});const result=await request('/api/state','PUT',{company:c,revision:state.revisions[c],data},admin);assert.equal(result.status,200);state=result.body;}
 assert.equal((await request('/api/state','PUT',{company:COMPANIES[0],revision:0,data:state.stores[COMPANIES[0]]},admin)).status,409);
 assert.equal((await request('/api/state','PUT',{company:COMPANIES[0],revision:state.revisions[COMPANIES[0]],data:state.stores[COMPANIES[0]]},{cookie:admin.cookie})).status,403);
 const employeeSessions=[];
 for(const [i,c] of COMPANIES.entries()){const id='200000000'+(i+1);const result=await request('/api/accounts/issue','POST',{identity:id,company:c,employeeId:'e'+i},admin);assert.equal(result.status,200);const code=result.body.code;assert.equal((await request('/api/activate','POST',{identity:id,code:'WRONG',password:'Employee-password-42'})).status,400);assert.equal((await request('/api/activate','POST',{identity:id,code,password:'Employee-password-42'})).status,200);assert.equal((await request('/api/activate','POST',{identity:id,code,password:'Employee-password-42'})).status,400);const resultLogin=await request('/api/login','POST',{identity:id,password:'Employee-password-42'});employeeSessions.push({cookie:resultLogin.cookie,csrf:resultLogin.body.csrf});}
 const emp=employeeSessions[0];let own=(await request('/api/state','GET',undefined,emp)).body;assert.deepEqual(Object.keys(own.stores),[COMPANIES[0]]);assert.equal(own.stores[COMPANIES[0]].docs.length,0);assert.equal(JSON.stringify(own).includes('وثيقة خاصة'),false);assert.equal(JSON.stringify(own).includes('password_hash'),false);
 assert.equal((await request('/api/accounts/issue','POST',{identity:'2000000033',company:COMPANIES[0],employeeId:'e0'},emp)).status,403);
 assert.equal((await request('/api/state','PUT',{company:COMPANIES[1],revision:1,data:emptyCompany()},emp)).status,403);
 const forged=structuredClone(own.stores[COMPANIES[0]]);forged.docs.push({id:'bad',name:'مزورة',kind:'رخصة'});assert.equal((await request('/api/state','PUT',{company:COMPANIES[0],revision:own.revisions[COMPANIES[0]],data:forged},emp)).status,403);
 let data=own.stores[COMPANIES[0]];data.leaves.push({id:'leave-1',employee:'موظف 0',type:'سنوية',start:'2026-10-01',end:'2026-10-02',status:'بانتظار الاعتماد',created:0});const saved=await request('/api/state','PUT',{company:COMPANIES[0],revision:own.revisions[COMPANIES[0]],data},emp);assert.equal(saved.status,200);own=saved.body;assert(own.stores[COMPANIES[0]].leaves[0].created>0);assert.equal(own.stores[COMPANIES[0]].leaves[0].employeeId,'e0');
 const approved=structuredClone(own.stores[COMPANIES[0]]);approved.leaves[0].status='مقبولة';assert.equal((await request('/api/state','PUT',{company:COMPANIES[0],revision:own.revisions[COMPANIES[0]],data:approved},emp)).status,403);
 service.schedule(new Date('2026-09-15T12:00:00Z'));const queued=db.prepare('SELECT count(*) AS n FROM outbox').get().n;service.schedule(new Date('2026-09-15T12:00:00Z'));assert.equal(db.prepare('SELECT count(*) AS n FROM outbox').get().n,queued);await service.dispatch();assert(deliveries>0);const sent=deliveries;await service.dispatch();assert.equal(deliveries,sent);
 assert.equal((await request('/api/logout','POST',{},emp)).status,200);assert.equal((await request('/api/state','GET',undefined,emp)).status,401);
});
