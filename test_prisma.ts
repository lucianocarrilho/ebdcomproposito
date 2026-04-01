import { prisma } from "./src/lib/prisma";

async function main() {
  try {
    const lesson = await prisma.lesson.create({
      data: {
        number: 99,
        title: "Test Lesson",
        quarter: "2026-Q2",
        category: "Adultos"
      }
    });
    console.log("Success:", lesson);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    //
  }
}

main();
