import { buildProxyRoute } from "../../../src/v1/index.js";

console.log("=== Sample 06: Build Reverse Proxy Route Object ===");
console.log("Pure function producing the reverse_proxy subroute Caddy route AST.\n");

const route = buildProxyRoute("cc9.keshavsoft.com", 3000);

console.log("Generated Caddy Route Object:");
console.log(JSON.stringify(route, null, 2));
