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

const SHAPE_OPTIONS = [{ value: 'rectangular', label: 'مستطيل/مربع' }, { value: 'circular', label: 'دائري' }];
const TIE_SHAPE_OPTIONS = [
  { value: 'rectangular', label: 'مستطيلة' },
  { value: 'square', label: 'مربعة' },
  { value: 'circular', label: 'دائرية' },
  { value: 'polygonal', label: 'متعددة الأضلاع' },
];

export default function ColumnPileRebarCalculator({ memberType }) {
  const isColumn = memberType === 'column';
  const [inputs, setInputs] = useState({
    shape: isColumn ? 'rectangular' : 'circular',
    widthMm: 450,
    depthMm: 450,
    diameterMm: 600,
    heightM: isColumn ? 3.5 : 15,
    coverMm: isColumn ? 40 : 75,
    fcMPa: 30,
    fyMPa: 420,
    longDiameterMm: 20,
    longCount: 8,
    spliceType: 'compression',
    includeLapAtTop: true,
    tieShape: isColumn ? 'rectangular' : 'circular',
    tieSidesCount: 8,
    tieDiameterMm: 10,
    tieSpacingMm: 200,
    tieHookAngleDeg: 135,
    tieExtraLegs: 0,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const sheetNumber = isColumn ? 'S2-02-A' : 'S2-02-B';
  const title = isColumn ? 'حديد الأعمدة' : 'حديد الخوازيق';
  const r = useCalculatorReport(`rebar_${memberType}`, title);
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }

  function handleCalculate() {
    r.handleCalculate({
      memberType,
      shape: inputs.shape,
      widthMm: inputs.widthMm,
      depthMm: inputs.depthMm,
      diameterMm: inputs.diameterMm,
      heightM: inputs.heightM,
      coverMm: inputs.coverMm,
      fcMPa: inputs.fcMPa,
      fyMPa: inputs.fyMPa,
      longitudinal: { diameterMm: inputs.longDiameterMm, count: inputs.longCount },
      spliceType: inputs.spliceType,
      includeLapAtTop: inputs.includeLapAtTop,
      tie: {
        shape: inputs.tieShape,
        sidesCount: inputs.tieSidesCount,
        diameterMm: inputs.tieDiameterMm,
        spacingMm: inputs.tieSpacingMm,
        hookAngleDeg: inputs.tieHookAngleDeg,
        extraLegsCount: inputs.tieExtraLegs,
      },
      wastePct: priceState.wastePct,
      priceList: priceState,
    });
  }

  const inputRows = [
    { label: 'الشكل', value: inputs.shape === 'circular' ? `Ø${inputs.diameterMm}mm` : `${inputs.widthMm}×${inputs.depthMm}mm` },
    { label: 'الارتفاع/الطول', value: `${inputs.heightM} m` },
    { label: 'الحديد الطولي', value: `${inputs.longCount} Ø${inputs.longDiameterMm}mm` },
    { label: 'الكانات', value: `Ø${inputs.tieDiameterMm}@${inputs.tieSpacingMm}mm` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber={sheetNumber}
        sheetTitle={title}
        sheetSubtitle="حديد طولي + كانات/حلزوني - أطوال تراكب حقيقية"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave(title)}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf(title, `تقرير-${title}.pdf`)}
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
          <ResultSection title="الشكل والأبعاد">
            <FieldGroup cols={2}>
              <SelectField label="الشكل" value={inputs.shape} onChange={(v) => set('shape', v)} options={SHAPE_OPTIONS} />
              <NumberField label="الارتفاع/الطول" unit="m" value={inputs.heightM} onChange={(v) => set('heightM', v)} />
              {inputs.shape === 'circular' ? (
                <NumberField label="القطر" unit="mm" value={inputs.diameterMm} onChange={(v) => set('diameterMm', v)} />
              ) : (
                <>
                  <NumberField label="العرض" unit="mm" value={inputs.widthMm} onChange={(v) => set('widthMm', v)} />
                  <NumberField label="العمق" unit="mm" value={inputs.depthMm} onChange={(v) => set('depthMm', v)} />
                </>
              )}
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="الحديد الطولي">
            <FieldGroup cols={2}>
              <NumberField label="القطر" unit="mm" value={inputs.longDiameterMm} onChange={(v) => set('longDiameterMm', v)} />
              <NumberField label="العدد" value={inputs.longCount} onChange={(v) => set('longCount', v)} />
              <SelectField
                label="نوع التراكب"
                value={inputs.spliceType}
                onChange={(v) => set('spliceType', v)}
                options={[{ value: 'compression', label: 'ضغط (Compression)' }, { value: 'tension', label: 'شد (Tension - Class B)' }]}
              />
            </FieldGroup>
            <ToggleField label="إضافة تراكب عند القمة للاستمرارية للطابق التالي" checked={inputs.includeLapAtTop} onChange={(v) => set('includeLapAtTop', v)} />
          </ResultSection>

          <ResultSection title="الكانات/الأربطة">
            <FieldGroup cols={2}>
              <SelectField label="الشكل" value={inputs.tieShape} onChange={(v) => set('tieShape', v)} options={TIE_SHAPE_OPTIONS} />
              {inputs.tieShape === 'polygonal' && <NumberField label="عدد الأضلاع" value={inputs.tieSidesCount} onChange={(v) => set('tieSidesCount', v)} />}
              <NumberField label="القطر" unit="mm" value={inputs.tieDiameterMm} onChange={(v) => set('tieDiameterMm', v)} />
              <NumberField label="التباعد" unit="mm" value={inputs.tieSpacingMm} onChange={(v) => set('tieSpacingMm', v)} />
              <SelectField
                label="زاوية الخطاف"
                value={String(inputs.tieHookAngleDeg)}
                onChange={(v) => set('tieHookAngleDeg', Number(v))}
                options={[{ value: '90', label: '90°' }, { value: '135', label: '135°' }, { value: '180', label: '180°' }]}
              />
              <NumberField label="أشواط إضافية (Cross-ties)" value={inputs.tieExtraLegs} onChange={(v) => set('tieExtraLegs', v)} required={false} />
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
              <ResultSection title="تفاصيل التراكب" tone="highlight">
                <ResultRow label="طول التراكب المحسوب" value={res.splice.lapLengthMm} unit="mm" />
                <ResultRow label="الطول المطلوب لكل سيخ طولي" value={res.splice.requiredLengthPerBarM} unit="m" />
              </ResultSection>
              <BarScheduleTable barGroups={res.barGroups} />
              <ResultSection title="الإجماليات">
                <ResultRow label="الوزن الصافي" value={res.totals.totalWeightKg} unit="kg" />
                <ResultRow label="حجم الخرسانة" value={res.geometry.volumeM3} unit="m³" />
                <ResultRow label="عدد الكانات" value={res.tieCount} />
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
            sheetNumber={sheetNumber}
            sheetTitle={title}
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
