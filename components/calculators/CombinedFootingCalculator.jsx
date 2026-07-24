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
  { deadKN: 500, liveKN: 250, positionM: 0, widthMm: 400, depthMm: 400 },
  { deadKN: 700, liveKN: 350, positionM: 4.5, widthMm: 450, depthMm: 450 },
];

export default function CombinedFootingCalculator() {
  const [columns, setColumns] = useState(initialColumns);
  const [general, setGeneral] = useState({
    edgeProjectionM: 0.4,
    widthOverrideM: '',
    soilBearingCapacityKPa: 180,
    foundationDepthM: 1.5,
    soilUnitWeightKNm3: 18,
    fcMPa: 25,
    fyMPa: 420,
    coverMm: 75,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('combined_footing', 'قاعدة مشتركة/شريطية');
  const dateStr = useUserTime();

  function setG(key, val) {
    setGeneral((s) => ({ ...s, [key]: val }));
  }
  function setCol(idx, key, val) {
    setColumns((cols) => cols.map((c, i) => (i === idx ? { ...c, [key]: val } : c)));
  }
  function addColumn() {
    const last = columns[columns.length - 1];
    setColumns((cols) => [...cols, { deadKN: 500, liveKN: 250, positionM: (last?.positionM || 0) + 4, widthMm: 400, depthMm: 400 }]);
  }
  function removeColumn(idx) {
    if (columns.length <= 2) return;
    setColumns((cols) => cols.filter((_, i) => i !== idx));
  }

  function handleCalculate() {
    r.handleCalculate({
      columns,
      edgeProjectionM: general.edgeProjectionM,
      widthM: general.widthOverrideM || null,
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
    ...columns.map((c, i) => ({ label: `العمود ${i + 1}`, value: `D=${c.deadKN}kN L=${c.liveKN}kN @ x=${c.positionM}m (${c.widthMm}×${c.depthMm}mm)` })),
    { label: 'قدرة تحمل التربة', value: `${general.soilBearingCapacityKPa} kPa` },
    { label: 'مقاومة الخرسانة f\'c', value: `${general.fcMPa} MPa` },
  ];

  const res = r.results;
  const columnsCountLabel = columns.length === 2 ? 'قاعدة مشتركة لعمودين' : columns.length === 3 ? 'قاعدة مشتركة لثلاثة أعمدة' : 'قاعدة شريطية متعددة الأعمدة';

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-01-B"
        sheetTitle="حاسبة القواعد المشتركة والشريطية"
        sheetSubtitle="Combined & Strip Footing — تحليل استاتيكي عددي حقيقي"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />

      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave(columnsCountLabel)}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf(columnsCountLabel, 'تقرير-قاعدة-مشتركة.pdf')}
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
          <ResultSection title={`الأعمدة (${columns.length}) — ${columnsCountLabel}`}>
            <div className="space-y-3">
              {columns.map((c, i) => (
                <div key={i} className="rounded-md border border-line p-3 relative">
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
                    <NumberField label="الموقع x" unit="m" value={c.positionM} onChange={(v) => setCol(i, 'positionM', v)} />
                    <NumberField label="عرض العمود" unit="mm" value={c.widthMm} onChange={(v) => setCol(i, 'widthMm', v)} />
                    <NumberField label="عمق العمود" unit="mm" value={c.depthMm} onChange={(v) => setCol(i, 'depthMm', v)} />
                  </div>
                </div>
              ))}
              <button onClick={addColumn} className="w-full flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line text-ink-soft hover:border-navy-400 hover:text-navy-600 text-sm py-2 transition-colors">
                <Plus size={15} /> إضافة عمود
              </button>
            </div>
          </ResultSection>

          <ResultSection title="أبعاد القاعدة وبيانات التربة">
            <FieldGroup cols={2}>
              <NumberField label="امتداد الطرف الحر" unit="m" value={general.edgeProjectionM} onChange={(v) => setG('edgeProjectionM', v)} />
              <NumberField label="عرض القاعدة (اختياري)" unit="m" value={general.widthOverrideM} onChange={(v) => setG('widthOverrideM', v)} required={false} help="اتركه فارغاً للحساب التلقائي" />
              <NumberField label="قدرة تحمل التربة" unit="kPa" value={general.soilBearingCapacityKPa} onChange={(v) => setG('soilBearingCapacityKPa', v)} />
              <NumberField label="عمق التأسيس" unit="m" value={general.foundationDepthM} onChange={(v) => setG('foundationDepthM', v)} />
              <NumberField label="الوزن النوعي للتربة" unit="kN/m³" value={general.soilUnitWeightKNm3} onChange={(v) => setG('soilUnitWeightKNm3', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={general.coverMm} onChange={(v) => setG('coverMm', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="مواصفات الخرسانة والحديد">
            <FieldGroup cols={2}>
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
              <ResultSection title="أبعاد القاعدة المصمّمة" tone="highlight">
                <ResultRow label="الطول الكلي" value={res.geometry.lengthM} unit="m" emphasis />
                <ResultRow label="العرض" value={res.geometry.widthM} unit="m" emphasis />
                <ResultRow label="السماكة الكلية" value={res.geometry.overallDepthMm} unit="mm" />
                <ResultRow label="موقع بداية القاعدة (نسبة لأول عمود)" value={res.geometry.startOffsetM} unit="m" />
                <ResultRow label="موقع محصلة الأحمال" value={res.geometry.resultantLocationM} unit="m" />
              </ResultSection>

              <ResultSection title="فحص ضغط التربة">
                <div className="mb-2">
                  <StatusStamp status={res.soil.providedPressureServiceKPa <= res.soil.netAllowableKPa ? 'pass' : 'fail'} />
                </div>
                <ResultRow label="قدرة التحمل الصافية" value={res.soil.netAllowableKPa} unit="kPa" />
                <ResultRow label="الضغط الفعلي (خدمي)" value={res.soil.providedPressureServiceKPa} unit="kPa" />
              </ResultSection>

              <ResultSection title="القص والعزم (من التحليل الاستاتيكي العددي)">
                <ResultRow label="أقصى عزم موجب (سفلي)" value={res.flexure.MmaxPositiveKNm} unit="kN.m" emphasis />
                <ResultRow label="عند الموقع" value={res.flexure.positiveMomentLocationM} unit="m" />
                <ResultRow label="أقصى عزم سالب (علوي)" value={res.flexure.MmaxNegativeKNm} unit="kN.m" emphasis />
                <ResultRow label="عند الموقع" value={res.flexure.negativeMomentLocationM} unit="m" />
                <ResultRow label="أقصى قوة قص" value={res.shear.VmaxKN} unit="kN" />
                <div className="mt-1">
                  <StatusStamp status={res.shear.punching.demandKN <= res.shear.punching.phiVcKN ? 'pass' : 'fail'} label="القص الثاقب (أثقل عمود)" />
                </div>
              </ResultSection>

              <ResultSection title="التسليح المطلوب">
                <ResultRow label={res.flexure.reinforcementBottom} value="" />
                <ResultRow label={res.flexure.reinforcementTop} value="" />
                <ResultRow label={res.flexure.reinforcementTransverse} value="" />
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
            sheetNumber="S-01-B"
            sheetTitle={`حاسبة القواعد المشتركة والشريطية — ${columnsCountLabel}`}
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
