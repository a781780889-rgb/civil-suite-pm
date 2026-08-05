'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import { getEquipment } from '@/lib/equipmentApi.js';

import OverviewTab from '@/components/equipment/tabs/OverviewTab.jsx';
import OperationsTab from '@/components/equipment/tabs/OperationsTab.jsx';
import FuelTab from '@/components/equipment/tabs/FuelTab.jsx';
import MaintenanceTab from '@/components/equipment/tabs/MaintenanceTab.jsx';
import BreakdownsTab from '@/components/equipment/tabs/BreakdownsTab.jsx';
import ReservationsTab from '@/components/equipment/tabs/ReservationsTab.jsx';
import OperatorsTab from '@/components/equipment/tabs/OperatorsTab.jsx';
import TransfersTab from '@/components/equipment/tabs/TransfersTab.jsx';
import RentalsTab from '@/components/equipment/tabs/RentalsTab.jsx';
import CostsTab from '@/components/equipment/tabs/CostsTab.jsx';
import DocumentsTab from '@/components/equipment/tabs/DocumentsTab.jsx';
import AuditTab from '@/components/equipment/tabs/AuditTab.jsx';

const TABS = [
  { key: 'overview', label: 'نظرة عامة', Component: OverviewTab },
  { key: 'operations', label: 'التشغيل والساعات', Component: OperationsTab },
  { key: 'fuel', label: 'الوقود', Component: FuelTab },
  { key: 'maintenance', label: 'الصيانة', Component: MaintenanceTab },
  { key: 'breakdowns', label: 'الأعطال', Component: BreakdownsTab },
  { key: 'reservations', label: 'الحجز والتخصيص', Component: ReservationsTab },
  { key: 'operators', label: 'المشغلون', Component: OperatorsTab },
  { key: 'transfers', label: 'النقل', Component: TransfersTab },
  { key: 'rentals', label: 'الإيجار', Component: RentalsTab },
  { key: 'costs', label: 'التكلفة والمؤشرات', Component: CostsTab },
  { key: 'documents', label: 'المستندات', Component: DocumentsTab },
  { key: 'audit', label: 'سجل التدقيق', Component: AuditTab },
];

export default function EquipmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getEquipment(id);
      setEquipment(res.equipment);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function setTab(key) {
    router.push(`/dashboard/equipment/equipment/${id}?tab=${key}`);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-ink-soft"><Loader2 className="animate-spin ml-2" size={18} /> جارِ التحميل...</div>;
  }
  if (error || !equipment) {
    return <div className="p-6 text-sm text-fail">{error || 'المعدة غير موجودة.'}</div>;
  }

  const ActiveComponent = TABS.find((t) => t.key === activeTab)?.Component || OverviewTab;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/equipment/equipment" className="p-1.5 rounded hover:bg-line text-ink-soft shrink-0"><ArrowRight size={18} /></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-ink truncate">{equipment.name}</h1>
              <StatusBadge status={equipment.status} />
            </div>
            <p className="text-xs text-ink-soft font-mono">{equipment.equipment_code} · {equipment.category_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationsBell equipmentId={equipment.id} />
          <ActorBar />
        </div>
      </div>

      <div className="border-b border-line overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.key ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ActiveComponent equipment={equipment} onChanged={load} />
    </div>
  );
}
