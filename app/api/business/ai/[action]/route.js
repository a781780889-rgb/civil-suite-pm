import { NextResponse } from 'next/server';
import {
  analyzeOpportunity, analyzeClientPerformance, compareSupplierQuotes, analyzePartnerPerformance,
  detectAnomalies, analyzeContract, summarizeCorrespondence, extractCommitmentsFromText,
  generateExecutiveSummary, askBusinessAssistant,
} from '@/lib/business/ai.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

// كل مفتاح: [الدالة، وحدة الصلاحية المطلوبة للقراءة قبل استدعاء الذكاء الاصطناعي]
const ACTIONS = {
  'opportunity-analysis': [analyzeOpportunity, 'biz_opportunity'],
  'client-analysis': [analyzeClientPerformance, 'biz_client'],
  'supplier-comparison': [compareSupplierQuotes, 'biz_partner'],
  'partner-performance': [analyzePartnerPerformance, 'biz_partner'],
  'anomaly-detection': [detectAnomalies, 'biz_payment'],
  'contract-analysis': [analyzeContract, 'biz_contract'],
  'correspondence-summary': [summarizeCorrespondence, 'biz_correspondence'],
  'extract-commitments': [extractCommitmentsFromText, 'biz_commitment'],
  'executive-summary': [generateExecutiveSummary, 'report'],
  ask: [askBusinessAssistant, 'report'],
};

/** كل مخرجات هذا المسار اقتراحات للمراجعة البشرية فقط (البند 20) - لا يكتب أي شيء في قاعدة البيانات. */
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
    return handleBizError(err);
  }
}
