const labels={leave_created:'طلب إجازة جديد',leave_escalated:'طلب إجازة يحتاج اعتماد المسؤول الأعلى',document_expiry:'موعد تجديد وثيقة',task_created:'مهمة جديدة',employee_created:'إضافة ملف موظف',test:'اختبار ربط التنبيهات'};
export function notificationText(event,portalUrl){
 if(!labels[event.type]||!event.id||typeof event.company!=='string'||event.company.length>100)throw Error('Invalid notification event');
 if(!portalUrl)return `${labels[event.type]}\nالشركة: ${event.company}\nراجع التفاصيل داخل المنصة.`;
 const url=new URL(portalUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Portal URL must be HTTPS without credentials or query parameters');
 return `${labels[event.type]}\nالشركة: ${event.company}\nراجع التفاصيل داخل البوابة:\n${url.href}`;
}
export async function sendTelegram(event,{token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_CHAT_ID,portalUrl=process.env.PORTAL_URL,fetchImpl=fetch}={}){
 if(!token||!chatId)throw Error('Telegram configuration is incomplete');
 const text=notificationText(event,portalUrl);
 let response;try{response=await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(15000)});}catch{throw Error('Telegram connection failed; delivery is uncertain');}
 let result;try{result=await response.json();}catch{throw Error('Invalid Telegram response');}
 if(!response.ok||!result.ok){const error=new Error('Telegram rejected notification');error.retryAfter=Number(result.parameters?.retry_after)||60;throw error;}
 return {messageId:result.result.message_id};
}
