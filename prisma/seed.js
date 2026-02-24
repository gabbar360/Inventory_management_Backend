const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create default user
  const hashedPassword = await bcrypt.hash('New#inventory_360', 10);
  
  await prisma.user.upsert({
    where: { email: 'malamj001@gmail.com' },
    update: {},
    create: {
      email: 'malamj001@gmail.com',
      password: hashedPassword,
      name: 'System Administrator',
    },
  });

  console.log('Default admin user created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });