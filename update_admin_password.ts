import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://u223033896_ebd2026:Eulk2180263%23@srv890.hstgr.io:3306/u223033896_ebd2026"
    }
  }
});

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);
  
  const updatedUser = await prisma.user.update({
    where: { email: "admin@ebdcomproposito.com" },
    data: { password: hashedPassword }
  });
  
  console.log("Password updated for:", updatedUser.email);
  const isValid = await bcrypt.compare("admin123", updatedUser.password);
  console.log("Verification valid? ", isValid);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
