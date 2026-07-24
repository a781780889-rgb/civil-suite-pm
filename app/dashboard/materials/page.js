'use client';

import { useState } from 'react';
import TitleBlock from '@/components/TitleBlock.jsx';
import ActionBar from '@/components/ActionBar.jsx';
import { NumberField, FieldGroup } from '@/components/ui/Field.jsx';
import { ResultSection, ErrorsList, EmptyResultsHint } from '@/components/ui/Results.jsx';
import MaterialsPanel, { defaultMaterialsState, toMaterialsPayload } from '@/components/MaterialsPanel.jsx';
import MaterialsResult from '@/components/MaterialsResult.jsx';
import PdfReport from '@/components/PdfReport.jsx';
import { useCalculatorReport } from '@/lib/useCalculatorReport.js';
import { useUserTime } from '@/lib/useUserTime.js';

export default function MaterialsQuickPage() {
  const [volumeM3, setVolumeM3] = useState(10);
  const [materials, setMaterials] = useState(defaultMaterialsState());
  const r = useCalculatorReport('materials_quick', 'حاسبة مواد سريعة');
  const dateStr = useUserTime();

  function handleCalculate() {
    r.handleCalculate({ volumeM3, materials: toMaterialsPayload(materials) });
  }

  const inputRows = [{ label: 'حجم الخرسانة', value: `${volumeM3} m³` }];
  const res = r.results;

  return (
    <div className="space-y-4">
      <TitleBlock
        sheetNumber="S-10"
        sheetTitle="حاسبة المواد السريعة"
        sheetSubtitle="حساب مباشر لمواد أي حجم خرسانة دون المرور بعنصر إنشائي محدد"
        projectName={r.meta.projectName}
        onProjectNameChange={r.meta.setProjectName}
        engineerName={r.meta.engineerName}
        onEngineerNameChange={r.meta.setEngineerName}
        dateLabel={dateStr}
      />
      <ActionBar
        onCalculate={handleCalculate}
        calculating={r.calculating}
        onSave={() => r.handleSave('حاسبة مواد سريعة')}
        saveStatus={r.saveStatus}
        onExportPdf={() => r.handleExportPdf('حاسبة مواد سريعة', 'تقرير-مواد.pdf')}
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
          <ResultSection title="حجم الخرسانة">
            <FieldGroup cols={2}>
              <NumberField label="حجم الخرسانة" unit="m³" value={volumeM3} onChange={setVolumeM3} />
            </FieldGroup>
          </ResultSection>
          <ResultSection title="مواصفات الخلطة">
            <MaterialsPanel value={materials} onChange={setMaterials} />
          </ResultSection>
        </div>
        <div className="space-y-4">
          <ErrorsList errors={r.errors} />
          {!res && !r.errors.length && <EmptyResultsHint />}
          {res && <MaterialsResult materials={res.materials} />}
        </div>
      </div>

      {res && (
        <div style={{ position: 'fixed', top: 0, left: -10000 }}>
          <PdfReport
            ref={r.reportRef}
            sheetNumber="S-10"
            sheetTitle="حاسبة المواد السريعة"
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
