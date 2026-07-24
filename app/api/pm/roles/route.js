import { NextResponse } from 'next/server';
import { getFullMatrix } from '@/lib/pm/roles.js';

export async function GET() {
  return NextResponse.json({ success: true, roles: getFullMatrix() });
}
