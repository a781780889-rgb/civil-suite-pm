// lib/equipment/costCalc.js
// حسابات التكلفة والإنتاجية ومؤشرات الأداء KPI - دوال نقية 100% (بلا أي استعلام قاعدة بيانات)
// بنفس روح lib/pm/budgetCalc.js، بحيث تبقى قابلة للاختبار المباشر دون Mock لقاعدة البيانات.
// البنود المرجعية: 16 (تكلفة المعدات)، 19 (مؤشرات الأداء KPI)، 26 (الذكاء الاصطناعي).

/** الإهلاك بطريقة القسط الثابت (Straight-Line) - القيمة السنوية والمتراكمة حتى تاريخ معيّن. */
export function computeStraightLineDepreciation({ purchase_price, salvage_value = 0, useful_life_years, purchase_date }, asOfDate = new Date()) {
  const price = Number(purchase_price) || 0;
  const salvage = Number(salvage_value) || 0;
  const life = Number(useful_life_years) || 0;
  if (!life || life <= 0 || !purchase_date) {
    return { annual_depreciation: 0, accumulated_depreciation: 0, book_value: price, months_in_service: 0 };
  }
  const annual = Math.max(0, (price - salvage) / life);
  const start = new Date(purchase_date);
  const end = new Date(asOfDate);
  const monthsInService = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
  const maxMonths = life * 12;
  const effectiveMonths = Math.min(monthsInService, maxMonths);
  const accumulated = Math.min(price - salvage, (annual / 12) * effectiveMonths);
  return {
    annual_depreciation: round2(annual),
    accumulated_depreciation: round2(accumulated),
    book_value: round2(Math.max(salvage, price - accumulated)),
    months_in_service: monthsInService,
  };
}

/** تكلفة الساعة التشغيلية = إجمالي التكلفة الفعلية ÷ إجمالي ساعات التشغيل (البند 16، 19). */
export function computeCostPerHour(totalCost, totalHours) {
  const hours = Number(totalHours) || 0;
  if (hours <= 0) return null;
  return round2(Number(totalCost || 0) / hours);
}

/** متوسط زمن الإصلاح MTTR = متوسط ساعات التوقف لكل الأعطال المُغلقة (البند 19). */
export function computeMTTR(breakdowns) {
  const resolved = (breakdowns || []).filter((b) => Number(b.downtime_hours) > 0);
  if (!resolved.length) return null;
  const total = resolved.reduce((s, b) => s + Number(b.downtime_hours || 0), 0);
  return round2(total / resolved.length);
}

/** متوسط الوقت بين الأعطال MTBF ≈ إجمالي ساعات التشغيل ÷ عدد الأعطال (البند 19). */
export function computeMTBF(totalOperatingHours, breakdownCount) {
  if (!breakdownCount || breakdownCount <= 0) return null;
  return round2(Number(totalOperatingHours || 0) / breakdownCount);
}

/** نسبة الاستغلال = ساعات التشغيل الفعلية ÷ ساعات العمل المتاحة في الفترة × 100 (البند 19). */
export function computeUtilizationRate(operatingHours, availableHours) {
  const avail = Number(availableHours) || 0;
  if (avail <= 0) return null;
  return round2((Number(operatingHours || 0) / avail) * 100);
}

/** استهلاك الوقود الفعلي لكل ساعة، ونسبة الانحراف عن المعدل المرجعي للمعدة (لاكتشاف الشذوذ - البند 9). */
export function computeFuelEfficiency(totalFuelL, totalHours, ratedConsumption) {
  const hours = Number(totalHours) || 0;
  if (hours <= 0) return { actual_l_per_hour: null, deviation_pct: null };
  const actual = Number(totalFuelL || 0) / hours;
  const rated = Number(ratedConsumption) || 0;
  const deviation = rated > 0 ? round2(((actual - rated) / rated) * 100) : null;
  return { actual_l_per_hour: round2(actual), deviation_pct: deviation };
}

/** إجمالي التكلفة الفعلية لمعدة = شراء(إهلاك) + وقود + صيانة + قطع غيار + إيجار + نقل (البند 16). */
export function computeTotalCost({ depreciation = 0, fuel = 0, maintenance = 0, spareParts = 0, rental = 0, transfer = 0 }) {
  return round2(
    Number(depreciation || 0) + Number(fuel || 0) + Number(maintenance || 0) +
    Number(spareParts || 0) + Number(rental || 0) + Number(transfer || 0)
  );
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
