import { buildProbeRoute } from "../../../src/v1/index.js";

console.log("=== Sample 05: Build Probe Route Object ===");
console.log("Pure function producing the static_response Caddy route AST.\n");

const route = buildProbeRoute("appointment.keshavsoft.com");

console.log("Generated Caddy Route Object:");
console.log(JSON.stringify(route, null, 2));
