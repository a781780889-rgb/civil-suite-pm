'use client';

import { useState } from 'react';
import IsolatedFootingCalculator from '@/components/calculators/IsolatedFootingCalculator.jsx';
import CombinedFootingCalculator from '@/components/calculators/CombinedFootingCalculator.jsx';
import StrapFootingCalculator from '@/components/calculators/StrapFootingCalculator.jsx';

const TABS = [
  { key: 'isolated', label: 'منفصلة' },
  { key: 'combined', label: 'مشتركة / شريطية' },
  { key: 'strap', label: 'مرتبطة (Strap)' },
];

export default function FootingsPage() {
  const [tab, setTab] = useState('isolated');

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

      {tab === 'isolated' && <IsolatedFootingCalculator />}
      {tab === 'combined' && <CombinedFootingCalculator />}
      {tab === 'strap' && <StrapFootingCalculator />}
    </div>
  );
}
