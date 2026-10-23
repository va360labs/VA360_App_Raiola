---
name: va360-app-raiola
theme:
  colorMode: LIGHT
  colorVariant: FIDELITY
  roundness: ROUND_EIGHT
  headlineFont: LEXEND
  bodyFont: LEXEND
  labelFont: LEXEND
  customColor: '#46684F'
  overridePrimaryColor: '#46684F'
  overrideSecondaryColor: '#55625A'
  overrideTertiaryColor: '#8A5300'
  overrideNeutralColor: '#66726A'
colors:
  surface: '#FFFFFF'
  on-surface: '#1E2A23'
  background: '#F5F6F2'
  on-background: '#1E2A23'
  primary: '#46684F'
  on-primary: '#FFFFFF'
  primary-container: '#E2EBE3'
  on-primary-container: '#2F4836'
  secondary: '#55625A'
  outline: '#7D887F'
  outline-variant: '#D8DDD6'
  warning: '#8A5300'
  warning-container: '#FBF0DC'
  error: '#B3261E'
  error-container: '#FBEAE8'
typography:
  headline-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-base:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  control: 6px
  panel: 10px
  dialog: 14px
  chip: 9999px
spacing:
  base: 4px
  panel-padding: 16px
  panel-gap: 24px
---

> Nota de fuentes: Stitch no ofrece Atkinson Hyperlegible Next entre sus fuentes, así que el bloque `theme` usa LEXEND (también diseñada para la legibilidad) solo como sustituto para Stitch. En el código se usa siempre Atkinson Hyperlegible Next.

## Overview

va360-app-raiola — visión consolidada por SpecBox a partir del Brand Kit y la VEG del proyecto.

**Voice & tone**: Sobrio, cercano y claro. Frases cortas, sin jerga técnica.

## Colors

Paleta canónica del proyecto. Siempre referenciar por hex code o por token reference, nunca por nombre de color en lenguaje natural.

- **background**: `#F5F6F2`
- **surface**: `#FFFFFF`
- **text_primary**: `#1E2A23`
- **text_secondary**: `#55625A`
- **primary**: `#46684F`
- **accent**: `#E2EBE3`
- **warning**: `#8A5300`
- **error**: `#B3261E`
- **border**: `#D8DDD6`

Paleta restringida; usar el primary únicamente para CTAs principales y elementos de navegación primaria.

## Typography

**Heading**: `Atkinson Hyperlegible Next`
**Body**: `Atkinson Hyperlegible Next`

**Tamaños**: h1=24px, h2=20px, h3=18px, body=16px, label=14px, caption=13px. Cifras con números tabulares.

Jerarquía estricta: H1 una vez por pantalla. Cuerpo legible a 16px sin excepción.

## Layout

Densidad media. Bandeja de trabajo: barra lateral 232 px + lista 400 px + detalle en escritorio; una columna con lista → detalle en móvil. Grid de 12 columnas. Whitespace funcional, no decorativo.

## Elevation & Depth

Sombras mínimas (0-2dp). Cards con borde antes que sombra.

## Shapes

Radios por función: 6 px en campos y botones, 10 px en paneles, 14 px en diálogos y pastilla solo en chips de estado. Sin formas decorativas.

## Components

Botones con la acción exacta en el texto; inputs con etiqueta superior y borde #7D887F. Lista de bandeja con chips de estado (texto + icono). Pieza propia: citas numeradas en el borrador que abren el fragmento del documento con el texto resaltado en #E2EBE3; un dato sin respaldo se subraya en #8A5300.

## Do's and Don'ts

**Do's**
- Mantener jerarquía visual clara con tipografía
- Usar primary únicamente para acciones principales
- Preferir tablas y formularios estructurados sobre cards decorativos

**Don'ts**
- Gradientes, neon, glow
- Iconografía ilustrada o cartoon
- Tipografías display o decorativas

**Lo que se rehúsa (dirección del proyecto)**
- Fondo crema con serif y terracota → blanco roto frío #F5F6F2, sin serif ni terracota.
- Inter o Roboto como única voz → Atkinson Hyperlegible Next, elegida por distinguir 0/O, 1/l/I y 5/S en precios y horas.
- Gris con un solo acento azul → salvia para acción, ámbar para revisión y rojo para error.
- Tarjetas idénticas y métrica héroe → lista de bandeja y un contador sencillo.
- Mismo radio y sombra en todo → radios por función y bordes de 1 px en lugar de sombras.
- Borde lateral de color en filas → chip de estado con texto e icono.
- Etiquetas en mayúsculas espaciadas, emojis, degradados y vidrio → no se usan.
- Botones genéricos («Enviar») → la acción exacta («Aprobar y enviar», «Guardar cambios»).

## VEG Notes

The following notes preserve VEG semantics that don't fit Material 3 enums:

- VEG archetype: corporate
- Brand primary anchor: #46684F
