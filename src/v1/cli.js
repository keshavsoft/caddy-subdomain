import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import {
  readCaddyConfig,
  listSubdomains,
  hasSubdomain,
  addSubdomainToFile
} from "./index.js";

export function resolveDefaultPath(customPath) {
  if (customPath) return resolve(process.cwd(), customPath);
  const local = resolve(process.cwd(), "./caddy.json");
  if (existsSync(local)) return local;
  const vps = "/etc/caddy/caddy.json";
  if (existsSync(vps)) return vps;
  return local;
}

export function printHelp() {
  console.log(`
caddy-subdomain (v1.0.0)
Atomic CLI to inspect, validate, and add subdomains to Caddy JSON.

Usage:
  npx caddy-subdomain add <domain> <port> [configPath] [options]
  npx caddy-subdomain list [configPath]
  npx caddy-subdomain check <domain> [configPath]

Commands:
  add <domain> <port>       Append a new reverse proxy subdomain to Caddy
  list                      List all currently configured subdomains
  check <domain>            Check if a subdomain is already registered

Options:
  --reload                  Trigger 'caddy reload' after saving
  --force                   Bypass duplicate subdomain check
  --no-backup               Skip timestamped backup file creation
  -h, --help                Show help message
  -v, --version             Show version number

Examples:
  npx caddy-subdomain add billing.keshavsoft.com 5000
  npx caddy-subdomain add billing.keshavsoft.com 5000 ./caddy.json --reload
  npx caddy-subdomain list ./caddy.json
  npx caddy-subdomain check quotation.keshavsoft.com
`);
}

export function run(args = process.argv.slice(2)) {
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return;
  }

  if (args.includes("-v") || args.includes("--version")) {
    console.log("1.0.0");
    return;
  }

  const command = args[0].toLowerCase();

  // Command: LIST
  if (command === "list") {
    const configPath = resolveDefaultPath(args[1]);
    try {
      const config = readCaddyConfig(configPath);
      const domains = listSubdomains(config);
      console.log(`\nConfigured Subdomains in ${configPath} (${domains.length}):\n`);
      domains.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
      console.log("");
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  // Command: CHECK
  if (command === "check") {
    const domain = args[1];
    if (!domain) {
      console.error("Error: Please provide a domain to check (e.g. npx caddy-subdomain check api.example.com)");
      process.exitCode = 1;
      return;
    }
    const configPath = resolveDefaultPath(args[2]);
    try {
      const config = readCaddyConfig(configPath);
      const exists = hasSubdomain(config, domain);
      if (exists) {
        console.log(`❌ Domain '${domain}' is ALREADY configured in ${configPath}`);
      } else {
        console.log(`✅ Domain '${domain}' is AVAILABLE to be added`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  // Command: ADD
  if (command === "add") {
    const domain = args[1];
    const port = args[2];

    if (!domain || !port) {
      console.error("Error: 'add' requires both <domain> and <port>.\n  Example: npx caddy-subdomain add billing.keshavsoft.com 5000");
      process.exitCode = 1;
      return;
    }

    const force = args.includes("--force");
    const noBackup = args.includes("--no-backup");
    const reload = args.includes("--reload");

    const nonFlags = args.slice(3).filter((a) => !a.startsWith("-"));
    const configPath = resolveDefaultPath(nonFlags[0]);

    try {
      const result = addSubdomainToFile(configPath, {
        domain,
        port,
        force,
        backup: !noBackup
      });

      console.log(`\n✅ Subdomain '${domain}' added successfully!`);
      console.log(`📁 File updated: ${result.filePath}`);
      if (result.backupFile) {
        console.log(`💾 Backup saved: ${result.backupFile}`);
      }

      if (reload) {
        try {
          console.log("\nReloading Caddy server...");
          execSync(`caddy reload --config "${result.filePath}"`, { stdio: "inherit" });
          console.log("✅ Caddy hot-reload completed.");
        } catch (reloadErr) {
          console.warn(`⚠️ Warning: Hot-reload failed: ${reloadErr.message}`);
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  // Fallback
  console.error(`Unknown command: '${command}'. Run 'npx caddy-subdomain --help' for usage.`);
  process.exitCode = 1;
}

export default { run, printHelp, resolveDefaultPath };
