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

const EDGE_OPTIONS = [
  { value: 'simple', label: 'بسيط الإسناد' },
  { value: 'continuous', label: 'مستمر' },
  { value: 'oneEndContinuous', label: 'مستمر من طرف واحد' },
];

export default function TwoWaySlabCalculator() {
  const [inputs, setInputs] = useState({
    shortSpanM: 4,
    longSpanM: 5,
    edgeConditionShort: 'continuous',
    edgeConditionLong: 'continuous',
    superimposedDeadKPa: 1.5,
    liveLoadKPa: 2,
    thicknessMm: 160,
    fcMPa: 25,
    fyMPa: 420,
    coverMm: 20,
    barDiaMm: 12,
  });
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('two_way_slab', 'بلاطة ثنائية الاتجاه');
  const dateStr = useUserTime();

  function set(key, val) {
    setInputs((s) => ({ ...s, [key]: val }));
  }
  function handleCalculate() {
    r.handleCalculate({ ...inputs, materials: toMaterialsPayload(materials) });
  }

  const inputRows = [
    { label: 'البحر القصير', value: `${inputs.shortSpanM} m` },
    { label: 'البحر الطويل', value: `${inputs.longSpanM} m` },
    { label: 'السماكة', value: `${inputs.thicknessMm} mm` },
    { label: 'الحمل الحي', value: `${inputs.liveLoadKPa} kPa` },
  ];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-05-B"
        sheetTitle="حاسبة البلاطات ثنائية الاتجاه"
        sheetSubtitle="Two-Way Slab — توزيع الحمل بطريقة توافق الانفراف"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('بلاطة ثنائية الاتجاه')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('بلاطة ثنائية الاتجاه', 'تقرير-بلاطة-ثنائية.pdf')}
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
          <ResultSection title="الأبحاث وحالات الإسناد">
            <FieldGroup cols={2}>
              <NumberField label="البحر القصير Lx" unit="m" value={inputs.shortSpanM} onChange={(v) => set('shortSpanM', v)} />
              <NumberField label="البحر الطويل Ly" unit="m" value={inputs.longSpanM} onChange={(v) => set('longSpanM', v)} />
              <SelectField label="إسناد الاتجاه القصير" value={inputs.edgeConditionShort} onChange={(v) => set('edgeConditionShort', v)} options={EDGE_OPTIONS} />
              <SelectField label="إسناد الاتجاه الطويل" value={inputs.edgeConditionLong} onChange={(v) => set('edgeConditionLong', v)} options={EDGE_OPTIONS} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="الأحمال والسماكة">
            <FieldGroup cols={2}>
              <NumberField label="حمل ميت إضافي" unit="kPa" value={inputs.superimposedDeadKPa} onChange={(v) => set('superimposedDeadKPa', v)} />
              <NumberField label="الحمل الحي" unit="kPa" value={inputs.liveLoadKPa} onChange={(v) => set('liveLoadKPa', v)} />
              <NumberField label="سماكة البلاطة" unit="mm" value={inputs.thicknessMm} onChange={(v) => set('thicknessMm', v)} />
              <NumberField label="الغطاء الخرساني" unit="mm" value={inputs.coverMm} onChange={(v) => set('coverMm', v)} />
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
              <ResultSection title="توزيع الحمل بين الاتجاهين" tone="highlight">
                <p className="text-xs text-ink-soft mb-2">{res.methodology}</p>
                <ResultRow label="نسبة الأبعاد Ly/Lx" value={res.geometry.aspectRatio} />
                <ResultRow label="حمل الاتجاه القصير" value={res.loadSharing.wShortKPa} unit="kPa" />
                <ResultRow label="حمل الاتجاه الطويل" value={res.loadSharing.wLongKPa} unit="kPa" />
              </ResultSection>

              <ResultSection title="الاتجاه القصير (Lx)">
                <ResultRow label="العزم الموجب" value={res.shortDirection.MposKNm_per_m} unit="kN.m/m" />
                <ResultRow label="التسليح (سفلي)" value={res.shortDirection.reinforcementPos} emphasis />
                {res.shortDirection.MnegKNm_per_m > 0 && <ResultRow label="التسليح (علوي)" value={res.shortDirection.reinforcementNeg} emphasis />}
              </ResultSection>
              <ResultSection title="الاتجاه الطويل (Ly)">
                <ResultRow label="العزم الموجب" value={res.longDirection.MposKNm_per_m} unit="kN.m/m" />
                <ResultRow label="التسليح (سفلي)" value={res.longDirection.reinforcementPos} emphasis />
                {res.longDirection.MnegKNm_per_m > 0 && <ResultRow label="التسليح (علوي)" value={res.longDirection.reinforcementNeg} emphasis />}
              </ResultSection>

              <ResultSection title="فحص الترخيم">
                <div className="mb-2">
                  <StatusStamp status={res.deflection.ok ? 'pass' : 'warn'} />
                </div>
                <ResultRow label="السماكة الاسترشادية الدنيا" value={res.deflection.minThicknessMm} unit="mm" />
              </ResultSection>

              <ResultSection title="الكميات">
                <ResultRow label="المساحة" value={res.quantities.areaM2} unit="m²" />
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
            sheetNumber="S-05-B"
            sheetTitle="حاسبة البلاطات ثنائية الاتجاه"
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
