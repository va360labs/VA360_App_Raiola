# Sistema de Diseño

> Configurado vía `/visual-setup` — 2026-10-23. El proyecto no tiene `CLAUDE.md`, así que esta es la referencia de diseño.

## Identidad Visual

| Campo | Valor |
|-------|-------|
| Dirección | La recepción entre paciente y paciente: todo en calma; el color solo aparece donde alguien tiene que actuar o revisar |
| Dominio | Herramienta interna de respuestas para clínicas de fisioterapia pequeñas |
| Superficie | Operate (bandeja de trabajo) |
| Primary | `#46684F` (verde salvia) |
| Fondo | `#F5F6F2` (blanco roto frío) |
| Secondary | `#55625A` |
| Font | Atkinson Hyperlegible Next |
| Roundness | 6 px controles · 10 px paneles · pastilla en chips |
| Device | desktop-first |
| Pieza propia | Citas numeradas que abren el fragmento del documento |

## Herramientas externas de diseño

| Herramienta | Estado | Qué falta |
|-------------|--------|-----------|
| Google Stitch | Pendiente | API key de Stitch (`stitch.pendingSetup: true` en `.claude/settings.local.json`) |
| Claude Design | Pendiente | Tokens del sistema (`design-system.tokens.json`), que aparecerán al montar el proyecto |

Cuando se configuren, vuelve a ejecutar `/visual-setup`: detecta lo que ya existe y solo crea el proyecto y el sistema remotos.

## Brand Kit

| Archivo | Ruta |
|---------|------|
| Resumen agentes | `doc/brand/brand_kit/SKILL.md` |
| CSS Tokens | `doc/brand/brand_kit/variables.css` |
| Tailwind Config | `doc/brand/brand_kit/tailwind.config.js` |
| Light Theme | `doc/brand/brand_kit/light.md` |
| Dark Theme | `doc/brand/brand_kit/dark.md` |

## VEG & Design

| Archivo | Ruta |
|---------|------|
| DESIGN.md canónico | `doc/design/DESIGN.md` |
| VEG Base | `doc/veg/base/veg-va360-app-raiola.md` |
| Prompt Template | `doc/design/stitch-prompt-template.md` |

## Reglas de Diseño

1. Un color, un significado: salvia = acción y respaldo; ámbar = requiere revisión; rojo = error.
2. Los estados siempre llevan texto e icono, no solo color.
3. Ningún dato del borrador sin su cita visible.
4. Una sola acción principal por vista, con el texto exacto de lo que hace.
5. Bordes de 1 px en lugar de sombras; sombras solo en elementos flotantes.
6. Movimiento ≤ 150 ms, nunca en las filas de la bandeja, y respetando `prefers-reduced-motion`.
7. Stitch o Claude Design, cuando se usen, generan en modo claro y solo candidatos; el modo oscuro va en código con los tokens CSS.
