'use client';

export default function BarScheduleTable({ barGroups }) {
  if (!barGroups || barGroups.length === 0) return null;
  return (
    <div className="rounded-sheet border border-line bg-white overflow-hidden">
      <div className="bg-navy-700 text-white px-3 py-2 text-sm font-bold">جدول تفصيل الحديد (Bar Bending Schedule)</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-concrete-50 text-ink-soft">
              <th className="px-2.5 py-2 text-right font-semibold">البند</th>
              <th className="px-2.5 py-2 text-center font-semibold">القطر</th>
              <th className="px-2.5 py-2 text-center font-semibold">طول القطعة</th>
              <th className="px-2.5 py-2 text-center font-semibold">العدد</th>
              <th className="px-2.5 py-2 text-center font-semibold">أسياخ تجارية/وحدة</th>
              <th className="px-2.5 py-2 text-center font-semibold">الطول الكلي</th>
              <th className="px-2.5 py-2 text-center font-semibold">الوزن</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {barGroups.map((g, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-concrete-50/50'}>
                <td className="px-2.5 py-2 text-ink">{g.label}</td>
                <td className="px-2.5 py-2 text-center font-mono tabular-figure" dir="ltr">
                  Ø{g.diameterMm}
                </td>
                <td className="px-2.5 py-2 text-center font-mono tabular-figure" dir="ltr">
                  {g.cuttingLengthM} m
                </td>
                <td className="px-2.5 py-2 text-center font-mono tabular-figure" dir="ltr">
                  {g.count}
                </td>
                <td className="px-2.5 py-2 text-center font-mono tabular-figure" dir="ltr">
                  {g.piecesPerUnit > 1 ? `${g.piecesPerUnit} (${g.splicesPerUnit} وصلة)` : '1'}
                </td>
                <td className="px-2.5 py-2 text-center font-mono tabular-figure" dir="ltr">
                  {g.totalLengthM} m
                </td>
                <td className="px-2.5 py-2 text-center font-mono font-bold tabular-figure" dir="ltr">
                  {g.weightKg} kg
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
