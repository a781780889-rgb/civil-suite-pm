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

const LABELS = {
  beam: { title: 'حديد الكمرات', sheet: 'S2-03-A' },
  tie_beam: { title: 'حديد الميدات (الشدادات الأرضية)', sheet: 'S2-03-B' },
  girder: { title: 'حديد الجسور', sheet: 'S2-03-C' },
};

export default function LinearRebarCalculator({ memberFamily }) {
  const meta = LABELS[memberFamily];
  const [inputs, setInputs] = useState({
    spanM: memberFamily === 'girder' ? 8 : memberFamily === 'tie_beam' ? 4.5 : 6,
    numberOfSpans: memberFamily === 'tie_beam' ? 5 : 1,
    supportWidthMm: 400,
    widthMm: memberFamily === 'girder' ? 400 : memberFamily === 'tie_beam' ? 250 : 300,
    heightMm: memberFamily === 'girder' ? 800 : memberFamily === 'tie_beam' ? 400 : 550,
    coverMm: memberFamily === 'tie_beam' ? 50 : 40,
    fcMPa: 25,
    fyMPa: 420,
    bottomDiameterMm: memberFamily === 'girder' ? 25 : 20,
    bottomCount: memberFamily === 'girder' ? 4 : 3,
    hasTop: true,
    topDiameterMm: memberFamily === 'girder' ? 20 : 16,
    topCount: memberFamily === 'girder' ? 3 : 2,
    stirrupDiameterMm: memberFamily === 'girder' ? 12 : 10,
    stirrupSpacingMm: 200,
    stirrupHookAngleDeg: 135,
    stirrupExtraLegs: 0,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const r = useCalculatorReport(`rebar_${memberFamily}`, meta.title);
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }

  function handleCalculate() {
    r.handleCalculate({
      memberFamily,
      spanM: inputs.spanM,
      numberOfSpans: inputs.numberOfSpans,
      supportWidthMm: inputs.supportWidthMm,
      widthMm: inputs.widthMm,
      heightMm: inputs.heightMm,
      coverMm: inputs.coverMm,
      fcMPa: inputs.fcMPa,
      fyMPa: inputs.fyMPa,
      bottom: { diameterMm: inputs.bottomDiameterMm, count: inputs.bottomCount },
      hasTop: inputs.hasTop,
      top: { diameterMm: inputs.topDiameterMm, count: inputs.topCount },
      stirrup: { diameterMm: inputs.stirrupDiameterMm, spacingMm: inputs.stirrupSpacingMm, hookAngleDeg: inputs.stirrupHookAngleDeg, extraLegsCount: inputs.stirrupExtraLegs },
      wastePct: priceState.wastePct,
      priceList: priceState,
    });
  }

  const inputRows = [
    { label: 'البحر', value: `${inputs.spanM} m × ${inputs.numberOfSpans} بحر` },
    { label: 'أبعاد المقطع', value: `${inputs.widthMm}×${inputs.heightMm}mm` },
    { label: 'الحديد السفلي', value: `${inputs.bottomCount}Ø${inputs.bottomDiameterMm}mm` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber={meta.sheet}
        sheetTitle={meta.title}
        sheetSubtitle="حديد علوي/سفلي + كانات - تثبيت حقيقي عند المساند"
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
          <ResultSection title="البحر والمساند">
            <FieldGroup cols={2}>
              <NumberField label="بحر واحد" unit="m" value={inputs.spanM} onChange={(v) => set('spanM', v)} />
              <NumberField label="عدد الأبحاث (استمرارية)" value={inputs.numberOfSpans} onChange={(v) => set('numberOfSpans', v)} />
              <NumberField label="عرض المسند (عمود/حائط)" unit="mm" value={inputs.supportWidthMm} onChange={(v) => set('supportWidthMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="أبعاد المقطع">
            <FieldGroup cols={2}>
              <NumberField label="العرض" unit="mm" value={inputs.widthMm} onChange={(v) => set('widthMm', v)} />
              <NumberField label="الارتفاع" unit="mm" value={inputs.heightMm} onChange={(v) => set('heightMm', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="الحديد الطولي">
            <FieldGroup cols={2}>
              <NumberField label="قطر الحديد السفلي" unit="mm" value={inputs.bottomDiameterMm} onChange={(v) => set('bottomDiameterMm', v)} />
              <NumberField label="عدد الأسياخ السفلية" value={inputs.bottomCount} onChange={(v) => set('bottomCount', v)} />
            </FieldGroup>
            <ToggleField label="يوجد حديد علوي" checked={inputs.hasTop} onChange={(v) => set('hasTop', v)} />
            {inputs.hasTop && (
              <FieldGroup cols={2}>
                <NumberField label="قطر الحديد العلوي" unit="mm" value={inputs.topDiameterMm} onChange={(v) => set('topDiameterMm', v)} />
                <NumberField label="عدد الأسياخ العلوية" value={inputs.topCount} onChange={(v) => set('topCount', v)} />
              </FieldGroup>
            )}
          </ResultSection>

          <ResultSection title="الكانات">
            <FieldGroup cols={2}>
              <NumberField label="القطر" unit="mm" value={inputs.stirrupDiameterMm} onChange={(v) => set('stirrupDiameterMm', v)} />
              <NumberField label="التباعد" unit="mm" value={inputs.stirrupSpacingMm} onChange={(v) => set('stirrupSpacingMm', v)} />
              <NumberField label="أشواط إضافية" value={inputs.stirrupExtraLegs} onChange={(v) => set('stirrupExtraLegs', v)} required={false} />
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
                <ResultRow label="الطول الكلي للعنصر" value={res.geometry.totalLengthM} unit="m" />
                <ResultRow label="حجم الخرسانة" value={res.geometry.volumeM3} unit="m³" />
                <ResultRow label="عدد الكانات" value={res.stirrupCount} />
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
