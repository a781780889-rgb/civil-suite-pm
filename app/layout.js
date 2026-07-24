import './globals.css';

export const metadata = {
  title: 'Civil Suite | حاسبة الخرسانة الهندسية',
  description: 'منصة هندسية احترافية لحساب عناصر الخرسانة المسلحة وحصر موادها وإصدار تقارير PDF جاهزة للطباعة.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
