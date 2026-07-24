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

const SUPPORT_OPTIONS = [
  { value: 'simple', label: 'بسيط الإسناد' },
  { value: 'cantilever', label: 'كابولي' },
  { value: 'continuous', label: 'مستمر (بحر داخلي)' },
  { value: 'oneEndContinuous', label: 'مستمر من طرف واحد' },
];

export default function BeamsPage() {
  const [inputs, setInputs] = useState({
    spanM: 6,
    supportType: 'simple',
    superimposedDeadKNm: 5,
    liveLoadKNm: 8,
    widthMm: 300,
    heightMm: 550,
    fcMPa: 25,
    fyMPa: 420,
    coverMm: 40,
    stirrupDiaMm: 10,
    stirrupLegs: 2,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('beam', 'كمرة خرسانية');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({ ...inputs, materials: toMaterialsPayload(materials) });
  }

  const inputRows = [
    { label: 'البحر', value: `${inputs.spanM} m` },
    { label: 'حالة الإسناد', value: SUPPORT_OPTIONS.find((o) => o.value === inputs.supportType)?.label },
    { label: 'حمل ميت إضافي', value: `${inputs.superimposedDeadKNm} kN/m` },
    { label: 'حمل حي', value: `${inputs.liveLoadKNm} kN/m` },
    { label: 'أبعاد المقطع', value: `${inputs.widthMm} × ${inputs.heightMm} mm` },
    { label: 'مقاومة الخرسانة f\'c', value: `${inputs.fcMPa} MPa` },
  ];

  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-04"
        sheetTitle="حاسبة الكمرات"
        sheetSubtitle="انحناء، قص، وترخيم — ACI 318"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('كمرة')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('كمرة', 'تقرير-كمرة.pdf')}
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
              <SelectField label="حالة الإسناد" value={inputs.supportType} onChange={(v) => set('supportType', v)} options={SUPPORT_OPTIONS} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="الأحمال (الوزن الذاتي يُحسب تلقائياً ويُضاف)">
            <FieldGroup cols={2}>
              <NumberField label="حمل ميت إضافي (تشطيبات)" unit="kN/m" value={inputs.superimposedDeadKNm} onChange={(v) => set('superimposedDeadKNm', v)} />
              <NumberField label="الحمل الحي" unit="kN/m" value={inputs.liveLoadKNm} onChange={(v) => set('liveLoadKNm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="أبعاد المقطع">
            <FieldGroup cols={2}>
              <NumberField label="العرض b" unit="mm" value={inputs.widthMm} onChange={(v) => set('widthMm', v)} />
              <NumberField label="الارتفاع h" unit="mm" value={inputs.heightMm} onChange={(v) => set('heightMm', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
              <NumberField label="قطر الكانة" unit="mm" value={inputs.stirrupDiaMm} onChange={(v) => set('stirrupDiaMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="مواصفات المواد">
            <FieldGroup cols={2}>
              <NumberField label="مقاومة الخرسانة f'c" unit="MPa" value={inputs.fcMPa} onChange={(v) => set('fcMPa', v)} />
              <NumberField label="إجهاد خضوع الحديد fy" unit="MPa" value={inputs.fyMPa} onChange={(v) => set('fyMPa', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="مواد الخرسانة">
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
                <ResultRow label="الوزن الذاتي (محسوب)" value={res.loads.selfWeightKNm} unit="kN/m" />
                <ResultRow label="إجمالي الحمل الميت" value={res.loads.totalDeadKNm} unit="kN/m" />
                <ResultRow label="الحمل المصعّد wu" value={res.loads.wuKNm} unit="kN/m" emphasis />
              </ResultSection>

              <ResultSection title="التصميم على الانحناء">
                <p className="text-xs text-ink-soft mb-2">{res.flexure.momentFormula}</p>
                {res.flexure.MuPosKNm > 0 && <ResultRow label="العزم الموجب Mu+" value={res.flexure.MuPosKNm} unit="kN.m" />}
                {res.flexure.MuNegKNm > 0 && <ResultRow label="العزم السالب Mu-" value={res.flexure.MuNegKNm} unit="kN.m" />}
                <ResultRow label="التسليح السفلي" value={res.flexure.reinforcementPos} emphasis />
                <ResultRow label="التسليح العلوي" value={res.flexure.reinforcementNeg} emphasis />
              </ResultSection>

              <ResultSection title="التصميم على القص">
                <div className="mb-2">
                  <StatusStamp status={!res.shear.stirrups.sectionTooSmall ? 'pass' : 'fail'} />
                </div>
                <ResultRow label="قوة القص Vu" value={res.shear.VuKN} unit="kN" />
                <ResultRow label="مقاومة الخرسانة φVc" value={res.shear.phiVcKN} unit="kN" />
                <ResultRow label="تسليح القص" value={res.shear.reinforcementShear} emphasis />
              </ResultSection>

              <ResultSection title="فحص الترخيم">
                <div className="mb-2">
                  <StatusStamp status={res.deflection.ok ? 'pass' : 'warn'} />
                </div>
                <ResultRow label="الحد الأدنى للارتفاع" value={res.deflection.minHeightMm} unit="mm" />
                <ResultRow label="الارتفاع المستخدم" value={res.deflection.providedHeightMm} unit="mm" />
              </ResultSection>

              <ResultSection title="الكميات">
                <ResultRow label="حجم الخرسانة" value={res.quantities.concreteVolumeM3} unit="m³" emphasis />
                <ResultRow label="وزن حديد التسليح" value={res.quantities.steelWeightKg} unit="kg" />
              </ResultSection>

              <MaterialsResult materials={res.materials} />
            </>
          )}
        </div>
      </div>

      {res && (
        <div style={{ position: 'fixed', top: 0, left: -10000 }}>
          <PdfReport
            ref={r.reportRef}
            sheetNumber="S-04"
            sheetTitle="حاسبة الكمرات — Beam Design"
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
