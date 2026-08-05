import { NextResponse } from 'next/server';
import { hdb } from '@/lib/hse/schema.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';
import { ValidationError } from '@/lib/calc/common.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_inspection', 'view');
    const category = searchParams.get('category');
    const db = hdb();
    const templates = category
      ? db.prepare(`SELECT * FROM hse_checklist_templates WHERE category = ? ORDER BY name`).all(category)
      : db.prepare(`SELECT * FROM hse_checklist_templates ORDER BY name`).all();
    return NextResponse.json({ success: true, templates: templates.map((t) => ({ ...t, items: JSON.parse(t.items_json || '[]') })) });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_inspection', 'create');
    if (!body.name || !Array.isArray(body.items) || body.items.length === 0) {
      throw new ValidationError('اسم القالب وبند واحد على الأقل مطلوبان.');
    }
    const db = hdb();
    const info = db.prepare(`INSERT INTO hse_checklist_templates (name, category, items_json, is_default, created_by) VALUES (?, ?, ?, ?, ?)`)
      .run(body.name, body.category || null, JSON.stringify(body.items), body.is_default ? 1 : 0, actor);
    const template = db.prepare(`SELECT * FROM hse_checklist_templates WHERE id = ?`).get(info.lastInsertRowid);
    return NextResponse.json({ success: true, template: { ...template, items: JSON.parse(template.items_json) } }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
