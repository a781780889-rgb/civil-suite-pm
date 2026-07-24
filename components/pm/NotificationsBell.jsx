'use client';
// components/pm/NotificationsBell.jsx — يجلب تنبيهات حقيقية (مُشتقة + حدثية) من /api/pm/notifications.

import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Info, CheckCheck } from 'lucide-react';
import { pmNotifications } from '@/lib/pmApi.js';

export default function NotificationsBell({ projectId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await pmNotifications.list(projectId ? { project_id: projectId } : {});
    setLoading(false);
    if (res.success) setItems(res.notifications);
  }

  useEffect(() => { load(); }, [projectId]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  async function markRead(id) {
    await pmNotifications.markRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  }

  async function markAll() {
    if (!projectId) return;
    await pmNotifications.markAllRead(projectId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  }

  return (
    <div className="relative">
      <button onClick={() => { setOpen((v) => !v); if (!open) load(); }} className="relative rounded-md border border-line bg-white p-2 hover:border-navy-300 transition-colors">
        <Bell size={15} className="text-ink-soft" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 bg-fail-DEFAULT text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 w-80 max-h-96 overflow-y-auto rounded-sheet border border-line bg-white shadow-sheet z-30" onMouseLeave={() => setOpen(false)}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <span className="text-xs font-bold text-navy-700">التنبيهات</span>
            {projectId && unreadCount > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-[11px] text-navy-600 hover:underline"><CheckCheck size={12} /> تعليم الكل مقروء</button>
            )}
          </div>
          {loading && <p className="text-xs text-ink-soft p-3">جارِ التحميل…</p>}
          {!loading && items.length === 0 && <p className="text-xs text-ink-soft p-3">لا توجد تنبيهات حالياً.</p>}
          <div className="divide-y divide-line">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-right px-3 py-2.5 flex items-start gap-2 hover:bg-paper transition-colors ${!n.is_read ? 'bg-navy-50/40' : ''}`}
              >
                {n.severity === 'critical' || n.severity === 'warning' ? (
                  <AlertTriangle size={14} className={n.severity === 'critical' ? 'text-fail-DEFAULT mt-0.5 shrink-0' : 'text-warnclr-DEFAULT mt-0.5 shrink-0'} />
                ) : (
                  <Info size={14} className="text-navy-400 mt-0.5 shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-ink">{n.title}</span>
                  {n.message && <span className="block text-[11px] text-ink-soft mt-0.5 line-clamp-2">{n.message}</span>}
                </span>
                {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-navy-600 mt-1.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
