// Run manually after you start your bot. Never prints the bot token.
const token=process.env.TELEGRAM_BOT_TOKEN;
if(!token){console.error('Set TELEGRAM_BOT_TOKEN in server/.env first.');process.exitCode=1;}else{
 try{const r=await fetch(`https://api.telegram.org/bot${token}/getUpdates`,{signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok||!data.ok)throw Error();const chats=new Map();for(const update of data.result){const chat=update.message?.chat;if(chat?.type==='private')chats.set(chat.id,chat);}if(!chats.size)console.log('No private chats found. Press Start in your new bot, then retry.');else for(const chat of chats.values())console.log(`Chat ID: ${chat.id} (${chat.first_name||'private chat'})`);}catch{console.error('Could not read bot updates. Check token/network and whether another service uses polling or a webhook.');process.exitCode=1;}
}
