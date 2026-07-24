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

const initialInputs = {
  deadLoadKN: 500,
  liveLoadKN: 250,
  columnWidthMm: 400,
  columnDepthMm: 400,
  soilBearingCapacityKPa: 180,
  foundationDepthM: 1.5,
  soilUnitWeightKNm3: 18,
  fcMPa: 25,
  fyMPa: 420,
  coverMm: 75,
  shape: 'square',
};

export default function IsolatedFootingCalculator() {
  const [inputs, setInputs] = useState(initialInputs);
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('isolated_footing', 'قاعدة منفصلة');
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
    { label: 'أبعاد العمود', value: `${inputs.columnWidthMm} × ${inputs.columnDepthMm} mm` },
    { label: 'قدرة تحمل التربة', value: `${inputs.soilBearingCapacityKPa} kPa` },
    { label: 'عمق التأسيس', value: `${inputs.foundationDepthM} m` },
    { label: 'مقاومة الخرسانة f\'c', value: `${inputs.fcMPa} MPa` },
    { label: 'إجهاد خضوع الحديد fy', value: `${inputs.fyMPa} MPa` },
    { label: 'الشكل', value: inputs.shape === 'square' ? 'مربعة' : 'مستطيلة' },
  ];

  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-01-A"
        sheetTitle="حاسبة القواعد المنفصلة"
        sheetSubtitle="Isolated Footing Design — ACI 318"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />

      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('قاعدة منفصلة')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('قاعدة منفصلة', 'تقرير-قاعدة-منفصلة.pdf')}
        exportStatus={r.exportStatus}
        canSave={!!res}
        canExport={!!res}
        logoDataUrl={r.meta.logoDataUrl}
        onLogoFile={r.meta.handleLogoFile}
        signatureDataUrl={r.meta.signatureDataUrl}
        onSignatureFile={r.meta.handleSignatureFile}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* المدخلات */}
        <div className="space-y-4">
          <ResultSection title="أحمال العمود">
            <FieldGroup cols={2}>
              <NumberField label="الحمل الميت D" unit="kN" value={inputs.deadLoadKN} onChange={(v) => set('deadLoadKN', v)} />
              <NumberField label="الحمل الحي L" unit="kN" value={inputs.liveLoadKN} onChange={(v) => set('liveLoadKN', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="أبعاد العمود والقاعدة">
            <FieldGroup cols={2}>
              <NumberField label="عرض العمود" unit="mm" value={inputs.columnWidthMm} onChange={(v) => set('columnWidthMm', v)} />
              <NumberField label="عمق العمود" unit="mm" value={inputs.columnDepthMm} onChange={(v) => set('columnDepthMm', v)} />
              <SelectField
                label="شكل القاعدة"
                value={inputs.shape}
                onChange={(v) => set('shape', v)}
                options={[{ value: 'square', label: 'مربعة' }, { value: 'rectangular', label: 'مستطيلة' }]}
              />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="بيانات التربة">
            <FieldGroup cols={2}>
              <NumberField label="قدرة تحمل التربة" unit="kPa" value={inputs.soilBearingCapacityKPa} onChange={(v) => set('soilBearingCapacityKPa', v)} />
              <NumberField label="عمق التأسيس" unit="m" value={inputs.foundationDepthM} onChange={(v) => set('foundationDepthM', v)} />
              <NumberField label="الوزن النوعي للتربة" unit="kN/m³" value={inputs.soilUnitWeightKNm3} onChange={(v) => set('soilUnitWeightKNm3', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="مواصفات الخرسانة والحديد">
            <FieldGroup cols={2}>
              <NumberField label="مقاومة الخرسانة f'c" unit="MPa" value={inputs.fcMPa} onChange={(v) => set('fcMPa', v)} />
              <NumberField label="إجهاد خضوع الحديد fy" unit="MPa" value={inputs.fyMPa} onChange={(v) => set('fyMPa', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="مواد الخرسانة">
            <MaterialsPanel value={materials} onChange={setMaterials} />
          </ResultSection>
        </div>

        {/* النتائج */}
        <div className="space-y-4">
          <ErrorsList errors={r.errors} />
          {!res && !r.errors.length && <EmptyResultsHint />}
          {res && (
            <>
              <WarningsList warnings={r.warnings} />
              <ResultSection title="أبعاد القاعدة المصمّمة" tone="highlight">
                <ResultRow label="الطول × العرض" value={`${res.geometry.lengthM} × ${res.geometry.widthM}`} unit="m" emphasis />
                <ResultRow label="السماكة الكلية" value={res.geometry.overallDepthMm} unit="mm" />
                <ResultRow label="العمق الفعال d" value={res.geometry.effectiveDepthMm} unit="mm" />
                <ResultRow label="المساحة" value={res.geometry.areaM2} unit="m²" />
              </ResultSection>

              <ResultSection title="فحص ضغط التربة">
                <div className="mb-2">
                  <StatusStamp status={res.soil.providedPressureServiceKPa <= res.soil.netAllowableKPa ? 'pass' : 'fail'} />
                </div>
                <ResultRow label="قدرة التحمل الصافية" value={res.soil.netAllowableKPa} unit="kPa" />
                <ResultRow label="الضغط الفعلي (خدمي)" value={res.soil.providedPressureServiceKPa} unit="kPa" />
              </ResultSection>

              <ResultSection title="فحص القص">
                <div className="mb-2 flex gap-2">
                  <StatusStamp status={res.shear.punching.VuKN <= res.shear.punching.phiVcKN ? 'pass' : 'fail'} label="القص الثاقب" />
                  <StatusStamp status={res.shear.oneWayDirectionL.VuKN <= res.shear.oneWayDirectionL.phiVcKN ? 'pass' : 'fail'} label="القص أحادي الاتجاه" />
                </div>
                <ResultRow label="القص الثاقب Vu" value={res.shear.punching.VuKN} unit="kN" />
                <ResultRow label="مقاومة القص الثاقب φVc" value={res.shear.punching.phiVcKN} unit="kN" />
                <ResultRow label="القص أحادي الاتجاه Vu" value={res.shear.oneWayDirectionL.VuKN} unit="kN" />
                <ResultRow label="مقاومة القص أحادي φVc" value={res.shear.oneWayDirectionL.phiVcKN} unit="kN" />
              </ResultSection>

              <ResultSection title="التسليح المطلوب">
                <ResultRow label="اتجاه L" value={res.flexure.reinforcementDirectionL} emphasis />
                <ResultRow label="اتجاه B" value={res.flexure.reinforcementDirectionB} emphasis />
              </ResultSection>

              <ResultSection title="الكميات">
                <ResultRow label="حجم الخرسانة" value={res.quantities.concreteVolumeM3} unit="m³" emphasis />
                <ResultRow label="وزن حديد التسليح (تقديري)" value={res.quantities.steelWeightKg} unit="kg" />
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
            sheetNumber="S-01-A"
            sheetTitle="حاسبة القواعد المنفصلة — Isolated Footing"
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
