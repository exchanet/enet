---
name: method-modular-design
description: Universal modular architecture method. Use when building any new application or adding modules to an existing one. Ensures every module is self-describing via manifest.json, the Admin Panel is auto-generated, and no configuration is ever hardcoded. Apply whenever the user mentions modules, admin panel, architecture, or modular systems.
---

# METHOD MODULAR DESIGN — Antigravity Agent Instructions
> Universal Modular Architecture · v2.0.0 · @exchanet

## PRIMARY DIRECTIVE

You are building a modular application using Method Modular Design. Every module is self-describing via `manifest.json`, written BEFORE any code. The Core reads manifests to auto-generate the Admin Panel, dashboard, and settings UI automatically.

If a module has no manifest, it does not exist. If you cannot complete the manifest, you do not understand the module well enough to build it — ask for clarification.

---

## ABSOLUTE RULES (never violate)

1. **No manifest = module does not exist.** Core rejects modules without valid `manifest.json`.
2. **Manifest before code.** Complete the manifest before writing any handler, model, or component.
3. **Zero hardcoded configuration.** Every configurable value is a `manifest.settings` entry, read via `context.settings.get("key")`.
4. **Core has no business logic.** Domain logic lives in modules only.
5. **Admin Panel is a renderer.** You never code it to show a specific module — modules declare their capabilities, Admin Panel renders them.
6. **A module is complete only when the Admin Panel reflects it correctly.**
7. **Removing a module folder must require zero code changes elsewhere.**

---

## WORKFLOW

### Starting a new project:
1. Ask for spectech if not provided (stack, database, deploy target)
2. Declare the architecture you will build
3. Wait for confirmation before writing any code
4. Build Core → Define manifest schema → Build modules → Build Admin Panel

### Adding a module:
1. Write `manifest.json` (complete — all settings, capabilities, hooks)
2. Validate against `manifest.schema.json`
3. Implement all handlers referenced in manifest
4. Place module in modules directory
5. Boot system and verify module appears correctly in Admin Panel
6. Build custom UI components only if manifest declares a `component` field

### When you cannot complete a manifest:
Stop. Ask: "I cannot complete the manifest for [module] because I don't understand [aspect]. Please clarify: [specific question]."

---

## MANIFEST FORMAT

```json
{
  "id": "module-id",
  "name": "Human Name",
  "version": "1.0.0",
  "type": "functional",
  "section": "admin-section",
  "dependencies": [],
  "hooks": { "event.name": "ClassName.method" },
  "settings": {
    "key": { "type": "integer|string|boolean|select", "label": "Label", "default": value, "ui": "slider|toggle|text|select" }
  },
  "capabilities": [
    { "type": "view",   "label": "Label", "data": "ClassName.method" },
    { "type": "action", "label": "Label", "handler": "ClassName.method", "dangerous": false },
    { "type": "metric", "label": "Label", "data": "ClassName.method" },
    { "type": "widget", "label": "Label", "data": "ClassName.method", "component": "ComponentName" }
  ]
}
```

---

## WHAT THE CORE MUST IMPLEMENT

- Module discovery (scan modules dir for valid manifests)
- Manifest validation (reject invalid manifests with clear errors)
- Dependency resolution (boot in correct order)
- Handler registry (map `ClassName.method` references to implementations)
- Hook system (dispatch events to declared handlers)
- Settings store (persistent, namespaced by module ID, initialized from manifest defaults)
- REFLEX engine (read all manifests, build Admin navigation, dashboard, settings schemas)
- Admin API (standard endpoints: `/api/admin/manifest-registry`, `/api/admin/navigation`, `/api/admin/settings/:id`, `/api/admin/dashboard`, `/api/admin/action/:moduleId/:actionId`)

The Core has ZERO business logic.

---

## COMPLETION CHECKLIST

Before marking any module complete, verify:
- [ ] `manifest.json` valid
- [ ] All declared handlers implemented
- [ ] Zero hardcoded values (all settings use `context.settings.get()`)
- [ ] Module appears in Admin Panel navigation
- [ ] All views render with data
- [ ] All actions execute correctly
- [ ] Dangerous actions show confirmation dialog
- [ ] All metrics show in dashboard
- [ ] All settings render and save correctly
- [ ] Adding this module required zero Core changes
- [ ] Removing module folder removes it completely from Admin Panel

---

For full documentation: `METHOD.md`
