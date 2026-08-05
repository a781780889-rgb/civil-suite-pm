import { NextResponse } from 'next/server';
import { checkHseAiHealth } from '@/lib/hse/ai.js';

export async function GET() {
  const health = await checkHseAiHealth();
  return NextResponse.json({ success: true, ...health });
}
