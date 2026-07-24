'use client';

import { useEffect, useRef, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { fetchBoqElements, boqExportUrl } from '@/lib/api.js';
import { exportNodeToPdf } from '@/lib/pdfExport.js';
import { TRADES } from '@/lib/boq/categoryRegistry.js';
import ProjectPicker, { useSelectedProject } from '@/components/boq/ProjectPicker.jsx';

const UNIT_LABEL = { m: 'م', m2: 'م²', m3: 'م³', kg: 'كغم', ea: 'عدد' };

export default function BoqReportsPage() {
  const { projects, projectId, select, addProject } = useSelectedProject();
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef(null);
  const project = projects.find((p) => String(p.id) === String(projectId));

  useEffect(() => {
    setLoading(true);
    fetchBoqElements({ project_id: projectId, pageSize: 500, page: 1 }).then((res) => {
      if (res.success) setElements(res.rows);
      setLoading(false);
    });
  }, [projectId]);

  const grouped = Object.keys(TRADES)
    .map((key) => ({ key, label: TRADES[key].label_ar, items: elements.filter((e) => e.trade === key) }))
    .filter((g) => g.items.length > 0);
  const grandTotal = elements.reduce((s, e) => s + (Number(e.total_cost) || 0), 0);

  const downloadPdf = async () => {
    setExportingPdf(true);
    try {
      await exportNodeToPdf(reportRef.current, `boq-report-${project?.name || 'all'}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">تقارير حصر الكميات</h1>
          <p className="text-ink-soft text-sm mt-1">{elements.length.toLocaleString('en-US')} عنصر — {grandTotal.toLocaleString('en-US')} ريال</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectPicker projects={projects} projectId={projectId} onSelect={select} onCreate={addProject} />
          <button onClick={downloadPdf} disabled={exportingPdf || !elements.length} className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-md border border-line hover:bg-concrete-50 disabled:opacity-50">
            {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} PDF
          </button>
          <a href={boqExportUrl('excel', projectId)} className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-md border border-line hover:bg-concrete-50">
            <FileSpreadsheet size={15} /> Excel
          </a>
          <a href={boqExportUrl('csv', projectId)} className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-md border border-line hover:bg-concrete-50">
            <FileDown size={15} /> CSV
          </a>
        </div>
      </div>

      {loading && <div className="text-center py-16 text-ink-soft text-sm">جارٍ التحميل...</div>}
      {!loading && !elements.length && <div className="text-center py-16 text-ink-soft text-sm">لا توجد عناصر لعرضها في هذا التقرير بعد.</div>}

      {!loading && elements.length > 0 && (
        <div ref={reportRef} className="pdf-capture-root rounded-sheet border border-line bg-white p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-bold text-navy-700">تقرير حصر الكميات (BOQ)</h2>
              <p className="text-sm text-ink-soft mt-0.5">{project?.name || 'كل المشاريع'}</p>
            </div>
            <p className="text-xs text-ink-soft font-mono" dir="ltr">{new Date().toLocaleDateString('ar-SA-u-nu-latn', { dateStyle: 'long' })}</p>
          </div>

          {grouped.map((g) => {
            const subtotal = g.items.reduce((s, e) => s + (Number(e.total_cost) || 0), 0);
            return (
              <div key={g.key}>
                <div className="bg-navy-700 text-white text-sm font-bold px-3 py-1.5 rounded-t-md">{g.label}</div>
                <table className="w-full text-sm border border-t-0 border-line">
                  <thead className="bg-concrete-50 text-ink-soft text-xs">
                    <tr>
                      <th className="text-right px-3 py-2 font-semibold">الصنف</th>
                      <th className="text-right px-3 py-2 font-semibold">الوصف/الموقع</th>
                      <th className="text-right px-3 py-2 font-semibold">الكمية</th>
                      <th className="text-right px-3 py-2 font-semibold">التكلفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {g.items.map((el) => (
                      <tr key={el.id}>
                        <td className="px-3 py-2">{el.category_name_ar}</td>
                        <td className="px-3 py-2 text-ink-soft">{[el.name, el.location_note].filter(Boolean).join(' - ')}</td>
                        <td className="px-3 py-2 font-mono tabular-figure" dir="ltr">{el.quantity_with_waste} {UNIT_LABEL[el.unit]}</td>
                        <td className="px-3 py-2 font-mono tabular-figure" dir="ltr">{Number(el.total_cost).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-concrete-50 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-left">مجموع {g.label}</td>
                      <td className="px-3 py-2 font-mono tabular-figure" dir="ltr">{subtotal.toLocaleString('en-US')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          <div className="flex items-center justify-between border-t-2 border-navy-700 pt-3">
            <span className="font-bold text-navy-700">الإجمالي الكلي</span>
            <span className="font-mono font-bold text-lg text-navy-700 tabular-figure" dir="ltr">{grandTotal.toLocaleString('en-US')} ريال</span>
          </div>
        </div>
      )}
    </div>
  );
}
