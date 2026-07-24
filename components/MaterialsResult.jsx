'use client';

import { ResultSection, ResultRow } from './ui/Results.jsx';

export default function MaterialsResult({ materials, volumeLabel = 'حجم الخرسانة الصافي' }) {
  if (!materials) return null;
  return (
    <ResultSection title={`مواد الخرسانة (${materials.gradeLabel} — نسبة الخلط ${materials.ratioLabel})`}>
      <ResultRow label={volumeLabel} value={materials.netVolumeM3} unit="m³" />
      <ResultRow label="الحجم شاملاً الهدر" value={materials.grossVolumeM3} unit="m³" emphasis />
      <div className="h-px bg-line my-1" />
      <ResultRow label="الأسمنت" value={materials.cementWeightKg} unit="kg" />
      <ResultRow label="عدد أكياس الأسمنت (50kg)" value={materials.cementBags} unit="كيس" emphasis />
      <ResultRow label="الرمل" value={materials.sandWeightTon} unit="طن" />
      <ResultRow label="البحص" value={materials.gravelWeightTon} unit="طن" />
      <ResultRow label="الماء" value={materials.waterLiters} unit="لتر" />
      <div className="h-px bg-line my-1" />
      <ResultRow label="عدد دفعات الخلاطة" value={materials.mixerLoads} unit={`دفعة (${materials.mixerCapacityM3}m³)`} />
      <ResultRow label="عدد سيارات النقل" value={materials.truckTrips} unit={`سيارة (${materials.truckCapacityM3}m³)`} />
      <div className="h-px bg-line my-1" />
      <ResultRow
        label="محتوى الأسمنت الفعلي"
        value={`${materials.cementContentPerM3} kg/m³`}
        unit={materials.cementAdvisoryOk ? '✓ ضمن الحد الاسترشادي' : `⚠ أقل من ${materials.advisoryMinCementKgM3}`}
      />
      {materials.cost?.totalMaterialCost > 0 && (
        <>
          <div className="h-px bg-line my-1" />
          <ResultRow label="التكلفة الإجمالية التقديرية للمواد" value={materials.cost.totalMaterialCost.toLocaleString('en-US')} unit="ريال" emphasis />
        </>
      )}
    </ResultSection>
  );
}
