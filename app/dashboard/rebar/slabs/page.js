'use client';

import { useState } from 'react';
import SolidSlabRebarCalculator from '@/components/calculators2/SolidSlabRebarCalculator.jsx';
import HourdiSlabRebarCalculator from '@/components/calculators2/HourdiSlabRebarCalculator.jsx';

export default function RebarSlabsPage() {
  const [tab, setTab] = useState('solid');
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 border-b border-line">
        <button
          onClick={() => setTab('solid')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'solid' ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          مصمتة
        </button>
        <button
          onClick={() => setTab('hourdi')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'hourdi' ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          هوردي
        </button>
      </div>
      {tab === 'solid' && <SolidSlabRebarCalculator />}
      {tab === 'hourdi' && <HourdiSlabRebarCalculator />}
    </div>
  );
}
