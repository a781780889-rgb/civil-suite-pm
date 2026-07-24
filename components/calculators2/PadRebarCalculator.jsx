'use client';

import { useState } from 'react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, FieldGroup, ToggleField } from '@/components/ui/Field.jsx';
import { ResultSection, ResultRow, WarningsList, ErrorsList, EmptyResultsHint } from '@/components/ui/Results.jsx';
import BarScheduleTable from '@/components/BarScheduleTable.jsx';
import PriceListPanel, { defaultPriceState } from '@/components/PriceListPanel.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

const PAD_LABELS = {
  isolated: { title: 'حديد القواعد المنفصلة', sheet: 'S2-01-A' },
  combined: { title: 'حديد القواعد المشتركة', sheet: 'S2-01-B' },
  mat: { title: 'حديد اللبشة', sheet: 'S2-01-C' },
  pile_cap: { title: 'حديد القبعات الخرسانية (Pile Cap)', sheet: 'S2-01-D' },
  strip_footing: { title: 'حديد الأساسات الشريطية', sheet: 'S2-01-E' },
};

export default function PadRebarCalculator({ padType }) {
  const meta = PAD_LABELS[padType];
  const [inputs, setInputs] = useState({
    lengthM: padType === 'strip_footing' ? 20 : padType === 'mat' ? 12 : 2.3,
    widthM: padType === 'strip_footing' ? 0.8 : padType === 'mat' ? 10 : 2.3,
    thicknessMm: padType === 'pile_cap' ? 900 : padType === 'mat' ? 500 : 500,
    coverMm: 75,
    fcMPa: 25,
    fyMPa: 420,
    bottomDir1DiameterMm: 16,
    bottomDir1SpacingMm: 200,
    bottomDir2DiameterMm: 16,
    bottomDir2SpacingMm: 200,
    hasTop: padType === 'mat' || padType === 'pile_cap',
    topDir1DiameterMm: 12,
    topDir1SpacingMm: 250,
    topDir2DiameterMm: 12,
    topDir2SpacingMm: 250,
    hasDowels: padType === 'isolated' || padType === 'pile_cap',
    dowelCount: 8,
    dowelDiameterMm: 20,
    dowelColumnHeightM: 3.5,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const r = useCalculatorReport(`rebar_${padType}`, meta.title);
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }

  function handleCalculate() {
    r.handleCalculate({
      lengthM: inputs.lengthM,
      widthM: inputs.widthM,
      thicknessMm: inputs.thicknessMm,
      coverMm: inputs.coverMm,
      fcMPa: inputs.fcMPa,
      fyMPa: inputs.fyMPa,
      bottom: {
        dir1DiameterMm: inputs.bottomDir1DiameterMm,
        dir1SpacingMm: inputs.bottomDir1SpacingMm,
        dir2DiameterMm: inputs.bottomDir2DiameterMm,
        dir2SpacingMm: inputs.bottomDir2SpacingMm,
      },
      hasTop: inputs.hasTop,
      top: { dir1DiameterMm: inputs.topDir1DiameterMm, dir1SpacingMm: inputs.topDir1SpacingMm, dir2DiameterMm: inputs.topDir2DiameterMm, dir2SpacingMm: inputs.topDir2SpacingMm },
      dowels: inputs.hasDowels ? { count: inputs.dowelCount, diameterMm: inputs.dowelDiameterMm, columnHeightM: inputs.dowelColumnHeightM } : null,
      wastePct: priceState.wastePct,
      priceList: priceState,
    });
  }

  const inputRows = [
    { label: 'الطول', value: `${inputs.lengthM} m` },
    { label: 'العرض', value: `${inputs.widthM} m` },
    { label: 'السماكة', value: `${inputs.thicknessMm} mm` },
    { label: 'حديد سفلي (اتجاه 1)', value: `Ø${inputs.bottomDir1DiameterMm}@${inputs.bottomDir1SpacingMm}mm` },
    { label: 'حديد سفلي (اتجاه 2)', value: `Ø${inputs.bottomDir2DiameterMm}@${inputs.bottomDir2SpacingMm}mm` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber={meta.sheet}
        sheetTitle={meta.title}
        sheetSubtitle="حصر وتفصيل حديد حقيقي - أطوال تثبيت وخطافات فعلية"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave(meta.title)}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf(meta.title, `تقرير-${meta.title}.pdf`)}
        exportStatus={r.exportStatus}
        canSave={!!res}
        canExport={!!res}
        logoDataUrl={r.meta.logoDataUrl}
        onLogoFile={r.meta.handleLogoFile}
        signatureDataUrl={r.meta.signatureDataUrl}
        onSignatureFile={r.meta.handleSignatureFile}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <ResultSection title="الأبعاد">
            <FieldGroup cols={2}>
              <NumberField label="الطول" unit="m" value={inputs.lengthM} onChange={(v) => set('lengthM', v)} />
              <NumberField label="العرض" unit="m" value={inputs.widthM} onChange={(v) => set('widthM', v)} />
              <NumberField label="السماكة" unit="mm" value={inputs.thicknessMm} onChange={(v) => set('thicknessMm', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="الحديد السفلي">
            <FieldGroup cols={2}>
              <NumberField label="قطر الاتجاه 1" unit="mm" value={inputs.bottomDir1DiameterMm} onChange={(v) => set('bottomDir1DiameterMm', v)} />
              <NumberField label="تباعد الاتجاه 1" unit="mm" value={inputs.bottomDir1SpacingMm} onChange={(v) => set('bottomDir1SpacingMm', v)} />
              <NumberField label="قطر الاتجاه 2" unit="mm" value={inputs.bottomDir2DiameterMm} onChange={(v) => set('bottomDir2DiameterMm', v)} />
              <NumberField label="تباعد الاتجاه 2" unit="mm" value={inputs.bottomDir2SpacingMm} onChange={(v) => set('bottomDir2SpacingMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="الحديد العلوي">
            <ToggleField label="يوجد حديد علوي" checked={inputs.hasTop} onChange={(v) => set('hasTop', v)} />
            {inputs.hasTop && (
              <FieldGroup cols={2}>
                <NumberField label="قطر الاتجاه 1" unit="mm" value={inputs.topDir1DiameterMm} onChange={(v) => set('topDir1DiameterMm', v)} />
                <NumberField label="تباعد الاتجاه 1" unit="mm" value={inputs.topDir1SpacingMm} onChange={(v) => set('topDir1SpacingMm', v)} />
                <NumberField label="قطر الاتجاه 2" unit="mm" value={inputs.topDir2DiameterMm} onChange={(v) => set('topDir2DiameterMm', v)} />
                <NumberField label="تباعد الاتجاه 2" unit="mm" value={inputs.topDir2SpacingMm} onChange={(v) => set('topDir2SpacingMm', v)} />
              </FieldGroup>
            )}
          </ResultSection>

          {(padType === 'isolated' || padType === 'pile_cap' || padType === 'combined') && (
            <ResultSection title="أوتاد ربط العمود (Dowels)">
              <ToggleField label="يوجد أوتاد تسليح" checked={inputs.hasDowels} onChange={(v) => set('hasDowels', v)} />
              {inputs.hasDowels && (
                <FieldGroup cols={2}>
                  <NumberField label="عدد الأوتاد" value={inputs.dowelCount} onChange={(v) => set('dowelCount', v)} />
                  <NumberField label="قطر الأوتاد" unit="mm" value={inputs.dowelDiameterMm} onChange={(v) => set('dowelDiameterMm', v)} />
                  <NumberField label="ارتفاع الامتداد داخل العمود" unit="m" value={inputs.dowelColumnHeightM} onChange={(v) => set('dowelColumnHeightM', v)} />
                </FieldGroup>
              )}
            </ResultSection>
          )}

          <ResultSection title="مقاومة الخرسانة والحديد">
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
                <ResultRow label="الوزن الصافي" value={res.totals.totalWeightKg} unit="kg" />
                <ResultRow label="الوزن شاملاً الهدر" value={res.totals.cost.grossWeightKg} unit="kg" emphasis />
                <ResultRow label="إجمالي عدد الأسياخ" value={res.totals.totalBarCount} />
                <ResultRow label="حجم الخرسانة" value={res.geometry.volumeM3} unit="m³" />
              </ResultSection>
              <ResultSection title="التكلفة">
                <ResultRow label="تكلفة الحديد" value={res.totals.cost.steelCost.toLocaleString('en-US')} unit="ريال" />
                <ResultRow label="القص + التشكيل + التركيب + النقل" value={(res.totals.cost.cuttingCost + res.totals.cost.bendingCost + res.totals.cost.installationCost + res.totals.cost.transportCost).toLocaleString('en-US')} unit="ريال" />
                <ResultRow label="التكلفة النهائية (بعد الضريبة والخصم)" value={res.totals.cost.finalCost.toLocaleString('en-US')} unit="ريال" emphasis />
              </ResultSection>
            </>
          )}
        </div>
      </div>

      {res && (
        <div style={{ position: 'fixed', top: 0, left: -10000 }}>
          <PdfReport
            ref={r.reportRef}
            sheetNumber={meta.sheet}
            sheetTitle={meta.title}
            reportNumber={r.reportNumber || '—'}
            dateStr={dateStr}
            projectName={r.meta.projectName}
            engineerName={r.meta.engineerName}
            logoDataUrl={r.meta.logoDataUrl}
            signatureDataUrl={r.meta.signatureDataUrl}
            qrDataUrl={r.qrDataUrl}
            inputRows={inputRows}
            results={res}
            warnings={r.warnings}
          />
        </div>
      )}
    </div>
  );
}
