import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TENANT_ID } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    // 1. Basic customer stats
    const totalCustomers = await prisma.customer.count({
      where: { tenantId: TENANT_ID },
    });

    const activeCustomers = await prisma.customer.count({
      where: { tenantId: TENANT_ID, isActive: true },
    });

    // 2. Financial aggregations from Bill
    const billStats = await prisma.bill.aggregate({
      where: { tenantId: TENANT_ID },
      _sum: {
        consumption: true,
        workUnits: true,
        totalAmount: true,
        paidAmount: true,
      },
    });

    const totalConsumed = (billStats._sum.consumption ? Number(billStats._sum.consumption) : 0)
      + (billStats._sum.workUnits ? Number(billStats._sum.workUnits) : 0);
    const totalBilled = billStats._sum.totalAmount ? Number(billStats._sum.totalAmount) : 0;
    const totalCollected = billStats._sum.paidAmount ? Number(billStats._sum.paidAmount) : 0;
    const totalDebt = Math.max(totalBilled - totalCollected, 0);

    // 3. Unhandled surplus payments
    const surplusStats = await prisma.payment.aggregate({
      where: {
        tenantId: TENANT_ID,
        surplusHandled: false,
        surplusAmount: { gt: 0 },
      },
      _sum: {
        surplusAmount: true,
      },
    });
    const totalSurplus = surplusStats._sum.surplusAmount ? Number(surplusStats._sum.surplusAmount) : 0;

    // 4. Monthly history (last 6 cycles)
    const cycles = await prisma.billingCycle.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
      take: 6,
      include: {
        bills: {
          select: {
            consumption: true,
            totalAmount: true,
            paidAmount: true,
          },
        },
      },
    });

    const history = cycles.map((c: any) => {
      const billCount = c.bills.length;
      const consumed = c.bills.reduce((acc: any, b: any) => acc + Number(b.consumption) + Number(b.workUnits), 0);
      const billed = c.bills.reduce((acc: any, b: any) => acc + Number(b.totalAmount), 0);
      const collected = c.bills.reduce((acc: any, b: any) => acc + Number(b.paidAmount), 0);
      return {
        id: c.id,
        name: `${c.year}/${String(c.month).padStart(2, '0')}`,
        year: c.year,
        month: c.month,
        status: c.status,
        billCount,
        consumed,
        billed,
        collected,
      };
    }).reverse(); // Order oldest to newest for charts

    // 5. Recent activity (last 5 payments)
    const recentPayments = await prisma.payment.findMany({
      where: { tenantId: TENANT_ID },
      include: {
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    const totalReceived = totalCollected + totalSurplus;

    return NextResponse.json({
      stats: {
        totalCustomers,
        activeCustomers,
        totalConsumed,
        totalBilled,
        totalCollected,
        totalReceived,
        totalDebt,
        totalSurplus,
      },
      history,
      recentPayments: recentPayments.map((p: any) => ({
        id: p.id,
        customerName: p.customer.name,
        amount: Number(p.amount),
        surplusAmount: Number(p.surplusAmount),
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Fetch dashboard stats error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل بيانات لوحة التحكم' }, { status: 500 });
  }
}
