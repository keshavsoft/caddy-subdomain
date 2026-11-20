import { listSubdomainDetails, readCaddyConfig } from "../../../src/v1/index.js";
import { resolve } from "node:path";

console.log("=== Sample 03: List Configured Subdomains ===");

const sampleFile = resolve(process.cwd(), "./samples/caddy.sample.json");
console.log(`Reading configuration from: ${sampleFile}\n`);

const config = readCaddyConfig(sampleFile);
const details = listSubdomainDetails(config);

console.log(`Found ${details.length} Subdomains:`);
details.forEach((item, idx) => {
  console.log(`  ${idx + 1}. ${item.domain.padEnd(28, " ")} ➔ ${item.target.padEnd(20, " ")} [${item.type}]`);
});
