import { NextResponse } from 'next/server';
import { checkEquipmentAiHealth } from '@/lib/equipment/ai.js';

export async function GET() {
  const health = await checkEquipmentAiHealth();
  return NextResponse.json({ success: true, ...health });
}
