'use client';
import { useEffect, useState, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/equipmentApi.js';

export default function NotificationsBell({ equipmentId } = {}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);

  async function load() {
    try {
      const res = await listNotifications({ equipment_id: equipmentId, pageSize: 30 });
      setNotifications(res.rows || []);
      setUnreadCount(res.unread || 0);
    } catch {
      /* صامت - لا نعطّل الواجهة إن فشل تحميل التنبيهات */
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => { clearInterval(interval); document.removeEventListener('mousedown', onClickOutside); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId]);

  async function handleMarkRead(id) {
    await markNotificationRead(id);
    load();
  }

  async function handleMarkAll() {
    await markAllNotificationsRead(equipmentId);
    load();
  }

  const sevColor = { critical: 'bg-fail', warning: 'bg-warnclr', info: 'bg-navy' };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative p-2 rounded-md hover:bg-line text-ink-soft hover:text-ink transition-colors">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 bg-fail text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-sheet border border-line rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line sticky top-0 bg-sheet">
            <span className="text-sm font-bold text-ink">تنبيهات المعدات</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-navy hover:underline flex items-center gap-1">
                <Check size={12} /> تعليم الكل كمقروء
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-ink-soft">لا توجد تنبيهات حالياً</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                className={`w-full text-right px-3 py-2.5 border-b border-line last:border-0 hover:bg-line/50 transition-colors ${n.is_read ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${sevColor[n.severity] || 'bg-navy'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink truncate">{n.title}</div>
                    {n.message && <div className="text-[11px] text-ink-soft mt-0.5 line-clamp-2">{n.message}</div>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
