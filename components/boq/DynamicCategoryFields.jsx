'use client';

import { useEffect, useState } from 'react';
import { NumberField, SelectField } from '@/components/ui/Field.jsx';
import { fetchBoqLinkedCalculations } from '@/lib/api.js';

export default function DynamicCategoryFields({ category, values, onChange, projectId }) {
  if (!category) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {category.fields.map((field) => {
        if (field.type === 'number') {
          return (
            <NumberField
              key={field.key}
              label={field.label}
              unit={field.unit === 'm' ? 'م' : field.unit === 'm2' ? 'م²' : field.unit === 'm3' ? 'م³' : field.unit === '%' ? '%' : field.unit === 'عدد' ? '' : field.unit}
              value={values[field.key] ?? field.default ?? ''}
              onChange={(v) => onChange(field.key, v)}
              required={!!field.required}
            />
          );
        }
        if (field.type === 'select') {
          return (
            <SelectField
              key={field.key}
              label={field.label}
              value={values[field.key] ?? field.default ?? field.options?.[0]?.value}
              onChange={(v) => onChange(field.key, v)}
              options={field.options}
            />
          );
        }
        if (field.type === 'linked_calculation') {
          return (
            <LinkedCalculationField
              key={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              onChange={(v) => onChange(field.key, v)}
              kind={field.calc_type_prefix === 'rebar_' ? 'rebar' : 'concrete'}
              projectId={projectId}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function LinkedCalculationField({ label, value, onChange, kind, projectId }) {
  const [calcs, setCalcs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBoqLinkedCalculations(kind, projectId).then((res) => {
      if (res.success) setCalcs(res.calculations);
      setLoading(false);
    });
  }, [kind, projectId]);

  return (
    <div className="col-span-2">
      <SelectField
        label={`${label}${loading ? ' (جارٍ التحميل...)' : ''}`}
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: calcs.length ? '— بدون ربط (إدخال يدوي) —' : 'لا توجد حسابات محفوظة قابلة للربط بعد' },
          ...calcs.map((c) => ({ value: String(c.id), label: `${c.title || c.calc_type} — ${new Date(c.created_at + 'Z').toLocaleDateString('ar-SA-u-nu-latn')}` })),
        ]}
        help={kind === 'rebar' ? 'يسحب الوزن النهائي فعلياً من حساب محفوظ في القسم الثاني (BBS)' : 'يسحب حجم الخرسانة فعلياً من حساب محفوظ في القسم الأول'}
      />
    </div>
  );
}
