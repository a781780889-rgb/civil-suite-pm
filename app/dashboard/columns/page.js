'use client';

import { useState } from 'react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, SelectField, FieldGroup, ToggleField } from '@/components/ui/Field.jsx';
import { ResultSection, ResultRow, WarningsList, ErrorsList, EmptyResultsHint, StatusStamp } from '@/components/ui/Results.jsx';
import MaterialsPanel, { defaultMaterialsState, toMaterialsPayload } from '@/components/MaterialsPanel.jsx';
import MaterialsResult from '@/components/MaterialsResult.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

export default function ColumnsPage() {
  const [inputs, setInputs] = useState({
    deadLoadKN: 800,
    liveLoadKN: 400,
    widthMm: 450,
    depthMm: 450,
    heightM: 3.5,
    fcMPa: 30,
    fyMPa: 420,
    tieType: 'tied',
    coverMm: 40,
    minSteelRatioPct: 1,
    maxSteelRatioPct: 8,
    slendernessCheck: true,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState({ grade: 'C30' }));
  const r = useCalculatorReport('column', 'عمود خرساني');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }

  function handleCalculate() {
    r.handleCalculate({ ...inputs, materials: toMaterialsPayload(materials) });
  }

  const inputRows = [
    { label: 'الحمل الميت D', value: `${inputs.deadLoadKN} kN` },
    { label: 'الحمل الحي L', value: `${inputs.liveLoadKN} kN` },
    { label: 'أبعاد المقطع', value: `${inputs.widthMm} × ${inputs.depthMm} mm` },
    { label: 'الارتفاع', value: `${inputs.heightM} m` },
    { label: 'نوع الكانات', value: inputs.tieType === 'tied' ? 'كانات عادية' : 'حلزوني' },
    { label: 'مقاومة الخرسانة f\'c', value: `${inputs.fcMPa} MPa` },
  ];

  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-03"
        sheetTitle="حاسبة الأعمدة الخرسانية"
        sheetSubtitle="تصميم محوري — ACI 318"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('عمود')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('عمود', 'تقرير-عمود.pdf')}
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
          <ResultSection title="الأحمال">
            <FieldGroup cols={2}>
              <NumberField label="الحمل الميت D" unit="kN" value={inputs.deadLoadKN} onChange={(v) => set('deadLoadKN', v)} />
              <NumberField label="الحمل الحي L" unit="kN" value={inputs.liveLoadKN} onChange={(v) => set('liveLoadKN', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="الأبعاد">
            <FieldGroup cols={2}>
              <NumberField label="عرض المقطع" unit="mm" value={inputs.widthMm} onChange={(v) => set('widthMm', v)} />
              <NumberField label="عمق المقطع" unit="mm" value={inputs.depthMm} onChange={(v) => set('depthMm', v)} />
              <NumberField label="ارتفاع العمود (حر)" unit="m" value={inputs.heightM} onChange={(v) => set('heightM', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="نوع التسليح">
            <FieldGroup cols={2}>
              <SelectField
                label="نوع الكانات"
                value={inputs.tieType}
                onChange={(v) => set('tieType', v)}
                options={[{ value: 'tied', label: 'كانات عادية (Tied)' }, { value: 'spiral', label: 'حلزوني (Spiral)' }]}
              />
              <NumberField label="مقاومة الخرسانة f'c" unit="MPa" value={inputs.fcMPa} onChange={(v) => set('fcMPa', v)} />
              <NumberField label="إجهاد خضوع الحديد fy" unit="MPa" value={inputs.fyMPa} onChange={(v) => set('fyMPa', v)} />
              <NumberField label="أقل نسبة تسليح" unit="%" value={inputs.minSteelRatioPct} onChange={(v) => set('minSteelRatioPct', v)} />
            </FieldGroup>
            <ToggleField label="فحص النحافة (Slenderness)" checked={inputs.slendernessCheck} onChange={(v) => set('slendernessCheck', v)} />
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
              <ResultSection title="نتيجة التصميم" tone="highlight">
                <div className="mb-2">
                  <StatusStamp status={res.design.isValid ? 'pass' : 'fail'} label={`نسبة الاستغلال ${(res.design.utilizationRatio * 100).toFixed(0)}%`} />
                </div>
                <ResultRow label="التسليح الطولي" value={res.design.reinforcement} unit="" emphasis />
                <ResultRow label="الكانات" value={res.design.ties} />
                <ResultRow label="نسبة التسليح الفعلية" value={res.design.actualRhoPct} unit="%" />
                <ResultRow label="القدرة المحورية φPn" value={res.design.phiPnActualKN} unit="kN" />
                <ResultRow label="الحمل المصعّد Pu" value={res.loads.PuKN} unit="kN" />
              </ResultSection>

              {res.slenderness && (
                <ResultSection title="فحص النحافة">
                  <div className="mb-2">
                    <StatusStamp status={res.slenderness.isSlender ? 'warn' : 'pass'} label={res.slenderness.isSlender ? 'عمود رشيق' : 'عمود قصير'} />
                  </div>
                  <ResultRow label="kLu/r" value={res.slenderness.kluOverR} />
                </ResultSection>
              )}

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
            sheetNumber="S-03"
            sheetTitle="حاسبة الأعمدة — Column Design"
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
