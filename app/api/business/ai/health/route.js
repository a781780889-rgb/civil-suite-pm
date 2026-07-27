import { NextResponse } from 'next/server';
import { checkBusinessAiHealth } from '@/lib/business/ai.js';

export async function GET() {
  const health = await checkBusinessAiHealth();
  return NextResponse.json({ success: true, ...health });
}
