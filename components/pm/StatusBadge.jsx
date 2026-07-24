// components/pm/StatusBadge.jsx
const TONE_CLASSES = {
  navy: 'bg-navy-50 text-navy-700 border-navy-200',
  pass: 'bg-pass-50 text-pass-700 border-pass-100',
  fail: 'bg-fail-50 text-fail-700 border-fail-100',
  warn: 'bg-warnclr-50 text-warnclr-700 border-warnclr-100',
  concrete: 'bg-concrete-100 text-concrete-700 border-concrete-200',
  rebar: 'bg-rebar-50 text-rebar-700 border-rebar-200',
};

const PROJECT_STATUS_TONE = { planning: 'concrete', in_progress: 'navy', stopped: 'warn', completed: 'pass', cancelled: 'fail', archived: 'concrete' };
const PROJECT_STATUS_LABEL = { planning: 'قيد التخطيط', in_progress: 'قيد التنفيذ', stopped: 'متوقف', completed: 'مكتمل', cancelled: 'ملغي', archived: 'مؤرشف' };

const TASK_STATUS_TONE = { not_started: 'concrete', in_progress: 'navy', delayed: 'fail', completed: 'pass', on_hold: 'warn' };
const TASK_STATUS_LABEL = { not_started: 'لم تبدأ', in_progress: 'قيد التنفيذ', delayed: 'متأخرة', completed: 'مكتملة', on_hold: 'معلّقة' };

const PRIORITY_TONE = { low: 'concrete', medium: 'navy', high: 'warn', critical: 'fail' };
const PRIORITY_LABEL = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };

const OPEN_TONE = { open: 'warn', closed: 'pass', in_progress: 'navy', resolved: 'pass', rejected: 'fail', approved: 'pass', pending_approval: 'warn', draft: 'concrete', cancelled: 'concrete' };

function Badge({ tone = 'concrete', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASSES[tone] || TONE_CLASSES.concrete}`}>
      {children}
    </span>
  );
}

export function ProjectStatusBadge({ status }) {
  return <Badge tone={PROJECT_STATUS_TONE[status] || 'concrete'}>{PROJECT_STATUS_LABEL[status] || status}</Badge>;
}

export function TaskStatusBadge({ status }) {
  return <Badge tone={TASK_STATUS_TONE[status] || 'concrete'}>{TASK_STATUS_LABEL[status] || status}</Badge>;
}

export function PriorityBadge({ priority }) {
  return <Badge tone={PRIORITY_TONE[priority] || 'concrete'}>{PRIORITY_LABEL[priority] || priority}</Badge>;
}

export function GenericStatusBadge({ status, labels = {} }) {
  return <Badge tone={OPEN_TONE[status] || 'concrete'}>{labels[status] || status}</Badge>;
}

export function SeverityBadge({ severity }) {
  const tone = severity === 'critical' ? 'fail' : severity === 'high' ? 'fail' : severity === 'warning' || severity === 'medium' ? 'warn' : severity === 'low' ? 'concrete' : 'navy';
  const label = { critical: 'حرجة', high: 'عالية', warning: 'تحذير', medium: 'متوسطة', low: 'منخفضة', info: 'معلومة' }[severity] || severity;
  return <Badge tone={tone}>{label}</Badge>;
}

export default Badge;
