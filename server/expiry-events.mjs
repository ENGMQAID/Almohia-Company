// Feed this function trusted database records from the future backend scheduler.
export function expiryEvents(documents,today){
 const milestones=[60,30,7,0],now=Date.parse(today+'T00:00:00Z');if(!Number.isFinite(now))throw Error('Invalid today');
 return documents.flatMap(d=>{if(!d.id||!d.expiry)return[];const remaining=Math.round((Date.parse(d.expiry+'T00:00:00Z')-now)/86400000);return milestones.includes(remaining)?[{id:`expiry:${d.id}:${d.expiry}:${remaining}`,type:'document_expiry',company:d.company}]:[];});
}
