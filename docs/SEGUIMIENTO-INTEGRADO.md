# Seguimiento integrado de MR Control

## Qué cambia

La opción Mantenimientos reemplaza al calendario. Conserva estilos, navegación, flota y Archivo Histórico. El seguimiento usa `eventos_historial` y `actualizaciones_evento`; no hay una segunda base de mantenimientos. Patio también guarda sus nuevos eventos en ese historial. Los resúmenes anteriores guardados solo en el navegador se conservan, pero no se convierten en hechos de mantenimiento.

- Semana: una barra continua por mantenimiento; distintas intervenciones se separan.
- Detalle: sistema, componente, detención, personal, trabajos diarios, correcciones y vínculo al historial con adjuntos.
- Eficiencia: porcentaje, composición útil/pérdida/sin datos y desglose diario dentro del detalle del mantenimiento.
- Informe: tabla filtrada para imprimir o guardar PDF. CSV de registros y de indicadores. Respaldo JSON de mantenimientos (no incluye contenido binario de adjuntos ni el resto del Libro).
- Importación del respaldo JSON del piloto: vista previa, validación, transacción atómica, identificadores de origen, omisión de importados y detección conservadora de posibles duplicados. No sobrescribe registros existentes. Los casos incompletos o duplicados requieren revisión y quedan fuera; se muestran antes de confirmar.
- Archivo Histórico: línea de vida de dos semanas por locomotora, con períodos de disponibilidad confirmada sobre el eje y cada mantenimiento debajo. Un mantenimiento de varios días conserva la misma barra; al tocarlo abre su detalle en Seguimiento. Los días sin evidencia se dejan sin color.
- En Archivo Histórico, **Ver archivo privado (temporal)** permite revisar un JSON local de la semana piloto en ambas pantallas sin subirlo al repositorio ni guardarlo en la base. Al cerrar la pestaña se pierde esta vista. La importación permanente requiere base habilitada y revisión de duplicados.

## Reglas combinadas

| Dato | Regla |
| --- | --- |
| Unidad | E701–E721, 7754, 7763, 7746, 7774, EM01, EM02; normalización del piloto |
| E / A / AB / ABC | Kilometraje; toda la locomotora; rotativo; 1 / 2 / 3 / 6 turnos de 8 horas |
| Numerales | 1–12; preventivo pesado; distinguir Boulogne de externo |
| Correctivo | Sistema y componente requeridos; mantiene especialidad y criticidad originales |
| Personal | Fijo se registra mañana; rotativo mañana/tarde para estos mantenimientos |
| Detención | Se confirma aparte del inicio. No se deduce de los textos antiguos |
| Trabajo | Se confirma explícitamente en cada novedad; el motivo de ingreso no es actividad |
| Demora | MO, MAT, Acc, CAP o GES; indicar si abarcó todo el día |
| Día mixto | Sin reparto confirmado no se calcula el porcentaje; admite mitad útil/mitad pérdida con explicación |
| Fin de semana | Livianos incluidos. Correctivos y pesados excluidos salvo intervención o excepción prevista |
| Datos faltantes | Se muestran como sin información; nunca se convierten automáticamente en pérdida |
| Hoy | Se incorpora al cálculo al cerrar el día o mantenimiento; no anticipar reparto o espera de todo el día |
| Cierre | No implica disponibilidad del Patio. Las observaciones posteriores no reabren el mantenimiento |
| Faltantes de carga | Preguntas y botones en el formulario; guardar sin actividad exige confirmación explícita. No crea tareas pendientes automáticas |
| Contradicciones | Fechas, turno fijo, trabajo frente a espera de día completo, doble reparto y actividad posterior al cierre se rechazan |
| Permisos | Supervisor/jefatura/desarrollador cargan; observador consulta. Requiere perfil activo |
| Importación | Mantiene fuente original y horas de referencia identificadas como estimadas; no transforma fechas desconocidas en fechas supuestas |

El indicador es por mantenimiento, no un indicador de utilización del personal ni una suma de disponibilidad de flota. Dos mantenimientos simultáneos pueden compartir días; no sumar sus denominadores para obtener un indicador global. Los externos y la ubicación desconocida quedan fuera del KPI de Boulogne.

## Activación sin exponer datos

1. Guardar respaldo de la base y verificar el esquema instalado. La migración presupone las tablas base del proyecto y `20260629_avances_mantenimiento.sql`. Probar en una instancia de staging con datos sintéticos.
2. Aplicar `supabase/migrations/20260927_seguimiento_integrado.sql`. Incluye validaciones de servidor, auditoría, importación transaccional, restricciones de roles y adjuntos privados. No carga datos reales.
3. Verificar con cuentas reales de supervisor, observador, inactivo y sesión anónima: lectura/escritura, perfiles y descarga de adjuntos. El módulo se bloquea si no encuentra la versión de migración.
4. Revisar también políticas de TODOS los módulos anteriores (Patio, importaciones, flota), RPC existentes y cualquier bucket distinto de `eventos-adjuntos`. Esta migración no certifica la seguridad de toda la instalación. Configurar acceso privado del despliegue y desactivar registro libre si corresponde. El repositorio de origen es público: solo código y datos sintéticos en la rama.
5. Desplegar primero la rama en preview; verificar el esquema real y los flujos completos. No usar producción como entorno de pruebas.
6. En el piloto, descargar **Respaldo JSON**. La importación definitiva queda pendiente de habilitar junto con la base; se retiró su botón de Mantenimientos para simplificar esa pantalla. El modal y el procedimiento de importación se conservan en el código. CSV no permite reconstruir fielmente todas las relaciones. Ante coincidencia con un evento viejo, completar ese evento o reconciliar manualmente antes de importar; no hay fusión automática de supuestos duplicados.
7. Comparar los mantenimientos importados con el piloto y el Archivo. Repetir la importación debe omitirlos. Conservar el piloto y su respaldo hasta verificar la equivalencia.
8. Una vez validado, integrar la rama y seleccionar el commit de producción en Vercel. Identificar la versión por commit/despliegue, no solo por el texto del pie.

La base conserva los datos; Vercel sirve la interfaz. No guardar datos de empresa en archivos del repositorio ni en variables `VITE_*` (son públicas para el navegador). El JSON descargado y los informes contienen datos: compartir únicamente la selección necesaria.

El archivo privado preparado para el piloto 21–25/9 contiene 11 mantenimientos y 21 novedades. No incluye E719 N9 ni numerales de EMEPA porque faltan fechas verificadas. E714, E709 y E718 siguen abiertos en el archivo, con su última confirmación del 25/9; la continuidad posterior se identifica con borde punteado hasta registrar un parte nuevo.

## Verificación

- `npm ci`, `npm test`, `npm run lint`, `npm run build`.
- `npm test`: casos sintéticos de cálculo y validaciones, migración SQL ejecutada con PGlite, roles, importación repetida y rollback ante error.
- `npx playwright install chromium` y `npm run test:ui`: flujo visual sintético con API simulada; no usa credenciales ni datos reales.
- La prueba SQL usa un esquema base mínimo compatible; no sustituye probar contra el esquema efectivo de Supabase ni el servicio Storage.

## Límites de esta entrega

No implementa aún transcripción de audio, WhatsApp o IA en producción. Se puede dictar en los campos con el teclado del teléfono. La clasificación y confirmación son estructuradas, sin inferencias automáticas. Tampoco calcula vencimientos por kilometraje ni recupera las tareas manuales del antiguo calendario, que solo vivían en memoria de sesión. No sustituye la programación de campañas: el calendario anterior permanece en el código para una futura integración explícita.
