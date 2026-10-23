# Stitch Prompt Template — va360-app-raiola

> Generado por /visual-setup (2026-10-23) — usar como base para TODAS las generaciones de pantalla.
> Estado de Stitch: **sin configurar** (no hay API key en esta instalación). La plantilla vale igual para Stitch o Claude Design cuando se configuren; mientras tanto sirve de guía para diseñar en código.
> Fuente visual: `doc/design/DESIGN.md` + `doc/brand/brand_kit/SKILL.md` + `doc/veg/base/veg-va360-app-raiola.md`.

## Estructura del Prompt

Cada generación de pantalla debe seguir esta estructura. Lo generado es siempre un **candidato**, nunca código de producción.

### Template

```
[SCREEN NAME]
UC-XXX: nombre del caso de uso

[PURPOSE]
Qué hace aquí la persona de recepción o la dirección de la clínica, en una frase.

[VISUAL DIRECTION]
Visual Direction (decided before designing; follow it instead of default patterns):
- Concept: the clinic reception between patients — the screen stays still; colour only appears where a person must act or review. Signature piece: numbered citation marks in each draft that open the source document fragment highlighted in pale sage; any unsupported figure is underlined in amber.
- Palette: background #F5F6F2 (page), surface #FFFFFF (panels), text #1E2A23, secondary text #55625A, action sage #46684F (primary button, focus, selection), pale sage #E2EBE3 (cited text, selected row), amber #8A5300 on #FBF0DC ("Requiere revisión" only), red #B3261E on #FBEAE8 (errors only), border #D8DDD6, control border #7D887F.
- Typography: Atkinson Hyperlegible Next for everything (600 headings, 400 body 16px/1.5, 500 labels 14px); tabular numbers for prices and times.
- Layout: work inbox — left sidebar 232px, inbox list 400px, message detail; left aligned; 1px borders instead of shadows; radii 6px controls, 10px panels, pill only for status chips.
- Refuse: cream background with serif and terracotta, Inter as the only voice, grey with a single blue accent, identical cards, hero metrics, coloured left borders on rows, uppercase spaced eyebrows, gradients, glass, emojis, generic "Enviar" buttons, fade-up entrance animations.

[LAYOUT]
- Device: DESKTOP | TABLET | MOBILE
- Structure: describir regiones de arriba abajo y de izquierda a derecha
- Sections: enumerar secciones

[CONTENT]
- Header: título de la pantalla (24px) y, si aplica, contador de «Requiere revisión»
- Main: contenido principal con datos realistas de una clínica de fisioterapia (tarifas, horarios, cancelaciones) — nunca lorem ipsum ni nombres tipo «John Doe»
- Secondary: panel de detalle o de citas si aplica
- Actions: una sola acción principal en salvia con el texto exacto de lo que hace

[COMPONENTS]
- componente 1: especificación concreta
- componente 2: especificación concreta

[INTERACTIONS]
- interacción 1: por ejemplo «clic en una fila → abre el detalle a la derecha»
- interacción 2: por ejemplo «clic en una cita → popover con el fragmento resaltado»

[RULES]
- ALWAYS use LIGHT MODE (dark mode is handled in code via CSS variables)
- Use the palette, typography and radii above exactly; no other colours
- Status always shown with text + icon, never colour alone
- Minimum touch target: 44px on mobile
- Maintain 4.5:1 contrast for text and 3:1 for control borders
- Spanish UI copy
```

---

## Multi-Form-Factor Protocol

Para cada pantalla que requiera responsive, generar 3 versiones:

| # | Form Factor | Stitch deviceType | Nombre archivo |
|---|------------|-------------------|----------------|
| 1 | Desktop | DESKTOP | `<uc-id>_<pantalla>_desktop.html` |
| 2 | Tablet | TABLET | `<uc-id>_<pantalla>_tablet.html` |
| 3 | Mobile | MOBILE | `<uc-id>_<pantalla>_mobile.html` |

**Reglas:**
- Generar SIEMPRE desktop primero (es la referencia principal: el ordenador de recepción).
- Tablet: barra lateral reducida a iconos; lista y detalle a dos columnas 40/60.
- Mobile: una columna; la lista primero y el detalle a pantalla completa con «Volver a la bandeja»; barra inferior con 4 destinos; «Aprobar y enviar» fijo abajo.
- Guardar en: `doc/design/<feature>/<uc-id>/`.

## Selección de Modelo

| Complejidad | Modelo | Cuándo usar |
|-------------|--------|-------------|
| Simple | GEMINI_3_5_FLASH_LITE | Inicio de sesión, Ajustes, confirmaciones |
| Compleja | GEMINI_3_8_FLASH | Bandeja con detalle, Documentos, Simulador |

## Referencia Rápida

| Parámetro | Valor |
|-----------|-------|
| Stitch Project ID | sin crear (Stitch sin configurar) |
| Design System Asset | sin crear (Stitch sin configurar) |
| Primary Color | `#46684F` |
| Secondary Color | `#55625A` |
| Font | Atkinson Hyperlegible Next (en Stitch: LEXEND como sustituto) |
| Roundness | 6 px controles / 10 px paneles (en Stitch: ROUND_EIGHT) |
| Color Mode | LIGHT (siempre) |
| Brand Context | `doc/brand/brand_kit/SKILL.md` |
| VEG Base | `doc/veg/base/veg-va360-app-raiola.md` |
| DESIGN.md | `doc/design/DESIGN.md` |
