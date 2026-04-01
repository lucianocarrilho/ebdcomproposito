const { Prisma } = require("@prisma/client");
const fs = require("fs");

const lessonModel = Prisma.dmmf.datamodel.models.find(m => m.name === "Lesson");
console.log("Lesson fields:", lessonModel.fields.map(f => f.name));
