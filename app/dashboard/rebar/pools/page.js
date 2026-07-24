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

export default function RebarPoolsPage() {
  const [inputs, setInputs] = useState({
    poolShape: 'rectangular', lengthM: 10, widthM: 5, diameterM: 6, maxDepthM: 2.0,
    wallThicknessMm: 250, baseThicknessMm: 250, coverMm: 50, fcMPa: 30, fyMPa: 420,
    wallVerticalDiameterMm: 14, wallVerticalSpacingMm: 175, wallHorizontalDiameterMm: 12, wallHorizontalSpacingMm: 175,
    baseDiameterMm: 12, baseSpacingMm: 175,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const r = useCalculatorReport('rebar_pool', 'حديد المسابح');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({
      poolShape: inputs.poolShape, lengthM: inputs.lengthM, widthM: inputs.widthM, diameterM: inputs.diameterM, maxDepthM: inputs.maxDepthM,
      wallThicknessMm: inputs.wallThicknessMm, baseThicknessMm: inputs.baseThicknessMm, coverMm: inputs.coverMm, fcMPa: inputs.fcMPa, fyMPa: inputs.fyMPa,
      wallVertical: { diameterMm: inputs.wallVerticalDiameterMm, spacingMm: inputs.wallVerticalSpacingMm },
      wallHorizontal: { diameterMm: inputs.wallHorizontalDiameterMm, spacingMm: inputs.wallHorizontalSpacingMm },
      baseBottom: { dir1DiameterMm: inputs.baseDiameterMm, dir1SpacingMm: inputs.baseSpacingMm, dir2DiameterMm: inputs.baseDiameterMm, dir2SpacingMm: inputs.baseSpacingMm },
      wastePct: priceState.wastePct, priceList: priceState,
    });
  }
  const isCircular = inputs.poolShape === 'circular';
  const inputRows = [
    { label: 'الشكل', value: isCircular ? `دائري Ø${inputs.diameterM}m` : `${inputs.lengthM}×${inputs.widthM}m` },
    { label: 'أقصى عمق', value: `${inputs.maxDepthM} m` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S2-07" sheetTitle="حديد المسابح" sheetSubtitle="تركيب: جدار + قاعدة"
        projectName={r.meta.projectName} onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName} onEngineerNameChange={r.meta.setEngineerName} dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate} calculating={r.calculating}
        onSave={() => r.handleSave('مسبح')} saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('مسبح', 'تقرير-حديد-مسبح.pdf')} exportStatus={r.exportStatus}
        canSave={!!res} canExport={!!res}
        logoDataUrl={r.meta.logoDataUrl} onLogoFile={r.meta.handleLogoFile}
        signatureDataUrl={r.meta.signatureDataUrl} onSignatureFile={r.meta.handleSignatureFile}
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <ResultSection title="الشكل والأبعاد">
            <FieldGroup cols={2}>
              <SelectField label="الشكل" value={inputs.poolShape} onChange={(v) => set('poolShape', v)} options={[{ value: 'rectangular', label: 'مستطيل' }, { value: 'circular', label: 'دائري' }]} />
              <NumberField label="أقصى عمق" unit="m" value={inputs.maxDepthM} onChange={(v) => set('maxDepthM', v)} />
              {isCircular ? (
                <NumberField label="القطر" unit="m" value={inputs.diameterM} onChange={(v) => set('diameterM', v)} />
              ) : (
                <>
                  <NumberField label="الطول" unit="m" value={inputs.lengthM} onChange={(v) => set('lengthM', v)} />
                  <NumberField label="العرض" unit="m" value={inputs.widthM} onChange={(v) => set('widthM', v)} />
                </>
              )}
              <NumberField label="سماكة الجدار" unit="mm" value={inputs.wallThicknessMm} onChange={(v) => set('wallThicknessMm', v)} />
              <NumberField label="سماكة القاعدة" unit="mm" value={inputs.baseThicknessMm} onChange={(v) => set('baseThicknessMm', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="حديد الجدار">
            <FieldGroup cols={2}>
              <NumberField label="قطر رأسي" unit="mm" value={inputs.wallVerticalDiameterMm} onChange={(v) => set('wallVerticalDiameterMm', v)} />
              <NumberField label="تباعد رأسي" unit="mm" value={inputs.wallVerticalSpacingMm} onChange={(v) => set('wallVerticalSpacingMm', v)} />
              <NumberField label="قطر أفقي" unit="mm" value={inputs.wallHorizontalDiameterMm} onChange={(v) => set('wallHorizontalDiameterMm', v)} />
              <NumberField label="تباعد أفقي" unit="mm" value={inputs.wallHorizontalSpacingMm} onChange={(v) => set('wallHorizontalSpacingMm', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="حديد القاعدة">
            <FieldGroup cols={2}>
              <NumberField label="القطر" unit="mm" value={inputs.baseDiameterMm} onChange={(v) => set('baseDiameterMm', v)} />
              <NumberField label="التباعد" unit="mm" value={inputs.baseSpacingMm} onChange={(v) => set('baseSpacingMm', v)} />
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
                <ResultRow label="إجمالي حجم الخرسانة" value={res.quantities.totalConcreteVolumeM3} unit="m³" />
                <ResultRow label="الوزن الصافي" value={res.totals.totalWeightKg} unit="kg" emphasis />
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
            ref={r.reportRef} sheetNumber="S2-07" sheetTitle="حديد المسابح" reportNumber={r.reportNumber || '—'} dateStr={dateStr}
            projectName={r.meta.projectName} engineerName={r.meta.engineerName} logoDataUrl={r.meta.logoDataUrl}
            signatureDataUrl={r.meta.signatureDataUrl} qrDataUrl={r.qrDataUrl} inputRows={inputRows} results={res} warnings={r.warnings}
          />
        </div>
      )}
    </div>
  );
}
