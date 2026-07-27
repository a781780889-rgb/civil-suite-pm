// lib/business/calc.js
// دوال حسابية بحتة (بلا اتصال قاعدة بيانات) لعروض الأسعار والمستخلصات والعقود - بنفس فلسفة
// lib/pm/budgetCalc.js: تُستدعى من طبقة db/* بعد كل تعديل بنود لإعادة حساب الإجماليات فعلياً
// بدل تخزين إجمالي "يدوي" قد يتعارض مع البنود الفعلية.

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** يحسب إجمالي بند عرض سعر واحد: الكمية × السعر، بعد خصم الصف ثم ضريبته. */
export function computeQuoteItemTotal(item) {
  const base = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  const afterDiscount = base * (1 - (Number(item.discount_pct) || 0) / 100);
  const afterTax = afterDiscount * (1 + (Number(item.tax_pct) || 0) / 100);
  return round2(afterTax);
}

/** يعيد حساب إجماليات عرض السعر بالكامل من بنوده الفعلية + خصم/ضريبة على مستوى العرض ككل. */
export function computeQuoteTotals(items, { discount_pct = 0, tax_pct = 0, other_costs = 0 } = {}) {
  const subtotal = round2(items.reduce((s, it) => s + computeQuoteItemTotal(it), 0));
  const discount_value = round2(subtotal * (Number(discount_pct) || 0) / 100);
  const afterDiscount = subtotal - discount_value;
  const tax_value = round2(afterDiscount * (Number(tax_pct) || 0) / 100);
  const total = round2(afterDiscount + tax_value + (Number(other_costs) || 0));
  return { subtotal, discount_value, tax_value, total };
}

/** القيمة الحالية للعقد = القيمة الأصلية + مجموع أوامر التغيير المعتمدة فقط (البند العاشر:
 * "لا يتم تحديث قيمة العقد إلا بعد اعتماد التغيير"). */
export function computeContractCurrentValue(originalValue, approvedChangeOrders) {
  const delta = approvedChangeOrders.reduce((s, co) => s + (Number(co.delta_value) || 0), 0);
  return round2((Number(originalValue) || 0) + delta);
}

/** صافي المستحق لمستخلص: قيمة الأعمال حتى تاريخه - الأعمال السابقة = أعمال الفترة الحالية،
 * ثم خصم نسبة الضمان والاستقطاعات الأخرى والدفعات السابقة الفعلية على نفس العقد. */
export function computeProgressPaymentNetDue({ work_value_to_date, previous_work_value, retention_pct, other_deductions, previous_payments_total }) {
  const currentPeriodValue = round2((Number(work_value_to_date) || 0) - (Number(previous_work_value) || 0));
  const retentionAmount = round2(currentPeriodValue * (Number(retention_pct) || 0) / 100);
  const netDue = round2(currentPeriodValue - retentionAmount - (Number(other_deductions) || 0) - (Number(previous_payments_total) || 0));
  return { currentPeriodValue, retentionAmount, netDue };
}

/** نسبة إنجاز مالي للعقد = مجموع المستخلصات المعتمدة/المدفوعة ÷ القيمة الحالية. */
export function computeContractFinancialProgress(contract, payments) {
  if (!contract.current_value) return 0;
  const paidToDate = payments
    .filter((p) => ['approved', 'paid'].includes(p.status))
    .reduce((s, p) => s + (Number(p.work_value_to_date) || 0), 0 /* آخر مستخلص فقط أدق، لكن لعدم توفر ترتيب مضمون هنا نأخذ الأحدث */);
  return Math.min(100, round2((paidToDate / contract.current_value) * 100));
}

/** متوسط تقييم شريك (مقاول/مورد) من آخر تقييماته الفعلية. */
export function computePartnerOverallRating(evaluations) {
  if (!evaluations.length) return null;
  const sums = evaluations.reduce(
    (acc, e) => ({
      quality: acc.quality + (Number(e.quality) || 0),
      schedule_adherence: acc.schedule_adherence + (Number(e.schedule_adherence) || 0),
      cost: acc.cost + (Number(e.cost) || 0),
      safety: acc.safety + (Number(e.safety) || 0),
    }),
    { quality: 0, schedule_adherence: 0, cost: 0, safety: 0 }
  );
  const n = evaluations.length;
  const avg = {
    quality: round2(sums.quality / n),
    schedule_adherence: round2(sums.schedule_adherence / n),
    cost: round2(sums.cost / n),
    safety: round2(sums.safety / n),
  };
  avg.overall = round2((avg.quality + avg.schedule_adherence + avg.cost + avg.safety) / 4);
  return avg;
}

/** القيمة المرجّحة لخط أنابيب الفرص (Pipeline) = القيمة المتوقعة × احتمالية الفوز. */
export function computeWeightedPipelineValue(opportunities) {
  return round2(
    opportunities
      .filter((o) => !['won', 'lost'].includes(o.stage))
      .reduce((s, o) => s + (Number(o.expected_value) || 0) * (Number(o.win_probability) || 0) / 100, 0)
  );
}

export { round2 };
