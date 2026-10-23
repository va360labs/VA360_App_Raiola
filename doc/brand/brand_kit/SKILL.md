# Brand: va360-app-raiola

> Herramienta interna de respuestas para clínicas de fisioterapia pequeñas. Dirección: la recepción entre paciente y paciente; todo está en calma y el color solo aparece donde alguien tiene que actuar o revisar.

## Paleta

| Rol | Hex | Función |
|-----|-----|---------|
| Fondo | #F5F6F2 | Fondo de página (blanco roto frío, con un punto de verde) |
| Superficie | #FFFFFF | Paneles, lista de la bandeja, detalle del mensaje |
| Texto | #1E2A23 | Texto principal y títulos |
| Texto secundario | #55625A | Metadatos, horas, descripciones (AA sobre fondo y superficie) |
| Acción | #46684F | Verde salvia: botón principal, enlaces, foco, selección |
| Acento | #E2EBE3 | Salvia claro: texto citado resaltado y fila seleccionada |
| Aviso | #8A5300 | «Requiere revisión» (texto sobre #FBF0DC) |
| Error | #B3261E | Fallos y acciones destructivas (texto sobre #FBEAE8) |
| Borde | #D8DDD6 | Separadores de filas y paneles |

Bordes de campos y controles: #7D887F (3:1 sobre fondo y superficie).

## Dirección

- **Tema:** la recepción entre paciente y paciente. La pantalla está quieta; el color marca lo que necesita a una persona.
- **Superficie:** Operate (bandeja de trabajo). El mundo visual aporta tipografía, paleta, densidad y una pieza propia; la estructura es la de una bandeja de correo.
- **Composición:** densidad media, alineación a la izquierda, lista + detalle en escritorio y lista → detalle en móvil. Radios por función: 6 px campos y botones, 10 px paneles, pastilla solo en chips de estado.
- **Pieza propia:** las citas. Cada dato del borrador lleva una marca numerada que abre el fragmento del documento con el texto resaltado en salvia claro; un dato sin respaldo se subraya en ámbar.
- **Principios:** 1) un color, un significado; 2) ningún dato sin su fuente visible; 3) una sola acción principal por vista.

## Lo que se rehúsa

- Fondo crema con serif y terracota → blanco roto frío #F5F6F2, sin serif ni terracota.
- Inter o Roboto como única voz → Atkinson Hyperlegible Next, elegida por distinguir 0/O, 1/l/I y 5/S en precios y horas.
- Gris con un solo acento azul → salvia para acción, ámbar para revisión y rojo para error.
- Tarjetas idénticas y métrica héroe → lista de bandeja y un contador sencillo.
- Mismo radio y sombra en todo → radios por función y bordes de 1 px en lugar de sombras.
- Borde lateral de color en filas → chip de estado con texto e icono.
- Etiquetas en mayúsculas espaciadas, emojis, degradados y vidrio → no se usan.
- Botones genéricos («Enviar») → la acción exacta («Aprobar y enviar», «Guardar cambios»).

## Tipografía

- **Heading**: Atkinson Hyperlegible Next, semibold (600)
- **Body**: Atkinson Hyperlegible Next, regular (400), 16 px base, interlineado 1.5
- **Label**: Atkinson Hyperlegible Next, medium (500), 14 px
- **Mono**: Atkinson Hyperlegible Mono, solo para identificadores y datos técnicos
- Cifras con `font-variant-numeric: tabular-nums` en horas, precios y contadores.

## Forma

- **Radius**: 6 px controles, 10 px paneles, 9999 px chips de estado
- **Shadows**: ninguna en paneles; `shadow-md` solo en elementos flotantes (popover de cita, menús)
- **Borders**: 1 px #D8DDD6 (claro) / #34413A (oscuro)

## Reglas

1. Salvia solo para la acción principal, el foco, los enlaces y la selección.
2. Ámbar solo para «Requiere revisión»; rojo solo para error y eliminar.
3. Los estados siempre llevan texto además de color.
4. Contraste mínimo 4.5:1 para texto y 3:1 para bordes de controles.
5. Espaciado en múltiplos de 4 px.
6. Movimiento sutil: ≤ 150 ms, sin animación en filas de la bandeja, respetando `prefers-reduced-motion`.
