// components/equipment/StatusBadge.jsx
const MAP = {
  // حالة المعدة (equipment_assets.status)
  available: ['متاحة', 'bg-pass/15 text-pass'],
  in_use: ['قيد التشغيل', 'bg-navy/10 text-navy'],
  maintenance: ['في الصيانة', 'bg-warnclr/15 text-warnclr'],
  stopped: ['متوقفة', 'bg-line text-ink-soft'],
  reserved: ['محجوزة', 'bg-warnclr/15 text-warnclr'],
  out_of_service: ['خارج الخدمة', 'bg-fail/15 text-fail'],
  sold: ['مباعة', 'bg-line text-ink-soft'],
  archived: ['مؤرشفة', 'bg-line text-ink-soft'],
  // عام (تخصيص/حجز/نقل/عطل/صيانة)
  active: ['نشط', 'bg-pass/15 text-pass'],
  pending: ['قيد الانتظار', 'bg-warnclr/15 text-warnclr'],
  confirmed: ['مؤكَّد', 'bg-navy/10 text-navy'],
  completed: ['مكتمل', 'bg-pass/15 text-pass'],
  cancelled: ['ملغي', 'bg-fail/15 text-fail'],
  scheduled: ['مجدولة', 'bg-navy/10 text-navy'],
  in_progress: ['قيد التنفيذ', 'bg-warnclr/15 text-warnclr'],
  open: ['مفتوح', 'bg-fail/15 text-fail'],
  in_repair: ['قيد الإصلاح', 'bg-warnclr/15 text-warnclr'],
  resolved: ['تم الإصلاح', 'bg-pass/15 text-pass'],
  planned: ['مخطَّط', 'bg-navy/10 text-navy'],
  in_transit: ['قيد النقل', 'bg-warnclr/15 text-warnclr'],
  expired: ['منتهي', 'bg-fail/15 text-fail'],
  terminated: ['مُنهى', 'bg-fail/15 text-fail'],
  pass: ['ناجح', 'bg-pass/15 text-pass'],
  fail: ['راسب', 'bg-fail/15 text-fail'],
  pass_with_notes: ['ناجح مع ملاحظات', 'bg-warnclr/15 text-warnclr'],
  owned: ['مملوكة', 'bg-navy/10 text-navy'],
  rented: ['مؤجَّرة', 'bg-warnclr/15 text-warnclr'],
};

export default function StatusBadge({ status }) {
  const [label, cls] = MAP[status] || [status || '—', 'bg-line text-ink-soft'];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function SeverityBadge({ severity }) {
  const map = {
    low: ['منخفضة', 'bg-line text-ink-soft'],
    medium: ['متوسطة', 'bg-navy/10 text-navy'],
    high: ['عالية', 'bg-warnclr/15 text-warnclr'],
    critical: ['حرجة', 'bg-fail/15 text-fail'],
  };
  const [label, cls] = map[severity] || [severity || '—', 'bg-line text-ink-soft'];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
