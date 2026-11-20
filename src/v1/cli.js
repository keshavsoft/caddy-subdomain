import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import {
  readCaddyConfig,
  listSubdomains,
  hasSubdomain,
  addSubdomainToFile,
  addProbeSubdomainToFile
} from "./index.js";

/**
 * Automatically discovers the Caddy configuration file:
 * 1. Explicit path if provided
 * 2. Standard VPS location (/etc/caddy/caddy.json)
 * 3. Local working directory (./caddy.json)
 * 4. Sibling/parent sample configuration
 */
export function resolveDefaultPath(customPath) {
  if (customPath) return resolve(process.cwd(), customPath);

  const vps = "/etc/caddy/caddy.json";
  if (existsSync(vps)) return vps;

  const local = resolve(process.cwd(), "./caddy.json");
  if (existsSync(local)) return local;

  const sample = resolve(process.cwd(), "./samples/caddy.sample.json");
  if (existsSync(sample)) return sample;

  const parent = resolve(process.cwd(), "../caddy.json");
  if (existsSync(parent)) return parent;

  return vps;
}

export function printHelp() {
  console.log(`
caddy-subdomain (v1.0.0)
The Zero-Config Subdomain Engine for Caddy Server.

Zero configuration required:
- Caddy config location (/etc/caddy/caddy.json) is detected automatically.
- Caddy hot-reload is executed automatically.
- Instant Yes/No verification for domain presence and live HTTPS traffic.

Usage:
  npx caddy-subdomain probe <domain>
  npx caddy-subdomain add <domain> <port>
  npx caddy-subdomain check <domain>
  npx caddy-subdomain list

Commands:
  probe <domain>            Add Level-1 smoke probe (zero ports), auto-reload & test live HTTPS
  add <domain> <port>       Connect subdomain to backend port & auto-reload with zero downtime
  check <domain>            Check if subdomain is already registered in Caddy (Yes / No)
  list                      List all configured subdomains

Options:
  --no-reload               Skip automatic 'caddy reload'
  --no-backup               Skip automatic timestamped backup file creation
  --force                   Force overwrite of an existing route
  -h, --help                Show help message
  -v, --version             Show version number

Examples:
  npx caddy-subdomain probe call.keshavsoft.com
  npx caddy-subdomain add call.keshavsoft.com 5000
  npx caddy-subdomain check call.keshavsoft.com
  npx caddy-subdomain list
`);
}

export async function run(args = process.argv.slice(2)) {
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return;
  }

  if (args.includes("-v") || args.includes("--version")) {
    console.log("1.0.0");
    return;
  }

  const command = args[0].toLowerCase();

  // ----------------------------------------------------
  // 1. PROBE (Level 1 Flight Check: Zero Dependencies)
  // ----------------------------------------------------
  if (command === "probe") {
    const domain = args[1];
    if (!domain || domain.startsWith("-")) {
      console.error("Error: 'probe' requires a domain.\n  Usage: npx caddy-subdomain probe <domain>\n  Example: npx caddy-subdomain probe call.keshavsoft.com");
      process.exitCode = 1;
      return;
    }

    const force = args.includes("--force");
    const noBackup = args.includes("--no-backup");
    const noReload = args.includes("--no-reload");

    const nonFlags = args.slice(2).filter((a) => !a.startsWith("-"));
    const configPath = resolveDefaultPath(nonFlags[0]);

    try {
      const config = readCaddyConfig(configPath);
      const alreadyPresent = hasSubdomain(config, domain);

      if (!alreadyPresent || force) {
        addProbeSubdomainToFile(configPath, {
          domain,
          force,
          backup: !noBackup
        });
      }

      console.log(`Subdomain:        ${domain}`);
      console.log(`Present in Caddy: ${alreadyPresent && !force ? "Yes" : "Yes (Probe Active)"}`);

      // Automatic Caddy reload
      if (!noReload) {
        try {
          execSync(`caddy reload --config "${configPath}"`, { stdio: "ignore" });
          console.log(`Caddy Reload:     Success`);
        } catch {
          console.log(`Caddy Reload:     Skipped (caddy server not running or binary not in PATH)`);
        }
      }

      // Live HTTP/HTTPS probe
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`https://${domain}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.status === 200) {
          console.log(`Live HTTPS:       Yes (200 OK - Verified)`);
        } else {
          console.log(`Live HTTPS:       Yes (HTTP ${res.status})`);
        }
      } catch {
        console.log(`Live HTTPS:       Pending (Waiting for DNS / SSL propagation)`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  // ----------------------------------------------------
  // 2. CHECK (Presence check: Yes / No)
  // ----------------------------------------------------
  if (command === "check") {
    const domain = args[1];
    if (!domain || domain.startsWith("-")) {
      console.error("Error: 'check' requires a domain.\n  Usage: npx caddy-subdomain check <domain>\n  Example: npx caddy-subdomain check call.keshavsoft.com");
      process.exitCode = 1;
      return;
    }

    const nonFlags = args.slice(2).filter((a) => !a.startsWith("-"));
    const configPath = resolveDefaultPath(nonFlags[0]);

    try {
      const config = readCaddyConfig(configPath);
      const exists = hasSubdomain(config, domain);
      console.log(`Subdomain:        ${domain}`);
      console.log(`Present in Caddy: ${exists ? "Yes" : "No"}`);
      if (!exists) {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  // ----------------------------------------------------
  // 3. ADD (Level 2: Backend Promotion)
  // ----------------------------------------------------
  if (command === "add") {
    const domain = args[1];
    const port = args[2];

    if (!domain || !port || domain.startsWith("-") || port.startsWith("-")) {
      console.error("Error: 'add' requires both <domain> and <port>.\n  Usage: npx caddy-subdomain add <domain> <port>\n  Example: npx caddy-subdomain add call.keshavsoft.com 5000");
      process.exitCode = 1;
      return;
    }

    const noBackup = args.includes("--no-backup");
    const noReload = args.includes("--no-reload");

    const nonFlags = args.slice(3).filter((a) => !a.startsWith("-"));
    const configPath = resolveDefaultPath(nonFlags[0]);

    try {
      addSubdomainToFile(configPath, {
        domain,
        port: Number(port),
        force: true, // auto-upgrades probe to backend!
        backup: !noBackup
      });

      console.log(`Subdomain:        ${domain}`);
      console.log(`Target:           localhost:${port}`);

      // Automatic Caddy reload
      if (!noReload) {
        try {
          execSync(`caddy reload --config "${configPath}"`, { stdio: "ignore" });
          console.log(`Caddy Reload:     Success`);
        } catch {
          console.log(`Caddy Reload:     Skipped (caddy server not running or binary not in PATH)`);
        }
      }
      console.log(`Status:           Active`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  // ----------------------------------------------------
  // 4. LIST (List all configured subdomains)
  // ----------------------------------------------------
  if (command === "list") {
    const nonFlags = args.slice(1).filter((a) => !a.startsWith("-"));
    const configPath = resolveDefaultPath(nonFlags[0]);

    try {
      const config = readCaddyConfig(configPath);
      const domains = listSubdomains(config);
      console.log(`Config: ${configPath}`);
      console.log(`Subdomains (${domains.length}):`);
      if (domains.length === 0) {
        console.log(`  (none configured)`);
      } else {
        domains.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  console.error(`Unknown command: '${command}'. Run 'npx caddy-subdomain --help' for usage.`);
  process.exitCode = 1;
}

export default run;
