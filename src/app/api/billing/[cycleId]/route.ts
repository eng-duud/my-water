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

    // If cycle is DRAFT and has no bills, return all active customers for data entry
    if (cycle.status === 'DRAFT' && cycle.bills.length === 0) {
      const customers = await prisma.customer.findMany({
        where: { tenantId: TENANT_ID, isActive: true },
        orderBy: { accountNumber: 'asc' },
      });

      const customersWithReading = await Promise.all(
        customers.map(async (customer) => {
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

      return NextResponse.json({
        ...cycle,
        bills: [],
        pendingCustomers: customersWithReading,
      });
    }

    const billsWithPrevious = await Promise.all(
      (cycle.bills || []).map(async (bill) => {
        const previousBill = await prisma.bill.findFirst({
          where: {
            customerId: bill.customerId,
            tenantId: TENANT_ID,
            createdAt: { lt: bill.createdAt },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        return {
          ...bill,
          previousBillAmount: previousBill ? previousBill.totalAmount : 0,
          previousBillPaid: previousBill ? previousBill.paidAmount : 0,
        };
      })
    );

    return NextResponse.json({
      ...cycle,
      bills: billsWithPrevious,
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
