import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getTemplate } from "caddy-template";

/**
 * ============================================================================
 * caddy-subdomain (v1)
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
 * Find and inspect the specific Caddy route entry for a subdomain.
 * Returns entry type, target, server name, route index, and raw Caddy route AST.
 * @param {object} caddyConfig
 * @param {string} domain
 * @returns {object|null}
 */
export function getSubdomainEntry(caddyConfig, domain) {
  if (!domain || typeof domain !== "string") return null;
  const target = domain.trim().toLowerCase();
  const servers = caddyConfig?.apps?.http?.servers || {};

  for (const [serverName, srv] of Object.entries(servers)) {
    const routes = srv.routes || [];
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const matchHosts = [];
      for (const match of route.match || []) {
        if (Array.isArray(match.host)) {
          matchHosts.push(...match.host);
        }
      }
      if (matchHosts.some((h) => h.toLowerCase() === target)) {
        let type = "custom";
        let targetDesc = "custom";

        for (const h of route.handle || []) {
          if (h.handler === "static_response") {
            type = "probe";
            targetDesc = `static_response (${h.status_code || 200} OK)`;
            break;
          }
          if (h.handler === "reverse_proxy") {
            type = "reverse_proxy";
            const up = (h.upstreams || []).map((u) => u.dial).join(", ");
            targetDesc = up || "reverse_proxy";
            break;
          }
          if (h.handler === "subroute") {
            let rootPath = "";
            for (const sub of h.routes || []) {
              for (const subH of sub.handle || []) {
                if (subH.handler === "vars" && subH.root) {
                  rootPath = subH.root;
                }
                if (subH.handler === "reverse_proxy") {
                  type = "reverse_proxy";
                  const dials = (subH.upstreams || []).map((u) => u.dial).join(", ");
                  targetDesc = dials || "reverse_proxy";
                  break;
                }
                if (subH.handler === "file_server") {
                  type = "file_server";
                  targetDesc = rootPath || "file_server";
                  break;
                }
              }
            }
          }
        }

        return {
          domain,
          server: serverName,
          index: i,
          type,
          target: targetDesc,
          route
        };
      }
    }
  }

  return null;
}

/**
 * List all configured subdomains along with their entry type and target.
 * @param {object} caddyConfig
 * @returns {Array<{ domain: string, type: string, target: string, server: string }>}
 */
export function listSubdomainDetails(caddyConfig) {
  const domains = listSubdomains(caddyConfig);
  return domains.map((domain) => {
    const entry = getSubdomainEntry(caddyConfig, domain);
    return {
      domain,
      type: entry?.type || "custom",
      target: entry?.target || "unspecified",
      server: entry?.server || "srv0"
    };
  });
}

/**
 * Build a Level-1 Smoke Test Probe route block using native static_response.
 * Requires ZERO external ports, ZERO files on disk, and ZERO Node.js processes.
 * Used to verify DNS propagation and automatic HTTPS issuance.
 * @param {string} domain
 * @param {object} [options]
 * @param {string} [options.message]
 * @returns {object}
 */
export function buildProbeRoute(domain, options = {}) {
  const message =
    options.message ||
    `✅ Subdomain '${domain}' is LIVE on Caddy!\nDNS propagation and Automatic HTTPS (SSL) verified successfully.\n`;

  return {
    match: [{ host: [domain] }],
    handle: [
      {
        handler: "static_response",
        status_code: 200,
        headers: {
          "Content-Type": ["text/plain; charset=utf-8"]
        },
        body: message
      }
    ],
    terminal: true
  };
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
 * Build a standard Caddy route block for a static file server.
 * Uses caddy-template if available, with a clean built-in fallback.
 * @param {string} domain
 * @param {string} [root] - Document root path (e.g. "/usr/share/caddy" or "/var/www/domain")
 * @returns {object}
 */
export function buildStaticRoute(domain, root) {
  const docRoot = (root && String(root).trim()) || `/usr/share/caddy/${domain}`;
  try {
    return getTemplate("static", {
      host: domain,
      root: docRoot
    });
  } catch {
    return {
      match: [{ host: [domain] }],
      handle: [
        {
          handler: "subroute",
          routes: [
            {
              handle: [
                {
                  handler: "vars",
                  root: docRoot
                },
                {
                  handler: "file_server",
                  hide: ["/etc/caddy/Caddyfile"]
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
 * Helper to ensure standard Caddy HTTP server structure and return the routes array.
 * @param {object} caddyConfig
 * @returns {Array<object>}
 */
function getOrCreateRoutes(caddyConfig) {
  caddyConfig.apps ??= {};
  caddyConfig.apps.http ??= {};
  caddyConfig.apps.http.servers ??= {};

  const serverKey = Object.keys(caddyConfig.apps.http.servers)[0] || "srv0";
  caddyConfig.apps.http.servers[serverKey] ??= { listen: [":443"], routes: [] };
  caddyConfig.apps.http.servers[serverKey].routes ??= [];

  return caddyConfig.apps.http.servers[serverKey].routes;
}

/**
 * Helper to insert or replace a route.
 * @param {Array<object>} routes
 * @param {string} domain
 * @param {object} newRoute
 * @param {boolean} force
 * @returns {number} routeIndex
 */
function upsertRoute(routes, domain, newRoute, force) {
  const existingIndex = routes.findIndex((r) =>
    (r.match || []).some((m) => (m.host || []).some((h) => h.toLowerCase() === domain.toLowerCase()))
  );

  if (existingIndex !== -1) {
    if (!force) {
      throw new Error(`Domain '${domain}' is already configured in Caddy at index ${existingIndex}. Use force: true to override.`);
    }
    routes[existingIndex] = newRoute;
    return existingIndex;
  }

  routes.push(newRoute);
  return routes.length - 1;
}

/**
 * Add a Level-1 Probe subdomain to an in-memory Caddy configuration.
 * @param {object} caddyConfig
 * @param {object} options
 * @param {string} options.domain
 * @param {boolean} [options.force=false]
 * @param {string} [options.message]
 * @returns {{ updatedConfig: object, newRoute: object, routeIndex: number }}
 */
export function addProbeSubdomain(caddyConfig, { domain, force = false, message } = {}) {
  if (!caddyConfig || typeof caddyConfig !== "object") {
    throw new Error("Invalid Caddy configuration: expected an object");
  }
  if (!domain) {
    throw new Error("Missing required 'domain' parameter for probe");
  }

  const routes = getOrCreateRoutes(caddyConfig);
  const newRoute = buildProbeRoute(domain, { message });
  const routeIndex = upsertRoute(routes, domain, newRoute, force);

  return {
    updatedConfig: caddyConfig,
    newRoute,
    routeIndex
  };
}

/**
 * Add a Level-1 Probe subdomain directly to a Caddy JSON file with auto-backup.
 * @param {string} filePath
 * @param {object} options
 * @param {string} options.domain
 * @param {boolean} [options.force=false]
 * @param {boolean} [options.backup=true]
 * @param {string} [options.message]
 * @returns {{ updatedConfig: object, newRoute: object, routeIndex: number, backupFile: string|null, filePath: string }}
 */
export function addProbeSubdomainToFile(filePath, { domain, force = false, backup = true, message } = {}) {
  const config = readCaddyConfig(filePath);
  const result = addProbeSubdomain(config, { domain, force, message });
  const { backupFile, filePath: savedPath } = writeCaddyConfig(filePath, result.updatedConfig, { backup });

  return {
    ...result,
    backupFile,
    filePath: savedPath
  };
}

/**
 * Add a Static File Server subdomain to an in-memory Caddy configuration.
 * @param {object} caddyConfig
 * @param {object} options
 * @param {string} options.domain
 * @param {string} [options.root] - Document root path on the server
 * @param {boolean} [options.force=false]
 * @returns {{ updatedConfig: object, newRoute: object, routeIndex: number }}
 */
export function addStaticSubdomain(caddyConfig, { domain, root, force = false } = {}) {
  if (!caddyConfig || typeof caddyConfig !== "object") {
    throw new Error("Invalid Caddy configuration: expected an object");
  }
  if (!domain) {
    throw new Error("Missing required 'domain' parameter for static subdomain");
  }

  const routes = getOrCreateRoutes(caddyConfig);
  const newRoute = buildStaticRoute(domain, root);
  const routeIndex = upsertRoute(routes, domain, newRoute, force);

  return {
    updatedConfig: caddyConfig,
    newRoute,
    routeIndex
  };
}

/**
 * Add a Static File Server subdomain directly to a Caddy JSON file with auto-backup.
 * @param {string} filePath
 * @param {object} options
 * @param {string} options.domain
 * @param {string} [options.root]
 * @param {boolean} [options.force=false]
 * @param {boolean} [options.backup=true]
 * @returns {{ updatedConfig: object, newRoute: object, routeIndex: number, backupFile: string|null, filePath: string }}
 */
export function addStaticSubdomainToFile(filePath, { domain, root, force = false, backup = true } = {}) {
  const config = readCaddyConfig(filePath);
  const result = addStaticSubdomain(config, { domain, root, force });
  const { backupFile, filePath: savedPath } = writeCaddyConfig(filePath, result.updatedConfig, { backup });

  return {
    ...result,
    backupFile,
    filePath: savedPath
  };
}

/**
 * Append or promote a subdomain route (reverse proxy or static file server) to an in-memory Caddy configuration.
 * @param {object} caddyConfig
 * @param {object} options
 * @param {string} options.domain - Target subdomain (e.g. "api.keshavsoft.com")
 * @param {number|string} [options.port] - Target backend port (e.g. 5000) OR static document root path (e.g. "/var/www/site")
 * @param {string} [options.target] - Target alias for port or root path
 * @param {string} [options.root] - Document root path for static file server
 * @param {string} [options.template] - Optional template override ("proxy" or "static")
 * @param {boolean} [options.force=false] - Bypass collision check
 * @returns {{ updatedConfig: object, newRoute: object, routeIndex: number }}
 */
export function addSubdomain(caddyConfig, { domain, port, target, root, template, force = false }) {
  if (!caddyConfig || typeof caddyConfig !== "object") {
    throw new Error("Invalid Caddy configuration: expected an object");
  }
  const dialOrPath = String(port || target || root || "").trim();
  if (!domain || !dialOrPath) {
    throw new Error("Missing required 'domain' and target ('port' or 'root') parameters");
  }

  const isStatic =
    template === "static" ||
    dialOrPath.startsWith("/") ||
    dialOrPath.startsWith("./") ||
    dialOrPath.includes("\\");

  const routes = getOrCreateRoutes(caddyConfig);
  const newRoute = isStatic
    ? buildStaticRoute(domain, dialOrPath)
    : buildProxyRoute(domain, dialOrPath, template || "proxy");

  const routeIndex = upsertRoute(routes, domain, newRoute, force);

  return {
    updatedConfig: caddyConfig,
    newRoute,
    routeIndex
  };
}

/**
 * End-to-end operation: Read -> Guard Check -> Build -> Append -> Backup -> Write.
 * Supports both reverse proxy ports and static file server paths.
 * @param {string} filePath
 * @param {object} options
 * @param {string} options.domain
 * @param {number|string} [options.port]
 * @param {string} [options.target]
 * @param {string} [options.root]
 * @param {string} [options.template]
 * @param {boolean} [options.force=false]
 * @param {boolean} [options.backup=true]
 * @returns {{ updatedConfig: object, newRoute: object, routeIndex: number, backupFile: string|null, filePath: string }}
 */
export function addSubdomainToFile(filePath, { domain, port, target, root, template, force = false, backup = true }) {
  const config = readCaddyConfig(filePath);
  const result = addSubdomain(config, { domain, port, target, root, template, force });
  const { backupFile, filePath: savedPath } = writeCaddyConfig(filePath, result.updatedConfig, { backup });

  return {
    ...result,
    backupFile,
    filePath: savedPath
  };
}
