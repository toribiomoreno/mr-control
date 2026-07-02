export const reportModuleTabs = [
  { id: 'campanas', icon: 'target', label: 'Cumplimiento de campanas' },
  { id: 'preventivo', icon: 'calendar', label: 'Cumplimiento preventivo' },
  { id: 'evolucion', icon: 'trend', label: 'Evolucion' },
  { id: 'indicadores', icon: 'reports', label: 'Indicadores' },
];

export const reportFiltersMock = {
  area: 'Todas',
  from: '2024-05-01',
  tipo: 'Todos',
  to: '2024-05-31',
  unidad: 'Todas',
};

export const campaignReportMock = {
  detailLabel: 'Ver detalle de campanas',
  donut: [
    { color: '#5ac45a', label: 'Finalizadas', value: 75 },
    { color: '#f4c430', label: 'En curso', value: 17 },
    { color: '#ef3340', label: 'Pendientes', value: 8 },
  ],
  metrics: [
    { label: 'Campanas visuales', value: '24' },
    { label: 'Finalizadas', value: '18' },
    { label: 'En curso', value: '4' },
    { label: 'Pendientes', value: '2' },
  ],
  subtitle: 'Avance global con datos mock',
  title: 'Cumplimiento de campanas',
  value: '76%',
};

export const preventiveReportMock = {
  detailLabel: 'Ver detalle preventivos',
  donut: [
    { color: '#5ac45a', label: 'Dentro de plazo', value: 72 },
    { color: '#ef3340', label: 'Vencidos', value: 8 },
    { color: '#f4c430', label: 'Proximos 7 dias', value: 12 },
    { color: '#94a3b8', label: 'Sin programar', value: 8 },
  ],
  legend: [
    { label: 'Planificados', value: '256' },
    { label: 'Completados', value: '210' },
    { label: 'Pendientes', value: '46' },
  ],
  subtitle: 'Preventivos planificados vs. ejecutados',
  title: 'Cumplimiento preventivo',
  value: '82%',
};

export const evolutionReportMock = {
  detailLabel: 'Ver evolucion completa',
  series: [
    { label: 'Dic', value: 62 },
    { label: 'Ene', value: 65 },
    { label: 'Feb', value: 68 },
    { label: 'Mar', value: 72 },
    { label: 'Abr', value: 75 },
    { label: 'May', value: 82 },
  ],
  subtitle: 'Cumplimiento preventivo (%)',
  title: 'Evolucion',
};

export const indicatorsReportMock = {
  detailLabel: 'Ver todos los indicadores',
  cards: [
    { delta: '+3.1%', label: 'Disponibilidad', tone: 'up', value: '92.4%' },
    { delta: '+12', label: 'Operativas', tone: 'up', value: '214' },
    { delta: '-4', label: 'Detenidas', tone: 'down', value: '18' },
    { delta: '-0.8 h', label: 'Tiempo medio de intervencion', tone: 'up', value: '6.2 h' },
  ],
  bars: [
    { label: 'Disp.', value: 92 },
    { label: 'Prev.', value: 82 },
    { label: 'Cal.', value: 76 },
    { label: 'Doc.', value: 68 },
  ],
  title: 'Indicadores',
};

export const reportTaskRowsMock = [
  {
    area: 'Ingenieria',
    estado: 'Mock',
    periodo: 'Mayo 2024',
    tarea: 'Campana tecnica A',
    unidad: 'Flota visual',
  },
  {
    area: 'Calidad',
    estado: 'Preliminar',
    periodo: 'Mayo 2024',
    tarea: 'Auditoria de proceso',
    unidad: 'Taller',
  },
  {
    area: 'Mantenimiento',
    estado: 'Sin vincular',
    periodo: 'Mayo 2024',
    tarea: 'Preventivos programados',
    unidad: 'Todas',
  },
];

export const reportLastUpdateMock = '31/05/2024 06:00 - mock visual';
