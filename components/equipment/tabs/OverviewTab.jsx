'use client';
import { useState } from 'react';
import { Pencil, MapPin, User, Fuel, Gauge } from 'lucide-react';
import { Section, StatCard } from '@/components/pm/Shared.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import EquipmentFormModal from '@/components/equipment/EquipmentFormModal.jsx';
import { setEquipmentStatus } from '@/lib/equipmentApi.js';
import { EQUIPMENT_STATUS_OPTIONS } from '@/lib/equipmentConstants.js';

function InfoRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-line last:border-0 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}

export default function OverviewTab({ equipment, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  async function handleStatusChange(status) {
    setChangingStatus(true);
    try { await setEquipmentStatus(equipment.id, status, 'تغيير يدوي من نظرة عامة'); onChanged?.(); }
    finally { setChangingStatus(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="عداد الساعات" value={equipment.current_hour_meter ?? 0} icon={Gauge} />
        <StatCard label="الموقع الحالي" value={equipment.current_location || '—'} icon={MapPin} />
        <StatCard label="المشروع الحالي" value={equipment.project_name || '—'} icon={User} />
        <StatCard label="نوع الوقود" value={equipment.fuel_type || '—'} icon={Fuel} />
      </div>

      <Section title="بيانات المعدة" action={
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline">
          <Pencil size={13} /> تعديل البيانات
        </button>
      }>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <StatusBadge status={equipment.status} />
          <span className="text-xs text-ink-soft">تغيير الحالة:</span>
          {EQUIPMENT_STATUS_OPTIONS.filter((s) => s.value !== equipment.status).map((s) => (
            <button
              key={s.value} disabled={changingStatus} onClick={() => handleStatusChange(s.value)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-line text-ink-soft hover:bg-line/50 disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <div>
            <InfoRow label="رقم المعدة" value={equipment.equipment_code} />
            <InfoRow label="التصنيف" value={equipment.category_name} />
            <InfoRow label="الشركة المصنعة" value={equipment.manufacturer} />
            <InfoRow label="الموديل" value={equipment.model} />
            <InfoRow label="سنة الصنع" value={equipment.manufacture_year} />
            <InfoRow label="الرقم التسلسلي" value={equipment.serial_number} />
            <InfoRow label="رقم الهيكل" value={equipment.chassis_number} />
            <InfoRow label="رقم المحرك" value={equipment.engine_number} />
            <InfoRow label="رقم اللوحة" value={equipment.plate_number} />
          </div>
          <div>
            <InfoRow label="الوزن" value={equipment.weight_kg ? `${equipment.weight_kg} كجم` : null} />
            <InfoRow label="الحمولة/السعة" value={equipment.capacity_value ? `${equipment.capacity_value} ${equipment.capacity_unit || ''}` : null} />
            <InfoRow label="القدرة التشغيلية" value={equipment.operating_power} />
            <InfoRow label="سعة الخزان" value={equipment.tank_capacity_l ? `${equipment.tank_capacity_l} لتر` : null} />
            <InfoRow label="معدل الاستهلاك المرجعي" value={equipment.rated_consumption_l_per_hour ? `${equipment.rated_consumption_l_per_hour} لتر/ساعة` : null} />
            <InfoRow label="الملكية" value={equipment.ownership_type === 'rented' ? 'مؤجَّرة' : 'مملوكة'} />
            <InfoRow label="المسؤول عنها" value={equipment.responsible_person} />
            <InfoRow label="تاريخ الشراء" value={equipment.purchase_date} />
            <InfoRow label="سعر الشراء" value={equipment.purchase_price} />
          </div>
        </div>
        {(equipment.warranty_expiry || equipment.insurance_expiry) && (
          <div className="mt-3 pt-3 border-t border-line grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <InfoRow label="انتهاء الضمان" value={equipment.warranty_expiry} />
            <InfoRow label="انتهاء التأمين" value={equipment.insurance_expiry ? `${equipment.insurance_expiry} (${equipment.insurance_provider || ''})` : null} />
          </div>
        )}
        {equipment.notes && <p className="text-sm text-ink-soft mt-3 pt-3 border-t border-line">{equipment.notes}</p>}
      </Section>

      <EquipmentFormModal open={editing} onClose={() => setEditing(false)} equipment={equipment} onSaved={() => { setEditing(false); onChanged?.(); }} />
    </div>
  );
}
