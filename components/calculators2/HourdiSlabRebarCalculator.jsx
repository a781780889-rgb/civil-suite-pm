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

export default function HourdiSlabRebarCalculator() {
  const [inputs, setInputs] = useState({
    spanM: 5, widthM: 6, ribWidthMm: 120, blockWidthMm: 400, toppingThicknessMm: 50, ribDepthMm: 250,
    coverMm: 20, fcMPa: 25, fyMPa: 420, supportWidthMm: 300,
    ribBottomDiameterMm: 12, ribBottomCountPerRib: 2, ribHasTopBar: true, ribTopDiameterMm: 10, ribTopCountPerRib: 1,
    meshDiameterMm: 6, meshSpacingMm: 200,
  });
  const [priceState, setPriceState] = useState(defaultPriceState());
  const r = useCalculatorReport('rebar_hourdi_slab', 'حديد البلاطات الهوردي');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({
      spanM: inputs.spanM, widthM: inputs.widthM, ribWidthMm: inputs.ribWidthMm, blockWidthMm: inputs.blockWidthMm,
      toppingThicknessMm: inputs.toppingThicknessMm, ribDepthMm: inputs.ribDepthMm, coverMm: inputs.coverMm,
      fcMPa: inputs.fcMPa, fyMPa: inputs.fyMPa, supportWidthMm: inputs.supportWidthMm,
      ribBottomBars: { diameterMm: inputs.ribBottomDiameterMm, countPerRib: inputs.ribBottomCountPerRib },
      ribHasTopBar: inputs.ribHasTopBar,
      ribTopBar: { diameterMm: inputs.ribTopDiameterMm, countPerRib: inputs.ribTopCountPerRib },
      meshDiameterMm: inputs.meshDiameterMm, meshSpacingMm: inputs.meshSpacingMm,
      wastePct: priceState.wastePct, priceList: priceState,
    });
  }
  const inputRows = [
    { label: 'البحر × العرض', value: `${inputs.spanM}×${inputs.widthM} m` },
    { label: 'عرض العصب/البلوك', value: `${inputs.ribWidthMm}/${inputs.blockWidthMm} mm` },
    { label: 'حديد العصب السفلي', value: `${inputs.ribBottomCountPerRib}×Ø${inputs.ribBottomDiameterMm}mm` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S2-04-B" sheetTitle="حديد البلاطات الهوردي" sheetSubtitle="حديد الأعصاب + شبكة التوزيع العلوية"
        projectName={r.meta.projectName} onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName} onEngineerNameChange={r.meta.setEngineerName} dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate} calculating={r.calculating}
        onSave={() => r.handleSave('بلاطة هوردي')} saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('بلاطة هوردي', 'تقرير-حديد-بلاطة-هوردي.pdf')} exportStatus={r.exportStatus}
        canSave={!!res} canExport={!!res}
        logoDataUrl={r.meta.logoDataUrl} onLogoFile={r.meta.handleLogoFile}
        signatureDataUrl={r.meta.signatureDataUrl} onSignatureFile={r.meta.handleSignatureFile}
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <ResultSection title="أبعاد البلاطة">
            <FieldGroup cols={2}>
              <NumberField label="البحر (اتجاه الأعصاب)" unit="m" value={inputs.spanM} onChange={(v) => set('spanM', v)} />
              <NumberField label="العرض" unit="m" value={inputs.widthM} onChange={(v) => set('widthM', v)} />
              <NumberField label="عرض المسند" unit="mm" value={inputs.supportWidthMm} onChange={(v) => set('supportWidthMm', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="هندسة الأعصاب والبلوك">
            <FieldGroup cols={2}>
              <NumberField label="عرض العصب" unit="mm" value={inputs.ribWidthMm} onChange={(v) => set('ribWidthMm', v)} />
              <NumberField label="عرض البلوك" unit="mm" value={inputs.blockWidthMm} onChange={(v) => set('blockWidthMm', v)} />
              <NumberField label="عمق العصب" unit="mm" value={inputs.ribDepthMm} onChange={(v) => set('ribDepthMm', v)} />
              <NumberField label="سماكة الطبقة العلوية" unit="mm" value={inputs.toppingThicknessMm} onChange={(v) => set('toppingThicknessMm', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="حديد الأعصاب">
            <FieldGroup cols={2}>
              <NumberField label="قطر الحديد السفلي" unit="mm" value={inputs.ribBottomDiameterMm} onChange={(v) => set('ribBottomDiameterMm', v)} />
              <NumberField label="عدد الأسياخ لكل عصب" value={inputs.ribBottomCountPerRib} onChange={(v) => set('ribBottomCountPerRib', v)} />
            </FieldGroup>
            <ToggleField label="يوجد حديد علوي فوق المساند" checked={inputs.ribHasTopBar} onChange={(v) => set('ribHasTopBar', v)} />
            {inputs.ribHasTopBar && (
              <FieldGroup cols={2}>
                <NumberField label="قطر الحديد العلوي" unit="mm" value={inputs.ribTopDiameterMm} onChange={(v) => set('ribTopDiameterMm', v)} />
                <NumberField label="عدد الأسياخ لكل عصب" value={inputs.ribTopCountPerRib} onChange={(v) => set('ribTopCountPerRib', v)} />
              </FieldGroup>
            )}
          </ResultSection>
          <ResultSection title="شبكة التوزيع العلوية">
            <FieldGroup cols={2}>
              <NumberField label="القطر" unit="mm" value={inputs.meshDiameterMm} onChange={(v) => set('meshDiameterMm', v)} />
              <NumberField label="التباعد" unit="mm" value={inputs.meshSpacingMm} onChange={(v) => set('meshSpacingMm', v)} />
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
              <ResultSection title="هندسة الأعصاب" tone="highlight">
                <ResultRow label="عدد الأعصاب" value={res.geometry.ribCount} emphasis />
                <ResultRow label="تباعد الأعصاب" value={res.geometry.ribPitchMm} unit="mm" />
                <ResultRow label="عدد البلوكات المطلوبة (استرشادي)" value={res.hollowBlocksNeeded} />
              </ResultSection>
              <BarScheduleTable barGroups={res.barGroups} />
              <ResultSection title="الإجماليات">
                <ResultRow label="حجم الخرسانة" value={res.geometry.concreteVolumeM3} unit="m³" />
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
            ref={r.reportRef} sheetNumber="S2-04-B" sheetTitle="حديد البلاطات الهوردي" reportNumber={r.reportNumber || '—'} dateStr={dateStr}
            projectName={r.meta.projectName} engineerName={r.meta.engineerName} logoDataUrl={r.meta.logoDataUrl}
            signatureDataUrl={r.meta.signatureDataUrl} qrDataUrl={r.qrDataUrl} inputRows={inputRows} results={res} warnings={r.warnings}
          />
        </div>
      )}
    </div>
  );
}
