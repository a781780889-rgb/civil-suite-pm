'use client';

export function ResultSection({ title, children, tone = 'default' }) {
  const toneClasses = {
    default: 'border-line',
    highlight: 'border-navy-200 bg-navy-50/40',
  };
  return (
    <div className={`rounded-sheet border ${toneClasses[tone]} bg-white p-4`}>
      {title && <h4 className="text-sm font-bold text-navy-700 mb-3">{title}</h4>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function ResultRow({ label, value, unit, emphasis = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-dashed border-line last:border-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className={`font-mono text-left ${emphasis ? 'text-base font-bold text-navy-700' : 'text-sm text-ink'}`} dir="ltr">
        {value} {unit && <span className="text-xs text-ink-soft">{unit}</span>}
      </span>
    </div>
  );
}

export function StatusStamp({ status, label }) {
  const map = {
    pass: { cls: 'text-pass border-pass bg-pass-50', text: label || 'مطابق ✓' },
    fail: { cls: 'text-fail border-fail bg-fail-50', text: label || 'غير مطابق ✕' },
    warn: { cls: 'text-warnclr border-warnclr bg-warnclr-50', text: label || 'يتطلب مراجعة' },
  };
  const s = map[status] || map.pass;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 text-xs font-bold tracking-wide ${s.cls}`}>
      {s.text}
    </span>
  );
}

export function WarningsList({ warnings }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="rounded-sheet border-2 border-warnclr-100 bg-warnclr-50 p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <StatusStamp status="warn" label={`${warnings.length} ملاحظة هندسية`} />
      </div>
      <ul className="list-disc pr-5 space-y-1 text-sm text-ink">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

export function ErrorsList({ errors }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="rounded-sheet border-2 border-fail-100 bg-fail-50 p-3.5">
      <div className="mb-1.5">
        <StatusStamp status="fail" label="تعذّر إتمام الحساب" />
      </div>
      <ul className="list-disc pr-5 space-y-1 text-sm text-fail-700">
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyResultsHint() {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-sheet border-2 border-dashed border-line text-center px-6">
      <div className="w-12 h-12 rounded-full bg-navy-50 flex items-center justify-center mb-3">
        <span className="text-navy-400 text-xl font-mono">Σ</span>
      </div>
      <p className="text-sm text-ink-soft">أدخل بيانات العنصر الإنشائي ثم اضغط «احسب» لعرض النتائج والتسليح المطلوب هنا.</p>
    </div>
  );
}
