---
description: Method Modular Design — Universal Modular Architecture
globs: ["**/*"]
alwaysApply: true
---

# METHOD MODULAR DESIGN — Cursor Rules
> Universal Modular Architecture · v1.0.0 · @exchanet

## PRIMARY DIRECTIVE

You are building a modular application using Method Modular Design. Every module is self-describing via `manifest.json`. The manifest is written BEFORE any code. The Core reads manifests to auto-generate the Admin Panel, dashboard, and settings UI. You never manually wire backend to Admin Panel — the manifest does it automatically.

## ABSOLUTE RULES

1. **No manifest = module does not exist.** Core rejects modules without valid `manifest.json`.
2. **Manifest before code.** Complete manifest before any handler, model, or component.
3. **Zero hardcoded config.** Every configurable value lives in `manifest.settings`, read via `context.settings.get("key")`.
4. **Core has no business logic.** Zero. Domain logic lives in modules only.
5. **Admin Panel is a renderer.** Never code it to show a specific module. Modules declare capabilities, Panel renders automatically.
6. **Module complete = Admin Panel reflects it correctly.**
7. **Remove module folder → zero code changes elsewhere required.**

## STARTING A PROJECT

1. Read spectech. If missing: ask for stack, database, deploy target before writing anything.
2. Declare architecture (backend path, modules path, admin panel path, admin API path).
3. **Wait for user confirmation.**
4. Build: Core → Manifest Schema → Modules → Admin Panel.

## ADDING A MODULE

1. Write complete `manifest.json` (all settings + capabilities + hooks declared)
2. Validate against `manifest.schema.json`
3. Implement all handlers referenced in manifest
4. Place in modules directory — Core discovers automatically
5. Boot and verify in Admin Panel — **required, not optional**
6. Build custom components only if manifest declares `"component"` field

## WHEN YOU CANNOT COMPLETE A MANIFEST

Stop immediately. Ask:
> "I cannot complete the manifest for [module] because I don't understand [aspect]. Before I continue, I need you to clarify: [question]"

Do not proceed with a partial manifest. Do not make assumptions. Wait for the answer.

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
    "key": { "type": "integer|string|boolean|select", "label": "Label", "default": null, "ui": "slider|toggle|text|select" }
  },
  "capabilities": [
    { "type": "view",   "label": "Label", "data": "ClassName.method" },
    { "type": "action", "label": "Label", "handler": "ClassName.method", "dangerous": false },
    { "type": "metric", "label": "Label", "data": "ClassName.method" },
    { "type": "widget", "label": "Label", "data": "ClassName.method", "component": "ComponentName" }
  ]
}
```

## CORE RESPONSIBILITIES

Discovery · Manifest validation (never silent failure) · Dependency resolution · Handler registry · Hook system · Settings store · REFLEX engine · Admin API

Standard Admin API (same in every project):
```
GET  /api/admin/manifest-registry
GET  /api/admin/navigation
GET/POST /api/admin/settings/:moduleId
GET  /api/admin/dashboard
POST /api/admin/action/:moduleId/:actionId
GET  /api/admin/health
```

## COMPLETION GATE (every module)

- [ ] manifest.json valid
- [ ] All handlers implemented, zero hardcoded values
- [ ] Appears in Admin Panel with correct section
- [ ] All views render with data
- [ ] All actions execute correctly
- [ ] Dangerous actions have confirmation dialog
- [ ] All metrics in dashboard
- [ ] All settings render and save
- [ ] Zero Core changes needed to add this module
- [ ] Removing folder removes it completely from Admin Panel
