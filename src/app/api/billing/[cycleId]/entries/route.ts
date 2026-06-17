import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { calculateBill } from '@/lib/billing';
import { TENANT_ID } from '@/lib/constants';

const batchEntriesSchema = z.object({
  entries: z.array(
    z.object({
      billId: z.string().optional(),
      customerId: z.string().optional(),
      currentReading: z.number().min(0, 'القراءة الحالية يجب أن تكون أكبر من أو تساوي الصفر'),
      meterPhotoUrl: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  ),
});

type ContextType = {
  params: Promise<{ cycleId: string }>;
};

export async function POST(
  request: NextRequest,
  context: ContextType
) {
  try {
    const { cycleId } = await context.params;
    const body = await request.json();
    const parsed = batchEntriesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // 1. Fetch the billing cycle to check status
    const cycle = await prisma.billingCycle.findFirst({
      where: {
        id: cycleId,
        tenantId: TENANT_ID,
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: 'دورة الفوترة غير موجودة' }, { status: 404 });
    }

    if (cycle.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'لا يمكن تعديل القراءات لدورة فوترة تم إصدارها أو إغلاقها' },
        { status: 400 }
      );
    }

    // 2. Fetch tenant settings for calculations
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: TENANT_ID },
    });

    if (!settings) {
      return NextResponse.json({ error: 'إعدادات الشركة المستأجرة غير متوفرة' }, { status: 500 });
    }

    // 3. Process each entry in a transaction
    const results = await prisma.$transaction(async (tx: any) => {
      const updatedBills = [];

      for (const entry of parsed.data.entries) {
        // Find or create bill
        let bill;

        if (entry.billId) {
          // Update existing bill
          bill = await tx.bill.findUnique({
            where: { id: entry.billId },
          });

          if (!bill) {
            throw new Error(`الفاتورة بالمعرف ${entry.billId} غير موجودة`);
          }
        } else if (entry.customerId) {
          // Check if bill already exists for this customer+cycle
          bill = await tx.bill.findFirst({
            where: {
              tenantId: TENANT_ID,
              customerId: entry.customerId,
              billingCycleId: cycleId,
            },
          });

          if (!bill) {
            // Create new bill
            const customer = await tx.customer.findUnique({
              where: { id: entry.customerId },
            });

            if (!customer) {
              throw new Error(`المشترك بالمعرف ${entry.customerId} غير موجود`);
            }

            // Get last reading from previous bill
            const lastBill = await tx.bill.findFirst({
              where: {
                tenantId: TENANT_ID,
                customerId: entry.customerId,
              },
              orderBy: { createdAt: 'desc' },
            });

            const prevReading = lastBill ? Number(lastBill.currentReading) : 0;
            const monthPadded = String(cycle.month).padStart(2, '0');
            const billNumber = `INV-${cycle.year}${monthPadded}-${customer.accountNumber}`;

            bill = await tx.bill.create({
              data: {
                tenantId: TENANT_ID,
                billNumber,
                customerId: entry.customerId,
                billingCycleId: cycleId,
                previousReading: prevReading,
                currentReading: entry.currentReading,
                consumption: 0,
                workUnits: customer.workUnits,
                workUnitsTotal: 0,
                tier1Units: 0,
                tier1Cost: 0,
                tier2Units: 0,
                tier2Cost: 0,
                totalAmount: 0,
                paidAmount: 0,
                status: 'PENDING',
              },
            });
          }
        } else {
          throw new Error('يجب توفير billId أو customerId');
        }

        const prevReading = Number(bill.previousReading);
        if (entry.currentReading < prevReading) {
          throw new Error(
            `القراءة الحالية (${entry.currentReading}) لا يمكن أن تكون أقل من القراءة السابقة (${prevReading})`
          );
        }

        // Run calculation engine
        const calc = calculateBill({
          workUnits: bill.workUnits,
          previousReading: bill.previousReading,
          currentReading: entry.currentReading,
          workUnitPrice: settings.workUnitPrice,
          tier1Limit: settings.tier1Limit,
          tier1Price: settings.tier1PricePerUnit,
          tier2Price: settings.tier2PricePerUnit,
        });

        // Update database record
        const updatedBill = await tx.bill.update({
          where: { id: bill.id },
          data: {
            currentReading: entry.currentReading,
            consumption: calc.consumption,
            workUnitsTotal: calc.workUnitsTotal,
            tier1Units: calc.tier1Units,
            tier1Cost: calc.tier1Cost,
            tier2Units: calc.tier2Units,
            tier2Cost: calc.tier2Cost,
            totalAmount: calc.totalAmount,
            meterPhotoUrl: entry.meterPhotoUrl || bill.meterPhotoUrl,
            notes: entry.notes || bill.notes,
          },
        });

        updatedBills.push(updatedBill);
      }

      return updatedBills;
    });

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error('Batch entries error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء حفظ القراءات' }, { status: 500 });
  }
}
