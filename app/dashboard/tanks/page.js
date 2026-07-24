'use client';

import { useState } from 'react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, SelectField, FieldGroup, ToggleField } from '@/components/ui/Field.jsx';
import { ResultSection, ResultRow, WarningsList, ErrorsList, EmptyResultsHint } from '@/components/ui/Results.jsx';
import MaterialsPanel, { defaultMaterialsState, toMaterialsPayload } from '@/components/MaterialsPanel.jsx';
import MaterialsResult from '@/components/MaterialsResult.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

export default function TanksPage() {
  const [inputs, setInputs] = useState({
    tankShape: 'rectangular',
    tankPosition: 'ground',
    internalLengthM: 5,
    internalWidthM: 4,
    internalDiameterM: 5,
    waterHeightM: 2.5,
    freeboardM: 0.3,
    wallThicknessMm: 250,
    baseThicknessMm: 300,
    hasRoof: true,
    roofThicknessMm: '',
    fcMPa: 30,
    fyMPa: 420,
    coverMm: 50,
    externalExposed: true,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState({ grade: 'C30' }));
  const r = useCalculatorReport('tank', 'خزان مياه');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({ ...inputs, roofThicknessMm: inputs.roofThicknessMm || null, materials: toMaterialsPayload(materials) });
  }

  const isCircular = inputs.tankShape === 'circular';
  const inputRows = [
    { label: 'الشكل', value: isCircular ? 'دائري' : 'مستطيل' },
    { label: 'الموقع', value: inputs.tankPosition === 'elevated' ? 'علوي' : 'أرضي' },
    { label: 'الأبعاد الداخلية', value: isCircular ? `Ø${inputs.internalDiameterM} m` : `${inputs.internalLengthM} × ${inputs.internalWidthM} m` },
    { label: 'ارتفاع المياه', value: `${inputs.waterHeightM} m` },
    { label: 'سماكة الجدار', value: `${inputs.wallThicknessMm} mm` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-08"
        sheetTitle="حاسبة الخزانات"
        sheetSubtitle="نظرية الضغط الهيدروستاتيكي وشد الطوق (Hoop Tension)"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('خزان')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('خزان', 'تقرير-خزان.pdf')}
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
          <ResultSection title="شكل وموقع الخزان">
            <FieldGroup cols={2}>
              <SelectField label="الشكل" value={inputs.tankShape} onChange={(v) => set('tankShape', v)} options={[{ value: 'rectangular', label: 'مستطيل' }, { value: 'circular', label: 'دائري' }]} />
              <SelectField label="الموقع" value={inputs.tankPosition} onChange={(v) => set('tankPosition', v)} options={[{ value: 'ground', label: 'أرضي' }, { value: 'elevated', label: 'علوي' }]} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="الأبعاد الداخلية">
            <FieldGroup cols={2}>
              {isCircular ? (
                <NumberField label="القطر الداخلي" unit="m" value={inputs.internalDiameterM} onChange={(v) => set('internalDiameterM', v)} />
              ) : (
                <>
                  <NumberField label="الطول الداخلي" unit="m" value={inputs.internalLengthM} onChange={(v) => set('internalLengthM', v)} />
                  <NumberField label="العرض الداخلي" unit="m" value={inputs.internalWidthM} onChange={(v) => set('internalWidthM', v)} />
                </>
              )}
              <NumberField label="ارتفاع المياه التصميمي" unit="m" value={inputs.waterHeightM} onChange={(v) => set('waterHeightM', v)} />
              <NumberField label="الفريبورد" unit="m" value={inputs.freeboardM} onChange={(v) => set('freeboardM', v)} required={false} />
            </FieldGroup>
          </ResultSection>

          <ResultSection title="السماكات والسقف">
            <FieldGroup cols={2}>
              <NumberField label="سماكة الجدار" unit="mm" value={inputs.wallThicknessMm} onChange={(v) => set('wallThicknessMm', v)} />
              <NumberField label="سماكة القاعدة" unit="mm" value={inputs.baseThicknessMm} onChange={(v) => set('baseThicknessMm', v)} />
            </FieldGroup>
            <ToggleField label="يوجد سقف علوي" checked={inputs.hasRoof} onChange={(v) => set('hasRoof', v)} />
            <ToggleField label="جدار خارجي مكشوف (يحتاج لياسة خارجية)" checked={inputs.externalExposed} onChange={(v) => set('externalExposed', v)} />
          </ResultSection>

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

              {res.tankShape === 'circular' ? (
                <ResultSection title="شد الطوق (Hoop Tension)" tone="highlight">
                  <ResultRow label="أقصى شد طوقي عند القاعدة" value={res.hoopTension.TmaxKN_per_m} unit="kN/m" emphasis />
                  <ResultRow label="التسليح الطوقي" value={res.hoopTension.reinforcementHoop} emphasis />
                  <ResultRow label="التسليح الرأسي عند القاعدة" value={res.verticalBending.reinforcementVertical} />
                </ResultSection>
              ) : (
                <ResultSection title="الانحناء الرأسي (كابولي تحت ضغط هيدروستاتيكي)" tone="highlight">
                  <ResultRow label="العزم عند القاعدة (لكل م)" value={res.verticalBending.MuBaseKNm_per_m} unit="kN.m" />
                  <ResultRow label="التسليح الرأسي" value={res.verticalBending.reinforcementVertical} emphasis />
                  <ResultRow label="التسليح الأفقي" value={res.verticalBending.reinforcementHorizontal} emphasis />
                </ResultSection>
              )}

              {res.roof && (
                <ResultSection title="تصميم السقف">
                  <ResultRow label="السماكة" value={res.roof.thicknessMm} unit="mm" />
                  {res.roof.reinforcementEdge && <ResultRow label="تسليح الحافة" value={res.roof.reinforcementEdge} />}
                  {res.roof.reinforcementCenter && <ResultRow label="تسليح المنتصف" value={res.roof.reinforcementCenter} />}
                </ResultSection>
              )}

              <ResultSection title="المساحات والسعة">
                <ResultRow label="السعة التخزينية" value={res.quantities.storageCapacityM3} unit="m³" emphasis />
                <ResultRow label="مساحة العزل المائي" value={res.quantities.waterproofingAreaM2} unit="m²" />
                <ResultRow label="مساحة اللياسة الداخلية" value={res.quantities.internalPlasterAreaM2} unit="m²" />
                {res.quantities.externalPlasterAreaM2 > 0 && <ResultRow label="مساحة اللياسة الخارجية" value={res.quantities.externalPlasterAreaM2} unit="m²" />}
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
            sheetNumber="S-08"
            sheetTitle="حاسبة الخزانات"
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
