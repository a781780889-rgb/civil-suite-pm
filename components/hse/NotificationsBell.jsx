'use client';
import { useEffect, useState, useRef } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import * as hseApi from '@/lib/hseApi.js';

const SEVERITY_DOT = { critical: 'bg-fail-DEFAULT', warning: 'bg-warnclr-DEFAULT', info: 'bg-navy-400' };

export default function NotificationsBell({ projectId }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ rows: [], unread: 0 });
  const ref = useRef(null);

  async function load() {
    try {
      const res = await hseApi.listNotifications({ project_id: projectId, pageSize: 15 });
      setData(res);
    } catch { /* التنبيهات ميزة ثانوية - فشل تحميلها لا يجب أن يكسر بقية الواجهة */ }
  }

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [projectId]);
  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleRead(id) { await hseApi.markNotificationRead(id); load(); }
  async function handleReadAll() { await hseApi.markAllNotificationsRead(projectId); load(); }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-full p-2 text-ink-soft hover:bg-paper" aria-label="التنبيهات">
        <Bell size={20} />
        {data.unread > 0 && (
          <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fail-DEFAULT px-1 text-[10px] font-bold text-white">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-2 w-80 rounded-sheet border border-line bg-white shadow-sheet">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold text-navy-700">تنبيهات السلامة</span>
            {data.unread > 0 && (
              <button onClick={handleReadAll} className="flex items-center gap-1 text-xs text-navy-600 hover:underline">
                <CheckCheck size={13} /> تعليم الكل كمقروء
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.rows.length === 0 && <p className="p-4 text-center text-sm text-ink-soft">لا توجد تنبيهات حالياً.</p>}
            {data.rows.map((n) => (
              <div key={n.id} className={`flex items-start gap-2 border-b border-line px-3 py-2.5 ${n.is_read ? 'opacity-60' : ''}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[n.severity] || 'bg-navy-400'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  {n.message && <p className="mt-0.5 text-xs text-ink-soft">{n.message}</p>}
                </div>
                {!n.is_read && (
                  <button onClick={() => handleRead(n.id)} className="shrink-0 rounded p-1 text-ink-soft hover:bg-paper" title="تعليم كمقروء">
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
