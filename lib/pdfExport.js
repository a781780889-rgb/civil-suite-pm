// lib/pdfExport.js
// يحوّل عنصر HTML (قالب التقرير) إلى ملف PDF متعدد الصفحات بجودة طباعة عالية.
// نستخدم أسلوب "التقاط ثم تقطيع" (html2canvas -> canvas -> شرائح A4 في jsPDF) لأنه
// الأسلوب الوحيد الموثوق لعرض النصوص العربية RTL بشكل صحيح دون مشاكل تشكيل الحروف
// التي تظهر عند الكتابة المباشرة للنص العربي داخل مكتبات PDF من جهة الخادم.

export async function exportNodeToPdf(node, filename) {
  if (!node) throw new Error('عنصر التقرير غير جاهز للتصدير.');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* تجاهل - سنستمر بالخط الاحتياطي إن لزم */
    }
  }

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: node.scrollWidth,
  });

  const imgWidthMm = 210;
  const pageHeightMm = 297;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  let heightLeft = imgHeightMm;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidthMm, imgHeightMm);
  heightLeft -= pageHeightMm;

  while (heightLeft > 0.5) {
    position = heightLeft - imgHeightMm;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidthMm, imgHeightMm);
    heightLeft -= pageHeightMm;
  }

  pdf.save(filename);
}

export async function generateQrDataUrl(text) {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(text, { margin: 1, width: 200, color: { dark: '#16324F', light: '#FFFFFF' } });
}
