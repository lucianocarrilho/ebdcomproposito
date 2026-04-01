import { execSync } from "child_process";
import fs from "fs";

function run(cmd) {
  try {
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    console.error(`Failed to run ${cmd}`);
  }
}

const vars = [
  { name: "AUTH_SECRET", value: "ebd-com-proposito-secret-key-2026" },
  { name: "AUTH_TRUST_HOST", value: "true" },
  { name: "DATABASE_URL", value: "mysql://u223033896_ebd2026:Eulk2180263#@srv890.hstgr.io:3306/u223033896_ebd2026" },
  { name: "NEXTAUTH_URL", value: "https://ebd-app.vercel.app" }
];

const envs = ["production", "preview", "development"];

for (const env of envs) {
  for (const v of vars) {
    console.log(`Removing ${v.name} from ${env}...`);
    run(`cmd /c npx vercel env rm ${v.name} ${env} -y`);
  }
}

for (const env of envs) {
  for (const v of vars) {
    console.log(`Adding ${v.name} to ${env}...`);
    fs.writeFileSync("temp_val.txt", v.value, "utf8");
    run(`cmd /c npx vercel env add ${v.name} ${env} < temp_val.txt`);
  }
}

if (fs.existsSync("temp_val.txt")) fs.unlinkSync("temp_val.txt");
console.log("Deploying fixed version...");
run("cmd /c npx vercel --prod --yes");
