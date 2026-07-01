import { useMemo, useState } from 'react';

import {
  buildOccurrences,
  calendarActivitySource,
  initialCalendarActivities,
  monthBounds,
  preventiveTurnDurations,
  recurrenceLabels,
  yearBounds,
} from '../data/calendarioTareas.js';

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const weekDays = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const viewOptions = [
  ['anual', 'Vista anual'],
  ['mensual', 'Vista mensual'],
  ['semanal', 'Vista semanal'],
];
const preventiveCodes = Object.keys(preventiveTurnDurations);
const activityLabels = {
  preventivo: 'Preventivo',
  numeral: 'Preventivo numeral',
  correctivo: 'Correctivo',
  campana: 'Campana',
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
}

function monthValue(date) {
  return date.toISOString().slice(0, 7);
}

function monthLabel(value) {
  const [year, month] = value.split('-');
  return `${monthNames[Number(month) - 1]} ${year}`;
}

function addMonths(value, amount) {
  const date = new Date(`${value}-01T00:00:00`);
  date.setMonth(date.getMonth() + amount);
  return monthValue(date);
}

function addYears(value, amount) {
  return String(Number(value) + amount);
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function weekStart(value) {
  const date = new Date(`${value}T00:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

function daysForMonth(value) {
  const [year, month] = value.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const totalDays = new Date(year, month, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const days = [];

  for (let index = 0; index < leading; index += 1) days.push(null);
  for (let day = 1; day <= totalDays; day += 1) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  return days;
}

function activityTone(activity) {
  if (activity.type === 'preventivo') return 'preventivo';
  if (activity.type === 'numeral') return 'numeral';
  if (activity.type === 'correctivo') return 'correctivo';
  if (activity.type === 'campana') return 'campana';
  return 'otro';
}

function activityTitle(activity) {
  if (activity.type === 'preventivo') return `${activity.unit} · Preventivo ${activity.preventiveCode}`;
  if (activity.type === 'numeral') return `${activity.unit} · ${activity.numeral}`;
  if (activity.type === 'correctivo') return `${activity.unit} · Correctivo`;
  return activity.name;
}

function activityMeta(activity) {
  if (activity.type === 'preventivo') return `${activity.durationTurns} ${activity.durationTurns === 1 ? 'turno' : 'turnos'}`;
  if (activity.type === 'numeral') return `${formatDateLabel(activity.startDate)} al ${formatDateLabel(activity.endDate)}`;
  if (activity.type === 'correctivo') return activity.origin === 'patio' ? 'Origen Patio · solo lectura' : `Desde ${formatDateLabel(activity.startDate)}${activity.endDate ? ` al ${formatDateLabel(activity.endDate)}` : ''}`;
  return `${recurrenceLabels[activity.recurrence]} · ${activity.scope}`;
}

function buildPatioCorrectives(locomotoras, today) {
  return locomotoras
    .filter((loco) => loco.estado === 'correctivo')
    .map((loco) => ({
      id: `patio-correctivo-${loco.codigo}`,
      type: 'correctivo',
      origin: 'patio',
      readOnly: true,
      unit: loco.codigo,
      description: loco.observacion || 'Correctivo en curso desde Patio',
      startDate: today,
      endDate: today,
    }));
}

function summarizeOccurrences(occurrences) {
  const counts = {
    preventivo: 0,
    numeral: new Set(),
    correctivo: new Set(),
    campana: 0,
  };

  occurrences.forEach((occurrence) => {
    if (occurrence.type === 'preventivo') counts.preventivo += 1;
    if (occurrence.type === 'numeral') counts.numeral.add(occurrence.id);
    if (occurrence.type === 'correctivo') counts.correctivo.add(occurrence.id);
    if (occurrence.type === 'campana') counts.campana += 1;
  });

  return [
    ['preventivo', counts.preventivo, 'preventivos'],
    ['numeral', counts.numeral.size, 'numerales'],
    ['correctivo', counts.correctivo.size, 'correctivos'],
    ['campana', counts.campana, 'campanas'],
  ].filter(([, count]) => count > 0);
}

function activitiesForMonth(activities, month) {
  const { start, end } = monthBounds(month);
  return buildOccurrences(activities, start, end);
}

function defaultFormState(today) {
  return {
    kind: 'preventivo',
    preventiveCode: 'E',
    unit: '',
    numeral: '',
    name: '',
    description: '',
    scope: 'Toda la flota',
    recurrence: 'unica',
    startDate: today,
    endDate: '',
  };
}

export default function CalendarioMantenimiento({
  canManage = false,
  locomotoras,
  onForbidden,
}) {
  const today = todayValue();
  const [manualActivities, setManualActivities] = useState(initialCalendarActivities);
  const [viewMode, setViewMode] = useState('mensual');
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedWeekStart, setSelectedWeekStart] = useState(weekStart(today));
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [formState, setFormState] = useState(() => defaultFormState(today));

  const patioCorrectives = useMemo(() => buildPatioCorrectives(locomotoras, today), [locomotoras, today]);
  const activities = useMemo(() => [...manualActivities, ...patioCorrectives], [manualActivities, patioCorrectives]);
  const unitCodes = useMemo(() => locomotoras.map((loco) => loco.codigo), [locomotoras]);

  const yearOccurrences = useMemo(() => {
    const { start, end } = yearBounds(selectedYear);
    return buildOccurrences(activities, start, end);
  }, [activities, selectedYear]);
  const { start: monthStart, end: monthEnd } = monthBounds(selectedMonth);
  const monthOccurrences = useMemo(() => buildOccurrences(activities, monthStart, monthEnd), [activities, monthEnd, monthStart]);
  const weekEnd = addDays(selectedWeekStart, 6);
  const weekOccurrences = useMemo(() => buildOccurrences(activities, selectedWeekStart, weekEnd), [activities, selectedWeekStart, weekEnd]);

  const monthTasksByDay = monthOccurrences.reduce((groups, task) => ({
    ...groups,
    [task.date]: [...(groups[task.date] || []), task],
  }), {});
  const weekTasksByDay = weekOccurrences.reduce((groups, task) => ({
    ...groups,
    [task.date]: [...(groups[task.date] || []), task],
  }), {});

  const openTaskModal = (date = today) => {
    if (!canManage) {
      onForbidden?.();
      return;
    }
    setEditingActivity(null);
    setFormState({ ...defaultFormState(today), startDate: date });
    setIsTaskModalOpen(true);
  };

  const openEditModal = (activity) => {
    if (!canManage || activity.readOnly) {
      onForbidden?.();
      return;
    }
    setEditingActivity(activity);
    setFormState({
      kind: activity.type === 'numeral' ? 'preventivo' : activity.type,
      preventiveCode: activity.type === 'numeral' ? 'Numeral' : activity.preventiveCode || 'E',
      unit: activity.unit || '',
      numeral: activity.numeral || '',
      name: activity.name || '',
      description: activity.description || '',
      scope: activity.scope || 'Toda la flota',
      recurrence: activity.recurrence || 'unica',
      startDate: activity.startDate || today,
      endDate: activity.endDate || '',
    });
    setIsTaskModalOpen(true);
  };

  const saveActivity = (event) => {
    event.preventDefault();
    if (!canManage) {
      onForbidden?.();
      return;
    }

    const form = new FormData(event.currentTarget);
    const kind = form.get('kind');
    const preventiveCode = form.get('preventiveCode');
    const unit = form.get('unit');
    const base = {
      id: editingActivity?.id || `calendar-${Date.now()}`,
      origin: 'manual',
      readOnly: false,
      unit,
      startDate: form.get('startDate'),
    };
    let nextActivity;

    if (kind === 'preventivo' && preventiveCode !== 'Numeral') {
      nextActivity = {
        ...base,
        type: 'preventivo',
        preventiveCode,
        durationTurns: preventiveTurnDurations[preventiveCode],
        description: `Preventivo ${preventiveCode}`,
      };
    }

    if (kind === 'preventivo' && preventiveCode === 'Numeral') {
      nextActivity = {
        ...base,
        type: 'numeral',
        numeral: String(form.get('numeral') || '').trim(),
        endDate: form.get('endDate'),
        description: String(form.get('numeral') || '').trim(),
      };
    }

    if (kind === 'correctivo') {
      nextActivity = {
        ...base,
        type: 'correctivo',
        description: String(form.get('description') || '').trim(),
        endDate: form.get('endDate') || '',
      };
    }

    if (kind === 'campana') {
      nextActivity = {
        id: editingActivity?.id || `calendar-${Date.now()}`,
        type: 'campana',
        origin: 'manual',
        readOnly: false,
        unit: String(form.get('scope') || '').trim(),
        name: String(form.get('name') || '').trim(),
        description: String(form.get('description') || '').trim(),
        scope: String(form.get('scope') || '').trim(),
        recurrence: form.get('recurrence'),
        startDate: form.get('startDate'),
      };
    }

    if (!nextActivity) return;

    setManualActivities((current) => (
      editingActivity
        ? current.map((activity) => (activity.id === editingActivity.id ? nextActivity : activity))
        : [nextActivity, ...current]
    ));
    setSelectedOccurrence(nextActivity);
    setIsTaskModalOpen(false);
  };

  const deleteActivity = (activity) => {
    if (!canManage || activity.readOnly) {
      onForbidden?.();
      return;
    }
    setManualActivities((current) => current.filter((item) => item.id !== activity.id));
    setSelectedOccurrence(null);
  };

  const changeView = (nextView) => {
    setViewMode(nextView);
    if (nextView === 'anual') setSelectedYear(selectedMonth.slice(0, 4));
    if (nextView === 'semanal') setSelectedWeekStart(weekStart(`${selectedMonth}-01`));
  };

  return (
    <main className="calendar-workspace">
      <section className="calendar-main-panel">
        <header className="calendar-header">
          <div>
            <p className="eyebrow">Planificacion Material Rodante</p>
            <h2>Calendario de Mantenimiento</h2>
            <p>Preventivos programados, numerales, correctivos en curso y campanas tecnicas.</p>
          </div>
          {canManage && (
            <button className="history-register-button" onClick={() => openTaskModal()} type="button">
              Nueva tarea
            </button>
          )}
        </header>

        <section className="calendar-view-selector" aria-label="Selector de vista del calendario">
          {viewOptions.map(([value, label]) => (
            <button
              className={viewMode === value ? 'active' : ''}
              key={value}
              onClick={() => changeView(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </section>

        <section className="calendar-period-nav" aria-label="Navegacion del periodo">
          {viewMode === 'anual' && (
            <>
              <button onClick={() => setSelectedYear((current) => addYears(current, -1))} type="button">Anterior</button>
              <strong>{selectedYear}</strong>
              <button onClick={() => setSelectedYear((current) => addYears(current, 1))} type="button">Siguiente</button>
            </>
          )}
          {viewMode === 'mensual' && (
            <>
              <button onClick={() => setSelectedMonth((current) => addMonths(current, -1))} type="button">Anterior</button>
              <input aria-label="Mes seleccionado" onChange={(event) => setSelectedMonth(event.target.value)} type="month" value={selectedMonth} />
              <button onClick={() => setSelectedMonth((current) => addMonths(current, 1))} type="button">Siguiente</button>
            </>
          )}
          {viewMode === 'semanal' && (
            <>
              <button onClick={() => setSelectedWeekStart((current) => addDays(current, -7))} type="button">Anterior</button>
              <strong>{formatDateLabel(selectedWeekStart)} al {formatDateLabel(weekEnd)}</strong>
              <button onClick={() => setSelectedWeekStart((current) => addDays(current, 7))} type="button">Siguiente</button>
            </>
          )}
        </section>

        {viewMode === 'anual' && (
          <section className="annual-planning">
            <div className="calendar-section-heading">
              <h3 className="calendar-view-title calendar-view-title-year">Planificacion anual {selectedYear}</h3>
              <span>{yearOccurrences.length ? `${yearOccurrences.length} ocurrencias visibles` : 'No hay actividades programadas para este periodo.'}</span>
            </div>
            <div className="annual-month-grid">
              {monthNames.map((name, index) => {
                const month = `${selectedYear}-${String(index + 1).padStart(2, '0')}`;
                const summary = summarizeOccurrences(activitiesForMonth(activities, month));
                return (
                  <button
                    className="annual-month-card"
                    key={month}
                    onClick={() => {
                      setSelectedMonth(month);
                      setViewMode('mensual');
                    }}
                    type="button"
                  >
                    <strong>{name}</strong>
                    {summary.length > 0 ? summary.map(([tone, count, label]) => (
                      <span className={tone} key={tone}>{count} {label}</span>
                    )) : <em>No hay actividades</em>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {viewMode === 'mensual' && (
          <section className="maintenance-month">
            <div className="calendar-section-heading">
              <h3 className="calendar-view-title calendar-view-title-month">{monthLabel(selectedMonth)}</h3>
              <div className="calendar-legend">
                <span className="preventivo">Preventivos</span>
                <span className="numeral">Numerales</span>
                <span className="correctivo">Correctivos</span>
                <span className="campana">Campanas</span>
              </div>
            </div>
            <div className="month-grid weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="month-grid">
              {daysForMonth(selectedMonth).map((day, index) => (
                <div className={`month-day ${day ? '' : 'is-empty'} ${day === today ? 'is-today' : ''}`} key={day || `empty-${index}`}>
                  {day && (
                    <>
                      <button className="month-day-number" onClick={() => openTaskModal(day)} type="button">{Number(day.slice(-2))}</button>
                      <div className="month-day-tasks">
                        {(monthTasksByDay[day] || []).slice(0, 5).map((task) => (
                          <button className={activityTone(task)} key={task.occurrenceId} onClick={() => setSelectedOccurrence(task)} type="button">
                            {activityTitle(task)}
                          </button>
                        ))}
                        {(monthTasksByDay[day] || []).length > 5 && <em>+{monthTasksByDay[day].length - 5}</em>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {monthOccurrences.length === 0 && <p className="calendar-empty">No hay actividades programadas para este periodo.</p>}
          </section>
        )}

        {viewMode === 'semanal' && (
          <section className="weekly-agenda">
            <div className="calendar-section-heading">
              <h3 className="calendar-view-title calendar-view-title-week">Semana del {formatDateLabel(selectedWeekStart)} al {formatDateLabel(weekEnd)}</h3>
              <span>{formatDateLabel(selectedWeekStart)} al {formatDateLabel(weekEnd)}</span>
            </div>
            <div className="week-column-grid">
              {weekDays.map((dayName, index) => {
                const value = addDays(selectedWeekStart, index);
                const dayTasks = weekTasksByDay[value] || [];
                return (
                  <section className="week-column" key={value}>
                    <header>
                      <strong>{dayName}</strong>
                      <span>{formatDateLabel(value)}</span>
                    </header>
                    {dayTasks.map((task) => (
                      <button className={activityTone(task)} key={task.occurrenceId} onClick={() => setSelectedOccurrence(task)} type="button">
                        <strong>{activityTitle(task)}</strong>
                        <span>{activityLabels[task.type]} · {activityMeta(task)}</span>
                        {task.description && <small>{task.description}</small>}
                      </button>
                    ))}
                    {dayTasks.length === 0 && <p>No hay actividades programadas para este periodo.</p>}
                  </section>
                );
              })}
            </div>
          </section>
        )}
      </section>

      {selectedOccurrence && (
        <div className="modal-backdrop" role="presentation">
          <section className="intervention-modal calendar-modal calendar-detail-modal">
            <div className="modal-heading">
              <div>
                <span className="panel-kicker">{activityLabels[selectedOccurrence.type]}</span>
                <h2>{activityTitle(selectedOccurrence)}</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedOccurrence(null)} type="button" aria-label="Cerrar">x</button>
            </div>
            <dl className="calendar-detail-list">
              <div><dt>Fecha</dt><dd>{formatDateLabel(selectedOccurrence.date || selectedOccurrence.startDate)}</dd></div>
              <div><dt>Unidad / alcance</dt><dd>{selectedOccurrence.unit || selectedOccurrence.scope}</dd></div>
              <div><dt>Tipo</dt><dd>{activityLabels[selectedOccurrence.type]}</dd></div>
              <div><dt>Periodo</dt><dd>{activityMeta(selectedOccurrence)}</dd></div>
              <div><dt>Origen</dt><dd>{selectedOccurrence.origin === 'patio' ? 'Patio - solo lectura' : 'Manual'}</dd></div>
            </dl>
            {selectedOccurrence.description && <p className="calendar-detail-description">{selectedOccurrence.description}</p>}
            {selectedOccurrence.type === 'campana' && selectedOccurrence.recurrence !== 'unica' && (
              <div className="history-modal-note">Las campanas recurrentes se editan sobre la campana base.</div>
            )}
            <div className="modal-actions">
              <button className="secondary-action" onClick={() => setSelectedOccurrence(null)} type="button">Cerrar</button>
              {canManage && !selectedOccurrence.readOnly && (
                <>
                  <button className="secondary-action" onClick={() => openEditModal(selectedOccurrence)} type="button">Editar</button>
                  <button className="primary-action" onClick={() => deleteActivity(selectedOccurrence)} type="button">Eliminar</button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {isTaskModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="intervention-modal calendar-modal" onSubmit={saveActivity}>
            <div className="modal-heading">
              <div>
                <span className="panel-kicker">Planificacion</span>
                <h2>{editingActivity ? 'Editar actividad' : 'Nueva tarea'}</h2>
              </div>
              <button className="modal-close" onClick={() => setIsTaskModalOpen(false)} type="button" aria-label="Cerrar">x</button>
            </div>

            <label>Tipo de tarea
              <select name="kind" value={formState.kind} onChange={(event) => setFormState((current) => ({ ...current, kind: event.target.value, preventiveCode: 'E' }))} required>
                <option value="preventivo">Preventivo</option>
                <option value="correctivo">Correctivo</option>
                <option value="campana">Campana</option>
              </select>
            </label>

            {formState.kind === 'preventivo' && (
              <label>Tipo de preventivo
                <select name="preventiveCode" value={formState.preventiveCode} onChange={(event) => setFormState((current) => ({ ...current, preventiveCode: event.target.value }))} required>
                  {preventiveCodes.map((code) => <option key={code} value={code}>{code} - {preventiveTurnDurations[code]} {preventiveTurnDurations[code] === 1 ? 'turno' : 'turnos'}</option>)}
                  <option value="Numeral">Numeral</option>
                </select>
              </label>
            )}

            {formState.kind !== 'campana' && (
              <label>Unidad
                <select name="unit" defaultValue={formState.unit || unitCodes[0]} required>
                  {unitCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
            )}

            {formState.kind === 'preventivo' && formState.preventiveCode === 'Numeral' && (
              <label>Numeral o identificacion
                <input name="numeral" defaultValue={formState.numeral} placeholder="Numeral 8" required />
              </label>
            )}

            {formState.kind === 'campana' && (
              <>
                <label>Nombre de campana<input name="name" defaultValue={formState.name} required /></label>
                <label>Descripcion de campana<textarea name="description" defaultValue={formState.description} rows="3" required /></label>
                <label>Alcance<input name="scope" defaultValue={formState.scope} list="calendar-units" placeholder="E711, varias unidades, toda la flota o sector" required /></label>
                <label>Recurrencia
                  <select name="recurrence" defaultValue={formState.recurrence} required>
                    {Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </>
            )}

            {formState.kind === 'correctivo' && (
              <label>Descripcion<input name="description" defaultValue={formState.description} placeholder="Correctivo en curso" required /></label>
            )}

            <datalist id="calendar-units">
              {unitCodes.map((code) => <option key={code} value={code} />)}
              <option value="Toda la flota" />
              <option value="Todas las locomotoras" />
            </datalist>

            <label>{formState.kind === 'preventivo' && formState.preventiveCode !== 'Numeral' ? 'Fecha programada' : 'Fecha de inicio'}
              <input name="startDate" type="date" defaultValue={formState.startDate} required />
            </label>

            {((formState.kind === 'preventivo' && formState.preventiveCode === 'Numeral') || formState.kind === 'correctivo') && (
              <label>{formState.kind === 'correctivo' ? 'Fecha estimada de finalizacion' : 'Fecha estimada de finalizacion'}
                <input name="endDate" type="date" defaultValue={formState.endDate} required={formState.kind === 'preventivo'} />
              </label>
            )}

            <div className="modal-actions">
              <button className="secondary-action" onClick={() => setIsTaskModalOpen(false)} type="button">Cancelar</button>
              <button className="primary-action" type="submit">{editingActivity ? 'Guardar cambios' : 'Guardar tarea'}</button>
            </div>
            <div className="history-modal-note">Fuente actual: {calendarActivitySource}. La integracion persistente con Supabase queda preparada, pero no se crean tablas en esta tarea.</div>
          </form>
        </div>
      )}
    </main>
  );
}
