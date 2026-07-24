'use client';
// components/pm/Shared.jsx — بطاقة إحصائية + مربع تأكيد، مُشتركان عبر شاشات القسم الرابع.

export function StatCard({ icon: Icon, label, value, tone = 'navy', small }) {
  const toneText = { navy: 'text-navy-700', fail: 'text-fail-700', pass: 'text-pass-700', warn: 'text-warnclr-700' }[tone] || 'text-navy-700';
  return (
    <div className="rounded-sheet border border-line bg-white p-4">
      <div className="flex items-center gap-2 text-ink-soft mb-2">
        {Icon && <Icon size={15} />}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`${small ? 'text-base' : 'text-xl'} font-bold font-mono tabular-figure ${toneText}`}>{value}</div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'تأكيد', danger = true, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-ink mb-1.5">{title}</h3>
        {message && <p className="text-sm text-ink-soft mb-4">{message}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-line text-sm text-ink hover:bg-paper transition-colors">إلغاء</button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-md text-sm text-white transition-colors ${danger ? 'bg-fail-DEFAULT hover:bg-fail-700' : 'bg-navy-600 hover:bg-navy-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="rounded-sheet border border-dashed border-line bg-white/60 p-8 text-center">
      {Icon && <Icon size={28} className="mx-auto text-concrete-300 mb-2" />}
      <p className="font-medium text-ink text-sm">{title}</p>
      {message && <p className="text-xs text-ink-soft mt-1">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = '' }) {
  return (
    <div className={`rounded-sheet border border-line bg-white p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-sm font-bold text-navy-700">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
