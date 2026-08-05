// components/equipment/EquipmentField.jsx
// حقول خاصة بقسم المعدات غير موجودة في components/ui/Field.jsx أو components/pm/PmField.jsx
// (وقت التاريخ - لبدء/نهاية سجلات التشغيل، ووقت التوقف/العودة للأعطال).
'use client';

export function DateTimeField({ label, value, onChange, required = false }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-soft mb-1">{label}{required && <span className="text-fail"> *</span>}</span>
      <input
        type="datetime-local"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-md border border-line px-3 py-2 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-navy/30"
      />
    </label>
  );
}

export function TimeField({ label, value, onChange, required = false }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-soft mb-1">{label}{required && <span className="text-fail"> *</span>}</span>
      <input
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-md border border-line px-3 py-2 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-navy/30"
      />
    </label>
  );
}
