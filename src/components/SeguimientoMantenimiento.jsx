import RailwayLoader from './RailwayLoader.jsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSeguimiento, saveMaintenanceIntake } from '../services/seguimientoService.js';
import { createHistorialEvent } from '../services/historialSupabaseService.js';
import { crearActualizacion, editarActualizacion } from '../services/actualizacionesEventoSupabaseService.js';
import { journalGroups, shiftEfficiency } from '../domain/maintenance/journal.js';
import MaintenanceSheet from './MaintenanceSheet.jsx';
import { toRegister } from '../domain/maintenance/adapter.js';
import { today, monday, shiftDay, dateLabel } from '../domain/maintenance/types.js';
import { maintenanceEfficiency, formatDays, causeName } from '../domain/maintenance/presentation.js';
import { dailyMaintenance, detentionReason, evidenceQuestions, hasMaintenanceDelay, isoWeek, maintenanceBars, orderedUpdates, updateOutcomeLabel, workDurationLabel } from '../domain/maintenance/view.js';
import { maintenanceCsv, efficiencyCsv } from '../domain/maintenance/export.js';
import CargaDatosModal from './CargaDatosModal.jsx';
import RegistroEventoModal from './RegistroEventoModal.jsx';
import ActualizacionEventoModal from './ActualizacionEventoModal.jsx';
import NuevoMantenimientoModal from './NuevoMantenimientoModal.jsx';
import MaintenanceIntakeFields from './MaintenanceIntakeFields.jsx';
import { intakeTime } from '../domain/maintenance/capture.js';
import { lightSchedule } from '../domain/maintenance/schedule.js';
import ImportarPilotoModal from './ImportarPilotoModal.jsx';
import './seguimiento.css';
import MaintenanceBar from './MaintenanceBar.jsx';

const EMPTY = [];
const stateNames = { worked: 'Útil', mixed: 'Mixto', wait: 'Pérdida', unknown: 'Sin información', excluded: 'Excluido', open: 'En curso' };
const activityNames = { trabajo: 'Se trabajó', espera: 'Sin intervención', mixto: 'Se trabajó parcialmente', sin_dato: 'Sin información' };
const shortDay = day => new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00Z`));
function download(name, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Efficiency({ result, location, onComplete, shifts }) {
  const denominator = result.worked + result.waited + result.missing;
  return <section className="maintenance-efficiency" aria-label="Cálculo de eficiencia">
    {shifts && <div className="shift-efficiency"><h3>Cumplimiento de turnos</h3><p>{shifts.planned} turnos previstos · {shifts.registered} registrados · {shifts.extensions} extensiones</p><strong>{shifts.percent == null ? 'Pendiente de completar los turnos' : `${shifts.percent} %`}</strong><p className="tracking-hint">Turnos previstos ÷ turnos utilizados. Las extensiones cuentan como turnos adicionales.</p></div>}
    <div className="efficiency-heading"><div><p className="eyebrow">Toda la intervención</p><h3>Eficiencia del mantenimiento</h3></div><strong>{location !== 'Boulogne' ? 'Fuera de alcance' : result.percent == null ? 'Sin confirmar' : `${result.percent} %`}</strong></div>
    <p>{formatDays(result.worked)} días útiles ÷ {formatDays(result.total)} días incluidos × 100{result.percent != null && location === 'Boulogne' ? ` = ${result.percent} %` : ''}</p>
    <div className="efficiency-bar" role="img" aria-label={`${formatDays(result.worked)} días útiles, ${formatDays(result.waited)} perdidos y ${result.missing} sin información`}>
      {[['useful', result.worked], ['lost', result.waited], ['missing', result.missing]].map(([key, value]) => value > 0 && <span key={key} className={key} style={{ width: `${value / denominator * 100}%` }} />)}
    </div>
    <div className="efficiency-legend"><span><i className="useful" />{formatDays(result.worked)} útiles</span><span><i className="lost" />{formatDays(result.waited)} pérdida</span><span><i className="missing" />{result.missing} sin datos</span><span>{result.excluded} excluidos</span></div>
    <p className="tracking-hint">{result.reason} Los correctivos y pesados excluyen fines de semana sin trabajo ni excepción prevista. Los días sin información no se convierten en pérdidas; impiden confirmar el porcentaje. El día de hoy se incorpora al cerrar el día o el mantenimiento.</p>
    {location !== 'Boulogne' && <p>El trabajo externo queda fuera del indicador de Boulogne.</p>}
    <details className="efficiency-days"><summary>Ver cómo cuenta cada día</summary><div className="tracking-table-wrap"><table className="tracking-table"><thead><tr><th>Día</th><th>Evaluación</th><th>Útil</th><th>Pérdida</th><th>Explicación</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.date}><td>{dateLabel(row.date)}</td><td>{stateNames[row.state]}{row.state === 'unknown' && onComplete && <button onClick={() => onComplete(row.date)}>Completar</button>}</td><td>{formatDays(row.useful)}</td><td>{formatDays(row.lost)}</td><td>{row.reason}{row.lossCause && <small>{causeName(row.lossCause)}</small>}</td></tr>)}</tbody></table></div></details>
  </section>;
}
function UpdateEntry({ update, event, questions, onEdit, editor, grouped = false }) {
  const data = update.metadata?.seguimiento || {};
  const classification = [data.system || event.metadata?.seguimiento?.system || 'Sistema por confirmar', data.subsystem || 'Subsistema por clasificar', data.component].filter(Boolean).filter((value, index, all) => all.findIndex(item => item.trim().toLocaleLowerCase('es') === value.trim().toLocaleLowerCase('es')) === index);
  return <article className={`maintenance-journal-entry${grouped ? ' grouped' : ''}`}>
    {!grouped && <div className="maintenance-journal-date"><strong>{dateLabel(update.fecha)}</strong></div>}
    <div>{editor || <>{event.tipo === 'preventivo' && ['E', 'A', 'AB', 'ABC'].includes(event.preventivoCodigo) && <span className="journal-preventive">Preventivo {event.preventivoCodigo} · locomotora completa</span>}<span className={`journal-activity ${data.activity || 'sin_dato'}`}>{activityNames[data.activity] || 'Actividad por confirmar'}</span><p>{update.descripcion}</p>
      {!['E','A','AB','ABC'].includes(event.preventivoCodigo) && <p className="journal-system"><strong>{classification[0]}</strong>{classification.slice(1).map(item => ` · ${item}`).join('')}</p>}
      {event.tipo === 'preventivo' && ['E','A','AB','ABC'].includes(event.preventivoCodigo) && <p>{data.period || 'Turno por confirmar'}</p>}
      <p>{[update.responsable, data.staffSpecialty, workDurationLabel(data)].filter(Boolean).join(' · ')}</p>
      {questions.map((q, i) => <p key={i} className="journal-missing">{onEdit ? <button onClick={onEdit}>{q.text} → Completar</button> : q.text}</p>)}
      {onEdit && <button className="journal-edit" onClick={onEdit}>Editar este avance</button>}
      {hasMaintenanceDelay(data) ? <p className="journal-delay"><strong>Demora · {causeName(data.cause)}</strong>{data.delayDescription && ` · ${data.delayDescription}`}</p> : <p className="tracking-hint">Demoras: No</p>}
      {data.additionalShiftRequired && <p className="journal-delay">Se agregó otro turno · {causeName(data.extensionCause || data.cause)}{data.extensionReason && ` · ${data.extensionReason}`}</p>}
      <p className="journal-outcome">Estado informado: <strong>{updateOutcomeLabel(event, update)}</strong></p>
    </>}
    </div>
  </article>;
}
export default function SeguimientoMantenimiento({ canManage, locomotoras, onChanged, initialSelection, privatePreviewEvents = EMPTY }) {
  const [events, setEvents] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [week, setWeek] = useState(() => monday(initialSelection?.fecha || today()));
  const [unit, setUnit] = useState(initialSelection?.codigo || '');
  const [entryOpen, setEntryOpen] = useState(false);
  const [day, setDay] = useState(''), [selectedId, setSelectedId] = useState(initialSelection?.id || '');
  const [creating, setCreating] = useState(initialSelection?.newMaintenance || false), [update, setUpdate] = useState(null), [editingMeta, setEditingMeta] = useState(false), [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const saved = await fetchSeguimiento();
      setEvents([...saved, ...privatePreviewEvents.filter(preview => !saved.some(item => item.metadata?.pilotSourceId === preview.metadata?.pilotSourceId))]);
    } catch (e) { setEvents(privatePreviewEvents); setError(privatePreviewEvents.length ? '' : e.message || 'No se pudieron cargar los mantenimientos.'); }
    finally { setLoading(false); }
  }, [privatePreviewEvents]);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);
  const register = useMemo(() => toRegister(events), [events]);
  const range = { from: week, to: shiftDay(week, 6) }, weekInfo = isoWeek(week);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(week, i));
  const filteredEvents = events.filter(event => !unit || event.locomotoraCodigo === unit);
  const bars = maintenanceBars(filteredEvents, range.from, range.to);
  const daily = day ? dailyMaintenance(filteredEvents, day) : [];
  const selected = register.maintenances.find(item => item.id === selectedId), event = events.find(item => item.id === selectedId);
  const updateEvent = update?.event || (update?.eventId ? events.find(item => item.id === update.eventId) : event);

  const canEdit = canManage && event?.origen !== 'vista-previa-privada';
  const result = selected ? maintenanceEfficiency(register, selected) : null;
  const updates = event ? orderedUpdates(event) : [];
  const groups = event ? journalGroups(event) : [];
  const lightNotes = selected?.kind === 'liviano' ? updates.filter(a=>a.metadata?.seguimiento?.activity === 'sin_dato') : [];
  const workGroups = selected?.kind === 'liviano' ? groups.map(g=>({...g,updates:g.updates.filter(a=>a.metadata?.seguimiento?.activity !== 'sin_dato')})).filter(g=>g.updates.length) : groups;
  const shifts = event ? shiftEfficiency(event) : null;
  const schedule = event ? lightSchedule(event) : null;
  const questions = event ? evidenceQuestions(event) : [];
  const jobs = register.maintenances.filter(item => bars.some(bar => bar.id === item.id));
  function changeWeek(value) { setWeek(monday(value)); setDay(''); }
  function select(id) { setSelectedId(id); setEditingMeta(false); setUpdate(null); }
  const inlineUpdate = Boolean(update && updateEvent?.id === selectedId);
  async function create(payload, files) {
    if (!canManage) throw new Error('No tenés permisos para cargar mantenimientos.');
    const saved = await createHistorialEvent(payload, files, locomotoras);
    setCreating(false); setSelectedId(saved.id);
    if (['preventivo', 'correctivo'].includes(saved.tipo)) setUpdate({ event: saved, newEntry: true, initialUpdate: {
      fecha: saved.fechaCierre || saved.fecha, hora: '', descripcion: saved.descripcion, responsable: saved.responsable,
      metadata: { seguimiento: { outcome: saved.metadata?.seguimiento?.outcome || '' } },
    } });
    await load(); onChanged?.();
  }
  async function createMaintenance(payload, files) {
    if (!canManage) throw new Error('No tenés permisos para cargar mantenimientos.');
    return createHistorialEvent(payload, files, locomotoras);
  }
  async function maintenanceCreated(saved) {
    setEntryOpen(false); setCreating(false); setSelectedId(saved.id);
    await load(); onChanged?.();
  }
  async function saveUpdate(parent, payload, files) {
    if (!canManage || parent.origen === 'vista-previa-privada') throw new Error('Este mantenimiento es de solo lectura.');
    if (payload.id) await editarActualizacion(payload, files, parent); else await crearActualizacion(payload, files, parent);
    await load(); onChanged?.(); setUpdate(null);
  }
  async function saveMeta(e) {
    e.preventDefault(); if (!canEdit) return;
    const form = new FormData(e.currentTarget); setSaving(true); setError('');
    try {
      await saveMaintenanceIntake(event, Object.fromEntries(form));
      setEditingMeta(false); await load(); onChanged?.();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return <main className="tracking-page maintenance-page">
    <header className="maintenance-heading"><div><p className="eyebrow">Mantenimientos · {weekInfo.year}</p><h2>Semana {weekInfo.number}</h2></div><p className="maintenance-week-range">Del {dateLabel(week)} al {dateLabel(range.to)}</p>{canManage && <button className="primary-action" onClick={() => setEntryOpen(true)}>+ Cargar datos</button>}</header>
    <div className="tracking-toolbar maintenance-toolbar">
      <div className="week-navigation"><button onClick={() => changeWeek(shiftDay(week, -7))} aria-label="Semana anterior">‹</button><label>Semana del<input type="date" value={week} onChange={e => e.target.value && changeWeek(e.target.value)} /></label><button onClick={() => changeWeek(shiftDay(week, 7))} aria-label="Semana siguiente">›</button></div>
      <label>Locomotora<select value={unit} onChange={e => setUnit(e.target.value)}><option value="">Todas</option>{locomotoras.map(l => <option key={l.codigo}>{l.codigo}</option>)}</select></label>

      <details className="maintenance-export"><summary>Datos</summary><button onClick={() => download(`mantenimientos-${week}.csv`, maintenanceCsv(filteredEvents, range))}>CSV de la semana</button><button onClick={() => download('mantenimientos-completos.csv', maintenanceCsv(filteredEvents))}>CSV completo</button><button onClick={() => download(`eficiencia-${week}.csv`, efficiencyCsv(register, jobs.filter(m => m.location === 'Boulogne'), range))}>Indicadores CSV</button>{canManage && <button onClick={() => setImporting(true)}>Importar respaldo JSON</button>}</details>
    </div>
    <div className="maintenance-key"><span><i className="preventivo" />Preventivos</span><span><i className="correctivo" />Correctivos</span><small>Tocá una barra para ver el mantenimiento o una fecha para revisar ese día.</small></div>
    {error && <p role="alert" className="tracking-error">{error}</p>}
    {loading && <RailwayLoader label="Cargando mantenimientos…" />}
    {!loading && <>
      <div className="tracking-table-wrap"><div className="tracking-week"><div className="tracking-week-head"><strong>Unidad</strong><div>{days.map(date => <button key={date} aria-label={`Ver día ${dateLabel(date)}`} aria-pressed={day === date} onClick={() => setDay(day === date ? '' : date)}>{shortDay(date)}</button>)}</div></div>
        {[...new Set(bars.map(bar => bar.event.locomotoraCodigo))].sort().map(code => {
          const lanes = maintenanceBars(filteredEvents.filter(item => item.locomotoraCodigo === code), week, range.to);
          return <div className="tracking-week-row" key={code}><strong>{code}</strong><div className="tracking-lanes">{lanes.map(bar => <MaintenanceBar key={bar.id} bar={bar} onSelect={select} />)}</div></div>;
        })}
      </div></div>
      {!bars.length && <p className="tracking-empty">No hay mantenimientos registrados en esta semana para los filtros elegidos.</p>}
      {day && <section className="maintenance-day-panel" aria-label={`Actividad del ${dateLabel(day)}`}><header><div><p className="eyebrow">Detalle diario</p><h3>{dateLabel(day)} · {shortDay(day).split(' ')[0]}</h3></div><button onClick={() => setDay('')} aria-label="Cerrar vista diaria">×</button></header>
        {!daily.length && <p>No hay mantenimientos registrados en esta fecha.</p>}
        {daily.map(item => <article key={item.id} className={`maintenance-day-card ${item.kind}`}><button onClick={() => select(item.id)}><strong>{item.event.locomotoraCodigo}</strong><span>{item.label}</span><small>Abrir mantenimiento →</small></button><div>{!item.updates.length ? <p>{day > today() ? 'Fecha futura; todavía no hay actividad registrada.' : 'Sin novedad registrada para este día. Falta confirmar si se trabajó y si continuó detenida.'}</p> : item.updates.map(a => <div className="day-update" key={a.id}><strong>{activityNames[a.metadata?.seguimiento?.activity] || 'Actividad por confirmar'} · {a.metadata?.seguimiento?.period || 'Turno por confirmar'}</strong><p>{a.descripcion}</p><small>{a.responsable || 'Personal por confirmar'} · {updateOutcomeLabel(item.event, a)}</small></div>)}</div></article>)}
      </section>}
    </>}
    {selected && event && <div className="modal-backdrop"><section className="intervention-modal tracking-detail" role="dialog" aria-modal="true" aria-label={`Mantenimiento ${selected.unit}`}><div className="modal-heading"><h3 className={`maintenance-type ${event.tipo}`}>{selected.unit} - {event.tipo === 'preventivo' ? `Preventivo ${event.preventivoCodigo}` : 'Correctivo'}</h3><button className="modal-close" aria-label="Cerrar detalle" onClick={() => select('')}>×</button></div>
      <section className="maintenance-detail-section">
      <dl className="tracking-facts">

        <div><dt>Fecha y hora de ingreso</dt><dd>{dateLabel(event.metadata?.seguimiento?.detentionStart || event.fecha)} · {intakeTime(event) || 'Hora por confirmar'}</dd></div>
        <div className="maintenance-reason"><dt>Motivo de la detención</dt><dd>{detentionReason(event)}</dd></div>
        {event.tipo === 'preventivo' && <><div><dt>Inicio programado</dt><dd>{dateLabel(schedule?.start || event.metadata?.seguimiento?.plannedStart)} · {schedule?.startTime || event.metadata?.seguimiento?.plannedStartTime || 'Hora por confirmar'}</dd></div><div><dt>Fin programado</dt><dd>{dateLabel(schedule?.end || event.metadata?.seguimiento?.plannedEnd)} · {schedule ? `Turno ${schedule.endPeriod.toLowerCase()} · ${schedule.endTime}` : event.metadata?.seguimiento?.plannedEndTime || 'Hora por confirmar'}</dd>{schedule && <small>{schedule.planned} turnos previstos{schedule.extensions ? ` + ${schedule.extensions} adicional(es)` : ''}</small>}</div></>}
        <div className="maintenance-end-fact"><dt>Fecha y hora de fin</dt><dd>{event.estadoMantenimiento === 'finalizado' ? `${dateLabel(event.fechaCierre)} · ${event.horaCierre || 'Hora por confirmar'}` : 'En curso · sin fin registrado'}</dd></div>
      </dl>
      <div className="maintenance-header-actions">{canEdit && <button onClick={() => setEditingMeta(true)}>Editar datos del mantenimiento</button>}{event.tipo === 'preventivo' && <button onClick={() => setSheetOpen(true)}>Ficha del mantenimiento</button>}</div>
      {selected.location === 'Externo' && <p className="tracking-hint">Mantenimiento externo: no se solicitan avances diarios. Se conservan los datos de ingreso y cierre.</p>}
      {event.origen === 'vista-previa-privada' && <p className="tracking-hint">Datos del archivo privado en vista temporal.</p>}
      {editingMeta && <form onSubmit={saveMeta}><MaintenanceIntakeFields event={event} locomotoras={locomotoras} /><button className="primary-action" disabled={saving}>{saving ? 'Guardando…' : 'Confirmar datos'}</button><button type="button" disabled={saving} onClick={() => setEditingMeta(false)}>Cancelar</button></form>}
      </section>
      <section className="maintenance-detail-section"><div className="maintenance-section-heading"><span>02</span><div><p className="eyebrow">Seguimiento diario</p><h3>Avances</h3></div></div>{!updates.length && <p>No hay avances registrados. El ingreso a mantenimiento no confirma una intervención.</p>}
      {workGroups.map(group => <section className="journal-day-group" key={group.key} aria-label={group.label}><header><h4>{group.label}{selected.kind === 'liviano' && ` · ${dateLabel(group.date)}`}</h4>{canEdit && selected.kind !== 'liviano' && <button onClick={() => setUpdate({initialDate:group.date})}>+ Otros trabajos realizados en este día</button>}</header>{group.updates.map(a => <UpdateEntry grouped key={a.id} update={a} event={event} questions={questions.filter(q => q.update?.id === a.id)} onEdit={canEdit ? () => setUpdate({ initialUpdate: a }) : null} editor={inlineUpdate && update.initialUpdate?.id === a.id ? <ActualizacionEventoModal key={a.id} event={event} mode="avance" initialUpdate={a} embedded onClose={() => setUpdate(null)} onSave={saveUpdate} /> : null} />)}{inlineUpdate && !update.initialUpdate?.id && update.initialDate === group.date && <article className="maintenance-journal-entry grouped"><ActualizacionEventoModal key={group.date} {...update} event={event} mode="avance" embedded onClose={() => setUpdate(null)} onSave={saveUpdate} /></article>}</section>)}
      {inlineUpdate && !update.initialUpdate?.id && !workGroups.some(group => group.date === update.initialDate) && <article className="maintenance-journal-entry grouped"><ActualizacionEventoModal key={update.initialDate || 'new'} {...update} event={event} mode="avance" embedded onClose={() => setUpdate(null)} onSave={saveUpdate} /></article>}
      {canEdit && !inlineUpdate && <button onClick={() => setUpdate(selected.kind === 'liviano' ? {} : { advanceNextDay: true })}>{selected.kind === 'liviano' ? '+ Agregar turno o novedad' : '+ Avance día siguiente'}</button>}
      </section>
      {selected.kind === 'liviano' && <section className="maintenance-detail-section"><h3>Novedades del mantenimiento</h3>{!lightNotes.length && <p>No hay novedades adicionales registradas.</p>}{lightNotes.map(a=><UpdateEntry key={a.id} update={a} event={event} questions={[]} onEdit={canEdit?()=>setUpdate({initialUpdate:a}):null} editor={inlineUpdate && update.initialUpdate?.id === a.id ? <ActualizacionEventoModal event={event} mode="observacion" initialUpdate={a} embedded onClose={()=>setUpdate(null)} onSave={saveUpdate} />:null} />)}{canEdit && !inlineUpdate && <button onClick={()=>setUpdate({initialUpdate:{fecha:today(),metadata:{seguimiento:{activity:'sin_dato'}}}})}>+ Agregar novedad</button>}</section>}
      <Efficiency shifts={shifts} result={result} location={selected.location} onComplete={canEdit && selected.location !== 'Externo' ? date => setUpdate({ initialDate: date }) : null} />
      {error && <p role="alert" className="tracking-error">{error}</p>}
    </section></div>}
    {sheetOpen && event && <MaintenanceSheet event={event} canManage={canEdit} onClose={() => setSheetOpen(false)} onSaved={async () => { await load(); onChanged?.(); }} />}
    {entryOpen && <CargaDatosModal events={events} unit={unit} onClose={() => setEntryOpen(false)} onNew={() => { setEntryOpen(false); setCreating('evento'); }} newMaintenance={<NuevoMantenimientoModal embedded locomotoras={locomotoras} unit={unit} onClose={() => setEntryOpen(false)} onCreate={createMaintenance} onSaveProgress={(parent, payload, files) => crearActualizacion(payload, files, parent)} onCreated={maintenanceCreated} />} onReview={eventId => { setEntryOpen(false); setSelectedId(eventId); setEditingMeta(true); }} onUpdate={(eventId, initialUpdate) => { setEntryOpen(false); setUpdate({ eventId, initialUpdate }); }} />}
    {creating === 'evento' && <RegistroEventoModal locomotoras={locomotoras} initialDate={initialSelection?.newMaintenance ? initialSelection.fecha : ''} selectedLoco={locomotoras.find(l => l.codigo === unit) || locomotoras[0]} onClose={() => setCreating(false)} onSave={create} />}
    {creating && creating !== 'evento' && <NuevoMantenimientoModal locomotoras={locomotoras} unit={unit} initialDate={initialSelection?.fecha} onClose={() => setCreating(false)} onCreate={createMaintenance} onSaveProgress={(parent, payload, files) => crearActualizacion(payload, files, parent)} onCreated={maintenanceCreated} />}
    {update && updateEvent && !inlineUpdate && <ActualizacionEventoModal key={update.initialUpdate?.id || update.initialDate || updateEvent.id} event={updateEvent} mode="avance" {...update} onClose={() => setUpdate(null)} onSave={saveUpdate} />}
    {importing && <ImportarPilotoModal events={events} onClose={() => setImporting(false)} onImported={async () => { await load(); onChanged?.(); }} />}
  </main>;
}
