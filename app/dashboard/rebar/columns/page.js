'use client';

import { useState } from 'react';
import ColumnPileRebarCalculator from '@/components/calculators2/ColumnPileRebarCalculator.jsx';

export default function RebarColumnsPage() {
  const [tab, setTab] = useState('column');
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 border-b border-line">
        <button
          onClick={() => setTab('column')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'column' ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          الأعمدة
        </button>
        <button
          onClick={() => setTab('pile')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'pile' ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          الخوازيق
        </button>
      </div>
      <ColumnPileRebarCalculator key={tab} memberType={tab} />
    </div>
  );
}
