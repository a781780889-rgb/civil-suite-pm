'use client';

import { useState } from 'react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, SelectField, FieldGroup, ToggleField } from '@/components/ui/Field.jsx';
import { ResultSection, ResultRow, WarningsList, ErrorsList, EmptyResultsHint } from '@/components/ui/Results.jsx';
import BarScheduleTable from '@/components/BarScheduleTable.jsx';
import PriceListPanel, { defaultPriceState } from '@/components/PriceListPanel.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

export default function RebarTanksPage() {
  const [inputs, setInputs] = useState({
    tankShape: 'rectangular', tankPosition: 'ground', internalLengthM: 5, internalWidthM: 4, internalDiameterM: 6,
    heightM: 2.8, wallThicknessMm: 250, baseThicknessMm: 300, hasRoof: true, roofThicknessMm: 150, coverMm: 50, fcMPa: 30, fyMPa: 420,
    wallVerticalDiameterMm: 14, wallVerticalSpacingMm: 175, wallHorizontalDiameterMm: 14, wallHorizontalSpacingMm: 175,
    baseDiameterMm: 14, baseSpacingMm: 175, roofDiameterMm: 10, roofSpacingMm: 200,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const r = useCalculatorReport('rebar_tank', 'حديد الخزانات');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({
      tankShape: inputs.tankShape, tankPosition: inputs.tankPosition,
      internalLengthM: inputs.internalLengthM, internalWidthM: inputs.internalWidthM, internalDiameterM: inputs.internalDiameterM,
      heightM: inputs.heightM, wallThicknessMm: inputs.wallThicknessMm, baseThicknessMm: inputs.baseThicknessMm,
      hasRoof: inputs.hasRoof, roofThicknessMm: inputs.roofThicknessMm, coverMm: inputs.coverMm, fcMPa: inputs.fcMPa, fyMPa: inputs.fyMPa,
      wallVertical: { diameterMm: inputs.wallVerticalDiameterMm, spacingMm: inputs.wallVerticalSpacingMm },
      wallHorizontal: { diameterMm: inputs.wallHorizontalDiameterMm, spacingMm: inputs.wallHorizontalSpacingMm },
      baseBottom: { dir1DiameterMm: inputs.baseDiameterMm, dir1SpacingMm: inputs.baseSpacingMm, dir2DiameterMm: inputs.baseDiameterMm, dir2SpacingMm: inputs.baseSpacingMm },
      roofBottom: { dir1DiameterMm: inputs.roofDiameterMm, dir1SpacingMm: inputs.roofSpacingMm, dir2DiameterMm: inputs.roofDiameterMm, dir2SpacingMm: inputs.roofSpacingMm },
      wastePct: priceState.wastePct, priceList: priceState,
    });
  }
  const isCircular = inputs.tankShape === 'circular';
  const inputRows = [
    { label: 'الشكل', value: isCircular ? `دائري Ø${inputs.internalDiameterM}m` : `${inputs.internalLengthM}×${inputs.internalWidthM}m` },
    { label: 'الموقع', value: inputs.tankPosition === 'elevated' ? 'علوي' : 'أرضي' },
    { label: 'سماكة الجدار', value: `${inputs.wallThicknessMm}mm` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S2-06" sheetTitle="حديد الخزانات" sheetSubtitle="تركيب: جدار + قاعدة + سقف"
        projectName={r.meta.projectName} onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName} onEngineerNameChange={r.meta.setEngineerName} dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate} calculating={r.calculating}
        onSave={() => r.handleSave('خزان')} saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('خزان', 'تقرير-حديد-خزان.pdf')} exportStatus={r.exportStatus}
        canSave={!!res} canExport={!!res}
        logoDataUrl={r.meta.logoDataUrl} onLogoFile={r.meta.handleLogoFile}
        signatureDataUrl={r.meta.signatureDataUrl} onSignatureFile={r.meta.handleSignatureFile}
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <ResultSection title="الشكل والموقع">
            <FieldGroup cols={2}>
              <SelectField label="الشكل" value={inputs.tankShape} onChange={(v) => set('tankShape', v)} options={[{ value: 'rectangular', label: 'مستطيل' }, { value: 'circular', label: 'دائري' }]} />
              <SelectField label="الموقع" value={inputs.tankPosition} onChange={(v) => set('tankPosition', v)} options={[{ value: 'ground', label: 'أرضي' }, { value: 'elevated', label: 'علوي' }]} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="الأبعاد">
            <FieldGroup cols={2}>
              {isCircular ? (
                <NumberField label="القطر الداخلي" unit="m" value={inputs.internalDiameterM} onChange={(v) => set('internalDiameterM', v)} />
              ) : (
                <>
                  <NumberField label="الطول الداخلي" unit="m" value={inputs.internalLengthM} onChange={(v) => set('internalLengthM', v)} />
                  <NumberField label="العرض الداخلي" unit="m" value={inputs.internalWidthM} onChange={(v) => set('internalWidthM', v)} />
                </>
              )}
              <NumberField label="الارتفاع" unit="m" value={inputs.heightM} onChange={(v) => set('heightM', v)} />
              <NumberField label="سماكة الجدار" unit="mm" value={inputs.wallThicknessMm} onChange={(v) => set('wallThicknessMm', v)} />
              <NumberField label="سماكة القاعدة" unit="mm" value={inputs.baseThicknessMm} onChange={(v) => set('baseThicknessMm', v)} />
            </FieldGroup>
            <ToggleField label="يوجد سقف" checked={inputs.hasRoof} onChange={(v) => set('hasRoof', v)} />
            {inputs.hasRoof && <NumberField label="سماكة السقف" unit="mm" value={inputs.roofThicknessMm} onChange={(v) => set('roofThicknessMm', v)} />}
          </ResultSection>
          <ResultSection title="حديد الجدار">
            <FieldGroup cols={2}>
              <NumberField label="قطر رأسي" unit="mm" value={inputs.wallVerticalDiameterMm} onChange={(v) => set('wallVerticalDiameterMm', v)} />
              <NumberField label="تباعد رأسي" unit="mm" value={inputs.wallVerticalSpacingMm} onChange={(v) => set('wallVerticalSpacingMm', v)} />
              <NumberField label="قطر أفقي" unit="mm" value={inputs.wallHorizontalDiameterMm} onChange={(v) => set('wallHorizontalDiameterMm', v)} />
              <NumberField label="تباعد أفقي" unit="mm" value={inputs.wallHorizontalSpacingMm} onChange={(v) => set('wallHorizontalSpacingMm', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="حديد القاعدة والسقف">
            <FieldGroup cols={2}>
              <NumberField label="قطر حديد القاعدة" unit="mm" value={inputs.baseDiameterMm} onChange={(v) => set('baseDiameterMm', v)} />
              <NumberField label="تباعد حديد القاعدة" unit="mm" value={inputs.baseSpacingMm} onChange={(v) => set('baseSpacingMm', v)} />
              {inputs.hasRoof && (
                <>
                  <NumberField label="قطر حديد السقف" unit="mm" value={inputs.roofDiameterMm} onChange={(v) => set('roofDiameterMm', v)} />
                  <NumberField label="تباعد حديد السقف" unit="mm" value={inputs.roofSpacingMm} onChange={(v) => set('roofSpacingMm', v)} />
                </>
              )}
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
            ref={r.reportRef} sheetNumber="S2-06" sheetTitle="حديد الخزانات" reportNumber={r.reportNumber || '—'} dateStr={dateStr}
            projectName={r.meta.projectName} engineerName={r.meta.engineerName} logoDataUrl={r.meta.logoDataUrl}
            signatureDataUrl={r.meta.signatureDataUrl} qrDataUrl={r.qrDataUrl} inputRows={inputRows} results={res} warnings={r.warnings}
          />
        </div>
      )}
    </div>
  );
}
