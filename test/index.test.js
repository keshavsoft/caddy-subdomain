import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import {
  readCaddyConfig,
  listSubdomains,
  hasSubdomain,
  buildProxyRoute,
  buildProbeRoute,
  addProbeSubdomain,
  addProbeSubdomainToFile,
  addSubdomain,
  addSubdomainToFile
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(__dirname, "fixtures/caddy.sample.json");

test("readCaddyConfig parses Caddy JSON properly", () => {
  const config = readCaddyConfig(samplePath);
  assert.ok(config.apps.http.servers.srv0);
});

test("listSubdomains extracts unique domains", () => {
  const config = readCaddyConfig(samplePath);
  const domains = listSubdomains(config);
  assert.equal(domains.length, 2);
  assert.ok(domains.includes("quotation.keshavsoft.com"));
  assert.ok(domains.includes("cli.keshavsoft.com"));
});

test("hasSubdomain performs case-insensitive check", () => {
  const config = readCaddyConfig(samplePath);
  assert.equal(hasSubdomain(config, "QUOTATION.KESHAVSOFT.COM"), true);
  assert.equal(hasSubdomain(config, "unknown.keshavsoft.com"), false);
});

test("buildProxyRoute returns valid Caddy route block", () => {
  const route = buildProxyRoute("api.keshavsoft.com", 3000);
  assert.deepEqual(route.match[0].host, ["api.keshavsoft.com"]);
  assert.equal(route.terminal, true);
});

test("buildProbeRoute returns valid static_response route block", () => {
  const route = buildProbeRoute("call.keshavsoft.com");
  assert.deepEqual(route.match[0].host, ["call.keshavsoft.com"]);
  assert.equal(route.handle[0].handler, "static_response");
  assert.equal(route.handle[0].status_code, 200);
  assert.ok(route.handle[0].body.includes("call.keshavsoft.com"));
  assert.equal(route.terminal, true);
});

test("addProbeSubdomain appends probe route in memory", () => {
  const config = readCaddyConfig(samplePath);
  const result = addProbeSubdomain(config, {
    domain: "call.keshavsoft.com"
  });

  assert.equal(result.routeIndex, 2);
  assert.equal(hasSubdomain(result.updatedConfig, "call.keshavsoft.com"), true);
  assert.equal(result.newRoute.handle[0].handler, "static_response");
});

test("addProbeSubdomainToFile writes file and creates backup", () => {
  const tempPath = resolve(__dirname, "fixtures/caddy.probe-temp.json");
  const initial = readCaddyConfig(samplePath);
  writeFileSync(tempPath, JSON.stringify(initial, null, 2), "utf8");

  try {
    const result = addProbeSubdomainToFile(tempPath, {
      domain: "call.keshavsoft.com",
      backup: true
    });

    assert.ok(result.backupFile);
    assert.ok(existsSync(result.backupFile));

    const updated = readCaddyConfig(tempPath);
    assert.equal(hasSubdomain(updated, "call.keshavsoft.com"), true);

    unlinkSync(result.backupFile);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
});

test("addSubdomain appends route in memory", () => {
  const config = readCaddyConfig(samplePath);
  const result = addSubdomain(config, {
    domain: "billing.keshavsoft.com",
    port: 5000
  });

  assert.equal(result.routeIndex, 2);
  assert.equal(hasSubdomain(result.updatedConfig, "billing.keshavsoft.com"), true);
});

test("addSubdomain replaces route when force is true", () => {
  const config = readCaddyConfig(samplePath);

  assert.throws(() => {
    addSubdomain(config, {
      domain: "quotation.keshavsoft.com",
      port: 9000
    });
  }, /already configured/);

  const forced = addSubdomain(config, {
    domain: "quotation.keshavsoft.com",
    port: 9000,
    force: true
  });
  assert.ok(forced);
  assert.equal(forced.routeIndex, 0); // Replaced existing route at index 0!
});

test("addSubdomainToFile creates backup and updates file", () => {
  const tempPath = resolve(__dirname, "fixtures/caddy.temp.json");
  const initial = readCaddyConfig(samplePath);
  writeFileSync(tempPath, JSON.stringify(initial, null, 2), "utf8");

  try {
    const result = addSubdomainToFile(tempPath, {
      domain: "payment.keshavsoft.com",
      port: 6000,
      backup: true
    });

    assert.ok(result.backupFile);
    assert.ok(existsSync(result.backupFile));

    const updated = readCaddyConfig(tempPath);
    assert.equal(hasSubdomain(updated, "payment.keshavsoft.com"), true);

    unlinkSync(result.backupFile);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
});
