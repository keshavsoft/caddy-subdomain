import { addStaticSubdomainToFile } from "../../../src/v1/index.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, unlinkSync } from "node:fs";

console.log("=== Sample 07: Level 2 Static File Server Promotion ===");
console.log("Configures subdomain to serve static files from document root.\n");

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleSource = resolve(__dirname, "../../caddy.sample.json");
const tempFile = resolve(__dirname, "caddy.temp.json");
copyFileSync(sampleSource, tempFile);

const result = addStaticSubdomainToFile(tempFile, {
  domain: "call.keshavsoft.com",
  root: "/usr/share/caddy/call.keshavsoft.com",
  force: true,
  backup: true
});

console.log("✅ Static File Server Route Injected!");
console.log(`Target File: ${result.filePath}`);
console.log(`Backup File: ${result.backupFile}`);
console.log("\nGenerated Route:");
console.log(JSON.stringify(result.newRoute, null, 2));

// Cleanup temp demo files
unlinkSync(tempFile);
if (result.backupFile) unlinkSync(result.backupFile);
console.log("\n(Cleaned up temporary demo files)");
