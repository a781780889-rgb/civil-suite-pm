'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Trash2, ChevronDown, FileDown, Loader2 } from 'lucide-react';
import { fetchCalculations, fetchCalculation, deleteCalculationApi } from '@/lib/api.js';
import { generateQrDataUrl, exportNodeToPdf } from '@/lib/pdfExport.js';
import { formatReportNumber } from '@/lib/reportNumber.js';
import { flattenResultsForReport } from '@/lib/reportFlatten.js';
import PdfReport from '@/components/PdfReport.jsx';
import { SelectField } from '@/components/ui/Field.jsx';

const TYPE_LABELS = {
  isolated_footing: 'قاعدة منفصلة', combined_footing: 'قاعدة مشتركة/شريطية', strap_footing: 'قاعدة مرتبطة',
  mat_foundation: 'لبشة', column: 'عمود', beam: 'كمرة', one_way_slab: 'بلاطة أحادية', two_way_slab: 'بلاطة ثنائية',
  wall: 'جدار', stairs: 'سلم', tank: 'خزان', pool: 'مسبح', materials_quick: 'مواد سريعة',
};

const FILTER_OPTIONS = [{ value: '', label: 'كل الأنواع' }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))];

export default function ReportsPage() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [exportNode, setExportNode] = useState(null);
  const archiveReportRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchCalculations(filter ? { calc_type: filter } : {}).then((res) => {
      if (res.success) setRows(res.calculations);
      setLoading(false);
    });
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    const res = await fetchCalculation(id);
    if (res.success) setExpandedDetail(res.calculation);
  }

  async function handleDelete(id) {
    if (!confirm('هل تريد حذف هذا الحساب نهائياً من قاعدة البيانات؟')) return;
    await deleteCalculationApi(id);
    load();
  }

  async function handleExport(id) {
    setExportingId(id);
    const res = await fetchCalculation(id);
    if (!res.success) {
      setExportingId(null);
      return;
    }
    const calc = res.calculation;
    const reportNumber = formatReportNumber(calc);
    const qr = await generateQrDataUrl(`${TYPE_LABELS[calc.calc_type] || calc.calc_type} | ${reportNumber}`);
    setExportNode({ calc, reportNumber, qr });
    // ننتظر جولة عرض لتركيب DOM ثم نصدّر
    setTimeout(async () => {
      await exportNodeToPdf(archiveReportRef.current, `تقرير-${reportNumber}.pdf`);
      setExportingId(null);
      setExportNode(null);
    }, 300);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-700">التقارير المحفوظة</h1>
          <p className="text-sm text-ink-soft mt-0.5">سجل جميع الحسابات المحفوظة في قاعدة البيانات الموحدة</p>
        </div>
        <div className="w-56">
          <SelectField label="" value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-ink-soft">
          <Loader2 className="animate-spin ml-2" size={18} /> جارٍ التحميل...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-sheet border-2 border-dashed border-line text-center py-16 text-ink-soft text-sm">
          لا توجد حسابات محفوظة بعد. احسب أي عنصر إنشائي واضغط «حفظ في قاعدة البيانات» ليظهر هنا.
        </div>
      )}

      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.id} className="rounded-sheet border border-line bg-white overflow-hidden">
            <div className="flex items-center justify-between p-3.5 gap-3">
              <button onClick={() => toggleExpand(row.id)} className="flex items-center gap-3 flex-1 min-w-0 text-right">
                <ChevronDown size={16} className={`shrink-0 text-ink-soft transition-transform ${expandedId === row.id ? 'rotate-180' : ''}`} />
                <span className="font-mono text-[10px] font-bold text-navy-600 bg-navy-50 px-1.5 py-0.5 rounded shrink-0" dir="ltr">
                  {formatReportNumber(row)}
                </span>
                <span className="font-semibold text-sm text-ink truncate">{TYPE_LABELS[row.calc_type] || row.calc_type}</span>
                {row.title && <span className="text-xs text-ink-soft truncate hidden sm:inline">— {row.title}</span>}
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-ink-soft font-mono tabular-figure hidden md:inline" dir="ltr">
                  {new Date(row.created_at + 'Z').toLocaleDateString('ar-SA-u-nu-latn')}
                </span>
                <button
                  onClick={() => handleExport(row.id)}
                  disabled={exportingId === row.id}
                  className="p-1.5 text-rebar-600 hover:bg-rebar-50 rounded-md disabled:opacity-50"
                  title="تصدير PDF"
                >
                  {exportingId === row.id ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                </button>
                <button onClick={() => handleDelete(row.id)} className="p-1.5 text-fail hover:bg-fail-50 rounded-md" title="حذف">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {expandedId === row.id && expandedDetail && (
              <div className="border-t border-line bg-concrete-50/50 p-4 space-y-3">
                {expandedDetail.engineer_name && (
                  <p className="text-xs text-ink-soft">المهندس المسؤول: <span className="font-medium text-ink">{expandedDetail.engineer_name}</span></p>
                )}
                {flattenResultsForReport(expandedDetail.results)
                  .slice(0, 6)
                  .map((section, i) => (
                    <div key={i} className="rounded-md border border-line bg-white p-3">
                      {section.title && <h4 className="text-xs font-bold text-navy-700 mb-1.5">{section.title}</h4>}
                      <div className="space-y-1">
                        {section.rows?.map((r, j) => (
                          <div key={j} className="flex justify-between text-xs">
                            <span className="text-ink-soft">{r.label}</span>
                            <span className="font-mono font-medium" dir="ltr">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {exportNode && (
        <div style={{ position: 'fixed', top: 0, left: -10000 }}>
          <PdfReport
            ref={archiveReportRef}
            sheetNumber="ARCHIVE"
            sheetTitle={TYPE_LABELS[exportNode.calc.calc_type] || exportNode.calc.calc_type}
            reportNumber={exportNode.reportNumber}
            dateStr={new Date(exportNode.calc.created_at + 'Z').toLocaleDateString('ar-SA-u-nu-latn')}
            projectName=""
            engineerName={exportNode.calc.engineer_name}
            logoDataUrl={null}
            signatureDataUrl={exportNode.calc.signature_base64}
            qrDataUrl={exportNode.qr}
            inputRows={Object.entries(exportNode.calc.inputs || {})
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => ({ label: k, value: String(v) }))}
            results={exportNode.calc.results}
            warnings={exportNode.calc.warnings}
          />
        </div>
      )}
    </div>
  );
}
