const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const customers = await p.customer.findMany({
    where: { tenantId: 'ghayl-al-diya' },
    select: { id: true, name: true, _count: {select: { bills: true }} },
    take: 5
  });
  for (const c of customers) {
    console.log(c.name, '- bills count:', c._count.bills);
    if (c._count.bills > 0) {
      const lastBill = await p.bill.findFirst({
        where: { customerId: c.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, currentReading: true, consumption: true }
      });
      console.log('  last reading:', lastBill.currentReading, 'consumption:', lastBill.consumption);
    }
  }
  await p.$disconnect();
})();
