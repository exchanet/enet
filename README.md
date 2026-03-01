# ◆ enet — exchanet methods manager

Install, scaffold and manage exchanet AI coding methods in any project, with any agent.

```bash
npm install -g @exchanet/enet
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@exchanet/enet.svg)](https://www.npmjs.com/package/@exchanet/enet)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18-green.svg)]()

---

## What is enet?

`enet` is the package manager for exchanet methods. It installs AI coding method adapters directly into your project — in the right place for your agent — and provides tools to scaffold modules, validate manifests, and keep everything up to date.

Think of it as `brew` or `npm`, but for AI coding architecture methods.

---

## Available Methods

| Method | What it does |
|---|---|
| `reflex` | Universal modular architecture. Auto-generated Admin Panel, zero hardcoded config. |
| `pdca-t` | ≥99% test coverage, zero vulnerabilities, systematic quality validation. |
| `iris` | Continuous improvement of existing systems without breaking architecture. |
| `enterprise-builder` | Large-scale planning for complex projects before writing code. |

The registry is live — new methods appear automatically without updating enet.

---

## Usage

### Install a method

```bash
enet install reflex
enet install pdca-t
enet install iris
enet install enterprise-builder
```

enet detects your AI agent automatically and places the adapter in the right location:

| Agent detected | Installs to |
|---|---|
| Cursor | `.cursor/rules/enet-reflex.md` |
| Windsurf | Appended to `.windsurfrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| None detected | `.enet/reflex.md` |

Override with `--agent cursor\|windsurf\|copilot\|generic`.

### See all available methods

```bash
enet list
enet list --installed
```

### Project status and health

```bash
enet status    # installed methods + detected agent
enet doctor    # full diagnostic — manifests, schema, agent, Node version
```

### Scaffold a new module

```bash
enet new module products
enet new module activity-logger --section monitoring
enet new ui-pack dark-theme
enet new integration stripe --section billing
```

Generates `manifest.json` + handler + README. Manifest first, always.

### Create a manifest interactively

```bash
enet init
enet init --json    # print to stdout without writing
```

### Validate manifests

```bash
enet validate              # validate all modules in project
enet validate --all        # recursive
enet validate --strict     # warnings become errors
```

### Keep methods up to date

```bash
enet update              # update all installed methods
enet update reflex       # update a specific method
```

---

## How it works

1. `enet install reflex` fetches `registry.json` from this repo
2. Finds the repo for `reflex` (`exchanet/method_reflex`)
3. Detects your agent (Cursor, Windsurf, Copilot...)
4. Downloads the right adapter from GitHub in real time
5. Writes it to the correct location in your project

The adapter content always comes live from the source repo. `enet update` re-fetches to get the latest version.

---

## The Registry

Methods are defined in [`registry.json`](./registry.json) in this repo. The CLI fetches it on every run — no local state, always current.

To add a new exchanet method to the registry, add an entry to `registry.json` and open a PR. No CLI code changes needed.

```json
{
  "methods": {
    "your-method": {
      "name": "Method Name",
      "description": "What it does.",
      "repo": "exchanet/method_your_repo",
      "adapters": {
        "cursor":   "adapters/cursor.md",
        "windsurf": "adapters/windsurf.md",
        "copilot":  "adapters/copilot.md",
        "generic":  "adapters/generic.md"
      }
    }
  }
}
```

---

## Requirements

- Node.js 18 or higher
- An AI coding agent (Cursor, Windsurf, GitHub Copilot, or any agent)

---

## Repository Structure

```
exchanet/enet/
├── registry.json          ← source of truth for all methods
├── README.md
├── package.json           ← published as @exchanet/enet
└── src/
    ├── index.js           ← entry point, command definitions
    ├── commands/
    │   ├── install.js     ← enet install
    │   ├── list.js        ← enet list
    │   ├── init.js        ← enet init
    │   ├── validate.js    ← enet validate
    │   ├── new.js         ← enet new
    │   ├── update.js      ← enet update
    │   ├── status.js      ← enet status
    │   └── doctor.js      ← enet doctor
    └── utils/
        ├── registry.js    ← loads registry.json from GitHub, caches locally
        └── agent-detector.js ← detects Cursor / Windsurf / Copilot
```

---

## Publishing

```bash
cd enet
npm publish --access public
```

---

## License

MIT — Francisco J Bernades ([@exchanet](https://github.com/exchanet))
