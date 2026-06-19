import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TENANT_ID } from '@/lib/constants';

type ContextType = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: ContextType
) {
  try {
    const { id } = await context.params;
    const payment = await prisma.payment.findFirst({
      where: {
        id,
        tenantId: TENANT_ID,
      },
      include: {
        customer: true,
        allocations: {
          include: {
            bill: {
              include: {
                billingCycle: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });
    }

    // Calculate arrears before this payment
    let totalArrearsBefore = 0;
    if (payment.allocations.length > 0) {
      const firstBill = payment.allocations[0].bill;
      const firstBillCycle = await prisma.billingCycle.findUnique({
        where: { id: firstBill.billingCycleId },
      });
      if (firstBillCycle) {
        const previousBills = await prisma.bill.findMany({
          where: {
            customerId: payment.customerId,
            tenantId: TENANT_ID,
            billingCycle: {
              OR: [
                { year: { lt: firstBillCycle.year } },
                { year: firstBillCycle.year, month: { lt: firstBillCycle.month } },
              ],
            },
          },
        });
        for (const pb of previousBills) {
          const unpaid = Number(pb.totalAmount) - Number(pb.paidAmount);
          if (unpaid > 0) totalArrearsBefore += unpaid;
        }
      }
    }

    return NextResponse.json({
      ...payment,
      amount: Number(payment.amount),
      allocatedAmount: Number(payment.allocatedAmount),
      surplusAmount: Number(payment.surplusAmount),
      arrearsBefore: totalArrearsBefore,
    });
  } catch (error: any) {
    console.error('Fetch payment error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب تفاصيل الدفعة' }, { status: 500 });
  }
}
