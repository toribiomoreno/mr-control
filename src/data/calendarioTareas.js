export const frecuenciaLabels = {
  unica: 'Unica',
  semanal: 'Semanal',
  quincenal: 'Cada 2 semanas',
  mensual: 'Mensual',
  bimestral: 'Cada 2 meses',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export const initialCalendarTasks = [
  {
    id: 'camp-puentes-paso',
    tipo: 'campana',
    nivelPlanificacion: 'anual',
    activo: 'Coches / formaciones',
    unidad: 'Toda la flota de coches',
    fechaProgramada: '2026-06-24',
    frecuencia: 'bimestral',
    responsable: 'MR Coches',
    especialidad: 'Mecanica',
    descripcion: 'Lubricacion de puentes de paso de coches.',
    observaciones: 'Campana periodica de coches y formaciones.',
    estado: 'pendiente',
  },
  {
    id: 'camp-mandibulas',
    tipo: 'campana',
    nivelPlanificacion: 'anual',
    activo: 'Locomotoras',
    unidad: 'Todas las locomotoras',
    fechaProgramada: '2026-06-25',
    frecuencia: 'quincenal',
    responsable: 'Turno rotativo',
    especialidad: 'Mecanica',
    descripcion: 'Lubricacion de tracciones y elementos moviles de mandibulas de todas las locomotoras.',
    observaciones: 'Planificar por disponibilidad de patio.',
    estado: 'pendiente',
  },
  {
    id: 'camp-rodamientos',
    tipo: 'campana',
    nivelPlanificacion: 'anual',
    activo: 'Locomotoras',
    unidad: 'Todas las locomotoras',
    fechaProgramada: '2026-06-23',
    frecuencia: 'semanal',
    responsable: 'Turno fijo',
    especialidad: 'Mecanica',
    descripcion: 'Revision semanal de temperatura de rodamientos en todas las locomotoras.',
    observaciones: 'Registrar desvíos relevantes en Archivo Historico.',
    estado: 'pendiente',
  },
  {
    id: 'prev-e703-a',
    tipo: 'preventivo-locomotora',
    nivelPlanificacion: 'semanal',
    activo: 'Locomotora',
    unidad: 'E703',
    fechaProgramada: '2026-06-22',
    turno: 'manana',
    preventivoCodigo: 'A',
    duracionTurnos: 2,
    frecuencia: 'unica',
    responsable: 'Turno rotativo',
    especialidad: 'Mecanica',
    descripcion: 'Preventivo A E703.',
    observaciones: '',
    estado: 'pendiente',
  },
  {
    id: 'prev-e710-ab',
    tipo: 'preventivo-locomotora',
    nivelPlanificacion: 'semanal',
    activo: 'Locomotora',
    unidad: 'E710',
    fechaProgramada: '2026-06-26',
    turno: 'tarde',
    preventivoCodigo: 'AB',
    duracionTurnos: 3,
    frecuencia: 'unica',
    responsable: 'Turno fijo',
    especialidad: 'General',
    descripcion: 'Preventivo AB E710.',
    observaciones: '',
    estado: 'pendiente',
  },
  {
    id: 'prev-e719-e',
    tipo: 'preventivo-locomotora',
    nivelPlanificacion: 'semanal',
    activo: 'Locomotora',
    unidad: 'E719',
    fechaProgramada: '2026-06-28',
    turno: 'manana',
    preventivoCodigo: 'E',
    duracionTurnos: 1,
    frecuencia: 'unica',
    responsable: 'Turno rotativo',
    especialidad: 'Mecanica',
    descripcion: 'Preventivo E E719.',
    observaciones: '',
    estado: 'pendiente',
  },
  {
    id: 'num-e701-e715',
    tipo: 'numeral',
    nivelPlanificacion: 'anual',
    activo: 'Grupo seleccionado',
    unidad: 'E701-E715',
    fechaProgramada: '2026-06-27',
    fechaFin: '2026-08-30',
    frecuencia: 'unica',
    responsable: 'Planificacion MR',
    especialidad: 'General',
    descripcion: 'Numeral 8 E701-E715.',
    observaciones: 'Carga semanal mock.',
    estado: 'pendiente',
  },
  {
    id: 'formacion-um-3',
    tipo: 'preventivo-coche',
    nivelPlanificacion: 'semanal',
    activo: 'Formacion',
    unidad: 'Formacion UM 3',
    fechaProgramada: '2026-06-20',
    frecuencia: 'unica',
    responsable: 'MR Coches',
    especialidad: 'Neumatica',
    descripcion: 'Preventivo de coches/formacion UM 3.',
    observaciones: '',
    estado: 'vencida',
  },
  {
    id: 'num-externo-7774',
    tipo: 'numeral',
    nivelPlanificacion: 'anual',
    activo: 'Locomotora',
    unidad: '7774',
    fechaProgramada: '2026-09-15',
    fechaFin: '2026-11-15',
    frecuencia: 'unica',
    responsable: 'Planificacion MR',
    especialidad: 'General',
    descripcion: 'Numeral externo 7774.',
    observaciones: 'Plan anual.',
    estado: 'pendiente',
  },
  {
    id: 'num-liviano-em01',
    tipo: 'numeral',
    nivelPlanificacion: 'anual',
    activo: 'Locomotora',
    unidad: 'EM01',
    fechaProgramada: '2026-11-04',
    fechaFin: '2026-12-15',
    frecuencia: 'unica',
    responsable: 'Planificacion MR',
    especialidad: 'General',
    descripcion: 'Numeral liviano EM01.',
    observaciones: 'Plan anual.',
    estado: 'pendiente',
  },
];

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function nextDateByFrequency(value, frequency) {
  const base = new Date(`${value}T00:00:00`);
  if (frequency === 'semanal') return formatDate(addDays(base, 7));
  if (frequency === 'quincenal') return formatDate(addDays(base, 14));
  if (frequency === 'mensual') return formatDate(addMonths(base, 1));
  if (frequency === 'bimestral') return formatDate(addMonths(base, 2));
  if (frequency === 'trimestral') return formatDate(addMonths(base, 3));
  if (frequency === 'semestral') return formatDate(addMonths(base, 6));
  if (frequency === 'anual') return formatDate(addMonths(base, 12));
  return value;
}

export function buildMonthlyOccurrences(tasks, selectedMonth) {
  const monthStart = new Date(`${selectedMonth}-01T00:00:00`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  return tasks.flatMap((task) => {
    if (task.fechaFin) {
      const start = new Date(`${task.fechaProgramada}T00:00:00`);
      const end = new Date(`${task.fechaFin}T00:00:00`);
      if (start < monthEnd && end >= monthStart) {
        const visibleDate = start > monthStart ? task.fechaProgramada : `${selectedMonth}-01`;
        return [{ ...task, occurrenceId: `${task.id}-${selectedMonth}`, date: visibleDate }];
      }
      return [];
    }

    const occurrences = [];
    let date = task.fechaProgramada;
    let guard = 0;

    while (date && guard < 24) {
      const current = new Date(`${date}T00:00:00`);
      if (current >= monthStart && current < monthEnd) {
        occurrences.push({ ...task, occurrenceId: `${task.id}-${date}`, date });
      }

      if (task.frecuencia === 'unica' || current >= monthEnd) break;
      date = nextDateByFrequency(date, task.frecuencia);
      guard += 1;
    }

    return occurrences;
  });
}

export function buildYearlyOccurrences(tasks, selectedYear) {
  return Array.from({ length: 12 }, (_, index) => `${selectedYear}-${String(index + 1).padStart(2, '0')}`)
    .flatMap((month) => buildMonthlyOccurrences(tasks, month));
}
