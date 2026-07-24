'use client';
// components/pm/PmField.jsx — امتداد لمكوّنات components/ui/Field.jsx بحقول التاريخ والنص الطويل
// (في ملف منفصل بدل تعديل الملف المشترك، حتى لا يتأثر أي قسم آخر).

export function DateField({ label, value, onChange, required = false, help }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && <span className="text-rebar-600 mr-1">*</span>}
      </span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink font-mono text-left focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 transition-shadow"
        dir="ltr"
      />
      {help && <span className="block mt-1 text-xs text-ink-soft">{help}</span>}
    </label>
  );
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 3, required = false }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && <span className="text-rebar-600 mr-1">*</span>}
      </span>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 transition-shadow resize-y"
      />
    </label>
  );
}
