import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("Dirname:", __dirname);

const standaloneDir = path.join(__dirname, ".next", "standalone");
fs.mkdirSync(standaloneDir, { recursive: true });

fs.cpSync(path.join(__dirname, ".next", "static"), path.join(standaloneDir, ".next", "static"), { recursive: true });
console.log("Copied static!");

fs.cpSync(path.join(__dirname, "public"), path.join(standaloneDir, "public"), { recursive: true });
console.log("Copied public!");
