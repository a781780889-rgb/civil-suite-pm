// lib/equipment/reportsData.js
// بناء بيانات التقارير الاثني عشر (البند 21) - كل دالة تُعيد {title, columns, rows} جاهزة
// لتُمرَّر مباشرة لمُصدِّري lib/pm/exporters (نفس مبدأ إعادة الاستخدام المُتَّبع في lib/business).
import { edb } from './schema.js';

function q(sql, params = {}) { return edb().prepare(sql).all(params); }

export function buildEquipmentReport() {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, ec.name_ar AS category, ea.manufacturer, ea.model, ea.status,
           ea.ownership_type, ea.current_location, p.name AS project, ea.current_hour_meter, ea.purchase_price
    FROM equipment_assets ea LEFT JOIN equipment_categories ec ON ec.key = ea.category_key LEFT JOIN projects p ON p.id = ea.current_project_id
    WHERE ea.is_archived = 0 ORDER BY ea.equipment_code
  `);
  return {
    title: 'تقرير المعدات', rows,
    columns: [
      { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'category', label: 'التصنيف' },
      { key: 'manufacturer', label: 'الشركة المصنعة' }, { key: 'model', label: 'الموديل' }, { key: 'status', label: 'الحالة' },
      { key: 'ownership_type', label: 'الملكية' }, { key: 'current_location', label: 'الموقع الحالي' }, { key: 'project', label: 'المشروع الحالي' },
      { key: 'current_hour_meter', label: 'عداد الساعات' }, { key: 'purchase_price', label: 'سعر الشراء' },
    ],
  };
}

export function buildUsageReport({ from, to } = {}) {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, COUNT(ol.id) AS sessions, ROUND(SUM(ol.hours), 1) AS total_hours,
           MIN(ol.log_date) AS first_use, MAX(ol.log_date) AS last_use
    FROM equipment_operation_logs ol JOIN equipment_assets ea ON ea.id = ol.equipment_id
    WHERE ol.log_date >= @from AND ol.log_date <= @to GROUP BY ol.equipment_id ORDER BY total_hours DESC
  `, { from: from || '0000-01-01', to: to || '9999-12-31' });
  return { title: 'تقرير الاستخدام', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'sessions', label: 'عدد جلسات التشغيل' },
    { key: 'total_hours', label: 'إجمالي الساعات' }, { key: 'first_use', label: 'أول استخدام' }, { key: 'last_use', label: 'آخر استخدام' },
  ] };
}

export function buildHoursReport({ from, to } = {}) {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, ol.log_date, ol.hours, ol.activity, p.name AS project, op.name AS operator
    FROM equipment_operation_logs ol JOIN equipment_assets ea ON ea.id = ol.equipment_id
    LEFT JOIN projects p ON p.id = ol.project_id LEFT JOIN equipment_operators op ON op.id = ol.operator_id
    WHERE ol.log_date >= @from AND ol.log_date <= @to ORDER BY ol.log_date DESC
  `, { from: from || '0000-01-01', to: to || '9999-12-31' });
  return { title: 'تقرير ساعات التشغيل', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'log_date', label: 'التاريخ' },
    { key: 'hours', label: 'الساعات' }, { key: 'activity', label: 'النشاط' }, { key: 'project', label: 'المشروع' }, { key: 'operator', label: 'المشغل' },
  ] };
}

export function buildFuelReport({ from, to } = {}) {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, fl.fill_date, fl.quantity_l, fl.price_per_liter, fl.total_cost, fl.supplier, p.name AS project
    FROM equipment_fuel_logs fl JOIN equipment_assets ea ON ea.id = fl.equipment_id LEFT JOIN projects p ON p.id = fl.project_id
    WHERE fl.fill_date >= @from AND fl.fill_date <= @to ORDER BY fl.fill_date DESC
  `, { from: from || '0000-01-01', to: to || '9999-12-31' });
  return { title: 'تقرير الوقود', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'fill_date', label: 'تاريخ التعبئة' },
    { key: 'quantity_l', label: 'الكمية (لتر)' }, { key: 'price_per_liter', label: 'سعر اللتر' }, { key: 'total_cost', label: 'التكلفة الإجمالية' },
    { key: 'supplier', label: 'المورد' }, { key: 'project', label: 'المشروع' },
  ] };
}

export function buildMaintenanceReport({ from, to } = {}) {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, m.maintenance_date, m.maintenance_type, m.title, m.technician, m.total_cost, m.downtime_hours, m.status
    FROM equipment_maintenance_records m JOIN equipment_assets ea ON ea.id = m.equipment_id
    WHERE m.maintenance_date >= @from AND m.maintenance_date <= @to ORDER BY m.maintenance_date DESC
  `, { from: from || '0000-01-01', to: to || '9999-12-31' });
  return { title: 'تقرير الصيانة', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'maintenance_date', label: 'التاريخ' },
    { key: 'maintenance_type', label: 'النوع' }, { key: 'title', label: 'العنوان' }, { key: 'technician', label: 'الفني' },
    { key: 'total_cost', label: 'التكلفة' }, { key: 'downtime_hours', label: 'ساعات التوقف' }, { key: 'status', label: 'الحالة' },
  ] };
}

export function buildBreakdownsReport({ from, to } = {}) {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, b.report_no, b.breakdown_date, b.description, b.severity, b.status, b.total_cost
    FROM equipment_breakdowns b JOIN equipment_assets ea ON ea.id = b.equipment_id
    WHERE b.breakdown_date >= @from AND b.breakdown_date <= @to ORDER BY b.breakdown_date DESC
  `, { from: from || '0000-01-01', to: to || '9999-12-31' });
  return { title: 'تقرير الأعطال', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'report_no', label: 'رقم البلاغ' },
    { key: 'breakdown_date', label: 'التاريخ' }, { key: 'description', label: 'الوصف' }, { key: 'severity', label: 'الخطورة' },
    { key: 'status', label: 'الحالة' }, { key: 'total_cost', label: 'تكلفة الإصلاح' },
  ] };
}

export function buildSparePartsReport() {
  const rows = q(`SELECT part_name, part_number, manufacturer, supplier, quantity_on_hand, min_stock, unit_price, storage_location FROM equipment_spare_parts ORDER BY part_name`);
  return { title: 'تقرير قطع الغيار', rows, columns: [
    { key: 'part_name', label: 'اسم القطعة' }, { key: 'part_number', label: 'رقم القطعة' }, { key: 'manufacturer', label: 'الشركة المصنعة' },
    { key: 'supplier', label: 'المورد' }, { key: 'quantity_on_hand', label: 'الكمية المتوفرة' }, { key: 'min_stock', label: 'الحد الأدنى' },
    { key: 'unit_price', label: 'سعر الوحدة' }, { key: 'storage_location', label: 'موقع التخزين' },
  ] };
}

export function buildCostReport() {
  const rows = q(`
    SELECT ea.equipment_code, ea.name,
      COALESCE((SELECT SUM(total_cost) FROM equipment_fuel_logs WHERE equipment_id = ea.id), 0) AS fuel_cost,
      COALESCE((SELECT SUM(total_cost) FROM equipment_maintenance_records WHERE equipment_id = ea.id), 0) AS maintenance_cost,
      COALESCE((SELECT SUM(total_cost) FROM equipment_breakdowns WHERE equipment_id = ea.id), 0) AS breakdown_cost,
      COALESCE((SELECT SUM(rental_cost_total) FROM equipment_rentals WHERE equipment_id = ea.id), 0) AS rental_cost,
      COALESCE((SELECT SUM(hours) FROM equipment_operation_logs WHERE equipment_id = ea.id), 0) AS total_hours
    FROM equipment_assets ea WHERE ea.is_archived = 0 ORDER BY ea.equipment_code
  `).map((r) => ({ ...r, total_cost: Math.round((r.fuel_cost + r.maintenance_cost + r.breakdown_cost + r.rental_cost) * 100) / 100 }));
  return { title: 'تقرير تكلفة المعدات', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'fuel_cost', label: 'تكلفة الوقود' },
    { key: 'maintenance_cost', label: 'تكلفة الصيانة' }, { key: 'breakdown_cost', label: 'تكلفة الأعطال' }, { key: 'rental_cost', label: 'تكلفة الإيجار' },
    { key: 'total_hours', label: 'إجمالي الساعات' }, { key: 'total_cost', label: 'التكلفة الإجمالية' },
  ] };
}

export function buildByProjectReport() {
  const rows = q(`
    SELECT p.name AS project, COUNT(ea.id) AS equipment_count, GROUP_CONCAT(ea.equipment_code, ', ') AS equipment_codes
    FROM equipment_assets ea JOIN projects p ON p.id = ea.current_project_id
    WHERE ea.is_archived = 0 GROUP BY ea.current_project_id ORDER BY equipment_count DESC
  `);
  return { title: 'تقرير المعدات حسب المشروع', rows, columns: [
    { key: 'project', label: 'المشروع' }, { key: 'equipment_count', label: 'عدد المعدات' }, { key: 'equipment_codes', label: 'أرقام المعدات' },
  ] };
}

export function buildStoppedReport() {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, ea.status, ea.current_location,
      (SELECT MAX(created_at) FROM equipment_status_log WHERE equipment_id = ea.id AND new_status = ea.status) AS since
    FROM equipment_assets ea WHERE ea.status IN ('stopped', 'out_of_service') AND ea.is_archived = 0
  `);
  return { title: 'تقرير المعدات المتوقفة', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'status', label: 'الحالة' },
    { key: 'current_location', label: 'الموقع' }, { key: 'since', label: 'متوقفة منذ' },
  ] };
}

export function buildRentalsReport() {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, r.rental_company, r.contract_no, r.rental_start, r.rental_end, r.rental_cost_total, r.contract_status
    FROM equipment_rentals r JOIN equipment_assets ea ON ea.id = r.equipment_id ORDER BY r.rental_start DESC
  `);
  return { title: 'تقرير المعدات المؤجرة', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'rental_company', label: 'شركة التأجير' },
    { key: 'contract_no', label: 'رقم العقد' }, { key: 'rental_start', label: 'بداية الإيجار' }, { key: 'rental_end', label: 'نهاية الإيجار' },
    { key: 'rental_cost_total', label: 'إجمالي التكلفة' }, { key: 'contract_status', label: 'حالة العقد' },
  ] };
}

export function buildProductivityReport({ from, to } = {}) {
  const rows = q(`
    SELECT ea.equipment_code, ea.name, ROUND(SUM(ol.hours), 1) AS total_hours, ROUND(SUM(ol.productivity_qty), 1) AS total_productivity,
      ol.productivity_unit
    FROM equipment_operation_logs ol JOIN equipment_assets ea ON ea.id = ol.equipment_id
    WHERE ol.log_date >= @from AND ol.log_date <= @to AND ol.productivity_qty IS NOT NULL
    GROUP BY ol.equipment_id, ol.productivity_unit ORDER BY total_productivity DESC
  `, { from: from || '0000-01-01', to: to || '9999-12-31' });
  return { title: 'تقرير الإنتاجية', rows, columns: [
    { key: 'equipment_code', label: 'رقم المعدة' }, { key: 'name', label: 'الاسم' }, { key: 'total_hours', label: 'إجمالي الساعات' },
    { key: 'total_productivity', label: 'إجمالي الإنتاجية' }, { key: 'productivity_unit', label: 'الوحدة' },
  ] };
}

export const REPORT_BUILDERS = {
  equipment: buildEquipmentReport, usage: buildUsageReport, hours: buildHoursReport, fuel: buildFuelReport,
  maintenance: buildMaintenanceReport, breakdowns: buildBreakdownsReport, spare_parts: buildSparePartsReport,
  cost: buildCostReport, by_project: buildByProjectReport, stopped: buildStoppedReport, rentals: buildRentalsReport,
  productivity: buildProductivityReport,
};
