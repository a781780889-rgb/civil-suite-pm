'use client';

import { useState } from 'react';
import OneWaySlabCalculator from '@/components/calculators/OneWaySlabCalculator.jsx';
import TwoWaySlabCalculator from '@/components/calculators/TwoWaySlabCalculator.jsx';

export default function SlabsPage() {
  const [tab, setTab] = useState('oneWay');
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 border-b border-line">
        <button
          onClick={() => setTab('oneWay')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'oneWay' ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          أحادية الاتجاه
        </button>
        <button
          onClick={() => setTab('twoWay')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'twoWay' ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          ثنائية الاتجاه
        </button>
      </div>
      {tab === 'oneWay' && <OneWaySlabCalculator />}
      {tab === 'twoWay' && <TwoWaySlabCalculator />}
    </div>
  );
}
