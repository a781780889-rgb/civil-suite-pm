'use client';

import { useState } from 'react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, SelectField, FieldGroup } from '@/components/ui/Field.jsx';
import { ResultSection, ResultRow, WarningsList, ErrorsList, EmptyResultsHint } from '@/components/ui/Results.jsx';
import BarScheduleTable from '@/components/BarScheduleTable.jsx';
import PriceListPanel, { defaultPriceState } from '@/components/PriceListPanel.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

const STAIR_TYPES = [
  { value: 'straight', label: 'مستقيم' },
  { value: 'L', label: 'حرف L' },
  { value: 'U', label: 'حرف U' },
  { value: 'circular', label: 'دائري (حلزوني)' },
];

export default function RebarStairsPage() {
  const [inputs, setInputs] = useState({
    stairType: 'straight', totalHeightM: 3.0, widthM: 1.2, waistThicknessMm: 150, coverMm: 20, fcMPa: 25, fyMPa: 420,
    mainDiameterMm: 12, mainSpacingMm: 150, distDiameterMm: 10, distSpacingMm: 200, supportWidthMm: 200,
    innerRadiusM: 0.35, outerRadiusM: 1.6, totalAngleDeg: 360, radialBarDiameterMm: 14,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const r = useCalculatorReport('rebar_stairs', 'حديد السلالم');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({
      stairType: inputs.stairType, totalHeightM: inputs.totalHeightM, widthM: inputs.widthM, waistThicknessMm: inputs.waistThicknessMm,
      coverMm: inputs.coverMm, fcMPa: inputs.fcMPa, fyMPa: inputs.fyMPa,
      main: { diameterMm: inputs.mainDiameterMm, spacingMm: inputs.mainSpacingMm },
      distribution: { diameterMm: inputs.distDiameterMm, spacingMm: inputs.distSpacingMm },
      supportWidthMm: inputs.supportWidthMm,
      innerRadiusM: inputs.innerRadiusM, outerRadiusM: inputs.outerRadiusM, totalAngleDeg: inputs.totalAngleDeg,
      radialBar: { diameterMm: inputs.radialBarDiameterMm },
      wastePct: priceState.wastePct, priceList: priceState,
    });
  }
  const isCircular = inputs.stairType === 'circular';
  const inputRows = [
    { label: 'النوع', value: STAIR_TYPES.find((s) => s.value === inputs.stairType)?.label },
    { label: 'الارتفاع الكلي', value: `${inputs.totalHeightM} m` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S2-08" sheetTitle="حديد السلالم" sheetSubtitle="حديد رئيسي وتوزيع لكل فرشة - تثبيت حقيقي عند المساند"
        projectName={r.meta.projectName} onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName} onEngineerNameChange={r.meta.setEngineerName} dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate} calculating={r.calculating}
        onSave={() => r.handleSave('سلم')} saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('سلم', 'تقرير-حديد-سلم.pdf')} exportStatus={r.exportStatus}
        canSave={!!res} canExport={!!res}
        logoDataUrl={r.meta.logoDataUrl} onLogoFile={r.meta.handleLogoFile}
        signatureDataUrl={r.meta.signatureDataUrl} onSignatureFile={r.meta.handleSignatureFile}
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <ResultSection title="نوع السلم والأبعاد">
            <FieldGroup cols={2}>
              <SelectField label="النوع" value={inputs.stairType} onChange={(v) => set('stairType', v)} options={STAIR_TYPES} />
              <NumberField label="الارتفاع الكلي" unit="m" value={inputs.totalHeightM} onChange={(v) => set('totalHeightM', v)} />
              {!isCircular && (
                <>
                  <NumberField label="العرض" unit="m" value={inputs.widthM} onChange={(v) => set('widthM', v)} />
                  <NumberField label="سماكة القلبة" unit="mm" value={inputs.waistThicknessMm} onChange={(v) => set('waistThicknessMm', v)} />
                </>
              )}
            </FieldGroup>
          </ResultSection>

          {isCircular ? (
            <ResultSection title="هندسة الدرج الدائري">
              <FieldGroup cols={2}>
                <NumberField label="نصف القطر الداخلي" unit="m" value={inputs.innerRadiusM} onChange={(v) => set('innerRadiusM', v)} />
                <NumberField label="نصف القطر الخارجي" unit="m" value={inputs.outerRadiusM} onChange={(v) => set('outerRadiusM', v)} />
                <NumberField label="الزاوية الكلية" unit="°" value={inputs.totalAngleDeg} onChange={(v) => set('totalAngleDeg', v)} />
                <NumberField label="قطر الحديد الشعاعي" unit="mm" value={inputs.radialBarDiameterMm} onChange={(v) => set('radialBarDiameterMm', v)} />
              </FieldGroup>
            </ResultSection>
          ) : (
            <ResultSection title="الحديد الرئيسي والتوزيع">
              <FieldGroup cols={2}>
                <NumberField label="قطر الحديد الرئيسي" unit="mm" value={inputs.mainDiameterMm} onChange={(v) => set('mainDiameterMm', v)} />
                <NumberField label="تباعد الحديد الرئيسي" unit="mm" value={inputs.mainSpacingMm} onChange={(v) => set('mainSpacingMm', v)} />
                <NumberField label="قطر حديد التوزيع" unit="mm" value={inputs.distDiameterMm} onChange={(v) => set('distDiameterMm', v)} />
                <NumberField label="تباعد حديد التوزيع" unit="mm" value={inputs.distSpacingMm} onChange={(v) => set('distSpacingMm', v)} />
                <NumberField label="عرض المسند (بسطة/كمرة)" unit="mm" value={inputs.supportWidthMm} onChange={(v) => set('supportWidthMm', v)} />
              </FieldGroup>
            </ResultSection>
          )}

          <ResultSection title="مقاومة المواد">
            <FieldGroup cols={2}>
              <NumberField label="مقاومة الخرسانة f'c" unit="MPa" value={inputs.fcMPa} onChange={(v) => set('fcMPa', v)} />
              <NumberField label="إجهاد خضوع الحديد fy" unit="MPa" value={inputs.fyMPa} onChange={(v) => set('fyMPa', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="الأسعار والهدر">
            <PriceListPanel value={priceState} onChange={setPriceState} />
          </ResultSection>
        </div>
        <div className="space-y-4">
          <ErrorsList errors={r.errors} />
          {!res && !r.errors.length && <EmptyResultsHint />}
          {res && (
            <>
              <WarningsList warnings={r.warnings} />
              <BarScheduleTable barGroups={res.barGroups} />
              <ResultSection title="الإجماليات" tone="highlight">
                <ResultRow label="الوزن الصافي" value={res.totals.totalWeightKg} unit="kg" emphasis />
                <ResultRow label="إجمالي عدد الأسياخ" value={res.totals.totalBarCount} />
              </ResultSection>
              <ResultSection title="التكلفة">
                <ResultRow label="التكلفة النهائية" value={res.totals.cost.finalCost.toLocaleString('en-US')} unit="ريال" emphasis />
              </ResultSection>
            </>
          )}
        </div>
      </div>
      {res && (
        <div style={{ position: 'fixed', top: 0, left: -10000 }}>
          <PdfReport
            ref={r.reportRef} sheetNumber="S2-08" sheetTitle="حديد السلالم" reportNumber={r.reportNumber || '—'} dateStr={dateStr}
            projectName={r.meta.projectName} engineerName={r.meta.engineerName} logoDataUrl={r.meta.logoDataUrl}
            signatureDataUrl={r.meta.signatureDataUrl} qrDataUrl={r.qrDataUrl} inputRows={inputRows} results={res} warnings={r.warnings}
          />
        </div>
      )}
    </div>
  );
}
