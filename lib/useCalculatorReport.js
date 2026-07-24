'use client';

import { useState, useRef, useCallback } from 'react';
import { runCalculation, saveCalculation } from './api.js';
import { generateQrDataUrl, exportNodeToPdf } from './pdfExport.js';
import { formatReportNumber } from './reportNumber.js';
import { useReportMeta } from './useReportMeta.js';

export function useCalculatorReport(calcType, sheetLabel) {
  const meta = useReportMeta();
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [errors, setErrors] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [exportStatus, setExportStatus] = useState('idle');
  const [savedRecord, setSavedRecord] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const reportRef = useRef(null);
  const lastInputsRef = useRef(null);

  const handleCalculate = useCallback(
    async (inputs) => {
      setCalculating(true);
      setErrors([]);
      lastInputsRef.current = inputs;
      try {
        const res = await runCalculation(calcType, inputs);
        if (res.success) {
          setResults(res.results);
          setWarnings(res.results.warnings || []);
          setSavedRecord(null);
          setSaveStatus('idle');
        } else {
          setResults(null);
          setErrors(res.errors || ['حدث خطأ غير متوقع.']);
        }
      } catch (e) {
        setResults(null);
        setErrors(['تعذّر الاتصال بخادم الحساب. تأكد من تشغيل الخادم.']);
      } finally {
        setCalculating(false);
      }
      return null;
    },
    [calcType]
  );

  const doSave = useCallback(
    async (title) => {
      if (!results) return null;
      setSaveStatus('saving');
      const res = await saveCalculation({
        calc_type: calcType,
        title: title || sheetLabel,
        engineer_name: meta.engineerName,
        signature_base64: meta.signatureDataUrl,
        inputs: lastInputsRef.current,
        results,
        warnings,
      });
      if (res.success) {
        setSavedRecord(res.calculation);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
        return res.calculation;
      }
      setSaveStatus('error');
      return null;
    },
    [calcType, sheetLabel, meta.engineerName, meta.signatureDataUrl, results, warnings]
  );

  const handleSave = useCallback(
    (title) => {
      doSave(title);
    },
    [doSave]
  );

  const handleExportPdf = useCallback(
    async (title, filename, qrSummary) => {
      if (!results) return;
      setExportStatus('exporting');
      try {
        let record = savedRecord;
        if (!record) {
          record = await doSave(title);
        }
        const reportNumber = record ? formatReportNumber(record) : formatReportNumber({ id: 0, created_at: new Date().toISOString() });
        const qr = await generateQrDataUrl(qrSummary || `${sheetLabel} | ${reportNumber} | ${meta.projectName || ''}`);
        setQrDataUrl(qr);
        // ننتظر جولة عرض (render) واحدة على الأقل ليلتقط html2canvas صورة الـQR بعد تحديث الحالة
        await new Promise((resolve) => setTimeout(resolve, 250));
        await exportNodeToPdf(reportRef.current, filename || `${sheetLabel}.pdf`);
        setExportStatus('idle');
      } catch (e) {
        console.error(e);
        setExportStatus('error');
      }
    },
    [results, savedRecord, doSave, meta.projectName, sheetLabel]
  );

  return {
    meta,
    calculating,
    results,
    warnings,
    errors,
    saveStatus,
    exportStatus,
    savedRecord,
    qrDataUrl,
    reportRef,
    handleCalculate,
    handleSave,
    handleExportPdf,
    reportNumber: savedRecord ? formatReportNumber(savedRecord) : null,
  };
}
