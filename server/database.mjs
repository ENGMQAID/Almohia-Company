import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export const COMPANIES=['فايز المحيا للتجارة','أنيستيزيا'];
export const KINDS=['employees','leaves','docs','cars','sales','tasks','uploads'];
export const emptyCompany=()=>Object.fromEntries([...KINDS.map(k=>[k,[]]),['notifications',[]],['notificationReads',{}]]);
export function openDatabase(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS companies(name TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS records(company TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(company,kind,id),FOREIGN KEY(company) REFERENCES companies(name));
 CREATE TABLE IF NOT EXISTS users(identity_hash TEXT PRIMARY KEY,role TEXT NOT NULL,company TEXT,employee_id TEXT,salt TEXT,password_hash TEXT,iterations INTEGER,activation_hash TEXT,activation_expires INTEGER,UNIQUE(company,employee_id));
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,identity_hash TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,company TEXT NOT NULL,title TEXT NOT NULL,detail TEXT NOT NULL,route TEXT NOT NULL,employee_id TEXT,admin_only INTEGER NOT NULL,time TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS reads(identity_hash TEXT NOT NULL,notification_id TEXT NOT NULL,PRIMARY KEY(identity_hash,notification_id));
 CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,body TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,sent_at TEXT,error TEXT);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,company TEXT,time TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 for(const c of COMPANIES)db.prepare('INSERT OR IGNORE INTO companies(name) VALUES(?)').run(c);
 return db;
}
export function companyData(db,company){const data=emptyCompany();for(const r of db.prepare('SELECT kind,body FROM records WHERE company=?').all(company))data[r.kind].push(JSON.parse(r.body));return data;}
export function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
