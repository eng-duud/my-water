import Decimal from 'decimal.js';
import prisma from './prisma';

interface PaymentInput {
  tenantId: string;
  billIds: string[];
  amount: number | string | Decimal;
  paymentMethod?: string | null;
  receiptNumber?: string | null;
  notes?: string | null;
}

export async function allocatePaymentToSingleBill(input: PaymentInput) {
  const amountDecimal = new Decimal(input.amount);
  if (amountDecimal.lessThanOrEqualTo(0)) {
    throw new Error('يجب أن يكون مبلغ السداد أكبر من الصفر.');
  }

  if (input.billIds.length === 0) {
    throw new Error('يجب اختيار فاتورة واحدة على الأقل.');
  }

  return await prisma.$transaction(async (tx: any) => {
    // Fetch all bills
    const bills = await tx.bill.findMany({
      where: { id: { in: input.billIds } },
      include: { customer: true },
      orderBy: { createdAt: 'asc' },
    });

    if (bills.length === 0) {
      throw new Error('الفواتير المحددة غير موجودة');
    }

    // Verify all bills belong to the same customer
    const customerId = bills[0].customerId;
    for (const bill of bills) {
      if (bill.customerId !== customerId) {
        throw new Error('يجب أن تكون جميع الفواتير لنفس المشترك');
      }
    }

    const customer = bills[0].customer;
    let remainingAmount = amountDecimal;
    const allocations: Array<{ billId: string; amount: Decimal; billNumber: string }> = [];

    // Distribute payment across bills (oldest first)
    for (const bill of bills) {
      if (remainingAmount.lessThanOrEqualTo(0)) break;

      const totalAmount = new Decimal(bill.totalAmount);
      const currentPaid = new Decimal(bill.paidAmount);
      const unpaidAmount = Decimal.max(totalAmount.minus(currentPaid), new Decimal(0));

      if (unpaidAmount.lessThanOrEqualTo(0)) continue;

      const allocateAmount = Decimal.min(remainingAmount, unpaidAmount);
      const newPaidAmount = currentPaid.plus(allocateAmount);
      const newStatus = newPaidAmount.greaterThanOrEqualTo(totalAmount) ? 'PAID' : 'PARTIALLY_PAID';

      await tx.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      allocations.push({
        billId: bill.id,
        amount: allocateAmount,
        billNumber: bill.billNumber,
      });

      remainingAmount = remainingAmount.minus(allocateAmount);
    }

    // Create the payment
    const payment = await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        customerId: customerId,
        amount: amountDecimal,
        allocatedAmount: amountDecimal.minus(remainingAmount),
        surplusAmount: remainingAmount,
        surplusHandled: remainingAmount.lessThanOrEqualTo(0),
        paymentMethod: input.paymentMethod || null,
        receiptNumber: input.receiptNumber || null,
        notes: input.notes || null,
      },
    });

    // Create allocations
    for (const alloc of allocations) {
      await tx.paymentAllocation.create({
        data: {
          tenantId: input.tenantId,
          paymentId: payment.id,
          billId: alloc.billId,
          amount: alloc.amount,
        },
      });
    }

    return {
      paymentId: payment.id,
      customerName: customer.name,
      billsCount: allocations.length,
      billNumbers: allocations.map((a) => a.billNumber),
      amount: amountDecimal.toNumber(),
      allocatedAmount: amountDecimal.minus(remainingAmount).toNumber(),
      surplusAmount: remainingAmount.toNumber(),
    };
  });
}
