// Real API adapter. File-based previews keep the original local workflow.
if(window.SERVER_MODE){
 const uiRender=render,uiLogout=logoutDemo,empty=()=>({employees:[],leaves:[],docs:[],cars:[],sales:[],tasks:[],uploads:[],notifications:[],notificationReads:{}});
 let csrf='',revisions={},accountRows=[],saving=false;
 stores=Object.fromEntries(companies.map(c=>[c,empty()]));db=stores[companies[0]];
 async function api(path,{method='GET',body}={}){const response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'تعذر الاتصال بالخادم.'),{status:response.status});return result;}
 function applySnapshot(result){stores=Object.fromEntries(companies.map(c=>[c,result.stores[c]||empty()]));revisions=result.revisions;accountRows=result.accounts||[];if(selectedCompany)db=stores[selectedCompany];previousRecords=fingerprints();}
 access.login=async(identity,password)=>{try{const result=await api('login',{method:'POST',body:{identity,password}});csrf=result.csrf;applySnapshot(await api('state'));return result.account;}catch(error){if(error.status===401)return null;throw error;}};
 access.read=()=>accountRows;
 access.issue=async(identity,company,employeeId)=>{const result=await api('accounts/issue',{method:'POST',body:{identity,company,employeeId}});applySnapshot(await api('state'));return result.code;};
 access.activate=(identity,code,password)=>api('activate',{method:'POST',body:{identity,code,password}});
 save=async function(){if(saving){toast('انتظر اكتمال الحفظ الحالي.');return false;}if(!account||!selectedCompany)return false;saving=true;window.serverSaveBusy=true;document.body.classList.add('server-saving');
  try{const result=await api('state',{method:'PUT',body:{company:selectedCompany,revision:revisions[selectedCompany],data:db}});applySnapshot(result);return true;}catch(error){try{applySnapshot(await api('state'));}catch{account=null;selectedCompany=null;}toast(error.message);return false;}finally{saving=false;window.serverSaveBusy=false;document.body.classList.remove('server-saving');}
 };
 logoutDemo=async function(){try{await api('logout',{method:'POST',body:{}});csrf='';accountRows=[];stores=Object.fromEntries(companies.map(c=>[c,empty()]));uiLogout();}catch(error){toast(error.message);}};
 render=function(){uiRender();document.querySelectorAll('.auth-local').forEach(e=>e.textContent='يتم التحقق من الحساب في الخادم.');document.querySelectorAll('.demo').forEach(e=>e.textContent='متصل بالخادم — البيانات محفوظة في قاعدة البيانات.');document.querySelectorAll('.gate-note,.private-note,.notice').forEach(e=>{if(e.textContent.includes('هذه التجربة تتم')||e.textContent.includes('الحماية الحقيقية')||e.textContent.includes('المتصفح والجهاز نفسيهما'))e.textContent='الحسابات والبيانات مرتبطة بالخادم، ويمكن الدخول من الأجهزة المسموح لها بالوصول إلى رابط المنصة.';});if(page==='telegram'&&account?.role==='admin')api('telegram/status').then(s=>{const area=document.querySelector('#content .notice');if(area)area.textContent=`تلجرام: ${s.enabled&&s.configured?'مفعّل أثناء تشغيل الخادم':'غير مفعّل'} · أرسلت ${s.sent} إشعارات · ${s.pending} بانتظار الإرسال. تشغيله المستمر يحتاج استضافة دائمة.`;}).catch(()=>{});};
 window.removeEventListener('hashchange',uiRender);window.addEventListener('hashchange',render);
 const originalToast=toast;toast=function(message){originalToast(String(message).replace('في النسخة التجريبية','في الخادم').replace('تم الاستيراد المحلي','تم الاستيراد إلى الخادم').replace('حُفظ المرفق محليًا','حُفظ المرفق في الخادم').replace('سُجّل القرار التجريبي','سُجّل القرار في الخادم'));};
 gate('<div class="gate-intro"><h1>جارٍ الاتصال بالبوابة…</h1></div>');
 api('session').then(async result=>{csrf=result.csrf;applySnapshot(await api('state'));enterAccount(result.account);}).catch(error=>{if(error.status===401)render();else gate('<div class="gate-intro"><h1>تعذر الاتصال بالخادم</h1><p>حدّث الصفحة بعد التحقق من تشغيل الخدمة.</p></div>');});
 window.addEventListener('beforeunload',event=>{if(saving){event.preventDefault();event.returnValue='';}});
 let polling=false;
 setInterval(async()=>{
  if(polling||saving||!account||$('#dialog').open||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  polling=true;
  try{const result=await api('state');const before=JSON.stringify({revisions,notes:companies.map(c=>stores[c].notifications)});const after=JSON.stringify({revisions:result.revisions,notes:companies.map(c=>result.stores[c]?.notifications||[])});if(before!==after){applySnapshot(result);render();}}
  catch(error){if(error.status===401){csrf='';account=null;selectedCompany=null;render();toast('انتهت الجلسة. سجّل الدخول مجددًا.');}}
  finally{polling=false;}
 },30000);
}
