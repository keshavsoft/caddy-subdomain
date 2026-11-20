# caddy-subdomain Samples (v1)

This folder contains step-by-step runnable samples demonstrating each core capability of `caddy-subdomain`.

## Directory Structure

```
samples/
├── caddy.sample.json            # Reference Caddy JSON configuration
├── README.md                    # Samples overview
└── v1/
    ├── 01-probe/                # Level-1 smoke test probe (static_response)
    │   ├── run.js
    │   ├── run.bat
    │   └── run.sh
    ├── 02-add/                  # Level-2 backend promotion (reverse_proxy)
    │   ├── run.js
    │   ├── run.bat
    │   └── run.sh
    ├── 03-list/                 # List all configured subdomains & targets
    │   ├── run.js
    │   ├── run.bat
    │   └── run.sh
    ├── 04-check/                # Check if a subdomain already exists
    │   ├── run.js
    │   ├── run.bat
    │   └── run.sh
    ├── 05-build-probe-route/    # Low-level AST builder for probe route
    │   ├── run.js
    │   ├── run.bat
    │   └── run.sh
    ├── 06-build-proxy-route/    # Low-level AST builder for proxy route
    │   ├── run.js
    │   ├── run.bat
    │   └── run.sh
    └── 07-static/               # Level-2 static file server promotion (file_server)
        ├── run.js
        ├── run.bat
        └── run.sh
```

## Running Any Sample

From repository root:

```bash
# Windows
.\samples\v1\01-probe\run.bat

# Linux / macOS
node samples/v1/01-probe/run.js
```
