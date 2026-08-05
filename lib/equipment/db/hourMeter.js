// lib/equipment/db/hourMeter.js
// عداد ساعات التشغيل (Hour Meter) - البند 8. مصدر واحد للحقيقة: كل قراءة تمر من هنا وتُحدّث
// equipment_assets.current_hour_meter تلقائياً، حتى لو أتت من سجل تشغيل (operations.js) أو
// إدخال يدوي مباشر. "منع إدخال قراءة أقل من القراءة السابقة إلا بصلاحية خاصة مع تسجيل السبب".
import { edb } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { updateHourMeterCache } from './equipment.js';
import { writeAudit } from './audit.js';

export function recordHourMeterReading(equipmentId, value, { source = 'manual', recordedBy = null, overrideReason = null, readingDate = null, allowBackward = false } = {}) {
  const db = edb();
  const equipment = db.prepare(`SELECT id, current_hour_meter FROM equipment_assets WHERE id = ?`).get(equipmentId);
  if (!equipment) throw new Error('المعدة غير موجودة.');
  const previous = Number(equipment.current_hour_meter) || 0;
  const reading = Number(value);
  if (Number.isNaN(reading)) throw new ValidationError('قراءة العداد غير صالحة.', ['يجب إدخال رقم صالح لقراءة العداد.']);

  if (reading < previous) {
    if (!allowBackward) {
      throw new ValidationError(
        'القراءة الجديدة أقل من القراءة السابقة.',
        [`القراءة السابقة ${previous} أكبر من القراءة المُدخلة ${reading}. هذا يتطلب صلاحية خاصة وسبباً موثّقاً.`]
      );
    }
    if (!overrideReason) {
      throw new ValidationError('سبب التعديل مطلوب.', ['يجب تسجيل سبب إدخال قراءة أقل من القراءة السابقة (مثال: استبدال العداد).']);
    }
  }

  const delta = Math.max(0, reading - previous);
  const info = db.prepare(`
    INSERT INTO equipment_hour_meter_readings (equipment_id, reading_value, previous_value, delta_hours, reading_date, source, recorded_by, override_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(equipmentId, reading, previous, delta, readingDate || new Date().toISOString().slice(0, 10), source, recordedBy, overrideReason);

  updateHourMeterCache(equipmentId, reading);
  writeAudit({
    equipment_id: equipmentId, entity_type: 'hour_meter_reading', entity_id: info.lastInsertRowid, action: 'create',
    before: { current_hour_meter: previous }, after: { current_hour_meter: reading }, actor: recordedBy,
  });
  return db.prepare(`SELECT * FROM equipment_hour_meter_readings WHERE id = ?`).get(info.lastInsertRowid);
}

export function listReadings(equipmentId, { page = 1, pageSize = 50 } = {}) {
  const db = edb();
  const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_hour_meter_readings WHERE equipment_id = ?`).get(equipmentId).n;
  const rows = db.prepare(`SELECT * FROM equipment_hour_meter_readings WHERE equipment_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(equipmentId, size, offset);
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

/** إجمالي ساعات التشغيل خلال فترة، من فروقات القراءات (أدق من جمع سجلات التشغيل وحدها). */
export function sumHoursInPeriod(equipmentId, fromDate, toDate) {
  const db = edb();
  const params = { equipmentId, fromDate: fromDate || '0000-01-01', toDate: toDate || '9999-12-31' };
  const row = db.prepare(`
    SELECT COALESCE(SUM(delta_hours), 0) AS total FROM equipment_hour_meter_readings
    WHERE equipment_id = @equipmentId AND reading_date >= @fromDate AND reading_date <= @toDate
  `).get(params);
  return Number(row.total) || 0;
}
