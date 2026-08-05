import { NextResponse } from 'next/server';
import {
  predictBreakdownRisk, analyzeFuelConsumption, suggestMaintenanceSchedule, compareEfficiency,
  estimateFutureCost, askEquipmentAssistant, generateFleetExecutiveSummary,
} from '@/lib/equipment/ai.js';
import { getDashboardStats } from '@/lib/equipment/db/dashboard.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

// كل مفتاح: [الدالة، وحدة الصلاحية المطلوبة للقراءة قبل استدعاء الذكاء الاصطناعي] - نفس نمط
// app/api/business/ai/[action]/route.js بالضبط.
const ACTIONS = {
  'breakdown-risk': [(body) => predictBreakdownRisk(body.equipment_id), 'equipment_maintenance'],
  'fuel-analysis': [(body) => analyzeFuelConsumption(body.equipment_id), 'equipment_operation'],
  'maintenance-suggestion': [(body) => suggestMaintenanceSchedule(body.equipment_id), 'equipment_maintenance'],
  'efficiency-comparison': [(body) => compareEfficiency(body.equipment_id), 'equipment'],
  'cost-forecast': [(body) => estimateFutureCost(body.equipment_id), 'equipment'],
  ask: [(body) => askEquipmentAssistant(body.equipment_id, body.question), 'equipment'],
  'executive-summary': [() => generateFleetExecutiveSummary(getDashboardStats()), 'report'],
};

/** كل مخرجات هذا المسار اقتراحات للمراجعة البشرية فقط (البند 26) - لا تكتب أي شيء في قاعدة البيانات. */
export async function POST(request, { params }) {
  try {
    const { action } = await params;
    const entry = ACTIONS[action];
    if (!entry) return NextResponse.json({ success: false, error: `إجراء ذكاء اصطناعي غير معروف: ${action}` }, { status: 400 });
    const [fn, requiredModule] = entry;
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, requiredModule, 'view');
    const result = await fn(body);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return handleEquipError(err);
  }
}
