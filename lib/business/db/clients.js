// lib/business/db/clients.js — إدارة العملاء (CRM)، البند الثاني من القواعد الإلزامية.
import { randomUUID } from 'crypto';
import { bdb, CLIENT_STATUSES, CLIENT_TYPES } from '../schema.js';
import { writeBizAudit } from './audit.js';

const FIELDS = [
  'client_code', 'name', 'client_type', 'status', 'phone', 'email', 'website',
  'address', 'city', 'country', 'contact_person', 'contact_title', 'rating', 'source', 'notes',
];

function normalize(data) {
  const out = {};
  for (const f of FIELDS) out[f] = data[f] !== undefined ? data[f] : null;
  if (!out.name) throw new Error('اسم العميل مطلوب.');
  out.client_type = CLIENT_TYPES.includes(out.client_type) ? out.client_type : 'company';
  out.status = CLIENT_STATUSES.includes(out.status) ? out.status : 'active';
  out.rating = out.rating === null || out.rating === '' ? null : Math.max(1, Math.min(5, Number(out.rating)));
  return out;
}

/** يمنع تكرار العميل نفسه (البند الثاني) - بحسب رقم العميل الفريد إن وُجد، وإلا الاسم + الهاتف/الإيميل معاً. */
export function findDuplicateClient({ client_code, name, phone, email }, excludeId) {
  const db = bdb();
  if (client_code) {
    const row = excludeId
      ? db.prepare(`SELECT * FROM biz_clients WHERE client_code = @c AND id != @id`).get({ c: client_code, id: excludeId })
      : db.prepare(`SELECT * FROM biz_clients WHERE client_code = @c`).get({ c: client_code });
    if (row) return row;
  }
  if (name && (phone || email)) {
    const params = { name, phone: phone || null, email: email || null, id: excludeId || 0 };
    const row = db
      .prepare(`SELECT * FROM biz_clients WHERE lower(name) = lower(@name) AND (phone = @phone OR email = @email) AND id != @id`)
      .get(params);
    if (row) return row;
  }
  return null;
}

export function createClient(data) {
  const db = bdb();
  const run = db.transaction(() => {
    const n = normalize(data);
    const uuid = randomUUID();
    const info = db
      .prepare(`INSERT INTO biz_clients (uuid, ${FIELDS.join(', ')}) VALUES (@uuid, ${FIELDS.map((f) => '@' + f).join(', ')})`)
      .run({ uuid, ...n });
    const created = getClientById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'client', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateClient(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getClientById(id);
    if (!before) throw new Error('العميل غير موجود.');
    const merged = { ...before, ...data };
    const n = normalize(merged);
    db.prepare(`UPDATE biz_clients SET ${FIELDS.map((f) => `${f}=@${f}`).join(', ')}, updated_at=datetime('now') WHERE id=@id`).run({ ...n, id });
    const after = getClientById(id);
    writeBizAudit(db, { entity_type: 'client', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function getClientById(id) {
  return bdb().prepare(`SELECT * FROM biz_clients WHERE id = ?`).get(id);
}

export function listClientsPaged({ status, client_type, search, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (client_type) { where += ' AND client_type = @client_type'; params.client_type = client_type; }
  if (search) { where += ' AND (name LIKE @search OR client_code LIKE @search OR phone LIKE @search OR email LIKE @search)'; params.search = `%${search}%`; }
  const total = db.prepare(`SELECT COUNT(*) AS n FROM biz_clients${where}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT * FROM biz_clients${where} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

/** أرشفة منطقية (تعطيل) بدل حذف فعلي - يحافظ على تتبّع كل العقود/الفواتير المرتبطة تاريخياً. */
export function setClientStatus(id, status, actor) {
  if (!CLIENT_STATUSES.includes(status)) throw new Error(`حالة عميل غير معروفة: ${status}`);
  const db = bdb();
  const run = db.transaction(() => {
    const before = getClientById(id);
    if (!before) throw new Error('العميل غير موجود.');
    db.prepare(`UPDATE biz_clients SET status=@status, updated_at=datetime('now') WHERE id=@id`).run({ id, status });
    const after = getClientById(id);
    writeBizAudit(db, { entity_type: 'client', entity_id: id, action: 'status_change', before: { status: before.status }, after: { status }, actor });
    return after;
  });
  return run();
}

export function hardDeleteClient(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getClientById(id);
    if (!before) return { deleted: false };
    const linked = db.prepare(`SELECT COUNT(*) AS n FROM biz_contracts WHERE client_id = ?`).get(id).n
      + db.prepare(`SELECT COUNT(*) AS n FROM biz_quotes WHERE client_id = ?`).get(id).n;
    if (linked > 0) throw new Error('لا يمكن حذف عميل مرتبط بعقود أو عروض أسعار فعلية - استخدم الأرشفة (تغيير الحالة إلى غير نشط) بدلاً من ذلك.');
    writeBizAudit(db, { entity_type: 'client', entity_id: id, action: 'hard_delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_clients WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}

// ---- جهات الاتصال (Contacts) ----
export function listClientContacts(clientId) {
  return bdb().prepare(`SELECT * FROM biz_client_contacts WHERE client_id = ? ORDER BY is_primary DESC, id ASC`).all(clientId);
}

export function createClientContact(clientId, data) {
  const db = bdb();
  const run = db.transaction(() => {
    if (!getClientById(clientId)) throw new Error('العميل غير موجود.');
    if (data.is_primary) db.prepare(`UPDATE biz_client_contacts SET is_primary = 0 WHERE client_id = ?`).run(clientId);
    const uuid = randomUUID();
    const info = db
      .prepare(`INSERT INTO biz_client_contacts (uuid, client_id, name, title, phone, email, is_primary, notes) VALUES (@uuid, @client_id, @name, @title, @phone, @email, @is_primary, @notes)`)
      .run({ uuid, client_id: clientId, name: data.name, title: data.title || null, phone: data.phone || null, email: data.email || null, is_primary: data.is_primary ? 1 : 0, notes: data.notes || null });
    const created = db.prepare(`SELECT * FROM biz_client_contacts WHERE id = ?`).get(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'client_contact', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateClientContact(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = db.prepare(`SELECT * FROM biz_client_contacts WHERE id = ?`).get(id);
    if (!before) throw new Error('جهة الاتصال غير موجودة.');
    if (data.is_primary) db.prepare(`UPDATE biz_client_contacts SET is_primary = 0 WHERE client_id = ?`).run(before.client_id);
    const merged = { ...before, ...data };
    db.prepare(`UPDATE biz_client_contacts SET name=@name, title=@title, phone=@phone, email=@email, is_primary=@is_primary, notes=@notes WHERE id=@id`)
      .run({ id, name: merged.name, title: merged.title || null, phone: merged.phone || null, email: merged.email || null, is_primary: merged.is_primary ? 1 : 0, notes: merged.notes || null });
    const after = db.prepare(`SELECT * FROM biz_client_contacts WHERE id = ?`).get(id);
    writeBizAudit(db, { entity_type: 'client_contact', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function deleteClientContact(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = db.prepare(`SELECT * FROM biz_client_contacts WHERE id = ?`).get(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM biz_client_contacts WHERE id = ?`).run(id);
    writeBizAudit(db, { entity_type: 'client_contact', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}

/** كل الكيانات التجارية المرتبطة بعميل واحد - يبني "سجل كامل لجميع التعاملات" (البند الثاني). */
export function getClientFullHistory(clientId) {
  const db = bdb();
  return {
    contacts: listClientContacts(clientId),
    opportunities: db.prepare(`SELECT * FROM biz_opportunities WHERE client_id = ? ORDER BY created_at DESC`).all(clientId),
    quotes: db.prepare(`SELECT * FROM biz_quotes WHERE client_id = ? ORDER BY created_at DESC`).all(clientId),
    contracts: db.prepare(`SELECT * FROM biz_contracts WHERE client_id = ? ORDER BY created_at DESC`).all(clientId),
    correspondence: db.prepare(`SELECT * FROM biz_correspondence WHERE client_id = ? ORDER BY correspondence_date DESC, created_at DESC`).all(clientId),
    meetings: db.prepare(`SELECT * FROM biz_meetings WHERE client_id = ? ORDER BY meeting_date DESC`).all(clientId),
    workOrders: db.prepare(`SELECT * FROM biz_work_orders WHERE client_id = ? ORDER BY created_at DESC`).all(clientId),
  };
}
