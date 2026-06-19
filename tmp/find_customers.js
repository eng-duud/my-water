const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cs = await p.customer.findMany({
    where: { tenantId: 'ghayl-al-diya' },
    select: { id: true, name: true, _count: {select: {bills: true}} },
    take: 5
  });
  cs.forEach(c => console.log(c.name, c.id, '- bills:', c._count.bills));
  await p.$disconnect();
})();
