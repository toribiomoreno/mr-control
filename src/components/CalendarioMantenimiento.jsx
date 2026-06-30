import { useMemo, useState } from 'react';

import {
  buildMonthlyOccurrences,
  buildYearlyOccurrences,
  frecuenciaLabels,
  initialCalendarTasks,
  nextDateByFrequency,
} from '../data/calendarioTareas.js';

const typeLabels = {
  'preventivo-locomotora': 'Preventivo locomotora',
  'preventivo-coche': 'Preventivo coche/formacion',
  numeral: 'Numeral',
  campana: 'Campana',
  otro: 'Otro',
};

const calendarToday = '2026-06-22';
const selectedYear = '2026';
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const viewOptions = [
  ['anual', 'Vista anual'],
  ['mensual', 'Vista mensual'],
  ['semanal', 'Vista semanal'],
];
const filterOptions = [
  ['campana', 'Campanas'],
  ['numeral', 'Numerales'],
  ['preventivo', 'Preventivos'],
  ['coches', 'Coches'],
  ['locomotoras', 'Locomotoras'],
];
const preventiveTurnDurations = {
  E: 1,
  A: 2,
  AB: 3,
  ABC: 6,
};
const locomotivePreventives = ['E', 'A', 'AB', 'ABC'];
const numeralPreventives = Array.from({ length: 12 }, (_, index) => `Numeral ${index + 1}`);
const coachPreventives = ['ABC', 'RP', 'RG'];

function formatDateLabel(value) {
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
}

function monthLabel(value) {
  const [year, month] = value.split('-');
  return `${monthNames[Number(month) - 1]} ${year}`;
}

function daysForMonth(value) {
  const [year, month] = value.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const totalDays = new Date(year, month, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const days = [];

  for (let index = 0; index < leading; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  return days;
}

function taskTone(task) {
  if (task.estado === 'vencida' || task.date < calendarToday) return 'vencida';
  if (task.tipo === 'campana') return 'campana';
  if (task.tipo === 'numeral') return 'numeral';
  if (task.tipo?.startsWith('preventivo')) return 'preventivo';
  return 'otro';
}

function shortTaskLabel(task) {
  if (task.tipo === 'campana') return `Campana: ${task.descripcion.replace(/\.$/, '')}`;
  if (task.tipo === 'numeral') return task.descripcion;
  if (task.tipo === 'preventivo-locomotora') return `${task.unidad} Preventivo ${task.preventivoCodigo || task.descripcion.replace(`${task.unidad}.`, '').trim()}`;
  if (task.tipo === 'preventivo-coche') return `${task.unidad} preventivo`;
  return task.descripcion;
}

function weekRange(today = calendarToday) {
  const date = new Date(`${today}T00:00:00`);
  const day = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function historyTypeFromTask(task) {
  if (task.tipo === 'campana') return 'campana';
  if (task.tipo === 'numeral') return 'numeral';
  if (task.tipo?.startsWith('preventivo')) return 'preventivo';
  return 'otro';
}

function canCreateUnitHistory(unit) {
  return /^E\d{3}$|^77\d{2}$|^EM\d{2}$/.test(unit);
}

function isAnnualPlanning(task) {
  return task.tipo === 'campana'
    || task.tipo === 'numeral'
    || (task.nivelPlanificacion === 'anual' && !task.tipo?.startsWith('preventivo'));
}

function matchesMonthlyFilters(task, filters) {
  if (task.tipo === 'campana') return filters.campana;
  if (task.tipo === 'numeral') return filters.numeral;
  if (task.tipo?.startsWith('preventivo')) {
    if (!filters.preventivo) return false;
    if (task.tipo === 'preventivo-coche') return filters.coches;
    return filters.locomotoras;
  }
  if (task.activo?.toLowerCase().includes('coche') || task.activo?.toLowerCase().includes('formacion')) return filters.coches;
  if (task.activo?.toLowerCase().includes('locomotora')) return filters.locomotoras;
  return true;
}

export default function CalendarioMantenimiento({
  canManage = false,
  locomotoras,
  onForbidden,
  onTaskRealized,
}) {
  const [tasks, setTasks] = useState(initialCalendarTasks);
  const [viewMode, setViewMode] = useState('anual');
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [selectedAnnualMonth, setSelectedAnnualMonth] = useState('2026-06');
  const [taskFormType, setTaskFormType] = useState('preventivo');
  const [preventiveAssetType, setPreventiveAssetType] = useState('locomotora');
  const [locomotivePreventiveCode, setLocomotivePreventiveCode] = useState('E');
  const [monthlyFilters, setMonthlyFilters] = useState({
    campana: true,
    numeral: true,
    preventivo: true,
    coches: true,
    locomotoras: true,
  });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRealizationOpen, setIsRealizationOpen] = useState(false);

  const allMonthOccurrences = useMemo(() => (
    buildMonthlyOccurrences(tasks, selectedMonth)
      .sort((a, b) => a.date.localeCompare(b.date))
  ), [tasks, selectedMonth]);
  const occurrences = allMonthOccurrences.filter((task) => matchesMonthlyFilters(task, monthlyFilters));
  const yearlyOccurrences = useMemo(() => (
    buildYearlyOccurrences(tasks, selectedYear)
      .filter(isAnnualPlanning)
      .sort((a, b) => a.date.localeCompare(b.date))
  ), [tasks]);
  const selectedAnnualTasks = yearlyOccurrences.filter((task) => task.date.startsWith(selectedAnnualMonth));

  const { start, end } = weekRange();
  const weeklyTasks = allMonthOccurrences.filter((task) => task.date >= start && task.date <= end);
  const pending = occurrences.filter((task) => task.estado !== 'completada' && taskTone(task) !== 'vencida');
  const completed = occurrences.filter((task) => task.estado === 'completada');
  const expired = occurrences.filter((task) => taskTone(task) === 'vencida' && task.estado !== 'completada');
  const yearDone = tasks.filter((task) => task.estado === 'completada' && task.fechaRealizada?.startsWith('2026')).length;
  const nextTasks = occurrences.filter((task) => task.date >= calendarToday).slice(0, 5);
  const nextExpired = expired.slice(0, 4);
  const operationalTotals = locomotoras.reduce((acc, loco) => {
    if (loco.estado === 'servicio') acc.servicio += 1;
    if (loco.estado === 'preventivo') acc.preventivo += 1;
    if (loco.estado === 'correctivo') acc.correctivo += 1;
    if (loco.lavadoProgramado) acc.lavado += 1;
    return acc;
  }, { servicio: 0, preventivo: 0, correctivo: 0, lavado: 0 });

  const tasksByDay = occurrences.reduce((groups, task) => ({
    ...groups,
    [task.date]: [...(groups[task.date] || []), task],
  }), {});
  const weeklyTasksByDay = weeklyTasks.reduce((groups, task) => ({
    ...groups,
    [task.date]: [...(groups[task.date] || []), task],
  }), {});

  const addTask = (event) => {
    event.preventDefault();
    if (!canManage) {
      onForbidden?.();
      return;
    }

    const form = new FormData(event.currentTarget);
    const taskKind = form.get('taskKind');
    const preventivoActivo = form.get('preventivoActivo');
    const preventivoCodigo = preventivoActivo === 'coche' ? form.get('preventivoCocheCodigo') : form.get('preventivoLocomotoraCodigo');
    const nombreCampana = String(form.get('nombreCampana') || '').trim();
    const isNumeral = taskKind === 'preventivo' && String(preventivoCodigo).startsWith('Numeral');
    const tipo = taskKind === 'campana'
      ? 'campana'
      : taskKind === 'otro'
        ? 'otro'
        : isNumeral
          ? 'numeral'
          : preventivoActivo === 'coche'
            ? 'preventivo-coche'
            : 'preventivo-locomotora';
    const campanaActivo = form.get('campanaActivo');
    const activo = taskKind === 'campana'
      ? campanaActivo
      : taskKind === 'preventivo'
        ? preventivoActivo === 'coche' ? 'Coche' : 'Locomotora'
        : form.get('otroActivo');
    const descripcion = taskKind === 'campana'
      ? nombreCampana || 'Campana sin nombre'
      : taskKind === 'preventivo'
        ? `${isNumeral ? preventivoCodigo : `Preventivo ${preventivoCodigo}`} ${form.get('unidad')}.`
        : form.get('descripcion');
    const nivelPlanificacion = taskKind === 'campana' || isNumeral
      ? 'anual'
      : taskKind === 'preventivo'
        ? 'semanal'
        : 'mensual';
    const task = {
      id: `task-${Date.now()}`,
      tipo,
      nivelPlanificacion,
      activo,
      unidad: taskKind === 'campana' ? campanaActivo : form.get('unidad'),
      fechaProgramada: form.get('fechaProgramada'),
      fechaFin: taskKind === 'campana' ? '' : form.get('fechaFin'),
      preventivoCodigo,
      turno: form.get('turno'),
      duracionTurnos: tipo === 'preventivo-locomotora' ? preventiveTurnDurations[preventivoCodigo] : '',
      duracionTarea: taskKind === 'campana' ? form.get('duracionTarea') : '',
      frecuencia: taskKind === 'campana' ? form.get('frecuencia') : 'unica',
      responsable: taskKind === 'otro' ? form.get('responsable') : 'Planificacion MR',
      especialidad: form.get('especialidad') || 'General',
      descripcion,
      observaciones: taskKind === 'otro' ? form.get('observaciones') : '',
      estado: form.get('fechaProgramada') < calendarToday ? 'vencida' : 'pendiente',
    };

    setTasks((current) => [task, ...current]);
    setIsTaskModalOpen(false);
  };

  const registerRealization = (event) => {
    event.preventDefault();
    if (!canManage) {
      onForbidden?.();
      return;
    }

    const form = new FormData(event.currentTarget);
    const task = tasks.find((item) => item.id === form.get('taskId'));
    if (!task) return;

    const realizedDate = form.get('fechaRealizada');
    const realizedUnits = String(form.get('unidadesRealizadas') || task.unidad).split(',').map((unit) => unit.trim()).filter(Boolean);
    const responsible = form.get('responsable');
    const observations = form.get('observaciones');

    setTasks((current) => current.map((item) => (
      item.id === task.id
        ? {
          ...item,
          estado: 'completada',
          fechaRealizada: realizedDate,
          proximaFecha: item.frecuencia === 'unica' ? '' : nextDateByFrequency(realizedDate, item.frecuencia),
        }
        : item
    )));

    realizedUnits.filter(canCreateUnitHistory).forEach((unit) => {
      onTaskRealized?.({
        id: `${unit}-cal-${Date.now()}`,
        locomotoraCodigo: unit,
        fecha: realizedDate,
        hora: '08:00',
        tipo: historyTypeFromTask(task),
        especialidad: task.especialidad,
        titulo: shortTaskLabel(task),
        descripcion: `${task.descripcion}${observations ? ` Observaciones: ${observations}` : ''}`,
        responsable: responsible,
        origen: 'calendario',
        automatico: false,
        adjuntos: [],
        tags: ['calendario'],
        criticidad: 'media',
      });
    });

    setIsRealizationOpen(false);
  };

  return (
    <main className="calendar-workspace">
      <section className="calendar-main-panel">
        <header className="calendar-header">
          <div>
            <p className="eyebrow">Planificacion Material Rodante</p>
            <h2>Calendario de Mantenimiento</h2>
            <p>Planificacion y seguimiento de preventivos, numerales y campanas tecnicas.</p>
          </div>
          <div className="calendar-header-actions">
            <input
              aria-label="Mes seleccionado"
              onChange={(event) => setSelectedMonth(event.target.value)}
              type="month"
              value={selectedMonth}
            />
            {canManage && (
              <button className="history-register-button" onClick={() => setIsTaskModalOpen(true)} type="button">Nueva tarea</button>
            )}
          </div>
        </header>

        <section className="calendar-view-selector" aria-label="Selector de vista del calendario">
          {viewOptions.map(([value, label]) => (
            <button
              className={viewMode === value ? 'active' : ''}
              key={value}
              onClick={() => setViewMode(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </section>

        <section className="calendar-kpis">
          <article><span>Tareas programadas este mes</span><strong>{occurrences.length}</strong></article>
          <article><span>Pendientes</span><strong>{pending.length}</strong></article>
          <article><span>Completadas</span><strong>{completed.length}</strong></article>
          <article><span>Vencidas</span><strong>{expired.length}</strong></article>
          <article><span>Tareas realizadas este ano</span><strong>{yearDone}</strong></article>
        </section>

                {viewMode === 'anual' && (
          <section className="annual-planning">
            <div className="calendar-section-heading">
              <h3>Planificacion anual {selectedYear}</h3>
              <span>Campanas, numerales y tareas de largo plazo</span>
            </div>
            <div className="annual-month-grid">
              {monthNames.map((name, index) => {
                const month = `${selectedYear}-${String(index + 1).padStart(2, '0')}`;
                const monthTasks = yearlyOccurrences.filter((task) => task.date.startsWith(month));
                const campanas = monthTasks.filter((task) => task.tipo === 'campana').length;
                const numerales = monthTasks.filter((task) => task.tipo === 'numeral').length;
                const vencidas = monthTasks.filter((task) => taskTone(task) === 'vencida').length;
                const completedCount = monthTasks.filter((task) => task.estado === 'completada').length;
                return (
                  <button className={`annual-month-card ${selectedAnnualMonth === month ? 'active' : ''} ${vencidas ? 'has-expired' : ''}`} key={month} onClick={() => setSelectedAnnualMonth(month)} type="button">
                    <strong>{name}</strong>
                    <span>{campanas} campanas</span>
                    <span>{numerales} numerales</span>
                    <em>{vencidas ? `${vencidas} vencidas` : completedCount === monthTasks.length && monthTasks.length ? 'Completo' : 'En plan'}</em>
                  </button>
                );
              })}
            </div>
            <div className="annual-month-detail">
              <div><h3>{monthLabel(selectedAnnualMonth)}</h3><span>{selectedAnnualTasks.length} tareas de plan anual</span></div>
              <div className="calendar-list">
                {selectedAnnualTasks.map((task) => (
                  <article className={taskTone(task)} key={task.occurrenceId}>
                    <time>{formatDateLabel(task.date)}</time>
                    <strong>{shortTaskLabel(task)}</strong>
                    <span>{task.responsable} - {frecuenciaLabels[task.frecuencia]}</span>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {viewMode === 'mensual' && (
          <section className="maintenance-month">
            <div className="calendar-section-heading">
              <h3>{monthLabel(selectedMonth)}</h3>
              <div className="calendar-filter-row">
                {filterOptions.map(([key, label]) => (
                  <label key={key}><input checked={monthlyFilters[key]} onChange={() => setMonthlyFilters((current) => ({ ...current, [key]: !current[key] }))} type="checkbox" />{label}</label>
                ))}
              </div>
            </div>
            <div className="month-grid weekdays">{['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="month-grid">
              {daysForMonth(selectedMonth).map((day, index) => (
                <div className={`month-day ${day ? '' : 'is-empty'} ${day === calendarToday ? 'is-today' : ''}`} key={day || `empty-${index}`}>
                  {day && <><strong>{Number(day.slice(-2))}</strong><div className="month-day-tasks">{(tasksByDay[day] || []).slice(0, 3).map((task) => <span className={taskTone(task)} key={task.occurrenceId}>{shortTaskLabel(task)}</span>)}{(tasksByDay[day] || []).length > 3 && <em>+{tasksByDay[day].length - 3}</em>}</div></>}
                </div>
              ))}
            </div>
          </section>
        )}

        {viewMode === 'semanal' && (
          <section className="weekly-agenda">
            <div className="calendar-section-heading"><h3>Vista semanal operativa</h3><span>{formatDateLabel(start)} al {formatDateLabel(end)}</span></div>
            <div className="week-column-grid">
              {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'].map((dayName, index) => {
                const date = new Date(`${start}T00:00:00`);
                date.setDate(date.getDate() + index);
                const value = date.toISOString().slice(0, 10);
                const dayTasks = weeklyTasksByDay[value] || [];
                return <section className="week-column" key={dayName}><header><strong>{dayName}</strong><span>{formatDateLabel(value)}</span></header>{dayTasks.map((task) => <article className={taskTone(task)} key={task.occurrenceId}><strong>{shortTaskLabel(task)}</strong><span>{typeLabels[task.tipo]} - {task.activo}</span></article>)}{dayTasks.length === 0 && <p>Sin programacion</p>}</section>;
              })}
            </div>
          </section>
        )}

      </section>

      <aside className="calendar-side-panel">
        <div>
          <span className="panel-kicker">Resumen del mes</span>
          <h3>{monthLabel(selectedMonth)}</h3>
          <p>{occurrences.length} tareas planificadas, {expired.length} vencidas y {pending.length} pendientes.</p>
        </div>

        <section>
          <h4>Estado actual del dia</h4>
          <div className="calendar-status-grid">
            <article><b className="servicio" /><span>Servicio</span><small>{operationalTotals.servicio}</small></article>
            <article><b className="preventivo" /><span>Preventivo</span><small>{operationalTotals.preventivo}</small></article>
            <article><b className="correctivo" /><span>Correctivo</span><small>{operationalTotals.correctivo}</small></article>
            <article><b className="lavado" /><span>Lavado</span><small>{operationalTotals.lavado}</small></article>
          </div>
        </section>

        <section>
          <h4>Proximas tareas</h4>
          {nextTasks.map((task) => (
            <article key={`next-${task.occurrenceId}`}>
              <b className={taskTone(task)} />
              <span>{shortTaskLabel(task)}</span>
              <small>{formatDateLabel(task.date)}</small>
            </article>
          ))}
        </section>

        <section>
          <h4>Proximas vencidas</h4>
          {nextExpired.length > 0 ? nextExpired.map((task) => (
            <article key={`expired-${task.occurrenceId}`}>
              <b className="vencida" />
              <span>{shortTaskLabel(task)}</span>
              <small>{formatDateLabel(task.date)}</small>
            </article>
          )) : <p>Sin vencidas abiertas.</p>}
        </section>

        {canManage && (
          <section className="calendar-quick-actions">
            <h4>Acciones rapidas</h4>
            <button onClick={() => setIsTaskModalOpen(true)} type="button">Nueva tarea</button>
            <button onClick={() => setIsRealizationOpen(true)} type="button">Registrar realizacion</button>
            <button type="button">Importar planificacion</button>
          </section>
        )}
      </aside>

      {isTaskModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="intervention-modal calendar-modal" onSubmit={addTask}>
            <div className="modal-heading">
              <div>
                <span className="panel-kicker">Planificacion</span>
                <h2>Nueva tarea</h2>
              </div>
              <button className="modal-close" onClick={() => setIsTaskModalOpen(false)} type="button" aria-label="Cerrar">x</button>
            </div>
            <label>Tipo de tarea<select name="taskKind" value={taskFormType} onChange={(event) => setTaskFormType(event.target.value)} required><option value="preventivo">Preventivo</option><option value="campana">Campana</option><option value="otro">Otro</option></select></label>

            {taskFormType === 'preventivo' && (
              <>
                <label>Preventivo de<select name="preventivoActivo" value={preventiveAssetType} onChange={(event) => setPreventiveAssetType(event.target.value)} required><option value="locomotora">Locomotora</option><option value="coche">Coche</option></select></label>
                {preventiveAssetType === 'locomotora' && (
                  <label>Tipo de preventivo locomotora<select name="preventivoLocomotoraCodigo" value={locomotivePreventiveCode} onChange={(event) => setLocomotivePreventiveCode(event.target.value)}>
                    {locomotivePreventives.map((code) => <option key={code} value={code}>{code} - {preventiveTurnDurations[code]} {preventiveTurnDurations[code] === 1 ? 'turno' : 'turnos'}</option>)}
                    {numeralPreventives.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select></label>
                )}
                {preventiveAssetType === 'coche' && (
                  <label>Tipo de preventivo coche<select name="preventivoCocheCodigo" defaultValue="ABC">{coachPreventives.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
                )}
                {preventiveAssetType === 'locomotora' && locomotivePreventives.includes(locomotivePreventiveCode) && (
                  <label>Turno<select name="turno" defaultValue="manana"><option value="manana">Turno manana 06 a 14</option><option value="tarde">Turno tarde 14 a 22</option></select></label>
                )}
              </>
            )}

            {taskFormType === 'campana' && (
              <>
                <label>Campana para<select name="campanaActivo" defaultValue="Locomotoras" required><option>Locomotoras</option><option>Coches / formaciones</option></select></label>
                <label>Nombre de la campana<input name="nombreCampana" placeholder="Ej: Lubricacion de puentes de paso" required /></label>
                <label>Duracion de la tarea<select name="duracionTarea" defaultValue="3-dias" required><option value="3-dias">3 dias</option><option value="5-dias">5 dias</option><option value="1-semana">1 semana</option></select></label>
                <label>Frecuencia<select name="frecuencia" defaultValue="unica" required><option value="unica">Unica vez</option><option value="semanal">Semanal</option><option value="quincenal">Cada 2 semanas</option><option value="mensual">Mensual</option><option value="trimestral">Trimestral</option><option value="semestral">Cada 6 meses</option><option value="anual">Anual</option></select></label>
              </>
            )}

            {taskFormType === 'otro' && (
              <label>Activo / alcance<input name="otroActivo" placeholder="Locomotora, coche, grupo o flota" /></label>
            )}

            {taskFormType !== 'campana' && (
              <label>Unidad o rango<input name="unidad" list="calendar-units" placeholder="E701, E701-E715, Toda la flota..." required /></label>
            )}
            <datalist id="calendar-units">
              {locomotoras.map((loco) => <option key={loco.codigo} value={loco.codigo} />)}
              <option value="E701-E715" />
              <option value="Todas las locomotoras" />
              <option value="Toda la flota de coches" />
            </datalist>
            <label>Fecha de inicio / programada<input name="fechaProgramada" type="date" defaultValue={calendarToday} required /></label>
            {taskFormType !== 'campana' && (
              <label>Fecha de fin <input name="fechaFin" type="date" /></label>
            )}
            {taskFormType === 'otro' && (
              <label>Responsable<input name="responsable" placeholder="Turno fijo, MR Coches, Planificacion..." required /></label>
            )}
            {taskFormType !== 'campana' && (
              <label>Especialidad<select name="especialidad" defaultValue="General"><option>Mecanica</option><option>Electrica</option><option>Neumatica</option><option>General</option></select></label>
            )}
            <label>Descripcion<textarea name="descripcion" rows="4" placeholder={taskFormType === 'campana' ? 'Descripcion de la campana' : 'Detalle opcional'} /></label>
            {taskFormType === 'otro' && (
              <label>Observaciones<textarea name="observaciones" rows="3" /></label>
            )}
            <div className="modal-actions">
              <button className="secondary-action" onClick={() => setIsTaskModalOpen(false)} type="button">Cancelar</button>
              <button className="primary-action" type="submit">Guardar tarea</button>
            </div>
          </form>
        </div>
      )}

      {isRealizationOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="intervention-modal calendar-modal" onSubmit={registerRealization}>
            <div className="modal-heading">
              <div>
                <span className="panel-kicker">Ejecucion</span>
                <h2>Registrar realizacion</h2>
              </div>
              <button className="modal-close" onClick={() => setIsRealizationOpen(false)} type="button" aria-label="Cerrar">x</button>
            </div>
            <label>Tarea / campana<select name="taskId" required>{tasks.map((task) => <option key={task.id} value={task.id}>{shortTaskLabel(task)}</option>)}</select></label>
            <label>Fecha realizada<input name="fechaRealizada" type="date" defaultValue={calendarToday} required /></label>
            <label>Unidad o unidades realizadas<input name="unidadesRealizadas" placeholder="E701 o E701, E702" required /></label>
            <label>Responsable<input name="responsable" placeholder="Responsable de ejecucion" required /></label>
            <label>Observaciones<textarea name="observaciones" rows="4" /></label>
            <div className="history-modal-note">Este formulario no carga adjuntos. Los PDF, fotos u OT se agregan desde Registrar evento en Archivo Historico.</div>
            <div className="modal-actions">
              <button className="secondary-action" onClick={() => setIsRealizationOpen(false)} type="button">Cancelar</button>
              <button className="primary-action" type="submit">Registrar realizacion</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
