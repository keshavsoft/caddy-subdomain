import { hasSubdomain, readCaddyConfig } from "../../../src/v1/index.js";
import { resolve } from "node:path";

console.log("=== Sample 04: Check Subdomain Existence ===");

const sampleFile = resolve(process.cwd(), "./samples/caddy.sample.json");
console.log(`Reading configuration from: ${sampleFile}\n`);

const config = readCaddyConfig(sampleFile);

const domainsToCheck = [
  "quotation.keshavsoft.com",
  "call.keshavsoft.com",
  "nonexistent.keshavsoft.com"
];

for (const domain of domainsToCheck) {
  const exists = hasSubdomain(config, domain);
  const statusIcon = exists ? "✅ EXISTS" : "❌ NOT FOUND";
  console.log(`Checking '${domain}': ${statusIcon}`);
}
