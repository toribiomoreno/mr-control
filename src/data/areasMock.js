export const areasSummaryCards = [
  {
    id: 'tareas',
    icon: 'calendar',
    label: 'Tareas activas',
    note: 'Sin datos vinculados',
    value: 'Vista preliminar',
  },
  {
    id: 'revisiones',
    icon: 'clock',
    label: 'Revisiones pendientes',
    note: 'Mock centralizado',
    value: 'Proximamente',
  },
  {
    id: 'campanas',
    icon: 'flag',
    label: 'Campanas abiertas',
    note: 'Pendiente de integracion',
    value: 'Sin datos',
  },
  {
    id: 'auditorias',
    icon: 'shield',
    label: 'Auditorias del mes',
    note: 'Vista visual',
    value: 'Preliminar',
  },
];

export const areaModules = [
  {
    id: 'ingenieria',
    actionLabel: 'Ir a Ingenieria',
    description: 'Planificacion, desarrollo y gestion tecnica del material rodante.',
    icon: 'tools',
    title: 'Ingenieria',
    items: [
      {
        description: 'Planes de trabajo y cronogramas de mantenimiento.',
        icon: 'calendar',
        title: 'Planificacion tecnica',
      },
      {
        description: 'Gestion de campanas tecnicas y boletines aplicables.',
        icon: 'flag',
        title: 'Campanas',
      },
      {
        description: 'Manuales, instructivos y registros tecnicos actualizados.',
        icon: 'document',
        title: 'Documentacion',
      },
      {
        description: 'Proyectos de mejora continua y desarrollo de soluciones.',
        icon: 'trend',
        title: 'Mejoras',
      },
      {
        description: 'Resguardo y soporte de documentacion historica.',
        icon: 'archive',
        title: 'Soporte al Archivo Historico',
      },
    ],
  },
  {
    id: 'calidad',
    actionLabel: 'Ir a Calidad',
    description: 'Aseguramiento de la calidad y control del material rodante.',
    icon: 'shield',
    title: 'Calidad',
    items: [
      {
        description: 'Gestion de inspecciones y checklists.',
        icon: 'search',
        title: 'Inspecciones',
      },
      {
        description: 'Planificacion y seguimiento de auditorias.',
        icon: 'clipboard',
        title: 'Auditorias',
      },
      {
        description: 'Registro y gestion de desvios detectados.',
        icon: 'warning',
        title: 'Desvios',
      },
      {
        description: 'Seguimiento de hallazgos y acciones correctivas.',
        icon: 'alert',
        title: 'Hallazgos',
      },
      {
        description: 'Monitoreo de KPIs y tendencias de calidad.',
        icon: 'reports',
        title: 'Indicadores de calidad',
      },
    ],
  },
];
