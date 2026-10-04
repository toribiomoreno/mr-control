# Criterios acordados para MR Control

Actualización del 28/09/2026. Este documento es la referencia funcional del proyecto para futuras modificaciones.

## Navegación y lectura

- Inicio mantiene contenido e imágenes; se retiran las dos filas duplicadas de accesos Locomotoras/Coches/Áreas/Reportes y Registrar intervención.
- Parque mantiene su funcionamiento. Configuración tiene una página propia todavía vacía.
- Mantenimientos muestra Semana + número ISO y año de esa semana, con sus fechas de lunes a domingo.
- Preventivos livianos y pesados en amarillo; correctivos en rojo. Una intervención conserva una barra continua; intervenciones distintas tienen barras diferentes.
- Elegir una fecha muestra solo la actividad de ese día y las intervenciones abiertas; la ausencia de avances se informa como dato sin confirmar.
- El calendario evita botones de actualización, archivo temporal, importación del piloto y pestañas de eficiencia/informe. El CSV queda en un menú pequeño.
- La línea de vida y el calendario usan el mismo cálculo de fechas, motivo y tipo. Los trabajos abiertos sin una confirmación reciente tienen borde punteado; eso no confirma detención ni actividad en días no relevados.
- En la línea de vida, disponible y operativa se representan como operativa, en verde y sobre el mismo eje. Mantenimientos debajo del eje, con acceso al mismo detalle.

## Ficha de mantenimiento y carga guiada

La ficha muestra detención y motivo, fechas de intervención real, sistemas/componentes trabajados, personal, demoras con causa, cronología diaria y estado posterior. Al final muestra eficiencia, gráfico útil/pérdida/sin datos y explicación día por día.

Preguntas de carga: ¿Desde cuándo está detenida? ¿Por qué? ¿Se trabajó en el período? ¿Cuándo/qué turno? ¿Quién intervino? ¿Qué sistema y parte? Si no se pudo trabajar, ¿por qué? ¿Quedó disponible, operativa, en prueba o continúa el mantenimiento? Un estado desconocido se conserva solo cuando la persona lo elige explícitamente. No generar tareas pendientes automáticas.

- Preventivos E/A/AB/ABC: kilometraje, toda la locomotora y turno rotativo; duración 1/2/3/6 turnos de 8 h. Turnos mañana 6–14 y tarde 14–22. Numerales N1 a N12, con lugar interno o externo.
- Correctivos: Motor diésel, Sistema neumático, Sistema eléctrico, Bogie, Equipos de a bordo, o clasificación adicional explícita cuando corresponda.
- Turno fijo se registra por la mañana. El responsable del registro y quien trabaja deben indicarse sin inventar personal.
- Causas de pérdida: MO mano de obra, MAT materiales, Acc accidental, CAP capacidad instalada, GES productividad.
- El ingreso no acredita trabajo. Se pide el estado posterior antes de cerrar: disponible y operativa se normalizan como operativa. El cierre de una revisión no implica una reparación ni un diagnóstico confirmado.
- Si se informa disponible u operativa en un avance, ese registro cierra el mantenimiento. Un cierre y “continúa” son incompatibles.
- Eficiencia por mantenimiento: días útiles equivalentes / días incluidos. Días mixtos requieren reparto explícito (por ejemplo 0,5 útil + 0,5 CAP). Fines de semana de correctivos/pesados excluidos sin trabajo/excepción; livianos incluidos. Días sin información impiden dar un porcentaje definitivo.
- Ejemplo acordado: un día mitad útil/mitad CAP, seguido de un día útil, produce 75 % sobre dos días incluidos.

## Persistencia y agente

El detalle, la línea de vida y el calendario leen los mismos eventos y novedades. Las preguntas están implementadas como campos y confirmaciones de formulario. El dictado del navegador y el texto escrito alimentan los mismos campos y validaciones; no hay un segundo circuito de carga por audio ni un agente conversacional que complete hechos por su cuenta. Los criterios quedan documentados y versionados; no representan entrenamiento automático de un modelo.

## Carga unificada e histórico (28/09)

- Una entrada principal: **Mantenimientos → Cargar datos**. Permite crear un registro, elegir un mantenimiento existente para un avance/cierre/observación, o corregir un avance ya guardado. Las preguntas para completar datos de una ficha usan los mismos formularios y validadores.
- Archivo Histórico queda como consulta: sin archivo temporal, importación de libro ni registro manual. Tarjetas con título, estado, sistema y personal; fechas de detención a cierre solo a la izquierda. Las anotaciones y los avances se despliegan debajo. No se elimina información de la base.
- Se toma el personal de los avances con trabajo confirmado, incluyendo especialidad cuando se conoce. No se repite sistema/componente/fecha en el resumen.
- Los filtros de fechas encuentran mantenimientos cuyo período se superpone al rango. La búsqueda incluye las anotaciones de los avances.
- Ingreso nuevo: locomotora, fecha, motivo de detención, lugar, sistema/parte para correctivos, responsable, título breve, descripción y estado posterior. E/A/AB/ABC conservan turno rotativo y locomotora completa. En numerales se confirma el personal, incluido externo.
- Se retira la doble pregunta estado del mantenimiento / estado de la máquina. Operativa exige fecha de cierre explícita y coherente. La hora es opcional y nunca se completa automáticamente.
- Después de guardar un ingreso se abre el paso de actividad diaria. Si se abandona ese paso, el ingreso permanece y la falta de actividad queda visible en la ficha; no se inventa un día trabajado.
- Avance: fecha, trabajo/espera/mixto/anotación, personal, turno, sistema y componente, estado posterior. Espera o mixto exige MO/MAT/Acc/CAP/GES. Datos desconocidos se eligen explícitamente.
- Duración del trabajo (jornada/media jornada/desconocida) se guarda y muestra separada del reparto útil/pérdida. Media jornada seguida de disponibilidad no equivale a media jornada de pérdida. El indicador existente sigue siendo por días y requiere reparto explícito en los días mixtos; la duración informativa no modifica por sí sola ese cálculo.
- No se cambian los bloqueos del día actual ni se eluden las validaciones de la base: una evaluación de día completo requiere que el día haya pasado o que el mantenimiento esté cerrado. Para un día abierto se registra la actividad y duración observadas.

## Revalidación del 29/09

- Al corregir un avance anterior a un cierre se conserva el estado que la máquina tenía en ese momento. «Continuaba en mantenimiento» antes del cierre no contradice su disponibilidad posterior.
- La ficha de un mantenimiento cerrado toma fecha de disponibilidad y resultado del cierre; no exige volver a cargar un estado de ingreso que quedó antiguo.
- Un avance después de una pausa vuelve a «En curso», igual que la base de datos.
- Jornada de trabajo desconocida sigue pendiente, también en registros anteriores. No se completa con jornada entera por defecto. Una observación sin trabajo no obliga a inventar personal.
- Los partes del 28/09 de E705, E709, E714 y EM02 se contrastaron con lo dictado. La revisión prevista para EM02 el 29/09 permanece como plan, sin crear una detención ni intervención futura como si ya hubieran ocurrido.
