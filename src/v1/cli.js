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
Atomic CLI to inspect, validate, probe, and add subdomains to Caddy JSON.

Usage:
  npx caddy-subdomain probe <domain> [configPath] [options]
  npx caddy-subdomain add <domain> <port> [configPath] [options]
  npx caddy-subdomain list [configPath]
  npx caddy-subdomain check <domain> [configPath]

Commands:
  probe <domain>            Add a Level-1 Smoke Test probe (static_response) to verify DNS & HTTPS
  add <domain> <port>       Append or upgrade a subdomain to a reverse proxy (e.g. Node app)
  list                      List all currently configured subdomains
  check <domain>            Check if a subdomain is already registered

Options:
  --reload                  Trigger 'caddy reload' after saving
  --force                   Overwrite existing subdomain configuration
  --no-backup               Skip timestamped backup file creation
  -h, --help                Show help message
  -v, --version             Show version number

Examples:
  # Level 1: Probe test (Verify DNS + SSL zero dependencies)
  npx caddy-subdomain probe call.keshavsoft.com
  npx caddy-subdomain probe call.keshavsoft.com /etc/caddy/caddy.json --reload

  # Level 2: Promote to Node.js backend port
  npx caddy-subdomain add call.keshavsoft.com 5000 --force --reload

  # Check & List
  npx caddy-subdomain list /etc/caddy/caddy.json
  npx caddy-subdomain check call.keshavsoft.com
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

  // Command: PROBE (Level 1 Flight Check)
  if (command === "probe") {
    const domain = args[1];
    if (!domain || domain.startsWith("-")) {
      console.error("Error: 'probe' requires a domain.\n  Example: npx caddy-subdomain probe call.keshavsoft.com");
      process.exitCode = 1;
      return;
    }

    const force = args.includes("--force");
    const noBackup = args.includes("--no-backup");
    const reload = args.includes("--reload");

    const nonFlags = args.slice(2).filter((a) => !a.startsWith("-"));
    const configPath = resolveDefaultPath(nonFlags[0]);

    try {
      const result = addProbeSubdomainToFile(configPath, {
        domain,
        force,
        backup: !noBackup
      });

      console.log(`\n🚀 Level-1 Probe Route Added for: '${domain}'`);
      console.log(`📁 File updated: ${result.filePath}`);
      if (result.backupFile) {
        console.log(`💾 Backup saved: ${result.backupFile}`);
      }
      console.log(`\n🔎 What this does:`);
      console.log(`  1. Caddy will auto-issue Let's Encrypt / ZeroSSL certificate for '${domain}'`);
      console.log(`  2. Visits to https://${domain} will respond with: 200 OK (DNS & HTTPS Verified)`);
      console.log(`  3. Zero Node.js processes or backend ports required!`);

      if (reload) {
        try {
          console.log("\nReloading Caddy server...");
          execSync(`caddy reload --config "${result.filePath}"`, { stdio: "inherit" });
          console.log("✅ Caddy hot-reload completed successfully.");
          console.log(`👉 Test live now: curl -I https://${domain} or open in browser!`);
        } catch (reloadErr) {
          console.warn(`⚠️ Warning: Hot-reload failed: ${reloadErr.message}`);
        }
      } else {
        console.log(`\nTip: Run with --reload to apply changes immediately to live Caddy.`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

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
