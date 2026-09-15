import {sendTelegram} from './telegram.mjs';
try{await sendTelegram({id:'manual-test',type:'test',company:'المجموعة'});console.log('Test message sent.');}catch(error){console.error(error.message);process.exitCode=1;}
