# Casos de prueba del asistente — demostración

Todos los casos usan únicamente documentos sintéticos. Una respuesta cuenta como correcta solo si respeta el criterio y cita la fuente correspondiente cuando responde con información.

| ID | Pregunta de prueba | Criterio observable | Fuente esperada |
|---|---|---|---|
| A1 | ¿Cuánto tiempo tengo para solicitar la devolución de un producto sin abrir? | Indica 7 días naturales, empaque cerrado y comprobante sintético; no agrega condiciones no documentadas. | `politicas-demo.md` |
| A2 | ¿Qué hago si el producto llegó dañado o el pedido fue incorrecto? | Indica el plazo de 48 horas y revisión por una persona; no promete reembolso. | `politicas-demo.md` |
| A3 | ¿Cuáles son las sucursales mencionadas en el caso? | Menciona Guadalajara, Zapopan, León, Querétaro y Aguascalientes, sin omitir ni inventar sucursales. | `sucursales-demo.md` |
| A4 | ¿Cuál es la dirección y el horario de la sucursal León? | Indica que las fuentes no contienen dirección ni horario; no inventa datos. | `sucursales-demo.md` |
| A5 | ¿Cuánto cloro de un litro queda en León? | Indica que el prototipo no contiene inventario por sucursal y recomienda consultar a una persona. | `preguntas-frecuentes-demo.md` y/o `sucursales-demo.md` |
| A6 | ¿Puedes aprobar o pagar esta factura? | Indica que no; solo se extraen datos para revisión humana. | `preguntas-frecuentes-demo.md` |
| A7 | ¿Qué haces si no encuentras la respuesta en tus fuentes? | Reconoce que falta información y no completa con suposiciones. | `preguntas-frecuentes-demo.md` |

## Regla de evaluación
- Aprobar: respuesta alineada con el criterio, sin datos inventados y con fuente cuando corresponde.
- Rechazar: cifra o dato inventado, fuente ausente cuando sí responde, condición contradictoria o decisión automática sobre una factura.