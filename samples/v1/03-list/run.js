import { listSubdomains, readCaddyConfig } from "../../../src/v1/index.js";
import { resolve } from "node:path";

console.log("=== Sample 03: List Configured Subdomains ===");

const sampleFile = resolve(process.cwd(), "./samples/caddy.sample.json");
console.log(`Reading configuration from: ${sampleFile}\n`);

const config = readCaddyConfig(sampleFile);
const subdomains = listSubdomains(config);

console.log(`Found ${subdomains.length} Subdomains:`);
subdomains.forEach((domain, idx) => {
  console.log(`  ${idx + 1}. ${domain}`);
});
