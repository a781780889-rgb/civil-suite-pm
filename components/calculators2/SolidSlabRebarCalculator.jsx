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

export default function SolidSlabRebarCalculator() {
  const [inputs, setInputs] = useState({
    lengthM: 5, widthM: 4, thicknessMm: 160, coverMm: 20, fcMPa: 25, fyMPa: 420,
    bottomDir1DiameterMm: 12, bottomDir1SpacingMm: 150, bottomDir2DiameterMm: 12, bottomDir2SpacingMm: 150,
    hasTop: false, topDir1DiameterMm: 10, topDir1SpacingMm: 200, topDir2DiameterMm: 10, topDir2SpacingMm: 200,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const r = useCalculatorReport('rebar_solid_slab', 'حديد البلاطات المصمتة');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({
      lengthM: inputs.lengthM, widthM: inputs.widthM, thicknessMm: inputs.thicknessMm, coverMm: inputs.coverMm, fcMPa: inputs.fcMPa, fyMPa: inputs.fyMPa,
      bottom: { dir1DiameterMm: inputs.bottomDir1DiameterMm, dir1SpacingMm: inputs.bottomDir1SpacingMm, dir2DiameterMm: inputs.bottomDir2DiameterMm, dir2SpacingMm: inputs.bottomDir2SpacingMm },
      hasTop: inputs.hasTop,
      top: { dir1DiameterMm: inputs.topDir1DiameterMm, dir1SpacingMm: inputs.topDir1SpacingMm, dir2DiameterMm: inputs.topDir2DiameterMm, dir2SpacingMm: inputs.topDir2SpacingMm },
      wastePct: priceState.wastePct, priceList: priceState,
    });
  }
  const inputRows = [
    { label: 'الأبعاد', value: `${inputs.lengthM}×${inputs.widthM} m` },
    { label: 'السماكة', value: `${inputs.thicknessMm} mm` },
    { label: 'حديد سفلي', value: `Ø${inputs.bottomDir1DiameterMm}@${inputs.bottomDir1SpacingMm}mm` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S2-04-A" sheetTitle="حديد البلاطات المصمتة" sheetSubtitle="شبكة حديد باتجاهين"
        projectName={r.meta.projectName} onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName} onEngineerNameChange={r.meta.setEngineerName} dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate} calculating={r.calculating}
        onSave={() => r.handleSave('بلاطة مصمتة')} saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('بلاطة مصمتة', 'تقرير-حديد-بلاطة-مصمتة.pdf')} exportStatus={r.exportStatus}
        canSave={!!res} canExport={!!res}
        logoDataUrl={r.meta.logoDataUrl} onLogoFile={r.meta.handleLogoFile}
        signatureDataUrl={r.meta.signatureDataUrl} onSignatureFile={r.meta.handleSignatureFile}
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
                <ResultRow label="المساحة" value={res.geometry.areaM2} unit="m²" />
                <ResultRow label="حجم الخرسانة" value={res.geometry.volumeM3} unit="m³" />
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
            ref={r.reportRef} sheetNumber="S2-04-A" sheetTitle="حديد البلاطات المصمتة" reportNumber={r.reportNumber || '—'} dateStr={dateStr}
            projectName={r.meta.projectName} engineerName={r.meta.engineerName} logoDataUrl={r.meta.logoDataUrl}
            signatureDataUrl={r.meta.signatureDataUrl} qrDataUrl={r.qrDataUrl} inputRows={inputRows} results={res} warnings={r.warnings}
          />
        </div>
      )}
    </div>
  );
}
