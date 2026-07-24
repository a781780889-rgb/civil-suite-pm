'use client';

import { forwardRef } from 'react';
import { flattenResultsForReport } from '@/lib/reportFlatten.js';

function Section({ title, rows, children }) {
  if ((!rows || rows.length === 0) && (!children || children.length === 0)) return null;
  return (
    <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
      {title && (
        <div style={{ background: '#16324F', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: '4px 4px 0 0' }}>
          {title}
        </div>
      )}
      {rows && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F6F7F6' }}>
                <td style={{ padding: '5px 10px', color: '#586066', border: '1px solid #DBDDD8', width: '55%' }}>{r.label}</td>
                <td style={{ padding: '5px 10px', fontWeight: 600, color: '#1C2321', border: '1px solid #DBDDD8', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {children && children.map((c, i) => <Section key={i} title={c.title} rows={c.rows} children={c.children} />)}
    </div>
  );
}

const PdfReport = forwardRef(function PdfReport(
  { sheetNumber, sheetTitle, reportNumber, dateStr, projectName, engineerName, logoDataUrl, signatureDataUrl, qrDataUrl, inputRows, results, warnings },
  ref
) {
  const sections = flattenResultsForReport(results || {});
  return (
    <div ref={ref} className="pdf-capture-root" style={{ fontFamily: '"IBM Plex Sans Arabic", Tahoma, sans-serif', padding: 32, color: '#1C2321' }}>
      {/* ترويسة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #16324F', paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="شعار المشروع" style={{ height: 52, width: 52, objectFit: 'contain', borderRadius: 6 }} />
          ) : (
            <div style={{ height: 52, width: 52, borderRadius: 6, background: '#16324F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>
              CS
            </div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#16324F' }}>Civil Engineering Suite</div>
            <div style={{ fontSize: 11, color: '#586066' }}>تقرير حساب هندسي — حاسبة الخرسانة المسلحة</div>
          </div>
        </div>
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR" style={{ height: 70, width: 70 }} />
        )}
      </div>

      {/* اللوحة العنوانية (Title Block) */}
      <div style={{ border: '1.5px solid #16324F', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ background: '#16324F', color: '#fff', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
          <span dir="ltr" style={{ fontFamily: 'monospace' }}>{sheetNumber}</span>
          <span>{sheetTitle}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 10px', border: '1px solid #DBDDD8', color: '#586066', width: '18%' }}>اسم المشروع</td>
              <td style={{ padding: '6px 10px', border: '1px solid #DBDDD8', fontWeight: 600, width: '32%' }}>{projectName || '—'}</td>
              <td style={{ padding: '6px 10px', border: '1px solid #DBDDD8', color: '#586066', width: '18%' }}>رقم التقرير</td>
              <td style={{ padding: '6px 10px', border: '1px solid #DBDDD8', fontWeight: 600, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{reportNumber}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', border: '1px solid #DBDDD8', color: '#586066' }}>المهندس المسؤول</td>
              <td style={{ padding: '6px 10px', border: '1px solid #DBDDD8', fontWeight: 600 }}>{engineerName || '—'}</td>
              <td style={{ padding: '6px 10px', border: '1px solid #DBDDD8', color: '#586066' }}>التاريخ</td>
              <td style={{ padding: '6px 10px', border: '1px solid #DBDDD8', fontWeight: 600, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{dateStr}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* المدخلات */}
      {inputRows && inputRows.length > 0 && <Section title="بيانات الإدخال" rows={inputRows} />}

      {/* النتائج والعمليات الحسابية */}
      {sections.map((s, i) => (
        <Section key={i} title={s.title} rows={s.rows} children={s.children} />
      ))}

      {/* الملاحظات الهندسية */}
      {warnings && warnings.length > 0 && (
        <div style={{ border: '1.5px solid #B8860B', background: '#FBF3E1', borderRadius: 6, padding: 10, marginBottom: 16, breakInside: 'avoid' }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, color: '#8a6508' }}>ملاحظات هندسية يجب مراجعتها:</div>
          <ul style={{ margin: 0, paddingRight: 18, fontSize: 11 }}>
            {warnings.map((w, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* التوقيع */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', breakInside: 'avoid' }}>
        <div style={{ fontSize: 9, color: '#8B9296', maxWidth: 260 }}>
          تم إنشاء هذا التقرير آلياً بواسطة Civil Engineering Suite. يبقى المهندس المسؤول المذكور أعلاه هو الجهة المُعتمدة لمراجعة النتائج والتوقيع عليها قبل الاستخدام التنفيذي.
        </div>
        <div style={{ textAlign: 'center' }}>
          {signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signatureDataUrl} alt="توقيع" style={{ height: 50, marginBottom: 2 }} />
          ) : (
            <div style={{ height: 50 }} />
          )}
          <div style={{ borderTop: '1.5px solid #1C2321', paddingTop: 4, fontSize: 11, minWidth: 180 }}>
            <div style={{ fontWeight: 700 }}>{engineerName || 'المهندس المسؤول'}</div>
            <div style={{ fontSize: 9, color: '#8B9296' }}>توقيع المهندس المسؤول</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PdfReport;
