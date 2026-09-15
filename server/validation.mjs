import {KINDS} from './database.mjs';
export function fail(message,status=400){throw Object.assign(new Error(message),{status});}
const text=(v,max=200)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function validateRecord(kind,r,company){
 if(!r||typeof r!=='object'||Array.isArray(r)||!text(r.id,100))fail('رقم السجل غير صالح.');
 if(JSON.stringify(r).length>1500000)fail('حجم السجل أكبر من المسموح.');
 if(r.company!==undefined&&r.company!==company)fail('السجل لا يتبع الشركة المحددة.',403);
 if(kind==='employees'&&(!text(r.name)||!text(r.branch)||!text(r.dept)||!text(r.job)||!text(r.manager)||!['مكتبي','ميداني'].includes(r.mode)))fail('أكمل بيانات الموظف ونمط عمله.');
 if(kind==='leaves'&&(!text(r.employee)||!['سنوية','مرضية','اضطرارية'].includes(r.type)||!date(r.start)||!date(r.end)||r.start>r.end||!['بانتظار الاعتماد','مقبولة','مرفوضة'].includes(r.status)))fail('بيانات طلب الإجازة غير صالحة.');
 if(kind==='docs'&&(!text(r.name)||!text(r.kind)||r.expiry&&!date(r.expiry)))fail('بيانات الوثيقة أو تاريخها غير صالح.');
 if(kind==='cars'&&(!text(r.plate)||!text(r.holder)||['registration','insurance','inspection'].some(k=>r[k]&&!date(r[k]))))fail('بيانات السيارة غير صالحة.');
 if(kind==='sales'&&(!text(r.supervisor)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period)||!Number.isFinite(r.target)||r.target<=0||!Number.isFinite(r.actual)||r.actual<0))fail('بيانات المبيعات غير صالحة.');
 if(kind==='tasks'&&(!text(r.title)||!text(r.assignee)||!date(r.due)||!['جديدة','قيد التنفيذ','مكتملة'].includes(r.status)))fail('بيانات المهمة غير صالحة.');
 if(kind==='uploads'){
  if(!text(r.employeeId)||!text(r.name)||!text(r.description)||typeof r.data!=='string')fail('بيانات المرفق غير صالحة.');
  const match=r.data.match(/^data:(application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/);if(!match)fail('نوع المرفق غير مدعوم.');const b=Buffer.from(match[2],'base64');
  if(b.length>1024*1024||!(match[1]==='application/pdf'&&b.subarray(0,5).toString()==='%PDF-'||match[1]==='image/png'&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71||match[1]==='image/jpeg'&&b[0]===255&&b[1]===216))fail('محتوى المرفق أو حجمه غير صالح.');
 }
}
export function validateData(data,company){if(!data||typeof data!=='object')fail('بيانات غير صالحة.');for(const k of KINDS){if(!Array.isArray(data[k])||data[k].length>2000)fail('عدد السجلات غير صالح.');const ids=new Set();for(const r of data[k]){validateRecord(k,r,company);if(ids.has(r.id))fail('رقم سجل مكرر.');ids.add(r.id);}}}
export function employeeView(data,user){const person=data.employees.find(e=>e.id===user.employee_id);if(!person)fail('الحساب لم يعد مرتبطًا بموظف.',403);return{employees:[person],docs:[],cars:[],sales:[],leaves:data.leaves.filter(l=>l.employeeId===person.id),tasks:data.tasks.filter(t=>t.employeeId===person.id),uploads:data.uploads.filter(u=>u.employeeId===person.id)};}
export function mergeEmployeeChange(current,incoming,user){
 const own=employeeView(current,user),person=own.employees[0],result=structuredClone(current);
 for(const k of ['employees','docs','cars','sales'])if(JSON.stringify(incoming[k])!==JSON.stringify(own[k]))fail('لا تملك صلاحية تعديل هذه البيانات.',403);
 for(const k of ['leaves','tasks','uploads']){
  const old=new Map(own[k].map(r=>[r.id,r]));if([...old.keys()].some(id=>!incoming[k].some(r=>r.id===id)))fail('الحذف غير مسموح للموظف.',403);
  for(const proposed of incoming[k]){
   const prior=old.get(proposed.id);if(prior&&JSON.stringify(prior)===JSON.stringify(proposed))continue;
   if(k==='tasks'){
    if(!prior)fail('إضافة المهام للإدارة فقط.',403);const allowed=prior.status==='جديدة'?'قيد التنفيذ':prior.status==='قيد التنفيذ'?'مكتملة':null;
    if(proposed.status!==allowed||JSON.stringify({...proposed,status:prior.status})!==JSON.stringify(prior))fail('يمكنك تحديث حالة مهمتك فقط.',403);
    result.tasks[result.tasks.findIndex(t=>t.id===prior.id)]=proposed;
   }else{
    if(prior||current[k].some(r=>r.id===proposed.id))fail('لا يمكن تعديل سجل قائم.',403);
    if(k==='leaves'){
     if(proposed.employee!==person.name||proposed.status!=='بانتظار الاعتماد')fail('طلب إجازة غير مسموح.',403);
     result.leaves.push({id:proposed.id,employee:person.name,employeeId:person.id,type:proposed.type,start:proposed.start,end:proposed.end,created:Date.now(),status:'بانتظار الاعتماد'});
    }else{if(proposed.employeeId!==person.id)fail('المرفق لا يخص حسابك.',403);result.uploads.push({...proposed,date:new Date().toISOString().slice(0,10)});}
   }
  }
 }
 return result;
}
