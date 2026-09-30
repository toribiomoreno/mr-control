# Estado diario y seguimiento · 30/09/2026

Estados diarios y seguimiento mediante las tablas y permisos existentes.

## Criterios

- Casilla de estado vacía en el parte: operativa; la observación se conserva en su columna. No eliminar celdas vacías al interpretar una tabla.
- Un texto suelto junto a la unidad se considera observación. Un estado explícito no reconocido bloquea la importación para evitar una asignación arbitraria.
- Hora predeterminada: 06:00; se respeta la hora explícita del encabezado o la que confirma el usuario.
- Cada parte genera una novedad por unidad en `eventos_historial.metadata.dailyState`, con estado informado, estado coherente, fecha, hora y observación. No crea actividad de trabajo ni cierres.
- Un mantenimiento abierto conserva detenida la unidad aunque el parte informe disponibilidad. El original se conserva y se solicita verificar el cierre.
- Una detención sin mantenimiento asociado requiere completar el ingreso de una nueva intervención, sin inventar sistema, parte, personal o trabajo.
- Una salida acompañada informada en el parte consulta desde las 9 del mismo día; una salida o prueba pendiente al cierre de un mantenimiento consulta desde las 9 del día siguiente. Los avisos permanecen hasta responder y se agrupan por unidad.
- Las respuestas se guardan en el origen; si el origen es un mantenimiento, se agrega una observación del mismo mantenimiento sin sumar trabajo a la eficiencia. Una nueva falla tras un cierre deriva a completar un nuevo mantenimiento.
- El aviso en la web requiere que esté abierta. El recordatorio de ChatGPT usa información informada en la conversación, no una conexión supuesta a la base. No se implementó WhatsApp ni push del sitio.
- Histórico: novedades con estado/hora/observación visibles; libro de turno separado de estados diarios, fechas en orden descendente como el resto del archivo.
- Ficha del mantenimiento: sin el estado actual global de la locomotora; el resultado propio del mantenimiento se conserva. La causa y el reparto numérico de demoras están solo en eficiencia; las narraciones originales no se borran.
- Parque: estado actual, último parte, observaciones y el último mantenimiento registrado.

## Persistencia y validación

La importación utiliza una única inserción de las filas nuevas en `eventos_historial`, con validación de las 27 unidades y revisión de las evidencias actuales antes de guardar. La clave única de importación existente evita duplicados concurrentes. Una discrepancia para la misma unidad, fecha y hora se rechaza para revisión. La aplicación espera el guardado y conserva el modal si hay error. No requiere nuevas funciones, permisos ni triggers en producción.

El seguimiento consulta el origen nuevamente antes de guardar y usa un identificador estable por consulta. Dos respuestas concurrentes no crean dos resultados. Las respuestas usan las tablas existentes y sus controles de acceso. Una observación posterior al cierre conserva el mismo mantenimiento y no inventa actividad ni eficiencia.

El parser del libro acepta CSV con separador `;`, celdas entre comillas y multilínea, normaliza códigos de locomotora y agrupa por número/fecha/hora/unidad. La importación existente usa una clave estable, conserva notas previas y evita líneas repetidas. Los registros generales solo se asignan a una locomotora cuando la unidad o una referencia explícita la identifica. Una fecha incoherente se conserva con nota de revisión; no se cambia por suposición. El resumen de importación registra la fuente y las incidencias.

La aplicación conserva una máquina detenida mientras tenga un mantenimiento abierto. Esta coherencia se calcula también al leer el parque. Las comprobaciones de importación consultan evidencia reciente; no se añaden restricciones de base sobre las confirmaciones históricas.

Pruebas: `npm test`, `npm run lint`, `npm run build`, `npm run test:ui`. Las pruebas de base se ejecutan sobre PostgreSQL local emulado con datos sintéticos; no escriben en producción.
