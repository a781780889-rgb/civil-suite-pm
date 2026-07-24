'use client';

import { useState } from 'react';
import LinearRebarCalculator from '@/components/calculators2/LinearRebarCalculator.jsx';

const TABS = [
  { key: 'beam', label: 'الكمرات' },
  { key: 'tie_beam', label: 'الميدات' },
  { key: 'girder', label: 'الجسور' },
];

export default function RebarBeamsPage() {
  const [tab, setTab] = useState('beam');
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <LinearRebarCalculator key={tab} memberFamily={tab} />
    </div>
  );
}
