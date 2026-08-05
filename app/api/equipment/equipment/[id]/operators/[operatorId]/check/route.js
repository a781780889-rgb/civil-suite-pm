import { NextResponse } from 'next/server';
import { checkOperatorAuthorization } from '@/lib/equipment/db/operators.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id, operatorId } = await params;
    getActor(null, request);
    const result = checkOperatorAuthorization(operatorId, id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleEquipError(err);
  }
}
