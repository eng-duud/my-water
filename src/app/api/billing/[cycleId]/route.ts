import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { TENANT_ID } from '@/lib/constants';

const updateCycleSchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'CLOSED']),
});

type ContextType = {
  params: Promise<{ cycleId: string }>;
};

export async function GET(
  request: NextRequest,
  context: ContextType
) {
  try {
    const { cycleId } = await context.params;
    const cycle = await prisma.billingCycle.findFirst({
      where: {
        id: cycleId,
        tenantId: TENANT_ID,
      },
      include: {
        bills: {
          include: {
            customer: true,
            billingCycle: true,
          },
          orderBy: {
            customer: {
              accountNumber: 'asc',
            },
          },
        },
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: 'دورة الفوترة غير موجودة' }, { status: 404 });
    }

    // For DRAFT cycles: return pending customers (active customers without a bill in this cycle)
    let pendingCustomers: any[] = [];
    if (cycle.status === 'DRAFT') {
      const existingCustomerIds = cycle.bills.map(b => b.customerId);
      const customersWithoutBill = await prisma.customer.findMany({
        where: {
          tenantId: TENANT_ID,
          isActive: true,
          id: { notIn: existingCustomerIds },
        },
        orderBy: { accountNumber: 'asc' },
      });

      pendingCustomers = await Promise.all(
        customersWithoutBill.map(async (customer) => {
          const lastBill = await prisma.bill.findFirst({
            where: {
              tenantId: TENANT_ID,
              customerId: customer.id,
            },
            orderBy: { createdAt: 'desc' },
          });
          const prevReading = lastBill ? Number(lastBill.currentReading) : 0;
          const monthPadded = String(cycle.month).padStart(2, '0');
          return {
            customerId: customer.id,
            billNumber: `INV-${cycle.year}${monthPadded}-${customer.accountNumber}`,
            previousReading: prevReading,
            workUnits: customer.workUnits,
            customer: {
              accountNumber: customer.accountNumber,
              name: customer.name,
            },
          };
        })
      );
    }

    const cycleYear = cycle.year;
    const cycleMonth = cycle.month;

    const billsWithPrevious = await Promise.all(
      (cycle.bills || []).map(async (bill) => {
        const previousBills = await prisma.bill.findMany({
          where: {
            customerId: bill.customerId,
            tenantId: TENANT_ID,
            billingCycle: {
              OR: [
                { year: { lt: cycleYear } },
                { year: cycleYear, month: { lt: cycleMonth } },
              ],
            },
          },
          orderBy: [
            { billingCycle: { year: 'asc' } },
            { billingCycle: { month: 'asc' } },
          ],
        });

        let totalArrears = 0;
        for (const pb of previousBills) {
          const unpaid = Number(pb.totalAmount) - Number(pb.paidAmount);
          if (unpaid > 0) totalArrears += unpaid;
        }

        return {
          ...bill,
          previousBillAmount: previousBills.length > 0 ? previousBills.reduce((sum, pb) => sum + Number(pb.totalAmount), 0) : 0,
          previousBillPaid: previousBills.length > 0 ? previousBills.reduce((sum, pb) => sum + Number(pb.paidAmount), 0) : 0,
          arrears: totalArrears,
        };
      })
    );

    return NextResponse.json({
      ...cycle,
      bills: billsWithPrevious,
      pendingCustomers,
    });
  } catch (error: any) {
    console.error('Fetch cycle detail error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب تفاصيل دورة الفوترة' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: ContextType
) {
  try {
    const { cycleId } = await context.params;
    const body = await request.json();
    const parsed = updateCycleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'حالة غير صالحة', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const cycle = await prisma.billingCycle.findFirst({
      where: {
        id: cycleId,
        tenantId: TENANT_ID,
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: 'دورة الفوترة غير موجودة' }, { status: 404 });
    }

    const updateData: any = { status: parsed.data.status };
    if (parsed.data.status === 'ISSUED' && cycle.status === 'DRAFT') {
      updateData.issuedAt = new Date();
    }

    const updated = await prisma.billingCycle.update({
      where: { id: cycleId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update cycle status error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث حالة دورة الفوترة' }, { status: 500 });
  }
}
