# Criterios acordados para MR Control

Actualización del 27/09/2026. Este documento es la referencia funcional del proyecto para futuras modificaciones.

## Navegación y lectura

- Inicio mantiene contenido e imágenes; se retiran las dos filas duplicadas de accesos Locomotoras/Coches/Áreas/Reportes y Registrar intervención.
- Parque mantiene su funcionamiento. Configuración tiene una página propia todavía vacía.
- Mantenimientos muestra Semana + número ISO y año de esa semana, con sus fechas de lunes a domingo.
- Preventivos livianos y pesados en amarillo; correctivos en rojo. Una intervención conserva una barra continua; intervenciones distintas tienen barras diferentes.
- Elegir una fecha muestra solo la actividad de ese día y las intervenciones abiertas; la ausencia de avances se informa como dato sin confirmar.
- El calendario evita botones de actualización, archivo temporal, importación del piloto y pestañas de eficiencia/informe. El CSV queda en un menú pequeño. El archivo temporal se puede seguir abriendo desde Archivo Histórico.
- La línea de vida y el calendario usan el mismo cálculo de fechas, motivo y tipo. Los trabajos abiertos sin una confirmación reciente tienen borde punteado; eso no confirma detención ni actividad en días no relevados.
- En la línea de vida, operativa es verde sobre el eje; disponible se identifica en azul para conservar su diferencia con operativa. Mantenimientos debajo del eje, con acceso al mismo detalle.

## Ficha de mantenimiento y carga guiada

La ficha muestra detención y motivo, fechas de intervención real, sistemas/componentes trabajados, personal, demoras con causa, cronología diaria y estado posterior. Al final muestra eficiencia, gráfico útil/pérdida/sin datos y explicación día por día.

Preguntas de carga: ¿Desde cuándo está detenida? ¿Por qué? ¿Se trabajó en el período? ¿Cuándo/qué turno? ¿Quién intervino? ¿Qué sistema y parte? Si no se pudo trabajar, ¿por qué? ¿Quedó disponible, operativa, en prueba o continúa el mantenimiento? Un estado desconocido se conserva solo cuando la persona lo elige explícitamente. No generar tareas pendientes automáticas.

- Preventivos E/A/AB/ABC: kilometraje, toda la locomotora y turno rotativo; duración 1/2/3/6 turnos de 8 h. Turnos mañana 6–14 y tarde 14–22. Numerales N1 a N12, con lugar interno o externo.
- Correctivos: Motor diésel, Sistema neumático, Sistema eléctrico, Bogie, Equipos de a bordo, o clasificación adicional explícita cuando corresponda.
- Turno fijo se registra por la mañana. El responsable del registro y quien trabaja deben indicarse sin inventar personal.
- Causas de pérdida: MO mano de obra, MAT materiales, Acc accidental, CAP capacidad instalada, GES productividad.
- El ingreso no acredita trabajo. Un cierre no acredita que la locomotora está operativa; pedir estado posterior. Disponible y operativa son estados diferentes.
- Si se informa disponible u operativa en un avance, ese registro cierra el mantenimiento. Un cierre y “continúa” son incompatibles.
- Eficiencia por mantenimiento: días útiles equivalentes / días incluidos. Días mixtos requieren reparto explícito (por ejemplo 0,5 útil + 0,5 CAP). Fines de semana de correctivos/pesados excluidos sin trabajo/excepción; livianos incluidos. Días sin información impiden dar un porcentaje definitivo.
- Ejemplo acordado: un día mitad útil/mitad CAP, seguido de un día útil, produce 75 % sobre dos días incluidos.

## Persistencia y agente

El detalle, la línea de vida y el calendario leen los mismos eventos y novedades. Las preguntas están implementadas como campos y confirmaciones de formulario. Estos cambios no incorporan todavía transcripción automática de audio ni un agente conversacional. Los criterios quedan documentados y versionados; no representan entrenamiento automático de un modelo.
