import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { TENANT_ID } from '@/lib/constants';
import { getOrCreateTenant } from '@/lib/tenant';

const createCycleSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function GET(request: NextRequest) {
  try {
    await getOrCreateTenant(TENANT_ID);
    const cycles = await prisma.billingCycle.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
      include: {
        _count: {
          select: { bills: true },
        },
      },
    });
    return NextResponse.json(cycles);
  } catch (error: any) {
    console.error('Fetch billing cycles error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب دورات الفوترة' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await getOrCreateTenant(TENANT_ID);
    const body = await request.json();
    const parsed = createCycleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { year, month } = parsed.data;

    // Check duplicate cycle
    const existing = await prisma.billingCycle.findUnique({
      where: {
        tenantId_year_month: {
          tenantId: TENANT_ID,
          year,
          month,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `دورة الفوترة للشهر ${month}-${year} موجودة بالفعل` },
        { status: 400 }
      );
    }

    // Create billing cycle only (no bills pre-generated)
    const cycle = await prisma.billingCycle.create({
      data: {
        tenantId: TENANT_ID,
        year,
        month,
        status: 'DRAFT',
      },
    });

    return NextResponse.json(cycle, { status: 201 });
  } catch (error: any) {
    console.error('Create billing cycle error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء دورة الفوترة' }, { status: 500 });
  }
}
