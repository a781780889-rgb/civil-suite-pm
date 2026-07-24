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

export default function PoolsPage() {
  const [inputs, setInputs] = useState({
    poolShape: 'rectangular',
    lengthM: 10,
    widthM: 5,
    diameterM: 6,
    surfaceAreaM2: 45,
    perimeterM: 28,
    shallowDepthM: 1.2,
    deepDepthM: 2.0,
    wallThicknessMm: 250,
    baseThicknessMm: 250,
    belowGrade: true,
    soilUnitWeightKNm3: 18,
    frictionAngleDeg: 30,
    workingSpaceM: 0.6,
    fcMPa: 30,
    fyMPa: 420,
    coverMm: 50,
    turnoverHours: 8,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState({ grade: 'C30' }));
  const r = useCalculatorReport('pool', 'مسبح');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({ ...inputs, materials: toMaterialsPayload(materials) });
  }

  const shape = inputs.poolShape;
  const inputRows = [
    { label: 'الشكل', value: shape === 'rectangular' ? 'مستطيل' : shape === 'circular' ? 'دائري' : 'حر الشكل' },
    { label: 'العمق (ضحل/عميق)', value: `${inputs.shallowDepthM} / ${inputs.deepDepthM} m` },
    { label: 'تحت منسوب الأرض', value: inputs.belowGrade ? 'نعم' : 'لا' },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-09"
        sheetTitle="حاسبة المسابح"
        sheetSubtitle="تصميم الجدار على أسوأ حالتين: امتلاء / فراغ"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('مسبح')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('مسبح', 'تقرير-مسبح.pdf')}
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
          <ResultSection title="شكل المسبح">
            <SelectField
              label="الشكل"
              value={shape}
              onChange={(v) => set('poolShape', v)}
              options={[{ value: 'rectangular', label: 'مستطيل' }, { value: 'circular', label: 'دائري' }, { value: 'freeform', label: 'حر الشكل' }]}
            />
          </ResultSection>

          <ResultSection title="الأبعاد">
            <FieldGroup cols={2}>
              {shape === 'rectangular' && (
                <>
                  <NumberField label="الطول" unit="m" value={inputs.lengthM} onChange={(v) => set('lengthM', v)} />
                  <NumberField label="العرض" unit="m" value={inputs.widthM} onChange={(v) => set('widthM', v)} />
                </>
              )}
              {shape === 'circular' && <NumberField label="القطر" unit="m" value={inputs.diameterM} onChange={(v) => set('diameterM', v)} />}
              {shape === 'freeform' && (
                <>
                  <NumberField label="المساحة السطحية" unit="m²" value={inputs.surfaceAreaM2} onChange={(v) => set('surfaceAreaM2', v)} />
                  <NumberField label="المحيط" unit="m" value={inputs.perimeterM} onChange={(v) => set('perimeterM', v)} />
                </>
              )}
              <NumberField label="العمق الضحل" unit="m" value={inputs.shallowDepthM} onChange={(v) => set('shallowDepthM', v)} />
              <NumberField label="العمق العميق" unit="m" value={inputs.deepDepthM} onChange={(v) => set('deepDepthM', v)} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="الموقع وأعمال الحفر">
            <ToggleField label="المسبح تحت منسوب الأرض الطبيعي" checked={inputs.belowGrade} onChange={(v) => set('belowGrade', v)} help="لفحص ضغط التربة عند الفراغ" />
            <FieldGroup cols={2}>
              <NumberField label="مسافة العمل الجانبية للحفر" unit="m" value={inputs.workingSpaceM} onChange={(v) => set('workingSpaceM', v)} />
              {inputs.belowGrade && (
                <>
                  <NumberField label="الوزن النوعي للتربة" unit="kN/m³" value={inputs.soilUnitWeightKNm3} onChange={(v) => set('soilUnitWeightKNm3', v)} />
                  <NumberField label="زاوية احتكاك التربة" unit="°" value={inputs.frictionAngleDeg} onChange={(v) => set('frictionAngleDeg', v)} />
                </>
              )}
            </FieldGroup>
          </ResultSection>

          <ResultSection title="السماكات والتنقية">
            <FieldGroup cols={2}>
              <NumberField label="سماكة الجدار" unit="mm" value={inputs.wallThicknessMm} onChange={(v) => set('wallThicknessMm', v)} />
              <NumberField label="سماكة القاعدة" unit="mm" value={inputs.baseThicknessMm} onChange={(v) => set('baseThicknessMm', v)} />
              <NumberField label="مدة دورة التنقية" unit="ساعة" value={inputs.turnoverHours} onChange={(v) => set('turnoverHours', v)} />
              <NumberField label="مقاومة الخرسانة f'c" unit="MPa" value={inputs.fcMPa} onChange={(v) => set('fcMPa', v)} />
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

              <ResultSection title="تصميم الجدار" tone="highlight">
                <p className="text-xs text-ink-soft mb-2">الحالة الحاكمة: {res.wallDesign.governingCase}</p>
                <ResultRow label="عزم حالة الامتلاء" value={res.wallDesign.MuFullPoolKNm_per_m} unit="kN.m/m" />
                <ResultRow label="عزم حالة الفراغ" value={res.wallDesign.MuEmptyPoolKNm_per_m} unit="kN.m/m" />
                <ResultRow label="التسليح الرأسي" value={res.wallDesign.reinforcementVertical} emphasis />
                <ResultRow label="التسليح الأفقي" value={res.wallDesign.reinforcementHorizontal} emphasis />
              </ResultSection>

              {res.upliftCheck && (
                <ResultSection title="فحص الرفع (Uplift)">
                  <div className="mb-2">
                    <StatusStamp status={res.upliftCheck.safe ? 'pass' : 'warn'} />
                  </div>
                  <ResultRow label="قوة الرفع الافتراضية" value={res.upliftCheck.upliftForceKN} unit="kN" />
                  <ResultRow label="وزن المنشأ" value={res.upliftCheck.structureWeightKN} unit="kN" />
                </ResultSection>
              )}

              <ResultSection title="أعمال الحفر">
                <ResultRow label="مساحة الحفر" value={res.excavation.excavAreaM2} unit="m²" />
                <ResultRow label="حجم الحفر" value={res.excavation.excavationVolumeM3} unit="m³" emphasis />
              </ResultSection>

              <ResultSection title="التشطيبات">
                <ResultRow label="مساحة العزل المائي" value={res.finishes.waterproofingAreaM2} unit="m²" />
                <ResultRow label="مساحة التبليط" value={res.finishes.tilingAreaM2} unit="m²" />
                <ResultRow label="مساحة اللياسة" value={res.finishes.plasteringAreaM2} unit="m²" />
              </ResultSection>

              <ResultSection title="المضخة والفلتر">
                <ResultRow label="حجم مياه المسبح" value={res.pump.poolVolumeM3} unit="m³" />
                <ResultRow label="التدفق المطلوب" value={res.pump.requiredFlowRateM3PerHr} unit="m³/hr" emphasis />
                <ResultRow label="التدفق (GPM)" value={res.pump.requiredFlowRateGPM} unit="GPM" />
                <p className="text-xs text-ink-soft mt-2">{res.pump.note}</p>
              </ResultSection>

              <ResultSection title="إجمالي الكميات">
                <ResultRow label="حجم الخرسانة الكلي" value={res.quantities.concreteVolumeM3} unit="m³" emphasis />
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
            sheetNumber="S-09"
            sheetTitle="حاسبة المسابح"
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
