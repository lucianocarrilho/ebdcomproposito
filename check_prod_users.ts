import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://u223033896_ebd2026:Eulk2180263%23@srv890.hstgr.io:3306/u223033896_ebd2026"
    }
  }
});

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users in DB:", users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
