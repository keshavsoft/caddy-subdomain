import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getTemplate } from "caddy-template";

/**
 * ============================================================================
 * caddy-subdomain
 * Atomic library to inspect, validate, and add subdomains to Caddy JSON.
 * ============================================================================
 */

/**
 * Safely read and parse a Caddy JSON configuration file.
 * @param {string} filePath
 * @returns {object}
 */
export function readCaddyConfig(filePath) {
  const resolvedPath = resolve(process.cwd(), filePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Caddy config file not found: ${resolvedPath}`);
  }

  try {
    return JSON.parse(readFileSync(resolvedPath, "utf8"));
  } catch (err) {
    throw new Error(`Failed to parse Caddy JSON at ${resolvedPath}: ${err.message}`);
  }
}

/**
 * Create a timestamped backup and write updated Caddy JSON to disk.
 * @param {string} filePath
 * @param {object} caddyConfig
 * @param {object} [options]
 * @param {boolean} [options.backup=true]
 * @returns {{ filePath: string, backupFile: string|null }}
 */
export function writeCaddyConfig(filePath, caddyConfig, { backup = true } = {}) {
  const resolvedPath = resolve(process.cwd(), filePath);
  let backupFile = null;

  if (backup && existsSync(resolvedPath)) {
    backupFile = `${resolvedPath}.bak.${Date.now()}`;
    writeFileSync(backupFile, JSON.stringify(readCaddyConfig(filePath), null, 2), "utf8");
  }

  writeFileSync(resolvedPath, JSON.stringify(caddyConfig, null, 2), "utf8");

  return {
    filePath: resolvedPath,
    backupFile
  };
}

/**
 * Extract all unique subdomains / hostnames configured in Caddy.
 * @param {object} caddyConfig
 * @returns {string[]}
 */
export function listSubdomains(caddyConfig) {
  const hosts = [];
  const servers = caddyConfig?.apps?.http?.servers || {};

  for (const srv of Object.values(servers)) {
    for (const route of srv.routes || []) {
      for (const match of route.match || []) {
        if (Array.isArray(match.host)) {
          hosts.push(...match.host);
        }
      }
    }
  }

  return [...new Set(hosts)];
}

/**
 * Check if a specific subdomain is already configured.
 * @param {object} caddyConfig
 * @param {string} domain
 * @returns {boolean}
 */
export function hasSubdomain(caddyConfig, domain) {
  if (!domain || typeof domain !== "string") return false;
  const target = domain.trim().toLowerCase();
  return listSubdomains(caddyConfig).some((h) => h.toLowerCase() === target);
}

/**
 * Build a standard Caddy route block for a reverse proxy.
 * Uses caddy-template if available, with a clean built-in fallback.
 * @param {string} domain
 * @param {number|string} port
 * @param {string} [template="proxy"]
 * @returns {object}
 */
export function buildProxyRoute(domain, port, template = "proxy") {
  try {
    return getTemplate(template, {
      host: domain,
      hosts: [domain],
      dial: port
    });
  } catch {
    const dial = String(port).includes(":") ? String(port) : `localhost:${port}`;
    return {
      match: [{ host: [domain] }],
      handle: [
        {
          handler: "subroute",
          routes: [
            {
              handle: [
                {
                  handler: "reverse_proxy",
                  upstreams: [{ dial }]
                }
              ]
            }
          ]
        }
      ],
      terminal: true
    };
  }
}

/**
 * Append a subdomain route to an in-memory Caddy configuration object.
 * @param {object} caddyConfig
 * @param {object} options
 * @param {string} options.domain - Target subdomain (e.g. "api.keshavsoft.com")
 * @param {number|string} options.port - Target backend port or dial target (e.g. 5000)
 * @param {string} [options.template="proxy"] - Route blueprint template
 * @param {boolean} [options.force=false] - Bypass collision check
 * @returns {{ updatedConfig: object, newRoute: object, routeIndex: number }}
 */
export function addSubdomain(caddyConfig, { domain, port, template = "proxy", force = false }) {
  if (!caddyConfig || typeof caddyConfig !== "object") {
    throw new Error("Invalid Caddy configuration: expected an object");
  }

  if (!domain || !port) {
    throw new Error("Missing required 'domain' and 'port' parameters");
  }

  if (!force && hasSubdomain(caddyConfig, domain)) {
    throw new Error(`Domain '${domain}' is already configured in Caddy. Use force: true to override.`);
  }

  caddyConfig.apps ??= {};
  caddyConfig.apps.http ??= {};
  caddyConfig.apps.http.servers ??= {};

  const serverKey = Object.keys(caddyConfig.apps.http.servers)[0] || "srv0";
  caddyConfig.apps.http.servers[serverKey] ??= { listen: [":443"], routes: [] };
  caddyConfig.apps.http.servers[serverKey].routes ??= [];

  const routes = caddyConfig.apps.http.servers[serverKey].routes;
  const newRoute = buildProxyRoute(domain, port, template);

  routes.push(newRoute);

  return {
    updatedConfig: caddyConfig,
    newRoute,
    routeIndex: routes.length - 1
  };
}

/**
 * End-to-end operation: Read -> Guard Check -> Build -> Append -> Backup -> Write.
 * @param {string} filePath
 * @param {object} options
 * @param {string} options.domain
 * @param {number|string} options.port
 * @param {string} [options.template="proxy"]
 * @param {boolean} [options.force=false]
 * @param {boolean} [options.backup=true]
 * @returns {{ updatedConfig: object, newRoute: object, routeIndex: number, backupFile: string|null, filePath: string }}
 */
export function addSubdomainToFile(filePath, { domain, port, template = "proxy", force = false, backup = true }) {
  const config = readCaddyConfig(filePath);
  const result = addSubdomain(config, { domain, port, template, force });
  const { backupFile, filePath: savedPath } = writeCaddyConfig(filePath, result.updatedConfig, { backup });

  return {
    ...result,
    backupFile,
    filePath: savedPath
  };
}
