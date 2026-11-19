# caddy-subdomain

[![npm version](https://img.shields.io/npm/v/caddy-subdomain.svg?color=amber&style=flat-square)](https://www.npmjs.com/package/caddy-subdomain)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](https://opensource.org/licenses/ISC)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-emerald.svg?style=flat-square)](https://keshavsoft.github.io/caddy-subdomain/)
[![GitHub](https://img.shields.io/badge/github-keshavsoft%2Fcaddy--subdomain-zinc.svg?style=flat-square&logo=github)](https://github.com/keshavsoft/caddy-subdomain)

> **Atomic, single-purpose library & CLI to inspect, validate, and programmatically add subdomains to Caddy JSON configurations.**

---

## ⚡ Why `caddy-subdomain`?

- 🎯 **Single Responsibility**: Does exactly one thing: subdomain management for Caddy JSON.
- 🛡️ **Duplicate Guard**: Automatically detects duplicate host collisions before writing.
- 💾 **Auto-Backups**: Saves timestamped `.bak.<timestamp>` snapshots before modifying files.
- 🔄 **Hot-Reload Ready**: Supports optional `--reload` for zero-downtime hot reloads.
- 📦 **Dual API**: Zero-install standalone CLI (`npx caddy-subdomain`) or pure ESM library (`import { addSubdomain } from "caddy-subdomain"`).

---

## 🚀 CLI Quick Start

```bash
# Add a new reverse proxy subdomain (domain -> port):
npx caddy-subdomain add billing.keshavsoft.com 5000

# Add and immediately trigger Caddy hot-reload:
npx caddy-subdomain add billing.keshavsoft.com 5000 /etc/caddy/caddy.json --reload

# List all subdomains configured in Caddy:
npx caddy-subdomain list

# Check if a subdomain is already in use:
npx caddy-subdomain check quotation.keshavsoft.com
```

### CLI Flags

| Flag | Description |
| :--- | :--- |
| `--reload` | Automatically run `caddy reload --config <file>` after writing |
| `--force` | Bypass duplicate domain collision check and add anyway |
| `--no-backup` | Skip creating the `.bak.<timestamp>` backup file |
| `-h, --help` | Display CLI help menu |
| `-v, --version` | Display version number |

---

## 📦 Programmatic Usage (ESM)

```javascript
import {
  readCaddyConfig,
  listSubdomains,
  hasSubdomain,
  addSubdomain,
  addSubdomainToFile
} from "caddy-subdomain";

// 1. Check if domain is already registered:
const config = readCaddyConfig("./caddy.json");
if (hasSubdomain(config, "billing.keshavsoft.com")) {
  console.log("Domain already exists!");
}

// 2. Add to file with automatic backup:
const result = addSubdomainToFile("./caddy.json", {
  domain: "billing.keshavsoft.com",
  port: 5000
});

console.log(`Added at route index: ${result.routeIndex}`);
console.log(`Backup saved to: ${result.backupFile}`);
```

---

## 🧪 Testing

```bash
npm test
```

---

## 📄 License

[ISC](LICENSE) &copy; [KeshavSoft](https://github.com/keshavsoft)
