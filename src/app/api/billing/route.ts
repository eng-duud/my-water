import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { TENANT_ID } from '@/lib/constants';
import { getOrCreateTenant } from '@/lib/tenant';
import { calculateBill } from '@/lib/billing';

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

    // Create billing cycle and pre-generate calculated bills for all active customers
    const cycle = await prisma.$transaction(async (tx: any) => {
      const tenantSettings = await tx.tenantSettings.findUnique({
        where: { tenantId: TENANT_ID },
      });
      const workUnitPrice = tenantSettings?.workUnitPrice || 2000;
      const tier1Limit = tenantSettings?.tier1Limit || 4;
      const tier1Price = tenantSettings?.tier1PricePerUnit || 700;
      const tier2Price = tenantSettings?.tier2PricePerUnit || 1000;

      // Create cycle
      const newCycle = await tx.billingCycle.create({
        data: {
          tenantId: TENANT_ID,
          year,
          month,
          status: 'DRAFT',
        },
      });

      // Get active customers
      const customers = await tx.customer.findMany({
        where: {
          tenantId: TENANT_ID,
          isActive: true,
        },
      });

      // For each customer, generate a calculated bill
      for (const customer of customers) {
        // Find latest meter reading from previous cycles
        const lastBill = await tx.bill.findFirst({
          where: {
            tenantId: TENANT_ID,
            customerId: customer.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const prevReading = lastBill ? Number(lastBill.currentReading) : 0;
        const workUnits = customer.workUnits;

        // Invoice number: INV-{year}{month_padded}-{customerAccountNumber}
        const monthPadded = String(month).padStart(2, '0');
        const billNumber = `INV-${year}${monthPadded}-${customer.accountNumber}`;

        // Calculate consumption: current = prevReading + workUnits (default consumption = workUnits)
        const currentReading = prevReading + workUnits;

        // Run calculation engine
        const calc = calculateBill({
          workUnits,
          previousReading: prevReading,
          currentReading,
          workUnitPrice,
          tier1Limit,
          tier1Price,
          tier2Price,
        });

        await tx.bill.create({
          data: {
            tenantId: TENANT_ID,
            billNumber,
            customerId: customer.id,
            billingCycleId: newCycle.id,
            previousReading: prevReading,
            currentReading,
            consumption: calc.consumption,
            workUnits,
            workUnitsTotal: calc.workUnitsTotal,
            tier1Units: calc.tier1Units,
            tier1Cost: calc.tier1Cost,
            tier2Units: calc.tier2Units,
            tier2Cost: calc.tier2Cost,
            totalAmount: calc.totalAmount,
            paidAmount: 0,
            status: 'PENDING',
          },
        });
      }

      return newCycle;
    });

    return NextResponse.json(cycle, { status: 201 });
  } catch (error: any) {
    console.error('Create billing cycle error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء دورة الفوترة' }, { status: 500 });
  }
}
