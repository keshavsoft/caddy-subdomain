import { addSubdomainToFile } from "../../../src/v1/index.js";
import { resolve } from "node:path";
import { copyFileSync, unlinkSync } from "node:fs";

console.log("=== Sample 02: Level 2 Backend Promotion ===");
console.log("Promotes subdomain to reverse proxy Node.js / Docker on port 5000.\n");

const sampleSource = resolve(process.cwd(), "./samples/caddy.sample.json");
const tempFile = resolve(process.cwd(), "./samples/v1/02-add/caddy.temp.json");
copyFileSync(sampleSource, tempFile);

const result = addSubdomainToFile(tempFile, {
  domain: "call.keshavsoft.com",
  port: 5000,
  force: true,
  backup: true
});

console.log("✅ Reverse Proxy Route Injected!");
console.log(`Target File: ${result.filePath}`);
console.log(`Backup File: ${result.backupFile}`);
console.log("\nGenerated Route:");
console.log(JSON.stringify(result.newRoute, null, 2));

// Cleanup temp demo files
unlinkSync(tempFile);
if (result.backupFile) unlinkSync(result.backupFile);
console.log("\n(Cleaned up temporary demo files)");
