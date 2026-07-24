'use client';
// components/pm/ActorBar.jsx — يحدد "من يتصرف الآن" لأغراض تطبيق مصفوفة الصلاحيات (lib/pm/roles.js).
// تنبيه شفاف: هذا اختيار من المتصفح وليس تسجيل دخول حقيقياً - انظر ملاحظة RBAC في README.

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getActor, setActorInfo, ROLE_LABELS } from '@/lib/pmApi.js';

const ROLE_OPTIONS = Object.entries(ROLE_LABELS);

export default function ActorBar() {
  const [actor, setActor] = useState('');
  const [role, setRole] = useState('project_manager');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const info = getActor();
    setActor(info.actor || '');
    setRole(info.actor_role || 'project_manager');
  }, []);

  function save(nextActor, nextRole) {
    setActorInfo({ actor: nextActor, actor_role: nextRole });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:border-navy-300 transition-colors"
        title="تحديد الدور الحالي لأغراض الصلاحيات"
      >
        <ShieldCheck size={13} className="text-navy-600" />
        <span>{ROLE_LABELS[role] || role}</span>
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-sheet border border-line bg-white shadow-sheet p-3 z-30 space-y-2">
          <div>
            <span className="block text-xs font-medium text-ink mb-1">الاسم</span>
            <input
              value={actor}
              onChange={(e) => { setActor(e.target.value); save(e.target.value, role); }}
              placeholder="اسمك (اختياري)"
              className="w-full rounded-md border border-line px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
            />
          </div>
          <div>
            <span className="block text-xs font-medium text-ink mb-1">الدور الحالي</span>
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value); save(actor, e.target.value); }}
              className="w-full rounded-md border border-line px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
            >
              {ROLE_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-ink-soft leading-relaxed">
            يحدّد هذا الدور صلاحياتك الفعلية (عرض/تعديل/حذف/اعتماد) في كل شاشات القسم - بلا نظام تسجيل دخول حقيقي بعد.
          </p>
        </div>
      )}
    </div>
  );
}
