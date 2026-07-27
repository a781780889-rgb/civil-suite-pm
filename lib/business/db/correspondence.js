// lib/business/db/correspondence.js — إدارة المراسلات، البند الحادي عشر من القواعد الإلزامية.
import { randomUUID } from 'crypto';
import { bdb, CORRESPONDENCE_STATUSES } from '../schema.js';
import { writeBizAudit } from './audit.js';

const FIELDS = ['ref_no', 'direction', 'client_id', 'contract_id', 'opportunity_id', 'project_id', 'subject', 'body', 'sender', 'recipient', 'correspondence_date'];

export function createCorrespondence(data) {
  const db = bdb();
  const run = db.transaction(() => {
    if (!data.subject) throw new Error('موضوع المراسلة مطلوب.');
    const uuid = randomUUID();
    const payload = Object.fromEntries(FIELDS.map((f) => [f, data[f] !== undefined ? data[f] : null]));
    payload.direction = payload.direction || 'outgoing';
    const info = db
      .prepare(`INSERT INTO biz_correspondence (uuid, status, ${FIELDS.join(', ')}) VALUES (@uuid, 'open', ${FIELDS.map((f) => '@' + f).join(', ')})`)
      .run({ uuid, ...payload });
    const created = getCorrespondenceById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'correspondence', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateCorrespondence(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getCorrespondenceById(id);
    if (!before) throw new Error('المراسلة غير موجودة.');
    const merged = { ...before, ...data };
    const payload = Object.fromEntries(FIELDS.map((f) => [f, merged[f] !== undefined ? merged[f] : null]));
    const status = CORRESPONDENCE_STATUSES.includes(merged.status) ? merged.status : before.status;
    db.prepare(`UPDATE biz_correspondence SET ${FIELDS.map((f) => `${f}=@${f}`).join(', ')}, status=@status, updated_at=datetime('now') WHERE id=@id`).run({ ...payload, status, id });
    const after = getCorrespondenceById(id);
    writeBizAudit(db, { entity_type: 'correspondence', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function getCorrespondenceById(id) {
  return bdb().prepare(`SELECT co.*, c.name AS client_name FROM biz_correspondence co LEFT JOIN biz_clients c ON c.id = co.client_id WHERE co.id = ?`).get(id);
}

export function listCorrespondencePaged({ status, direction, client_id, contract_id, search, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (status) { where += ' AND co.status = @status'; params.status = status; }
  if (direction) { where += ' AND co.direction = @direction'; params.direction = direction; }
  if (client_id) { where += ' AND co.client_id = @client_id'; params.client_id = client_id; }
  if (contract_id) { where += ' AND co.contract_id = @contract_id'; params.contract_id = contract_id; }
  if (search) { where += ' AND (co.subject LIKE @search OR co.ref_no LIKE @search)'; params.search = `%${search}%`; }
  const base = ` FROM biz_correspondence co LEFT JOIN biz_clients c ON c.id = co.client_id${where}`;
  const total = db.prepare(`SELECT COUNT(*) AS n${base}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT co.*, c.name AS client_name${base} ORDER BY co.correspondence_date DESC, co.created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

export function deleteCorrespondence(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getCorrespondenceById(id);
    if (!before) return { deleted: false };
    writeBizAudit(db, { entity_type: 'correspondence', entity_id: id, action: 'delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_correspondence WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}
