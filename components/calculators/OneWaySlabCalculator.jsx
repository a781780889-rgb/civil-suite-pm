'use client';

import { useState } from 'react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, SelectField, FieldGroup } from '@/components/ui/Field.jsx';
import { ResultSection, ResultRow, WarningsList, ErrorsList, EmptyResultsHint, StatusStamp } from '@/components/ui/Results.jsx';
import MaterialsPanel, { defaultMaterialsState, toMaterialsPayload } from '@/components/MaterialsPanel.jsx';
import MaterialsResult from '@/components/MaterialsResult.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

const EDGE_OPTIONS = [
  { value: 'simple', label: 'بسيط الإسناد' },
  { value: 'cantilever', label: 'كابولي' },
  { value: 'continuous', label: 'مستمر' },
  { value: 'oneEndContinuous', label: 'مستمر من طرف واحد' },
];

export default function OneWaySlabCalculator() {
  const [inputs, setInputs] = useState({
    spanM: 4,
    edgeCondition: 'simple',
    superimposedDeadKPa: 1.5,
    liveLoadKPa: 2,
    thicknessMm: 150,
    fcMPa: 25,
    fyMPa: 420,
    coverMm: 20,
    barDiaMm: 12,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('one_way_slab', 'بلاطة أحادية الاتجاه');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({ ...inputs, materials: toMaterialsPayload(materials) });
  }

  const inputRows = [
    { label: 'البحر', value: `${inputs.spanM} m` },
    { label: 'حالة الإسناد', value: EDGE_OPTIONS.find((o) => o.value === inputs.edgeCondition)?.label },
    { label: 'السماكة', value: `${inputs.thicknessMm} mm` },
    { label: 'الحمل الحي', value: `${inputs.liveLoadKPa} kPa` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-05-A"
        sheetTitle="حاسبة البلاطات أحادية الاتجاه"
        sheetSubtitle="One-Way Slab — تصميم كشريحة بعرض 1م"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('بلاطة أحادية الاتجاه')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('بلاطة أحادية الاتجاه', 'تقرير-بلاطة-احادية.pdf')}
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
          <ResultSection title="البحر وحالة الإسناد">
            <FieldGroup cols={2}>
              <NumberField label="البحر" unit="m" value={inputs.spanM} onChange={(v) => set('spanM', v)} />
              <SelectField label="حالة الإسناد" value={inputs.edgeCondition} onChange={(v) => set('edgeCondition', v)} options={EDGE_OPTIONS} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="الأحمال والسماكة">
            <FieldGroup cols={2}>
              <NumberField label="حمل ميت إضافي (تشطيبات)" unit="kPa" value={inputs.superimposedDeadKPa} onChange={(v) => set('superimposedDeadKPa', v)} />
              <NumberField label="الحمل الحي" unit="kPa" value={inputs.liveLoadKPa} onChange={(v) => set('liveLoadKPa', v)} />
              <NumberField label="سماكة البلاطة" unit="mm" value={inputs.thicknessMm} onChange={(v) => set('thicknessMm', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="مواصفات المواد">
            <FieldGroup cols={2}>
              <NumberField label="مقاومة الخرسانة f'c" unit="MPa" value={inputs.fcMPa} onChange={(v) => set('fcMPa', v)} />
              <NumberField label="إجهاد خضوع الحديد fy" unit="MPa" value={inputs.fyMPa} onChange={(v) => set('fyMPa', v)} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="مواد الخرسانة (لكل م² × السماكة)">
            <MaterialsPanel value={materials} onChange={setMaterials} />
          </ResultSection>
        </div>

        <div className="space-y-4">
          <ErrorsList errors={r.errors} />
          {!res && !r.errors.length && <EmptyResultsHint />}
          {res && (
            <>
              <WarningsList warnings={r.warnings} />
              <ResultSection title="الأحمال المصممة" tone="highlight">
                <ResultRow label="الوزن الذاتي" value={res.loads.selfWeightKPa} unit="kPa" />
                <ResultRow label="الحمل المصعّد wu" value={res.loads.wuKPa} unit="kPa" emphasis />
              </ResultSection>
              <ResultSection title="التصميم">
                <p className="text-xs text-ink-soft mb-2">{res.flexure.formula}</p>
                <ResultRow label="التسليح الرئيسي (سفلي)" value={res.flexure.reinforcementMainPos} emphasis />
                {res.flexure.MnegKNm_per_m > 0 && <ResultRow label="التسليح الرئيسي (علوي)" value={res.flexure.reinforcementMainNeg} emphasis />}
                <ResultRow label="تسليح التوزيع" value={res.flexure.reinforcementDistribution} />
              </ResultSection>
              <ResultSection title="فحص القص والترخيم">
                <div className="mb-2 flex gap-2">
                  <StatusStamp status={res.shear.VuKN_per_m <= res.shear.phiVcKN_per_m ? 'pass' : 'fail'} label="القص" />
                  <StatusStamp status={res.deflection.ok ? 'pass' : 'warn'} label="الترخيم" />
                </div>
                <ResultRow label="قوة القص (لكل م)" value={res.shear.VuKN_per_m} unit="kN" />
                <ResultRow label="مقاومة القص φVc (لكل م)" value={res.shear.phiVcKN_per_m} unit="kN" />
              </ResultSection>
              <ResultSection title="الكميات (لكل متر عرض)">
                <ResultRow label="حجم الخرسانة" value={res.quantities.concreteVolumeM3PerMeterWidth} unit="m³/m" emphasis />
                <ResultRow label="وزن الحديد" value={res.quantities.steelWeightKgPerM2} unit="kg/m²" />
              </ResultSection>
              <MaterialsResult materials={res.materialsPerMeterWidth} volumeLabel="حجم الخرسانة (لكل متر عرض)" />
            </>
          )}
        </div>
      </div>

      {res && (
        <div style={{ position: 'fixed', top: 0, left: -10000 }}>
          <PdfReport
            ref={r.reportRef}
            sheetNumber="S-05-A"
            sheetTitle="حاسبة البلاطات أحادية الاتجاه"
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
