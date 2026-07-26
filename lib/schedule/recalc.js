// lib/schedule/recalc.js
// =============================================================================
// منسّق إعادة الحساب - يُستدعى بعد أي تعديل على أنشطة/علاقات/تواريخ (القاعدة السادسة:
// "إعادة الحساب تلقائياً عند أي تعديل"). يجمع الأنشطة والعلاقات والتقويم، يشغّل محرك
// المسار الحرج، يكتب النتائج المحسوبة على sch_activities، ويُطلق تنبيهات حقيقية
// (تأخر/اقتراب بداية أو نهاية/تجاوز تاريخ التسليم المستهدف) عبر جدول pm_notifications
// المركزي الموجود أصلاً - تكامل حقيقي لا تكراراً لجدول تنبيهات منفصل.
// =============================================================================

import { sdb } from './schema.js';
import { listActivities, writeComputedFields } from './db/activities.js';
import { listRelationships } from './db/relationships.js';
import { getCalendar, listExceptions } from './db/calendars.js';
import { computeCriticalPath } from './criticalPath.js';
import { normalizeCalendar, DEFAULT_CALENDAR, todayStr } from './calendar.js';
import { upsertNotification } from '../pm/db/notifications.js';

export function recalculateSchedule(scheduleId) {
  const db = sdb();
  const schedule = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(scheduleId);
  if (!schedule) throw new Error('الجدول الزمني غير موجود.');

  const activities = listActivities(scheduleId);
  const relationships = listRelationships(scheduleId);

  const calendarRow = schedule.calendar_id ? getCalendar(schedule.calendar_id) : null;
  const exceptions = calendarRow ? listExceptions(calendarRow.id) : [];
  const calendar = calendarRow ? normalizeCalendar(calendarRow, exceptions) : DEFAULT_CALENDAR;

  const anchor = schedule.data_date || todayStr();
  const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: anchor, calendar });
  if (!result.ok) return result;

  writeComputedFields(scheduleId, result.schedule);
  raiseScheduleNotifications(schedule, activities, result);

  return result;
}

function raiseScheduleNotifications(schedule, activities, result) {
  const db = sdb();
  const today = todayStr();
  const soon = addDaysStr(today, 3);
  const byId = new Map(result.schedule.map((r) => [r.id, r]));
  const project = db.prepare(`SELECT id, end_date FROM projects WHERE id = ?`).get(schedule.project_id);

  for (const a of activities) {
    if (a.activity_type === 'summary') continue;
    const computed = byId.get(a.id);
    const endDate = a.planned_end || computed?.earlyFinishInclusive;

    if (a.status !== 'completed' && endDate && endDate < today) {
      upsertNotification({
        project_id: schedule.project_id, type: 'schedule_activity_delayed', severity: 'warning',
        title: `تأخر نشاط: ${a.name}`,
        message: `النشاط "${a.name}"${a.wbs_code ? ` (${a.wbs_code})` : ''} تجاوز تاريخه المخطط (${endDate}) ولم يكتمل بعد.`,
        related_entity_type: 'sch_activity', related_entity_id: a.id,
        dedup_key: `sch_delay_${a.id}_${endDate}`,
      });
    }
    if (a.status === 'not_started' && a.planned_start && a.planned_start >= today && a.planned_start <= soon) {
      upsertNotification({
        project_id: schedule.project_id, type: 'schedule_activity_starting_soon', severity: 'info',
        title: `اقتراب بداية نشاط: ${a.name}`,
        message: `النشاط "${a.name}" مجدوَل ليبدأ في ${a.planned_start}.`,
        related_entity_type: 'sch_activity', related_entity_id: a.id,
        dedup_key: `sch_start_soon_${a.id}_${a.planned_start}`,
      });
    }
    if (a.status === 'in_progress' && endDate && endDate >= today && endDate <= soon) {
      upsertNotification({
        project_id: schedule.project_id, type: 'schedule_activity_ending_soon', severity: 'info',
        title: `اقتراب نهاية نشاط: ${a.name}`,
        message: `النشاط "${a.name}" من المتوقع انتهاؤه في ${endDate}.`,
        related_entity_type: 'sch_activity', related_entity_id: a.id,
        dedup_key: `sch_end_soon_${a.id}_${endDate}`,
      });
    }
  }

  if (project?.end_date && result.projectEndDate && result.projectEndDate > project.end_date) {
    upsertNotification({
      project_id: schedule.project_id, type: 'schedule_exceeds_target', severity: 'critical',
      title: 'الجدول الزمني يتجاوز تاريخ التسليم المستهدف',
      message: `التاريخ المتوقع لانتهاء آخر الأنشطة (${result.projectEndDate}) يتجاوز تاريخ تسليم المشروع المستهدف (${project.end_date}).`,
      related_entity_type: 'schedule', related_entity_id: schedule.id,
      dedup_key: `sch_exceeds_target_${schedule.id}_${result.projectEndDate}`,
    });
  }
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
