'use client';

import { useState } from 'react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, FieldGroup } from '@/components/ui/Field.jsx';
import { ResultSection, ResultRow, WarningsList, ErrorsList, EmptyResultsHint } from '@/components/ui/Results.jsx';
import MaterialsPanel, { defaultMaterialsState, toMaterialsPayload } from '@/components/MaterialsPanel.jsx';
import MaterialsResult from '@/components/MaterialsResult.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

export default function StrapFootingCalculator() {
  const [edgeColumn, setEdgeColumn] = useState({ deadKN: 400, liveKN: 200, widthMm: 400, depthMm: 400, maxProjectionM: 0.3 });
  const [interiorColumn, setInteriorColumn] = useState({ deadKN: 600, liveKN: 300, widthMm: 450, depthMm: 450 });
  const [general, setGeneral] = useState({
    columnsSpacingM: 4.5,
    soilBearingCapacityKPa: 180,
    foundationDepthM: 1.5,
    soilUnitWeightKNm3: 18,
    fcMPa: 25,
    fyMPa: 420,
    coverMm: 75,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('strap_footing', 'قاعدة مرتبطة (Strap)');
  const dateStr = useUserTime();

  function setG(key, val) {
    setGeneral((s) => ({ ...s, [key]: val }));
  }

  function handleCalculate() {
    r.handleCalculate({
      edgeColumn,
      interiorColumn,
      columnsSpacingM: general.columnsSpacingM,
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
    { label: 'العمود الحافي', value: `D=${edgeColumn.deadKN}kN L=${edgeColumn.liveKN}kN (${edgeColumn.widthMm}×${edgeColumn.depthMm}mm)` },
    { label: 'العمود الداخلي', value: `D=${interiorColumn.deadKN}kN L=${interiorColumn.liveKN}kN (${interiorColumn.widthMm}×${interiorColumn.depthMm}mm)` },
    { label: 'المسافة بين الأعمدة', value: `${general.columnsSpacingM} m` },
    { label: 'قدرة تحمل التربة', value: `${general.soilBearingCapacityKPa} kPa` },
  ];

  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-01-C"
        sheetTitle="حاسبة القواعد المرتبطة (Strap Footing)"
        sheetSubtitle="عمود حافي + عمود داخلي مرتبطان بجسر رابط"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />

      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('قاعدة مرتبطة (Strap)')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('قاعدة مرتبطة (Strap)', 'تقرير-قاعدة-مرتبطة.pdf')}
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
          <ResultSection title="العمود الحافي (المقيّد بحد الملكية)">
            <FieldGroup cols={2}>
              <NumberField label="حمل ميت D" unit="kN" value={edgeColumn.deadKN} onChange={(v) => setEdgeColumn((s) => ({ ...s, deadKN: v }))} />
              <NumberField label="حمل حي L" unit="kN" value={edgeColumn.liveKN} onChange={(v) => setEdgeColumn((s) => ({ ...s, liveKN: v }))} />
              <NumberField label="عرض العمود" unit="mm" value={edgeColumn.widthMm} onChange={(v) => setEdgeColumn((s) => ({ ...s, widthMm: v }))} />
              <NumberField label="عمق العمود" unit="mm" value={edgeColumn.depthMm} onChange={(v) => setEdgeColumn((s) => ({ ...s, depthMm: v }))} />
              <NumberField label="أقصى امتداد ممكن للقاعدة" unit="m" value={edgeColumn.maxProjectionM} onChange={(v) => setEdgeColumn((s) => ({ ...s, maxProjectionM: v }))} help="محدود بحد الملكية" />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="العمود الداخلي">
            <FieldGroup cols={2}>
              <NumberField label="حمل ميت D" unit="kN" value={interiorColumn.deadKN} onChange={(v) => setInteriorColumn((s) => ({ ...s, deadKN: v }))} />
              <NumberField label="حمل حي L" unit="kN" value={interiorColumn.liveKN} onChange={(v) => setInteriorColumn((s) => ({ ...s, liveKN: v }))} />
              <NumberField label="عرض العمود" unit="mm" value={interiorColumn.widthMm} onChange={(v) => setInteriorColumn((s) => ({ ...s, widthMm: v }))} />
              <NumberField label="عمق العمود" unit="mm" value={interiorColumn.depthMm} onChange={(v) => setInteriorColumn((s) => ({ ...s, depthMm: v }))} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="بيانات عامة">
            <FieldGroup cols={2}>
              <NumberField label="المسافة بين الأعمدة" unit="m" value={general.columnsSpacingM} onChange={(v) => setG('columnsSpacingM', v)} />
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
              <ResultSection title="اللامركزية وقوة جسر الربط" tone="highlight">
                <ResultRow label="اللامركزية e" value={res.eccentricityM} unit="m" />
                <ResultRow label="قوة القص في جسر الربط (مصعّد)" value={res.strapShear.factoredKN} unit="kN" emphasis />
              </ResultSection>

              <ResultSection title={res.edgeFooting.label}>
                <ResultRow label="الأبعاد" value={`${res.edgeFooting.lengthM} × ${res.edgeFooting.widthM}`} unit="m" />
                <ResultRow label="السماكة" value={res.edgeFooting.overallDepthMm} unit="mm" />
                <ResultRow label="التسليح" value={res.edgeFooting.reinforcement} />
                <ResultRow label="حجم الخرسانة" value={res.edgeFooting.concreteVolumeM3} unit="m³" />
              </ResultSection>

              <ResultSection title={res.interiorFooting.label}>
                <ResultRow label="الأبعاد" value={`${res.interiorFooting.lengthM} × ${res.interiorFooting.widthM}`} unit="m" />
                <ResultRow label="السماكة" value={res.interiorFooting.overallDepthMm} unit="mm" />
                <ResultRow label="التسليح" value={res.interiorFooting.reinforcement} />
                <ResultRow label="حجم الخرسانة" value={res.interiorFooting.concreteVolumeM3} unit="m³" />
              </ResultSection>

              <ResultSection title="جسر الربط (Strap Beam)">
                <ResultRow label="الأبعاد" value={`${res.strapBeam.widthMm} × ${res.strapBeam.overallDepthMm}`} unit="mm" />
                <ResultRow label="العزم المصمم Mu" value={res.strapBeam.MuKNm} unit="kN.m" />
                <ResultRow label="التسليح" value={res.strapBeam.reinforcement} />
              </ResultSection>

              <ResultSection title="إجمالي الكميات">
                <ResultRow label="إجمالي حجم الخرسانة" value={res.quantities.concreteVolumeM3} unit="m³" emphasis />
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
            sheetNumber="S-01-C"
            sheetTitle="حاسبة القواعد المرتبطة — Strap Footing"
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
