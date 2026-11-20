import { addProbeSubdomainToFile } from "../../../src/v1/index.js";
import { resolve } from "node:path";
import { copyFileSync, unlinkSync } from "node:fs";

console.log("=== Sample 01: Level 1 Smoke Test Probe ===");
console.log("Verifies GoDaddy DNS and Let's Encrypt SSL with zero ports/processes.\n");

const sampleSource = resolve(process.cwd(), "./samples/caddy.sample.json");
const tempFile = resolve(process.cwd(), "./samples/v1/01-probe/caddy.temp.json");
copyFileSync(sampleSource, tempFile);

const result = addProbeSubdomainToFile(tempFile, {
  domain: "call.keshavsoft.com",
  backup: true
});

console.log("✅ Probe Route Injected!");
console.log(`Target File: ${result.filePath}`);
console.log(`Backup File: ${result.backupFile}`);
console.log("\nGenerated Route:");
console.log(JSON.stringify(result.newRoute, null, 2));

// Cleanup temp demo files
unlinkSync(tempFile);
if (result.backupFile) unlinkSync(result.backupFile);
console.log("\n(Cleaned up temporary demo files)");
