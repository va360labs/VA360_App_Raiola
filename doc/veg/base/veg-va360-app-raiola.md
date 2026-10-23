# VEG: va360-app-raiola — Base

> Feature: Global (base para todas las features)
> Modo: uniforme
> Generado: 2026-10-23

## Contexto del Target

- **Quién**: recepción y dirección de clínicas de fisioterapia pequeñas que contestan a pacientes por WhatsApp y email (ICP-1 e ICP-2 de `doc/app/app_market.md`).
- **Referentes visuales**: WhatsApp Web y bandejas de correo (Gmail) por estructura; su agenda online por familiaridad.
- **Tolerancia visual**: minimal.
- **Plataforma primaria**: desktop-first (ordenador de recepción), usable en móvil por la dirección.

## Pilar 1: Imágenes

### Estrategia de imagen

| Campo | Valor |
|-------|-------|
| Tipo | Ninguna fotografía ni ilustración en el panel; iconos de línea (Lucide) a 1.5 px |
| Mood | Tranquilo, ordenado, de consulta clínica |
| Paleta | Iconos en #55625A; en estados, el color del estado |
| Sujetos | Solo iconografía funcional: canal (WhatsApp, email), estado, documento, cita |

### Prompts de imagen por sección

| Sección | Tipo | Prompt |
|---------|------|--------|
| Hero | Ninguna | No aplica: herramienta interna sin portada |
| Features | Ninguna | No aplica |
| Empty states | Icono + texto | "Icono de línea de una bandeja vacía en #55625A, 48 px, sin fondo ni ilustración; debajo, una frase que explica qué hacer (por ejemplo: «Todavía no hay mensajes. Prueba con el simulador.»)" |
| Backgrounds | Ninguna | Fondo plano #F5F6F2, sin texturas ni degradados |

## Pilar 2: Motion

### Estrategia de motion

| Campo | Valor |
|-------|-------|
| Nivel | subtle |
| Personalidad | Discreta: confirma acciones sin llamar la atención |

### Catálogo de animaciones

| Tipo | Animación | Duración | Easing |
|------|-----------|----------|--------|
| page_enter | Fundido de opacidad 0 → 1 del panel de detalle | 120ms | cubic-bezier(0.2, 0, 0, 1) |
| scroll_reveal | No se usa (nivel subtle) | — | — |
| scroll_stagger_delay | — | 0ms | — |
| hover_buttons | Cambio de color de fondo, sin desplazamiento | 120ms | — |
| loading | Texto «Redactando borrador…» con indicador lineal indeterminado en salvia; nada de esqueletos animados en la lista | — | — |
| transitions_pages | Sin transición entre pantallas | 0ms | — |
| transitions_modals | Fundido y escala 0.98 → 1 en el diálogo de confirmación | 150ms | — |
| feedback_success | Chip de estado cambia a «Enviado» con aviso breve en la parte inferior (4 s, sin animación de rebote) | — | — |
| feedback_error | Aviso de error persistente hasta que se cierra | — | — |

Todas las animaciones se desactivan con `prefers-reduced-motion: reduce`. Las filas de la bandeja nunca se animan.

## Pilar 3: Diseño

### Estrategia de diseño

| Campo | Valor |
|-------|-------|
| Densidad | Media: filas de bandeja de 64 px con contacto, extracto y estado legibles de un vistazo |
| Whitespace | Moderado: 16 px dentro de paneles, 24 px entre paneles |
| Separación de secciones | Bordes de 1 px #D8DDD6, no sombras ni bloques de color |

### Tipografía

| Campo | Valor |
|-------|-------|
| Heading weight | 600 (Atkinson Hyperlegible Next) |
| Body spacing | 16 px, interlineado 1.5, medida máxima de 72 caracteres en el texto del mensaje |
| Hero scale | Sin hero; título de pantalla a 24 px |

### Jerarquía visual

| Campo | Valor |
|-------|-------|
| Estilo | Bandeja de trabajo (lista + detalle), alineada a la izquierda |
| CTA prominence | Una acción principal por vista («Aprobar y enviar») en salvia; el resto contorneado o como enlace |
| Data presentation | Lista con chips de estado; borrador con citas numeradas que abren el fragmento del documento; cifras con números tabulares |

## Form Factor Adaptations

### Desktop (>= 1024px)
- Layout: barra lateral de navegación de 232 px + lista de bandeja de 400 px + detalle del mensaje en el resto
- Grid: 12 columnas, gap 24px
- Max width: sin límite en la bandeja (usa todo el ancho); 960 px en Documentos y Ajustes
- Navigation: barra lateral fija (Bandeja, Documentos, Simulador, Ajustes) con el contador de «Requiere revisión»

### Tablet (768px - 1023px)
- Layout: barra lateral reducida a iconos con etiqueta al pasar el ratón; lista y detalle a dos columnas 40/60
- Grid: 8 columnas, gap 16px
- Navigation: barra lateral colapsada

### Mobile (< 768px)
- Layout: una columna; la lista ocupa la pantalla y el detalle se abre como pantalla completa con botón «Volver a la bandeja»; la lista aparece antes que cualquier resumen
- Grid: 4 columnas, gap 12px
- Navigation: barra inferior con 4 destinos
- Touch targets: mínimo 44px; la acción «Aprobar y enviar» fija en la parte inferior del detalle

## Resumen para inyección en sub-agentes (~400 tokens)

VEG [uniforme] Base: va360-app-raiola
Images: none (Lucide line icons 1.5px), mood calm clinical reception, palette sage #46684F + off-white #F5F6F2
Motion: level subtle, personality discreet
  - page_enter: opacity fade 120ms cubic-bezier(0.2,0,0,1)
  - scroll: none, stagger 0ms
  - loading: "Redactando borrador…" + indeterminate linear bar in sage
  - transitions: none between pages; dialog fade+scale 0.98→1 150ms
Design: density medium (64px inbox rows), whitespace moderate (16/24px)
  - hierarchy: inbox list + detail, left aligned, CTA single sage "Aprobar y enviar"
  - typography: heading 600, body 16px/1.5, no hero, screen title 24px
  - signature piece: numbered citation marks opening the source fragment highlighted in #E2EBE3; unsupported data underlined in amber #8A5300
Form factors: desktop-first, breakpoints 640/768/1024/1280
Brand: #46684F + #55625A, font Atkinson Hyperlegible Next, radius 6px controls / 10px panels
