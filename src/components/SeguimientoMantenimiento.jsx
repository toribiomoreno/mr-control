import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSeguimiento, saveTracking } from '../services/seguimientoService.js';
import { createHistorialEvent } from '../services/historialSupabaseService.js';
import { crearActualizacion, editarActualizacion } from '../services/actualizacionesEventoSupabaseService.js';
import { toRegister } from '../domain/maintenance/adapter.js';
import { today, monday, shiftDay, dateLabel } from '../domain/maintenance/types.js';
import { maintenanceEfficiency, formatDays, causeName } from '../domain/maintenance/presentation.js';
import { dailyMaintenance, detentionReason, evidenceQuestions, isoWeek, maintenanceBars, maintenanceLabel, orderedUpdates, outcomeAtEnd, updateOutcomeLabel } from '../domain/maintenance/view.js';
import { registerCsv, efficiencyCsv } from '../domain/maintenance/export.js';
import RegistroEventoModal from './RegistroEventoModal.jsx';
import ActualizacionEventoModal from './ActualizacionEventoModal.jsx';
import SeguimientoFields from './SeguimientoFields.jsx';
import './seguimiento.css';

const EMPTY = [];
const stateNames = { worked: 'Útil', mixed: 'Mixto', wait: 'Pérdida', unknown: 'Sin información', excluded: 'Excluido', open: 'En curso' };
const activityNames = { trabajo: 'Se trabajó', espera: 'Sin intervención', mixto: 'Trabajo y demora', sin_dato: 'Sin información' };
const shortDay = day => new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00Z`));
function download(name, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Efficiency({ result, location, onComplete }) {
  const denominator = result.worked + result.waited + result.missing;
  return <section className="maintenance-efficiency" aria-label="Cálculo de eficiencia">
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
function UpdateEntry({ update, event, canEdit, onEdit }) {
  const data = update.metadata?.seguimiento || {};
  const whole = event.tipo === 'preventivo';
  return <article className="maintenance-journal-entry">
    <div className="maintenance-journal-date"><strong>{dateLabel(update.fecha)}</strong><small>{data.period || 'Turno por confirmar'}{update.hora && !update.metadata?.horaEstimada ? ` · ${update.hora}` : ''}</small></div>
    <div><span className={`journal-activity ${data.activity || 'sin_dato'}`}>{activityNames[data.activity] || 'Actividad por confirmar'}</span><p>{update.descripcion}</p>
      <dl className="journal-facts"><div><dt>Quién intervino / informó</dt><dd>{update.responsable || 'Por confirmar'}</dd></div><div><dt>Parte</dt><dd>{whole ? 'Locomotora completa' : `${data.system || event.metadata?.seguimiento?.system || 'Sistema por confirmar'} · ${data.component || event.metadata?.seguimiento?.component || 'Parte por confirmar'}`}</dd></div>
      {['espera', 'mixto'].includes(data.activity) && <div><dt>Motivo de la demora</dt><dd>{causeName(data.cause)}{data.usefulFraction != null ? ` · ${Math.round((1 - data.usefulFraction) * 100)} % del día` : ''}</dd></div>}
      <div><dt>Al terminar el día</dt><dd>{updateOutcomeLabel(event, update)}</dd></div></dl>
      {canEdit && <button className="journal-edit" onClick={() => onEdit(update)}>Corregir / completar registro</button>}
    </div>
  </article>;
}
export default function SeguimientoMantenimiento({ canManage, locomotoras, onOpenHistory, initialSelection, privatePreviewEvents = EMPTY }) {
  const [events, setEvents] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [week, setWeek] = useState(() => monday(initialSelection?.fecha || today()));
  const [unit, setUnit] = useState(initialSelection?.codigo || ''), [place, setPlace] = useState(initialSelection?.place || 'Boulogne');
  const [day, setDay] = useState(''), [selectedId, setSelectedId] = useState(initialSelection?.id || '');
  const [creating, setCreating] = useState(false), [update, setUpdate] = useState(null), [editingMeta, setEditingMeta] = useState(false), [saving, setSaving] = useState(false);
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
  const filteredEvents = events.filter(event => (!unit || event.locomotoraCodigo === unit) && (!place || (event.metadata?.seguimiento?.location || 'Ubicación por confirmar') === place));
  const bars = maintenanceBars(filteredEvents, range.from, range.to);
  const daily = day ? dailyMaintenance(filteredEvents, day) : [];
  const selected = register.maintenances.find(item => item.id === selectedId), event = events.find(item => item.id === selectedId);
  const canEdit = canManage && event?.origen !== 'vista-previa-privada';
  const result = selected ? maintenanceEfficiency(register, selected) : null;
  const updates = event ? orderedUpdates(event) : [];
  const intervened = updates.filter(item => ['trabajo', 'mixto'].includes(item.metadata?.seguimiento?.activity));
  const questions = event ? evidenceQuestions(event) : [];
  const jobs = register.maintenances.filter(item => bars.some(bar => bar.id === item.id));
  const subset = { ...register, maintenances: jobs, observations: register.observations.filter(o => jobs.some(m => m.id === o.maintenanceId)), episodes: register.episodes.filter(e => jobs.some(m => m.episodeId === e.id)) };
  function changeWeek(value) { setWeek(monday(value)); setDay(''); }
  function select(id) { setSelectedId(id); setEditingMeta(false); }
  async function create(payload, files) {
    if (!canManage) throw new Error('No tenés permisos para cargar mantenimientos.');
    const saved = await createHistorialEvent(payload, files, locomotoras);
    setCreating(false); await load(); setSelectedId(saved.id);
  }
  async function saveUpdate(parent, payload, files) {
    if (!canEdit) throw new Error('Este mantenimiento es de solo lectura.');
    if (payload.id) await editarActualizacion(payload, files, parent); else await crearActualizacion(payload, files, parent);
    await load();
  }
  async function saveMeta(e) {
    e.preventDefault(); if (!canEdit) return;
    const form = new FormData(e.currentTarget); setSaving(true); setError('');
    try {
      await saveTracking(event, { ...event.metadata?.seguimiento, detentionStart: form.get('detentionStart'), detentionReason: form.get('detentionReason') || detentionReason(event), location: form.get('location'), system: form.get('system') || 'Varios sistemas', component: form.get('component') || 'Locomotora completa' });
      setEditingMeta(false); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return <main className="tracking-page maintenance-page">
    <header className="maintenance-heading"><div><p className="eyebrow">Mantenimientos · {weekInfo.year}</p><h2>Semana {weekInfo.number}</h2></div><p className="maintenance-week-range">Del {dateLabel(week)} al {dateLabel(range.to)}</p>{canManage && <button className="primary-action" onClick={() => setCreating(true)}>+ Registrar mantenimiento</button>}</header>
    <div className="tracking-toolbar maintenance-toolbar">
      <div className="week-navigation"><button onClick={() => changeWeek(shiftDay(week, -7))} aria-label="Semana anterior">‹</button><label>Semana del<input type="date" value={week} onChange={e => e.target.value && changeWeek(e.target.value)} /></label><button onClick={() => changeWeek(shiftDay(week, 7))} aria-label="Semana siguiente">›</button></div>
      <label>Locomotora<select value={unit} onChange={e => setUnit(e.target.value)}><option value="">Todas</option>{locomotoras.map(l => <option key={l.codigo}>{l.codigo}</option>)}</select></label>
      <label>Ubicación<select value={place} onChange={e => setPlace(e.target.value)}><option>Boulogne</option><option>Externo</option><option>Ubicación por confirmar</option><option value="">Todas</option></select></label>
      <details className="maintenance-export"><summary>Exportar CSV</summary><button onClick={() => download(`mantenimientos-${week}.csv`, registerCsv(subset))}>Registros de la semana</button><button onClick={() => download(`eficiencia-${week}.csv`, efficiencyCsv(register, jobs.filter(m => m.location === 'Boulogne'), range))}>Indicadores de la semana</button></details>
    </div>
    <div className="maintenance-key"><span><i className="preventivo" />Preventivos</span><span><i className="correctivo" />Correctivos</span><small>Tocá una barra para ver el mantenimiento o una fecha para revisar ese día.</small></div>
    {error && <p role="alert" className="tracking-error">{error}</p>}
    {loading && <p role="status">Cargando mantenimientos…</p>}
    {!loading && <>
      <div className="tracking-table-wrap"><div className="tracking-week"><div className="tracking-week-head"><strong>Unidad</strong><div>{days.map(date => <button key={date} aria-label={`Ver día ${dateLabel(date)}`} aria-pressed={day === date} onClick={() => setDay(day === date ? '' : date)}>{shortDay(date)}</button>)}</div></div>
        {[...new Set(bars.map(bar => bar.event.locomotoraCodigo))].sort().map(code => {
          const lanes = maintenanceBars(filteredEvents.filter(item => item.locomotoraCodigo === code), week, range.to);
          return <div className="tracking-week-row" key={code}><strong>{code}</strong><div className="tracking-lanes">{lanes.map(bar => <button key={bar.id} className={`tracking-bar ${bar.kind} ${bar.unconfirmed ? 'is-unconfirmed' : ''}`} style={{ gridColumn: `${bar.column} / span ${bar.span}`, gridRow: bar.lane + 1 }} onClick={() => select(bar.id)} title={`${bar.label} · ${bar.reason}`}><strong>{bar.label}</strong><span>{bar.unconfirmed ? 'Continuidad por confirmar' : outcomeAtEnd(bar.event).label}</span></button>)}</div></div>;
        })}
      </div></div>
      {!bars.length && <p className="tracking-empty">No hay mantenimientos registrados en esta semana para los filtros elegidos.</p>}
      {day && <section className="maintenance-day-panel" aria-label={`Actividad del ${dateLabel(day)}`}><header><div><p className="eyebrow">Detalle diario</p><h3>{dateLabel(day)} · {shortDay(day).split(' ')[0]}</h3></div><button onClick={() => setDay('')} aria-label="Cerrar vista diaria">×</button></header>
        {!daily.length && <p>No hay mantenimientos registrados en esta fecha.</p>}
        {daily.map(item => <article key={item.id} className={`maintenance-day-card ${item.kind}`}><button onClick={() => select(item.id)}><strong>{item.event.locomotoraCodigo}</strong><span>{item.label}</span><small>Abrir mantenimiento →</small></button><div>{!item.updates.length ? <p>{day > today() ? 'Fecha futura; todavía no hay actividad registrada.' : 'Sin novedad registrada para este día. Falta confirmar si se trabajó y si continuó detenida.'}</p> : item.updates.map(a => <div className="day-update" key={a.id}><strong>{activityNames[a.metadata?.seguimiento?.activity] || 'Actividad por confirmar'} · {a.metadata?.seguimiento?.period || 'Turno por confirmar'}</strong><p>{a.descripcion}</p><small>{a.responsable || 'Personal por confirmar'}{a.metadata?.seguimiento?.cause ? ` · ${causeName(a.metadata.seguimiento.cause)}` : ''} · {updateOutcomeLabel(item.event, a)}</small></div>)}</div></article>)}
      </section>}
    </>}
    {selected && event && <div className="modal-backdrop"><section className="intervention-modal tracking-detail" role="dialog" aria-modal="true" aria-label={`Mantenimiento ${selected.unit}`}><div className="modal-heading"><div><span className={`maintenance-type ${event.tipo}`}>{selected.unit} · {event.tipo === 'preventivo' ? `Preventivo ${event.preventivoCodigo}` : 'Correctivo'}</span><h2>{maintenanceLabel(event)}</h2></div><button className="modal-close" aria-label="Cerrar detalle" onClick={() => select('')}>×</button></div>
      <dl className="tracking-facts"><div><dt>Detenida desde</dt><dd>{dateLabel(event.metadata?.seguimiento?.detentionStart)}</dd></div><div><dt>Motivo de la detención</dt><dd>{detentionReason(event)}</dd></div><div><dt>Cuándo se intervino</dt><dd>{intervened.length ? [...new Set(intervened.map(a => dateLabel(a.fecha)))].join(' · ') : 'Sin trabajo confirmado'}</dd></div><div><dt>Sistema y parte intervenida</dt><dd>{selected.kind === 'liviano' ? 'Locomotora completa' : `${selected.system} · ${selected.component}`}</dd></div><div><dt>Quién intervino</dt><dd>{intervened.length ? [...new Set(intervened.map(a => a.responsable || 'Por confirmar'))].join(' · ') : 'Sin intervención registrada'}</dd></div><div><dt>Estado posterior informado</dt><dd>{outcomeAtEnd(event).label}{outcomeAtEnd(event).date ? ` · ${dateLabel(outcomeAtEnd(event).date)}` : ''}</dd></div></dl>
      {updates.some(a => ['espera','mixto'].includes(a.metadata?.seguimiento?.activity)) && <div className="maintenance-delays"><h3>Por qué no se pudo trabajar</h3>{updates.filter(a => ['espera','mixto'].includes(a.metadata?.seguimiento?.activity)).map(a => <p key={a.id}><strong>{dateLabel(a.fecha)} · {causeName(a.metadata.seguimiento.cause)}</strong> — {a.descripcion}</p>)}</div>}
      {event.origen === 'vista-previa-privada' && <p className="tracking-hint">Datos del archivo privado en vista temporal.</p>}
      <div className="tracking-toolbar">{canEdit && <><button onClick={() => setEditingMeta(!editingMeta)}>Completar datos</button><button className="primary-action" onClick={() => setUpdate({})}>+ Registrar novedad</button></>}<button onClick={() => onOpenHistory(selected.unit)}>Archivo Histórico</button></div>
      {questions.length > 0 && <details className="maintenance-questions"><summary>Información por confirmar ({questions.length})</summary>{questions.map((q,index) => <div key={index}><span>{q.text}</span>{canEdit && <button onClick={() => q.field === 'meta' ? setEditingMeta(true) : setUpdate(q.update ? { initialUpdate: q.update } : {})}>Responder</button>}</div>)}</details>}
      {editingMeta && <form onSubmit={saveMeta}><SeguimientoFields tipo={event.tipo} code={event.preventivoCodigo} tracking={{ ...event.metadata?.seguimiento, detentionReason: detentionReason(event) }} /><button className="primary-action" disabled={saving}>{saving ? 'Guardando…' : 'Confirmar datos'}</button></form>}
      <h3 className="journal-title">Intervenciones día a día</h3>{!updates.length && <p>No hay avances registrados. El ingreso a mantenimiento no confirma una intervención.</p>}
      {updates.map(a => <UpdateEntry key={a.id} update={a} event={event} canEdit={canEdit} onEdit={value => setUpdate({ initialUpdate: value })} />)}
      <Efficiency result={result} location={selected.location} onComplete={canEdit ? date => setUpdate({ initialDate: date }) : null} />
      {error && <p role="alert" className="tracking-error">{error}</p>}
    </section></div>}
    {creating && <RegistroEventoModal locomotoras={locomotoras} selectedLoco={locomotoras.find(l => l.codigo === unit) || locomotoras[0]} onClose={() => setCreating(false)} onSave={create} />}
    {update && event && <ActualizacionEventoModal key={update.initialUpdate?.id || update.initialDate || 'new'} event={event} mode={event.estadoMantenimiento === 'finalizado' ? 'observacion' : 'avance'} {...update} onClose={() => setUpdate(null)} onSave={saveUpdate} />}
  </main>;
}
