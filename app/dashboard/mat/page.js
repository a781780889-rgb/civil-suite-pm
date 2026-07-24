'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, FieldGroup } from '@/components/ui/Field.jsx';
import { ResultSection, ResultRow, WarningsList, ErrorsList, EmptyResultsHint, StatusStamp } from '@/components/ui/Results.jsx';
import MaterialsPanel, { defaultMaterialsState, toMaterialsPayload } from '@/components/MaterialsPanel.jsx';
import MaterialsResult from '@/components/MaterialsResult.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

const initialColumns = [
  { deadKN: 500, liveKN: 250, xM: 1, yM: 1, widthMm: 400, depthMm: 400 },
  { deadKN: 600, liveKN: 300, xM: 6, yM: 1, widthMm: 400, depthMm: 400 },
  { deadKN: 550, liveKN: 275, xM: 1, yM: 9, widthMm: 400, depthMm: 400 },
  { deadKN: 650, liveKN: 325, xM: 6, yM: 9, widthMm: 450, depthMm: 450 },
];

export default function MatFoundationPage() {
  const [columns, setColumns] = useState(initialColumns);
  const [general, setGeneral] = useState({
    matLengthM: 12,
    matWidthM: 10,
    soilBearingCapacityKPa: 150,
    foundationDepthM: 2,
    soilUnitWeightKNm3: 18,
    fcMPa: 30,
    fyMPa: 420,
    coverMm: 75,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('mat_foundation', 'لبشة (Mat Foundation)');
  const dateStr = useUserTime();

  function setG(key, val) {
    setGeneral((s) => ({ ...s, [key]: val }));
  }
  function setCol(idx, key, val) {
    setColumns((cols) => cols.map((c, i) => (i === idx ? { ...c, [key]: val } : c)));
  }
  function addColumn() {
    setColumns((cols) => [...cols, { deadKN: 500, liveKN: 250, xM: 3, yM: 3, widthMm: 400, depthMm: 400 }]);
  }
  function removeColumn(idx) {
    if (columns.length <= 2) return;
    setColumns((cols) => cols.filter((_, i) => i !== idx));
  }

  function handleCalculate() {
    r.handleCalculate({
      matLengthM: general.matLengthM,
      matWidthM: general.matWidthM,
      columns,
      soilBearingCapacityKPa: general.soilBearingCapacityKPa,
      foundationDepthM: general.foundationDepthM,
      soilUnitWeightKNm3: general.soilUnitWeightKNm3,
      fcMPa: general.fcMPa,
      fyMPa: general.fyMPa,
      coverMm: general.coverMm,
      materials: toMaterialsPayload(materials),
    });
  }

  const inputRows = [
    { label: 'أبعاد اللبشة', value: `${general.matLengthM} × ${general.matWidthM} m` },
    ...columns.map((c, i) => ({ label: `عمود ${i + 1}`, value: `D=${c.deadKN}kN L=${c.liveKN}kN @ (${c.xM},${c.yM})m` })),
    { label: 'قدرة تحمل التربة', value: `${general.soilBearingCapacityKPa} kPa` },
  ];

  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-02"
        sheetTitle="حاسبة اللبشة (Mat Foundation)"
        sheetSubtitle="الطريقة الجاسئة لتوزيع ضغط التربة"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />

      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('لبشة')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('لبشة', 'تقرير-لبشة.pdf')}
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
          <ResultSection title="أبعاد اللبشة">
            <FieldGroup cols={2}>
              <NumberField label="الطول" unit="m" value={general.matLengthM} onChange={(v) => setG('matLengthM', v)} />
              <NumberField label="العرض" unit="m" value={general.matWidthM} onChange={(v) => setG('matWidthM', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title={`الأعمدة (${columns.length}) — إحداثيات X,Y من ركن اللبشة`}>
            <div className="space-y-3">
              {columns.map((c, i) => (
                <div key={i} className="rounded-md border border-line p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-navy-600">عمود {i + 1}</span>
                    {columns.length > 2 && (
                      <button onClick={() => removeColumn(i)} className="text-fail hover:text-fail-700">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberField label="حمل ميت D" unit="kN" value={c.deadKN} onChange={(v) => setCol(i, 'deadKN', v)} />
                    <NumberField label="حمل حي L" unit="kN" value={c.liveKN} onChange={(v) => setCol(i, 'liveKN', v)} />
                    <NumberField label="عرض العمود" unit="mm" value={c.widthMm} onChange={(v) => setCol(i, 'widthMm', v)} />
                    <NumberField label="الموقع X" unit="m" value={c.xM} onChange={(v) => setCol(i, 'xM', v)} />
                    <NumberField label="الموقع Y" unit="m" value={c.yM} onChange={(v) => setCol(i, 'yM', v)} />
                    <NumberField label="عمق العمود" unit="mm" value={c.depthMm} onChange={(v) => setCol(i, 'depthMm', v)} />
                  </div>
                </div>
              ))}
              <button onClick={addColumn} className="w-full flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line text-ink-soft hover:border-navy-400 hover:text-navy-600 text-sm py-2 transition-colors">
                <Plus size={15} /> إضافة عمود
              </button>
            </div>
          </ResultSection>

          <ResultSection title="بيانات التربة والخرسانة">
            <FieldGroup cols={2}>
              <NumberField label="قدرة تحمل التربة" unit="kPa" value={general.soilBearingCapacityKPa} onChange={(v) => setG('soilBearingCapacityKPa', v)} />
              <NumberField label="عمق التأسيس" unit="m" value={general.foundationDepthM} onChange={(v) => setG('foundationDepthM', v)} />
              <NumberField label="مقاومة الخرسانة f'c" unit="MPa" value={general.fcMPa} onChange={(v) => setG('fcMPa', v)} />
              <NumberField label="إجهاد خضوع الحديد fy" unit="MPa" value={general.fyMPa} onChange={(v) => setG('fyMPa', v)} />
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
              <ResultSection title="السماكة المصمّمة" tone="highlight">
                <ResultRow label="السماكة الكلية" value={res.geometry.overallDepthMm} unit="mm" emphasis />
                <ResultRow label="العمق الفعال d" value={res.geometry.effectiveDepthMm} unit="mm" />
                <ResultRow label="المساحة الكلية" value={res.geometry.areaM2} unit="m²" />
              </ResultSection>

              <ResultSection title="ضغط التربة (طريقة الأحمال المحورية + الانحناء ثنائي المحور)">
                <div className="mb-2">
                  <StatusStamp status={res.soilPressure.qServiceMaxKPa <= res.soilPressure.netAllowableKPa && res.soilPressure.qServiceMinKPa >= 0 ? 'pass' : 'fail'} />
                </div>
                <ResultRow label="اللامركزية ex" value={res.eccentricity.exM} unit="m" />
                <ResultRow label="اللامركزية ey" value={res.eccentricity.eyM} unit="m" />
                <ResultRow label="أقصى ضغط (خدمي)" value={res.soilPressure.qServiceMaxKPa} unit="kPa" />
                <ResultRow label="أدنى ضغط (خدمي)" value={res.soilPressure.qServiceMinKPa} unit="kPa" />
                <ResultRow label="قدرة التحمل الصافية" value={res.soilPressure.netAllowableKPa} unit="kPa" />
              </ResultSection>

              <ResultSection title="القص الثاقب عند أثقل عمود">
                <div className="mb-2">
                  <StatusStamp status={res.punchingShear.demandFactoredKN <= res.punchingShear.phiVcKN ? 'pass' : 'fail'} />
                </div>
                <ResultRow label="الحمل المطلوب" value={res.punchingShear.demandFactoredKN} unit="kN" />
                <ResultRow label="مقاومة القص φVc" value={res.punchingShear.phiVcKN} unit="kN" />
              </ResultSection>

              <ResultSection title="التسليح — الاتجاه X">
                <ResultRow label="العزم الموجب" value={res.flexure.directionX.MposKNm_per_m} unit="kN.m/m" />
                <ResultRow label="سفلي" value={res.flexure.directionX.reinforcementBottom} />
                <ResultRow label="علوي" value={res.flexure.directionX.reinforcementTop} />
              </ResultSection>
              <ResultSection title="التسليح — الاتجاه Y">
                <ResultRow label="العزم الموجب" value={res.flexure.directionY.MposKNm_per_m} unit="kN.m/m" />
                <ResultRow label="سفلي" value={res.flexure.directionY.reinforcementBottom} />
                <ResultRow label="علوي" value={res.flexure.directionY.reinforcementTop} />
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
            sheetNumber="S-02"
            sheetTitle="حاسبة اللبشة — Mat Foundation"
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
