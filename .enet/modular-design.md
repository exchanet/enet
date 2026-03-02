# METHOD REFLEX — Agent Instructions
> Universal Modular Architecture · v1.0.0 · @exchanet

---

## YOUR PRIMARY DIRECTIVE / TU DIRECTIVA PRINCIPAL

You are building a modular application using Method REFLEX. Every module you create must be self-describing via a `manifest.json` file. The manifest is written **before any code**. The system reads manifests to automatically generate the Admin Panel, dashboard, and settings UI. You never manually wire backend logic to the Admin Panel — the manifest does it.

Estás construyendo una aplicación modular usando Method REFLEX. Cada módulo que crees debe ser auto-descriptivo a través de un archivo `manifest.json`. El manifest se escribe **antes de cualquier código**. El sistema lee los manifests para generar automáticamente el Panel Admin, dashboard y UI de configuración. Nunca cablearás manualmente la lógica backend al Panel Admin — el manifest lo hace.

**If a module has no manifest, it does not exist.**
**Si un módulo no tiene manifest, no existe.**

---

## ABSOLUTE RULES / REGLAS ABSOLUTAS

1. **No manifest = module does not exist.** Core rejects modules without valid `manifest.json`.
2. **Manifest before code.** Complete manifest before any handler, model, or component.
3. **Zero hardcoded configuration.** Every configurable value lives in `manifest.settings`, read via `context.settings.get("key")`.
4. **Core has no business logic.** Domain logic lives in modules only.
5. **Admin Panel is a renderer.** Never code it to show a specific module — modules declare capabilities, Admin Panel renders them.
6. **A module is complete only when the Admin Panel reflects it correctly.**
7. **Removing a module folder requires zero code changes elsewhere.**

---

## WORKFLOW / FLUJO DE TRABAJO

### Starting a new project / Nuevo proyecto:
1. Ask for spectech if not provided (stack, database, deploy target)
2. Declare the architecture you will build
3. **Wait for confirmation before writing any code**
4. Build Core → Manifest schema → Modules → Admin Panel

### Adding a module / Añadir un módulo:
1. Write complete `manifest.json` (all settings + capabilities + hooks)
2. Validate against `manifest.schema.json`
3. Implement all handlers referenced in manifest
4. Place in modules directory (Core discovers automatically)
5. Boot system and verify module appears in Admin Panel
6. Build custom UI components only if manifest declares a `component` field

### When you cannot complete a manifest / Cuando no puedes completar un manifest:

**STOP. Ask the user:**

```
"I cannot complete the manifest for [module name] because I don't understand 
[specific aspect]. Before I continue, I need you to clarify: [specific question]"

"No puedo completar el manifest de [nombre del módulo] porque no entiendo 
[aspecto específico]. Antes de continuar, necesito que aclares: [pregunta específica]"
```

Do not proceed. Do not create a partial manifest. Do not make assumptions. Wait.
No continúes. No crees un manifest parcial. No hagas suposiciones. Espera.

---

## MANIFEST FORMAT / FORMATO DEL MANIFEST

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
    "key": {
      "type": "integer|string|boolean|select",
      "label": "Label",
      "default": null,
      "ui": "slider|toggle|text|select"
    }
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

## WHAT THE CORE MUST IMPLEMENT / QUÉ DEBE IMPLEMENTAR EL CORE

- Module discovery — scan modules dir for valid manifests
- Manifest validation — reject invalid manifests with clear errors (never silent)
- Dependency resolution — boot in correct order
- Handler registry — map `ClassName.method` references to implementations
- Hook system — dispatch events to declared handlers
- Settings store — persistent, namespaced by module ID, initialized from defaults
- REFLEX engine — read all manifests, build Admin nav, dashboard, settings schemas
- Admin API — standard endpoints (same in every project, every stack)

```
GET  /api/admin/manifest-registry
GET  /api/admin/navigation
GET  /api/admin/settings/:moduleId
POST /api/admin/settings/:moduleId
GET  /api/admin/dashboard
POST /api/admin/action/:moduleId/:actionId
GET  /api/admin/health
```

**The Core has ZERO business logic. / El Core tiene CERO lógica de negocio.**

---

## COMPLETION CHECKLIST / CHECKLIST DE COMPLETITUD

Before marking any module complete / Antes de marcar cualquier módulo como completo:

- [ ] `manifest.json` valid / válido
- [ ] All declared handlers implemented / Todos los handlers declarados implementados
- [ ] Zero hardcoded values — all settings use `context.settings.get()` / Cero hardcoded
- [ ] Module appears in Admin Panel navigation / El módulo aparece en la navegación del Panel Admin
- [ ] All views render with data / Todas las vistas renderizan con datos
- [ ] All actions execute correctly / Todas las acciones ejecutan correctamente
- [ ] Dangerous actions show confirmation dialog / Las acciones peligrosas muestran diálogo
- [ ] All metrics show in dashboard / Todas las métricas aparecen en el dashboard
- [ ] All settings render and save correctly / Todos los settings renderizan y guardan
- [ ] Adding this module required zero Core changes / Añadir el módulo requirió cero cambios en el Core
- [ ] Removing module folder removes it completely from Admin Panel / Eliminar la carpeta lo elimina del Panel Admin

---

*For full documentation / Para documentación completa: `METHOD.md`*
*Method REFLEX v1.0.0 · @exchanet · MIT*
