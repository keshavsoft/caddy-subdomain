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
  addSubdomainToFile,
  buildStaticRoute,
  addStaticSubdomain,
  addStaticSubdomainToFile,
  getSubdomainEntry,
  listSubdomainDetails
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

test("getSubdomainEntry inspects existing route entry and raw AST", () => {
  const config = readCaddyConfig(samplePath);
  const entry = getSubdomainEntry(config, "quotation.keshavsoft.com");
  assert.ok(entry);
  assert.equal(entry.domain, "quotation.keshavsoft.com");
  assert.equal(entry.server, "srv0");
  assert.equal(entry.index, 0);
  assert.equal(entry.type, "reverse_proxy");
  assert.equal(entry.target, "localhost:8080");
  assert.ok(entry.route);

  const missing = getSubdomainEntry(config, "nonexistent.keshavsoft.com");
  assert.equal(missing, null);
});

test("listSubdomainDetails returns mapped details for all domains", () => {
  const config = readCaddyConfig(samplePath);
  const details = listSubdomainDetails(config);
  assert.equal(details.length, 2);
  assert.equal(details[0].domain, "quotation.keshavsoft.com");
  assert.equal(details[0].type, "reverse_proxy");
});

test("buildStaticRoute returns valid file_server subroute", () => {
  const route = buildStaticRoute("cli.keshavsoft.com", "/usr/share/cli.keshavsoft.com");
  assert.deepEqual(route.match[0].host, ["cli.keshavsoft.com"]);
  assert.equal(route.handle[0].handler, "subroute");
  const subHandle = route.handle[0].routes[0].handle;
  assert.equal(subHandle[0].handler, "vars");
  assert.equal(subHandle[0].root, "/usr/share/cli.keshavsoft.com");
  assert.equal(subHandle[1].handler, "file_server");
});

test("addStaticSubdomain adds file_server route in memory", () => {
  const config = readCaddyConfig(samplePath);
  const result = addStaticSubdomain(config, {
    domain: "assets.keshavsoft.com",
    root: "/var/www/assets"
  });
  assert.ok(result.newRoute);
  assert.equal(hasSubdomain(config, "assets.keshavsoft.com"), true);

  const entry = getSubdomainEntry(config, "assets.keshavsoft.com");
  assert.equal(entry.type, "file_server");
  assert.equal(entry.target, "/var/www/assets");
});

test("addStaticSubdomainToFile writes file and creates backup", () => {
  const tempPath = resolve(__dirname, "fixtures/caddy.temp.static.json");
  const initial = readCaddyConfig(samplePath);
  writeFileSync(tempPath, JSON.stringify(initial, null, 2), "utf8");

  try {
    const result = addStaticSubdomainToFile(tempPath, {
      domain: "docs.keshavsoft.com",
      root: "/usr/share/docs",
      backup: true
    });

    assert.ok(result.backupFile);
    assert.ok(existsSync(result.backupFile));

    const updated = readCaddyConfig(tempPath);
    const entry = getSubdomainEntry(updated, "docs.keshavsoft.com");
    assert.equal(entry.type, "file_server");
    assert.equal(entry.target, "/usr/share/docs");

    unlinkSync(result.backupFile);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
});

test("addSubdomain auto-detects static file path and creates file_server route", () => {
  const config = readCaddyConfig(samplePath);
  const result = addSubdomain(config, {
    domain: "spa.keshavsoft.com",
    target: "/var/www/spa"
  });
  assert.ok(result.newRoute);

  const entry = getSubdomainEntry(config, "spa.keshavsoft.com");
  assert.equal(entry.type, "file_server");
  assert.equal(entry.target, "/var/www/spa");
});

