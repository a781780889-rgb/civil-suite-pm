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

export default function WallsPage() {
  const [inputs, setInputs] = useState({
    lengthM: 6,
    heightM: 3,
    thicknessMm: 200,
    wallType: 'plain',
    fcMPa: 25,
    fyMPa: 420,
    coverMm: 40,
    barDiaMm: 12,
    soilUnitWeightKNm3: 18,
    frictionAngleDeg: 30,
    surchargeKPa: 0,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('wall', 'جدار خرساني');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({ ...inputs, materials: toMaterialsPayload(materials) });
  }

  const inputRows = [
    { label: 'نوع الجدار', value: inputs.wallType === 'retaining' ? 'استنادي' : 'عادي' },
    { label: 'الطول', value: `${inputs.lengthM} m` },
    { label: 'الارتفاع', value: `${inputs.heightM} m` },
    { label: 'السماكة', value: `${inputs.thicknessMm} mm` },
    ...(inputs.wallType === 'retaining' ? [{ label: 'زاوية احتكاك التربة', value: `${inputs.frictionAngleDeg}°` }] : []),
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-06"
        sheetTitle="حاسبة الجدران الخرسانية"
        sheetSubtitle="تسليح أدنى ACI 318 + تصميم جدار استنادي (Rankine)"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('جدار')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('جدار', 'تقرير-جدار.pdf')}
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
          <ResultSection title="نوع الجدار والأبعاد">
            <FieldGroup cols={2}>
              <SelectField
                label="نوع الجدار"
                value={inputs.wallType}
                onChange={(v) => set('wallType', v)}
                options={[{ value: 'plain', label: 'جدار عادي' }, { value: 'retaining', label: 'جدار استنادي/بدروم' }]}
              />
              <NumberField label="السماكة" unit="mm" value={inputs.thicknessMm} onChange={(v) => set('thicknessMm', v)} />
              <NumberField label="الطول" unit="m" value={inputs.lengthM} onChange={(v) => set('lengthM', v)} />
              <NumberField label="الارتفاع" unit="m" value={inputs.heightM} onChange={(v) => set('heightM', v)} />
            </FieldGroup>
          </ResultSection>

          {inputs.wallType === 'retaining' && (
            <ResultSection title="بيانات التربة المستندة (نظرية Rankine)">
              <FieldGroup cols={2}>
                <NumberField label="الوزن النوعي للتربة" unit="kN/m³" value={inputs.soilUnitWeightKNm3} onChange={(v) => set('soilUnitWeightKNm3', v)} />
                <NumberField label="زاوية الاحتكاك الداخلي φ" unit="°" value={inputs.frictionAngleDeg} onChange={(v) => set('frictionAngleDeg', v)} />
                <NumberField label="حمل السرشارج" unit="kPa" value={inputs.surchargeKPa} onChange={(v) => set('surchargeKPa', v)} required={false} />
              </FieldGroup>
            </ResultSection>
          )}

          <ResultSection title="مواصفات المواد">
            <FieldGroup cols={2}>
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
              <ResultSection title="التسليح الأدنى (ACI 318 §11.6)" tone="highlight">
                <ResultRow label="النسبة الرأسية الدنيا" value={res.minimumReinforcement.rhoVerticalMinPct} unit="%" />
                <ResultRow label="النسبة الأفقية الدنيا" value={res.minimumReinforcement.rhoHorizontalMinPct} unit="%" />
                <ResultRow label="التسليح الرأسي" value={res.minimumReinforcement.reinforcementVertical} emphasis />
                <ResultRow label="التسليح الأفقي" value={res.minimumReinforcement.reinforcementHorizontal} emphasis />
              </ResultSection>

              {res.retainingDesign && (
                <ResultSection title="تصميم الجدار الاستنادي (كابولي تحت ضغط تربة)">
                  <div className="mb-2">
                    <StatusStamp status={res.retainingDesign.VuBaseKN_per_m <= res.retainingDesign.phiVcKN_per_m ? 'pass' : 'fail'} />
                  </div>
                  <ResultRow label="معامل الضغط النشط Ka" value={res.retainingDesign.Ka} />
                  <ResultRow label="العزم عند القاعدة (لكل م)" value={res.retainingDesign.MuBaseKNm_per_m} unit="kN.m" />
                  <ResultRow label="القص عند القاعدة (لكل م)" value={res.retainingDesign.VuBaseKN_per_m} unit="kN" />
                  <ResultRow label="التسليح الرأسي الرئيسي" value={res.retainingDesign.reinforcementVerticalMain} emphasis />
                  <p className="text-xs text-ink-soft mt-2">{res.retainingDesign.note}</p>
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
            sheetNumber="S-06"
            sheetTitle="حاسبة الجدران الخرسانية"
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
