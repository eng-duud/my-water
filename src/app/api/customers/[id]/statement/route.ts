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
    const customer = await prisma.customer.findFirst({
      where: {
        id,
        tenantId: TENANT_ID,
      },
      include: {
        bills: {
          include: {
            billingCycle: true,
            paymentAllocations: {
              include: {
                payment: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        payments: {
          include: {
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
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    // Build a unified timeline of transactions
    const transactions: Array<{
      date: string;
      type: 'bill' | 'payment';
      description: string;
      debit: number;
      credit: number;
      balance: number;
      reference: string;
    }> = [];

    // Add bills as debit entries
    for (const bill of customer.bills) {
      transactions.push({
        date: bill.createdAt.toISOString(),
        type: 'bill',
        description: `فاتورة شهر ${bill.billingCycle.month}/${bill.billingCycle.year}`,
        debit: Number(bill.totalAmount),
        credit: 0,
        balance: 0,
        reference: bill.billNumber,
      });
    }

    // Add payments as credit entries
    for (const payment of customer.payments) {
      const billRefs = payment.allocations.map((a: any) => a.bill.billNumber).join(', ');
      transactions.push({
        date: payment.createdAt.toISOString(),
        type: 'payment',
        description: `سداد - سند رقم ${payment.receiptNumber || payment.id.slice(0, 8)}`,
        debit: 0,
        credit: Number(payment.amount),
        balance: 0,
        reference: payment.receiptNumber || payment.id.slice(0, 8),
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    for (const tx of transactions) {
      runningBalance += tx.debit - tx.credit;
      tx.balance = runningBalance;
    }

    // Summary
    const totalBilled = transactions.reduce((sum, tx) => sum + tx.debit, 0);
    const totalPaid = transactions.reduce((sum, tx) => sum + tx.credit, 0);
    const currentBalance = totalBilled - totalPaid;

    const totalConsumed = customer.bills.reduce((sum, bill) => sum + Number(bill.consumption) + Number(bill.workUnits), 0);

    return NextResponse.json({
      customer: {
        id: customer.id,
        accountNumber: customer.accountNumber,
        name: customer.name,
        phone: customer.phone,
        village: customer.village,
        meterNumber: customer.meterNumber,
        workUnits: Number(customer.workUnits),
        totalConsumed,
      },
      transactions,
      summary: {
        totalBilled,
        totalPaid,
        currentBalance,
        billsCount: customer.bills.length,
        paymentsCount: customer.payments.length,
      },
    });
  } catch (error: any) {
    console.error('Fetch statement error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب كشف الحساب' }, { status: 500 });
  }
}
