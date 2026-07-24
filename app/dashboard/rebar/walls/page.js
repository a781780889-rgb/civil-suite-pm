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

export default function RebarWallsPage() {
  const [inputs, setInputs] = useState({
    wallShape: 'straight', lengthM: 10, diameterM: 6, heightM: 3, thicknessMm: 250, coverMm: 40, fcMPa: 25, fyMPa: 420,
    verticalDiameterMm: 12, verticalSpacingMm: 200, horizontalDiameterMm: 12, horizontalSpacingMm: 200, layers: 2,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const r = useCalculatorReport('rebar_wall', 'حديد الجدران');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({
      usageContext: 'wall', wallShape: inputs.wallShape,
      lengthM: inputs.wallShape === 'straight' ? inputs.lengthM : undefined,
      diameterM: inputs.wallShape === 'circular' ? inputs.diameterM : undefined,
      heightM: inputs.heightM, thicknessMm: inputs.thicknessMm, coverMm: inputs.coverMm, fcMPa: inputs.fcMPa, fyMPa: inputs.fyMPa,
      vertical: { diameterMm: inputs.verticalDiameterMm, spacingMm: inputs.verticalSpacingMm },
      horizontal: { diameterMm: inputs.horizontalDiameterMm, spacingMm: inputs.horizontalSpacingMm },
      layers: inputs.layers,
      wastePct: priceState.wastePct, priceList: priceState,
    });
  }
  const inputRows = [
    { label: 'الشكل', value: inputs.wallShape === 'circular' ? `دائري Ø${inputs.diameterM}m` : `مستقيم ${inputs.lengthM}m` },
    { label: 'الارتفاع', value: `${inputs.heightM} m` },
    { label: 'السماكة', value: `${inputs.thicknessMm} mm` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S2-05" sheetTitle="حديد الجدران" sheetSubtitle="حديد رأسي/أفقي - مستقيم أو حلقات مغلقة دائرية"
        projectName={r.meta.projectName} onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName} onEngineerNameChange={r.meta.setEngineerName} dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate} calculating={r.calculating}
        onSave={() => r.handleSave('جدار')} saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('جدار', 'تقرير-حديد-جدار.pdf')} exportStatus={r.exportStatus}
        canSave={!!res} canExport={!!res}
        logoDataUrl={r.meta.logoDataUrl} onLogoFile={r.meta.handleLogoFile}
        signatureDataUrl={r.meta.signatureDataUrl} onSignatureFile={r.meta.handleSignatureFile}
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <ResultSection title="الشكل والأبعاد">
            <FieldGroup cols={2}>
              <SelectField label="الشكل" value={inputs.wallShape} onChange={(v) => set('wallShape', v)} options={[{ value: 'straight', label: 'مستقيم' }, { value: 'circular', label: 'دائري (حلقي)' }]} />
              <NumberField label="الارتفاع" unit="m" value={inputs.heightM} onChange={(v) => set('heightM', v)} />
              {inputs.wallShape === 'circular' ? (
                <NumberField label="القطر" unit="m" value={inputs.diameterM} onChange={(v) => set('diameterM', v)} />
              ) : (
                <NumberField label="الطول" unit="m" value={inputs.lengthM} onChange={(v) => set('lengthM', v)} />
              )}
              <NumberField label="السماكة" unit="mm" value={inputs.thicknessMm} onChange={(v) => set('thicknessMm', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
              <NumberField label="عدد الطبقات (وجهان=2)" value={inputs.layers} onChange={(v) => set('layers', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="الحديد الرأسي والأفقي">
            <FieldGroup cols={2}>
              <NumberField label="قطر رأسي" unit="mm" value={inputs.verticalDiameterMm} onChange={(v) => set('verticalDiameterMm', v)} />
              <NumberField label="تباعد رأسي" unit="mm" value={inputs.verticalSpacingMm} onChange={(v) => set('verticalSpacingMm', v)} />
              <NumberField label="قطر أفقي" unit="mm" value={inputs.horizontalDiameterMm} onChange={(v) => set('horizontalDiameterMm', v)} />
              <NumberField label="تباعد أفقي" unit="mm" value={inputs.horizontalSpacingMm} onChange={(v) => set('horizontalSpacingMm', v)} />
            </FieldGroup>
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
            ref={r.reportRef} sheetNumber="S2-05" sheetTitle="حديد الجدران" reportNumber={r.reportNumber || '—'} dateStr={dateStr}
            projectName={r.meta.projectName} engineerName={r.meta.engineerName} logoDataUrl={r.meta.logoDataUrl}
            signatureDataUrl={r.meta.signatureDataUrl} qrDataUrl={r.qrDataUrl} inputRows={inputRows} results={res} warnings={r.warnings}
          />
        </div>
      )}
    </div>
  );
}
