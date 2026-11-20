import { hasSubdomain, getSubdomainEntry, readCaddyConfig } from "../../../src/v1/index.js";
import { resolve } from "node:path";

console.log("=== Sample 04: Check & Inspect Subdomain Entries ===");

const sampleFile = resolve(process.cwd(), "./samples/caddy.sample.json");
console.log(`Reading configuration from: ${sampleFile}\n`);

const config = readCaddyConfig(sampleFile);

const domainsToCheck = [
  "quotation.keshavsoft.com",
  "call.keshavsoft.com",
  "nonexistent.keshavsoft.com"
];

for (const domain of domainsToCheck) {
  const entry = getSubdomainEntry(config, domain);
  if (entry) {
    console.log(`✅ '${domain}' -> EXISTS in ${entry.server}.routes[${entry.index}] (${entry.type} -> ${entry.target})`);
  } else {
    console.log(`❌ '${domain}' -> NOT FOUND in Caddy JSON`);
  }
}
