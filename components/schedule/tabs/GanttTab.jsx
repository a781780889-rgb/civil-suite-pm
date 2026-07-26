'use client';
import { useEffect, useState, useCallback } from 'react';
import { schSchedules } from '@/lib/scheduleApi.js';
import { EmptyState } from '@/components/pm/Shared.jsx';
import ScheduleGanttChart from '@/components/schedule/ScheduleGanttChart.jsx';

export default function GanttTab({ schedule, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await schSchedules.gantt(schedule.id);
    if (res.success) setData(res);
    setLoading(false);
  }, [schedule.id]);

  useEffect(() => { load(); }, [load]);

  async function handleChanged() {
    await load();
    onChanged();
  }

  if (loading) return <div className="text-sm text-ink-soft">جارِ التحميل…</div>;
  if (!data || data.activities.length === 0) {
    return <EmptyState title="لا أنشطة بعد" message="أضف أنشطة من تبويب WBS ليظهر مخطط جانت." />;
  }
  return <ScheduleGanttChart schedule={data.schedule} activities={data.activities} relationships={data.relationships} onChanged={handleChanged} />;
}
