'use client';

import { useState } from 'react';
import PadRebarCalculator from '@/components/calculators2/PadRebarCalculator.jsx';

const TABS = [
  { key: 'isolated', label: 'منفصلة' },
  { key: 'combined', label: 'مشتركة' },
  { key: 'mat', label: 'لبشة' },
  { key: 'pile_cap', label: 'قبعات خوازيق' },
  { key: 'strip_footing', label: 'شريطية' },
];

export default function RebarPadsPage() {
  const [tab, setTab] = useState('isolated');
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <PadRebarCalculator key={tab} padType={tab} />
    </div>
  );
}
