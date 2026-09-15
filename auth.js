'use strict';
// Local prototype only. Production authentication and authorization belong on a server.
class LocalAccounts {
  constructor(storage, bootstrap, employeeExists) {
    this.storage = storage;
    this.bootstrap = bootstrap;
    this.employeeExists = employeeExists;
    this.key = 'group-employee-access-v1';
    this.iterations = 210000;
  }
  normalizeIdentity(value) {
    return String(value).trim().replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
  }
  validIdentity(value) { return /^[12]\d{9}$/.test(this.normalizeIdentity(value)); }
  hex(bytes) { return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join(''); }
  random() { return this.hex(crypto.getRandomValues(new Uint8Array(16))); }
  async digest(value) { return this.hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
  async identityHash(value) { return this.digest(this.normalizeIdentity(value)); }
  async passwordHash(password, salt, iterations = this.iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return this.hex(await crypto.subtle.deriveBits({name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations, hash: 'SHA-256'}, key, 256));
  }
  read() {
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) throw Error('تعذر قراءة حسابات التجربة.');
    return records;
  }
  write(records) { this.storage.setItem(this.key, JSON.stringify(records)); }
  exists(record) { return this.employeeExists(record.company, record.employeeId); }
  async login(identity, password) {
    if (!this.validIdentity(identity)) return null;
    const hash = await this.identityHash(identity);
    const admin = this.bootstrap;
    if (admin && hash === admin.identityHash) {
      const result = await this.passwordHash(password, admin.salt, admin.iterations);
      return result === admin.passwordHash ? {role: 'admin'} : null;
    }
    const record = this.read().find(r => r.identityHash === hash);
    if (!record?.passwordHash || !this.exists(record)) return null;
    const result = await this.passwordHash(password, record.salt, record.iterations);
    if (result !== record.passwordHash) return null;
    return {role: 'employee', company: record.company, id: record.employeeId};
  }
  async issue(identity, company, employeeId) {
    if (!this.validIdentity(identity)) throw Error('أدخل رقم هوية أو إقامة من 10 أرقام يبدأ بـ 1 أو 2.');
    if (!this.employeeExists(company, employeeId)) throw Error('أضف الموظف في الشركة أولًا.');
    const hash = await this.identityHash(identity);
    if (hash === this.bootstrap?.identityHash) throw Error('هذا الرقم مستخدم لحساب الإدارة.');
    const records = this.read();
    if (records.some(r => r.identityHash === hash && (r.company !== company || r.employeeId !== employeeId))) throw Error('هذا الرقم مرتبط بموظف آخر.');
    if (records.some(r => r.company === company && r.employeeId === employeeId && r.passwordHash)) throw Error('حساب الموظف مفعّل بالفعل.');
    const code = this.random().slice(0, 16).toUpperCase();
    const record = {identityHash: hash, company, employeeId, activationHash: await this.digest(code), expires: Date.now() + 86400000};
    this.write([...records.filter(r => !(r.company === company && r.employeeId === employeeId)), record]);
    return code;
  }
  async activate(identity, code, password) {
    if (!this.validIdentity(identity) || password.length < 10 || password.length > 128) throw Error('تحقق من رقم الهوية، واجعل كلمة المرور بين 10 و128 حرفًا.');
    const hash = await this.identityHash(identity);
    const records = this.read();
    const record = records.find(r => r.identityHash === hash);
    const codeHash = await this.digest(code.trim().toUpperCase());
    if (!record || record.passwordHash || !this.exists(record) || !record.activationHash || record.expires <= Date.now() || record.activationHash !== codeHash) throw Error('بيانات التفعيل غير صحيحة أو انتهت صلاحية الرمز. راجع الموارد البشرية.');
    record.salt = this.random();
    record.iterations = this.iterations;
    record.passwordHash = await this.passwordHash(password, record.salt);
    delete record.activationHash;
    delete record.expires;
    this.write(records);
  }
}
globalThis.LocalAccounts = LocalAccounts;
