// app/api/calculate/route.js
// نقطة نهاية موحّدة لتنفيذ جميع أنواع الحسابات الهندسية (لا يتم حفظ شيء هنا - حساب فقط)

import { NextResponse } from 'next/server';
import { calculateIsolatedFooting, calculateCombinedFooting, calculateStrapFooting } from '@/lib/calc/footings.js';
import { calculateMatFoundation } from '@/lib/calc/mat.js';
import { calculateColumn } from '@/lib/calc/column.js';
import { calculateBeam } from '@/lib/calc/beam.js';
import { calculateOneWaySlab, calculateTwoWaySlab } from '@/lib/calc/slab.js';
import { calculateWall } from '@/lib/calc/wall.js';
import { calculateStairs } from '@/lib/calc/stairs.js';
import { calculateTank } from '@/lib/calc/tank.js';
import { calculatePool } from '@/lib/calc/pool.js';
import { calculateConcreteMaterials } from '@/lib/calc/materials.js';
import { ValidationError } from '@/lib/calc/common.js';
import { calculatePadRebar } from '@/lib/calc/rebar/padRebar.js';
import { calculateColumnPileRebar } from '@/lib/calc/rebar/columnPileRebar.js';
import { calculateLinearRebar } from '@/lib/calc/rebar/linearRebar.js';
import { calculateSolidSlabRebar, calculateHourdiSlabRebar } from '@/lib/calc/rebar/slabRebar.js';
import { calculateWallPanelRebar } from '@/lib/calc/rebar/wallPanelRebar.js';
import { calculateTankRebar } from '@/lib/calc/rebar/tankRebar.js';
import { calculatePoolRebar } from '@/lib/calc/rebar/poolRebar.js';
import { calculateStairsRebar } from '@/lib/calc/rebar/stairsRebar.js';

const HANDLERS = {
  isolated_footing: calculateIsolatedFooting,
  combined_footing: calculateCombinedFooting,
  strap_footing: calculateStrapFooting,
  mat_foundation: calculateMatFoundation,
  column: calculateColumn,
  beam: calculateBeam,
  one_way_slab: calculateOneWaySlab,
  two_way_slab: calculateTwoWaySlab,
  wall: calculateWall,
  stairs: calculateStairs,
  tank: calculateTank,
  pool: calculatePool,
  materials_quick: (inputs) => {
    const r = calculateConcreteMaterials(inputs.volumeM3, inputs.materials || inputs);
    if (!r) throw new ValidationError('حجم الخرسانة يجب أن يكون أكبر من صفر.');
    return { type: 'materials_quick', materials: r, warnings: [] };
  },
  // القسم الثاني: حاسبة حديد التسليح
  rebar_isolated_footing: (inputs) => calculatePadRebar({ ...inputs, padType: 'isolated' }),
  rebar_combined_footing: (inputs) => calculatePadRebar({ ...inputs, padType: 'combined' }),
  rebar_mat: (inputs) => calculatePadRebar({ ...inputs, padType: 'mat' }),
  rebar_pile_cap: (inputs) => calculatePadRebar({ ...inputs, padType: 'pile_cap' }),
  rebar_strip_footing: (inputs) => calculatePadRebar({ ...inputs, padType: 'strip_footing' }),
  rebar_column: (inputs) => calculateColumnPileRebar({ ...inputs, memberType: 'column' }),
  rebar_pile: (inputs) => calculateColumnPileRebar({ ...inputs, memberType: 'pile' }),
  rebar_beam: (inputs) => calculateLinearRebar({ ...inputs, memberFamily: 'beam' }),
  rebar_tie_beam: (inputs) => calculateLinearRebar({ ...inputs, memberFamily: 'tie_beam' }),
  rebar_girder: (inputs) => calculateLinearRebar({ ...inputs, memberFamily: 'girder' }),
  rebar_solid_slab: (inputs) => calculateSolidSlabRebar(inputs),
  rebar_hourdi_slab: (inputs) => calculateHourdiSlabRebar(inputs),
  rebar_wall: (inputs) => calculateWallPanelRebar({ ...inputs, usageContext: 'wall' }),
  rebar_tank: (inputs) => calculateTankRebar(inputs),
  rebar_pool: (inputs) => calculatePoolRebar(inputs),
  rebar_stairs: (inputs) => calculateStairsRebar(inputs),
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: ['طلب غير صالح (JSON غير مقروء).'] }, { status: 400 });
  }

  const { calc_type, inputs } = body || {};
  const handler = HANDLERS[calc_type];
  if (!handler) {
    return NextResponse.json({ success: false, errors: [`نوع حساب غير مدعوم: ${calc_type}`] }, { status: 400 });
  }

  try {
    const results = handler(inputs || {});
    return NextResponse.json({ success: true, results });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ success: false, errors: err.messages }, { status: 422 });
    }
    console.error('Calculation error:', err);
    return NextResponse.json({ success: false, errors: [err.message || 'حدث خطأ غير متوقع أثناء الحساب.'] }, { status: 500 });
  }
}
