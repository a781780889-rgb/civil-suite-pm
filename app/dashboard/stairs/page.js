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

const STAIR_TYPES = [
  { value: 'straight', label: 'مستقيم' },
  { value: 'L', label: 'حرف L' },
  { value: 'U', label: 'حرف U' },
  { value: 'circular', label: 'دائري (حلزوني)' },
];

export default function StairsPage() {
  const [inputs, setInputs] = useState({
    stairType: 'straight',
    totalHeightM: 3.0,
    widthM: 1.2,
    waistThicknessMm: 150,
    liveLoadKPa: 4.0,
    fcMPa: 25,
    fyMPa: 420,
    coverMm: 20,
    barDiaMm: 12,
    supportType: 'simple',
    innerRadiusM: 0.35,
    outerRadiusM: 1.6,
    totalAngleDeg: 360,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('stairs', 'سلم');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({ ...inputs, materials: toMaterialsPayload(materials) });
  }

  const isCircular = inputs.stairType === 'circular';
  const inputRows = [
    { label: 'نوع الدرج', value: STAIR_TYPES.find((s) => s.value === inputs.stairType)?.label },
    { label: 'الارتفاع الكلي', value: `${inputs.totalHeightM} m` },
    ...(isCircular
      ? [
          { label: 'نصف القطر الداخلي/الخارجي', value: `${inputs.innerRadiusM} / ${inputs.outerRadiusM} m` },
          { label: 'الزاوية الكلية', value: `${inputs.totalAngleDeg}°` },
        ]
      : [{ label: 'العرض', value: `${inputs.widthM} m` }, { label: 'سماكة القلبة', value: `${inputs.waistThicknessMm} mm` }]),
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-07"
        sheetTitle="حاسبة السلالم"
        sheetSubtitle="مستقيم، L، U، دائري — معادلة الراحة وتصميم القلبة"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('سلم')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('سلم', 'تقرير-سلم.pdf')}
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
          <ResultSection title="نوع السلم">
            <SelectField label="النوع" value={inputs.stairType} onChange={(v) => set('stairType', v)} options={STAIR_TYPES} />
          </ResultSection>

          <ResultSection title="الأبعاد الرأسية">
            <FieldGroup cols={2}>
              <NumberField label="الارتفاع الكلي (بين الطابقين)" unit="m" value={inputs.totalHeightM} onChange={(v) => set('totalHeightM', v)} />
              {!isCircular && <NumberField label="عرض الدرج" unit="m" value={inputs.widthM} onChange={(v) => set('widthM', v)} />}
            </FieldGroup>
          </ResultSection>

          {isCircular ? (
            <ResultSection title="هندسة الدرج الدائري">
              <FieldGroup cols={2}>
                <NumberField label="نصف القطر الداخلي (العمود)" unit="m" value={inputs.innerRadiusM} onChange={(v) => set('innerRadiusM', v)} />
                <NumberField label="نصف القطر الخارجي" unit="m" value={inputs.outerRadiusM} onChange={(v) => set('outerRadiusM', v)} />
                <NumberField label="الزاوية الكلية" unit="°" value={inputs.totalAngleDeg} onChange={(v) => set('totalAngleDeg', v)} />
              </FieldGroup>
            </ResultSection>
          ) : (
            <ResultSection title="القلبة والإسناد">
              <FieldGroup cols={2}>
                <NumberField label="سماكة القلبة" unit="mm" value={inputs.waistThicknessMm} onChange={(v) => set('waistThicknessMm', v)} />
                <SelectField
                  label="حالة الإسناد"
                  value={inputs.supportType}
                  onChange={(v) => set('supportType', v)}
                  options={[{ value: 'simple', label: 'بسيط' }, { value: 'continuous', label: 'مستمر' }]}
                />
              </FieldGroup>
            </ResultSection>
          )}

          <ResultSection title="الأحمال والمواد">
            <FieldGroup cols={2}>
              <NumberField label="الحمل الحي" unit="kPa" value={inputs.liveLoadKPa} onChange={(v) => set('liveLoadKPa', v)} />
              <NumberField label="مقاومة الخرسانة f'c" unit="MPa" value={inputs.fcMPa} onChange={(v) => set('fcMPa', v)} />
              <NumberField label="إجهاد خضوع الحديد fy" unit="MPa" value={inputs.fyMPa} onChange={(v) => set('fyMPa', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
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

              {res.stairType === 'circular' ? (
                <>
                  <ResultSection title="هندسة الدرج" tone="highlight">
                    <ResultRow label="عدد القوائم" value={res.geometry.risers} />
                    <ResultRow label="ارتفاع القائمة" value={res.geometry.riserMm} unit="mm" />
                    <ResultRow label="عرض النائمة عند خط السير" value={res.geometry.walkLineTreadMm} unit="mm" />
                  </ResultSection>
                  <ResultSection title="تصميم الدرجة (كابولي شعاعي)">
                    <ResultRow label="العزم Mu (لكل م)" value={res.flexure.MuKNm_per_m} unit="kN.m" />
                    <ResultRow label="التسليح" value={res.flexure.reinforcement} emphasis />
                  </ResultSection>
                  <ResultSection title="العمود المركزي">
                    <div className="mb-2">
                      <StatusStamp status={res.centralColumn.PuKN <= res.centralColumn.phiPnMaxKN ? 'pass' : 'fail'} />
                    </div>
                    <ResultRow label="الحمل المحوري Pu" value={res.centralColumn.PuKN} unit="kN" />
                    <ResultRow label="القدرة القصوى φPnmax" value={res.centralColumn.phiPnMaxKN} unit="kN" />
                    <p className="text-xs text-ink-soft mt-2">{res.centralColumn.note}</p>
                  </ResultSection>
                </>
              ) : (
                <>
                  <ResultSection title="هندسة السلم" tone="highlight">
                    <ResultRow label="عدد القوائم الكلي" value={res.geometry.totalRisers} />
                    <ResultRow label="ارتفاع القائمة R" value={res.geometry.riserMm} unit="mm" />
                    <ResultRow label="عرض النائمة T" value={res.geometry.treadMm} unit="mm" />
                    <ResultRow label="معادلة الراحة" value={res.geometry.comfortFormula} />
                  </ResultSection>
                  {res.flights.map((f, i) => (
                    <ResultSection key={i} title={`الفَرَشة ${i + 1} (Flight ${i + 1})`}>
                      <ResultRow label="زاوية الميل" value={f.angleDeg} unit="°" />
                      <ResultRow label="الطول المائل (القلبة)" value={f.inclinedLengthM} unit="m" />
                      <ResultRow label="عدد النائمات" value={f.nTreads} />
                      <ResultRow label="العزم Mu (لكل م)" value={f.flexure.MuKNm_per_m} unit="kN.m" />
                      <ResultRow label="التسليح الرئيسي" value={f.flexure.reinforcementMain} emphasis />
                      <ResultRow label="تسليح التوزيع" value={f.flexure.reinforcementDistribution} />
                      <ResultRow label="حجم خرسانة الفرشة" value={f.quantities.flightVolumeM3} unit="m³" />
                    </ResultSection>
                  ))}
                  {res.landing && (
                    <ResultSection title="البسطة (Landing)">
                      <ResultRow label="الأبعاد" value={`${res.landing.widthM} × ${res.landing.lengthM}`} unit="m" />
                      <ResultRow label="التسليح" value={res.landing.reinforcement} emphasis />
                      <ResultRow label="حجم الخرسانة" value={res.landing.volumeM3} unit="m³" />
                    </ResultSection>
                  )}
                </>
              )}

              <ResultSection title="إجمالي الكميات">
                <ResultRow label="حجم الخرسانة الكلي" value={res.quantities.concreteVolumeM3} unit="m³" emphasis />
                <ResultRow label="وزن حديد التسليح" value={res.quantities.steelWeightKg} unit="kg" />
                {res.quantities.formworkAreaM2 && <ResultRow label="مساحة الشدة الخشبية" value={res.quantities.formworkAreaM2} unit="m²" />}
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
            sheetNumber="S-07"
            sheetTitle="حاسبة السلالم"
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
