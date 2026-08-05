import { NextResponse } from 'next/server';
import { listCategoryGroups } from '@/lib/equipment/db/categories.js';

export async function GET() {
  return NextResponse.json({ success: true, groups: listCategoryGroups() });
}
