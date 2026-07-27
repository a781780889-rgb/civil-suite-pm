// components/business/StatusBadge.jsx
const MAP = {
  // عام
  draft: ['مسودة', 'bg-line text-ink-soft'],
  active: ['نشط', 'bg-pass/15 text-pass'],
  inactive: ['غير نشط', 'bg-line text-ink-soft'],
  blacklisted: ['محظور', 'bg-fail/15 text-fail'],
  under_review: ['قيد المراجعة', 'bg-warnclr/15 text-warnclr'],
  pending_approval: ['بانتظار الاعتماد', 'bg-warnclr/15 text-warnclr'],
  approved: ['معتمد', 'bg-pass/15 text-pass'],
  rejected: ['مرفوض', 'bg-fail/15 text-fail'],
  cancelled: ['ملغي', 'bg-fail/15 text-fail'],
  completed: ['مكتمل', 'bg-pass/15 text-pass'],
  closed: ['مغلق', 'bg-line text-ink-soft'],
  open: ['مفتوح', 'bg-navy/10 text-navy'],
  // الفرص
  new: ['جديدة', 'bg-navy/10 text-navy'],
  qualified: ['مؤهلة', 'bg-navy/10 text-navy'],
  study: ['قيد الدراسة', 'bg-warnclr/15 text-warnclr'],
  quote: ['عرض سعر', 'bg-warnclr/15 text-warnclr'],
  negotiation: ['تفاوض', 'bg-warnclr/15 text-warnclr'],
  won: ['فوز', 'bg-pass/15 text-pass'],
  lost: ['خسارة', 'bg-fail/15 text-fail'],
  // عروض الأسعار
  sent: ['مُرسل', 'bg-navy/10 text-navy'],
  expired: ['منتهي الصلاحية', 'bg-fail/15 text-fail'],
  // العقود
  terminated: ['مُنهى', 'bg-fail/15 text-fail'],
  // المستخلصات
  submitted: ['مُقدَّم', 'bg-navy/10 text-navy'],
  paid: ['مصروف', 'bg-pass/15 text-pass'],
  // أوامر العمل
  in_progress: ['قيد التنفيذ', 'bg-warnclr/15 text-warnclr'],
  // المراسلات والالتزامات
  pending_reply: ['بانتظار الرد', 'bg-warnclr/15 text-warnclr'],
  done: ['مُنجز', 'bg-pass/15 text-pass'],
  overdue: ['متأخر', 'bg-fail/15 text-fail'],
};

export default function StatusBadge({ status }) {
  const [label, cls] = MAP[status] || [status || '—', 'bg-line text-ink-soft'];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function PriorityBadge({ priority }) {
  const map = {
    low: ['منخفضة', 'bg-line text-ink-soft'],
    medium: ['متوسطة', 'bg-navy/10 text-navy'],
    high: ['عالية', 'bg-warnclr/15 text-warnclr'],
    critical: ['حرجة', 'bg-fail/15 text-fail'],
  };
  const [label, cls] = map[priority] || [priority || '—', 'bg-line text-ink-soft'];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
