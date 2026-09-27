import ImportarPilotoModal from './ImportarPilotoModal.jsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSeguimiento, saveTracking } from '../services/seguimientoService.js';
import { createHistorialEvent } from '../services/historialSupabaseService.js';
import { crearActualizacion, editarActualizacion } from '../services/actualizacionesEventoSupabaseService.js';
import { toRegister } from '../domain/maintenance/adapter.js';
import { today, monday, shiftDay, dateLabel } from '../domain/maintenance/types.js';
import { timelineLanes, jobTitle, maintenanceEfficiency, formatDays, causeName } from '../domain/maintenance/presentation.js';
import { registerCsv, efficiencyCsv } from '../domain/maintenance/export.js';
import RegistroEventoModal from './RegistroEventoModal.jsx';
import ActualizacionEventoModal from './ActualizacionEventoModal.jsx';
import SeguimientoFields from './SeguimientoFields.jsx';
import './seguimiento.css';

function download(name, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stateNames = { worked: 'Útil', mixed: 'Mixto', wait: 'Pérdida', unknown: 'Sin información', excluded: 'Excluido', open: 'En curso' };
function DayBreakdown({ result, onComplete }) {
  return <div className="tracking-table-wrap"><table className="tracking-table"><thead><tr><th>Día</th><th>Evaluación</th><th>Útil</th><th>Pérdida</th><th>Motivo / trabajo</th></tr></thead><tbody>{result.rows.map(r => <tr key={r.date}><td>{dateLabel(r.date)}</td><td><span className={'tracking-state ' + r.state}>{stateNames[r.state]}</span>{r.state === 'unknown' && onComplete && <button onClick={() => onComplete(r.date)}>Completar</button>}</td><td>{formatDays(r.useful)}</td><td>{formatDays(r.lost)}</td><td>{r.reason}{r.lossCause && <small>{causeName(r.lossCause)}</small>}</td></tr>)}</tbody></table></div>;
}
export default function SeguimientoMantenimiento({ canManage, locomotoras, patioActivities = [], onOpenHistory, initialSelection, privatePreviewEvents = [], onPreviewFile }) {
  const [importing, setImporting] = useState(false);
  const [events, setEvents] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [week, setWeek] = useState(() => monday(initialSelection?.fecha || today())), [unit, setUnit] = useState(initialSelection?.codigo || ''), [place, setPlace] = useState(initialSelection?.place || 'Boulogne'), [view, setView] = useState('semana');
  const [selectedId, setSelectedId] = useState(initialSelection?.id || ''), [creating, setCreating] = useState(false), [update, setUpdate] = useState(null), [editingMeta, setEditingMeta] = useState(false), [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const saved = await fetchSeguimiento();
      setEvents([...saved, ...privatePreviewEvents.filter(preview => !saved.some(item => item.metadata?.pilotSourceId === preview.metadata?.pilotSourceId))]);
    } catch (e) {
      setEvents(privatePreviewEvents);
      setError(privatePreviewEvents.length ? 'Vista temporal desde archivo privado. La base todavía no guarda estos registros.' : e.message || 'No se pudo cargar el seguimiento.');
    } finally { setLoading(false); }
  }, [privatePreviewEvents]);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);
  const register = useMemo(() => toRegister(events), [events]);
  const range = { from: week, to: shiftDay(week, 6) };
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(week, i));
  const jobs = register.maintenances.filter(m => (!unit || m.unit === unit) && (!place || m.location === place) && m.start <= range.to && (!m.end || m.end >= range.from));
  const selected = register.maintenances.find(m => m.id === selectedId), event = events.find(e => e.id === selectedId);
  const previewOnly = event?.origen === 'vista-previa-privada';
  const episode = register.episodes.find(e => e.id === selectedId);
  const result = selected ? maintenanceEfficiency(register, selected, undefined) : null;
  const subset = { ...register, maintenances: jobs, observations: register.observations.filter(o => jobs.some(m => m.id === o.maintenanceId)), episodes: register.episodes.filter(e => jobs.some(m => m.episodeId === e.id)) };
  const unknownLocations = register.maintenances.filter(m => m.location === 'Ubicación por confirmar').length;
  const context = patioActivities.filter(a => a.active && (!unit || a.unit === unit) && !register.maintenances.some(m => m.unit === a.unit && !m.end));
  async function create(payload, files) {
    if (!canManage) throw new Error('No tenés permisos para cargar mantenimientos.');
    const saved = await createHistorialEvent(payload, files, locomotoras);
    setCreating(false); await load(); setSelectedId(saved.id);
  }
  async function saveUpdate(parent, payload, files) {
    if (!canManage) throw new Error('No tenés permisos para modificar el seguimiento.');
    if (payload.id) await editarActualizacion(payload, files, parent); else await crearActualizacion(payload, files, parent);
    await load();
  }
  async function saveMeta(e) {
    e.preventDefault(); if (!canManage) return;
    const form = new FormData(e.currentTarget); setSaving(true); setError('');
    try {
      await saveTracking(event, { ...event.metadata?.seguimiento, detentionStart: form.get('detentionStart'), location: form.get('location'), system: form.get('system') || 'Varios sistemas', component: form.get('component') || 'Locomotora completa' });
      setEditingMeta(false); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  function select(id) { setSelectedId(id); setEditingMeta(false); }
  return <main className="tracking-page">
    <header className="tracking-heading"><div><p className="eyebrow">Material rodante · Archivo integrado</p><h2>Seguimiento de mantenimiento</h2><p>Una línea por intervención. Trabajos, demoras y eficiencia con el mismo historial.</p></div>{canManage && <button className="primary-action" onClick={() => setCreating(true)}>+ Registrar mantenimiento</button>}</header>
    <div className="tracking-toolbar no-print">
      <button onClick={() => setWeek(shiftDay(week, -7))} aria-label="Semana anterior">←</button><label>Semana del<input type="date" value={week} onChange={e => e.target.value && setWeek(monday(e.target.value))} /></label><button onClick={() => setWeek(shiftDay(week, 7))} aria-label="Semana siguiente">→</button>
      <label>Locomotora<select value={unit} onChange={e => setUnit(e.target.value)}><option value="">Todas</option>{locomotoras.map(l => <option key={l.codigo}>{l.codigo}</option>)}</select></label>
      <label>Ubicación<select value={place} onChange={e => setPlace(e.target.value)}><option>Boulogne</option><option>Externo</option><option>Ubicación por confirmar</option><option value="">Todas</option></select></label>
      <button onClick={load} disabled={loading}>Actualizar</button><label className="tracking-private-file">Ver archivo privado (temporal)<input type="file" accept="application/json,.json" onChange={e => { const [file] = e.target.files || []; onPreviewFile?.(file); e.target.value = ''; }} /></label>{canManage && <button onClick={() => setImporting(true)}>Integrar archivo del piloto</button>}
    </div>
    <nav className="tracking-tabs no-print" aria-label="Vistas de mantenimiento">{[['semana', 'Seguimiento semanal'], ['indicadores', 'Eficiencia'], ['informe', 'Informe para compartir']].map(([id, name]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{name}</button>)}</nav>
    {error && <p role="alert" className="tracking-error">{error}</p>}
    {loading && <p role="status">Cargando historial…</p>}
    {!loading && <>
      <div className="tracking-period"><strong>{dateLabel(week)} — {dateLabel(range.to)}</strong><span>{jobs.length} mantenimiento(s) · {place || 'Todas las ubicaciones'}</span></div>
      {unknownLocations > 0 && <p className="tracking-note no-print">Hay {unknownLocations} mantenimiento(s) antiguo(s) sin ubicación confirmada. <button onClick={() => setPlace('Ubicación por confirmar')}>Revisar</button></p>}
      {!jobs.length && <div className="tracking-empty">No hay mantenimientos en este período y ubicación. Podés cargar uno o cambiar los filtros.</div>}
      {view === 'semana' && jobs.length > 0 && <div className="tracking-table-wrap"><div className="tracking-week"><div className="tracking-week-head"><strong>Locomotora</strong><div>{days.map(d => <span key={d}>{new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00Z'))}</span>)}</div></div>{[...new Set(jobs.map(m => m.unit))].sort().map(code => {
        const lanes = timelineLanes(register, jobs.filter(m => m.unit === code), week);
        return <div className="tracking-week-row" key={code}><strong>{code}</strong><div className="tracking-lanes" style={{ minHeight: `${Math.max(...lanes.map(x => x.lane)) * 56 + 70}px` }}>{lanes.map(({ m, column, span, lane }) => <button key={m.id} className={'tracking-bar ' + m.kind} style={{ gridColumn: `${column} / span ${span}`, gridRow: lane + 1 }} onClick={() => select(m.id)}><strong>{jobTitle(m)}</strong><span>{m.status === 'finalizado' ? 'Finalizado' : events.find(e => e.id === m.id)?.estadoMantenimiento === 'pausado' ? 'Pausado' : 'En curso'}</span></button>)}</div></div>;
      })}</div></div>}
      {view !== 'semana' && <>
        <p className="tracking-note">Eficiencia = días útiles equivalentes ÷ días incluidos × 100. Correctivos y pesados excluyen fines de semana sin intervención ni excepción. Los datos incompletos no se toman como pérdida. Los trabajos externos se muestran como referencia y no se evalúan con las reglas de Boulogne.</p>
        {jobs.length > 0 && <div className="tracking-table-wrap"><table className="tracking-table"><thead><tr><th>Unidad / mantenimiento</th><th>Útiles</th><th>Pérdida</th><th>Sin datos</th><th>Excluidos</th><th>Eficiencia semanal</th></tr></thead><tbody>{jobs.map(m => { const k = maintenanceEfficiency(register, m, range); return <tr key={m.id}><td><button className="tracking-job-link" onClick={() => select(m.id)}><strong>{m.unit}</strong> {jobTitle(m)}</button></td><td>{formatDays(k.worked)}</td><td>{formatDays(k.waited)}</td><td>{k.missing}</td><td>{k.excluded}</td><td><strong>{m.location !== 'Boulogne' ? 'Fuera de alcance' : k.percent == null ? 'Sin confirmar' : `${k.percent} %`}</strong><small>{m.location === 'Boulogne' ? k.reason : m.location}</small>{Object.entries(k.losses).map(([c,n]) => <small key={c}>{causeName(c)}: {formatDays(n)} día(s)</small>)}</td></tr>; })}</tbody></table></div>}
        {view === 'informe' && <p className="tracking-hint">Informe del período seleccionado · generado el {dateLabel(today())}. Incluye únicamente las unidades y ubicación elegidas. Revisá los datos antes de compartir.</p>}
      </>}
      <div className="tracking-toolbar no-print"><button onClick={() => download(`mantenimientos-${week}.csv`, registerCsv(subset))}>Descargar registros CSV</button><button onClick={() => download(`eficiencia-${week}.csv`, efficiencyCsv(register, jobs.filter(m => m.location === 'Boulogne'), range))}>Descargar eficiencia CSV</button><button onClick={() => download(`respaldo-mantenimientos-${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), events }, null, 2), 'application/json')}>Respaldo de mantenimientos</button>{view === 'informe' && <button className="primary-action" onClick={() => window.print()}>Imprimir / guardar PDF</button>}</div>
      {view === 'semana' && context.length > 0 && <details className="tracking-note no-print"><summary>Referencias del Patio sin mantenimiento asociado ({context.length})</summary>{context.map(a => <p key={a.id}>{a.unit} · {a.description || a.type}. El parte informa estado; falta confirmar la intervención y actividad.</p>)}</details>}
    </>}
    {selected && event && <div className="modal-backdrop"><section className="intervention-modal tracking-detail" role="dialog" aria-modal="true" aria-label={`Mantenimiento ${selected.unit}`}><div className="modal-heading"><div><span className="panel-kicker">{selected.unit} · {event.estadoMantenimiento}</span><h2>{jobTitle(selected)}</h2></div><button className="modal-close" aria-label="Cerrar detalle" onClick={() => select('')}>×</button></div>
      <dl className="tracking-facts"><div><dt>Detenida desde</dt><dd>{dateLabel(episode?.start)}</dd></div><div><dt>Intervención</dt><dd>{dateLabel(selected.start)} — {selected.end ? dateLabel(selected.end) : 'En curso'}</dd></div><div><dt>Parte atacada</dt><dd>{selected.system} · {selected.component}</dd></div><div><dt>Personal / ubicación</dt><dd>{selected.staff} · {selected.location}</dd></div></dl>
      <p>{event.descripcion}</p>
      {previewOnly && <p className="tracking-note">Vista temporal del archivo privado: podés revisar esta información en Seguimiento y Archivo Histórico. Para editarla y guardarla hace falta integrarla en la base.</p>}
      <div className="tracking-toolbar">{canManage && !previewOnly && <><button onClick={() => setEditingMeta(!editingMeta)}>Completar datos del mantenimiento</button><button className="primary-action" onClick={() => setUpdate({})}>+ Registrar novedad</button></>}<button onClick={() => onOpenHistory(selected.unit)}>Ver historial y adjuntos de la unidad</button></div>
      {editingMeta && <form onSubmit={saveMeta}><SeguimientoFields tipo={event.tipo} code={event.preventivoCodigo} tracking={event.metadata?.seguimiento} /><button className="primary-action" disabled={saving}>{saving ? 'Guardando…' : 'Confirmar datos'}</button></form>}
      <h3>Trabajos y novedades día a día</h3>
      {!(event.actualizaciones || []).length && <p>No hay actividad registrada. El motivo de ingreso no confirma trabajo realizado.</p>}
      {(event.actualizaciones || []).map(a => <article className="tracking-update" key={a.id}><strong>{dateLabel(a.fecha)} · {a.hora} · {a.responsable || 'Personal sin confirmar'}</strong><small>{a.tipoActualizacion} · {a.metadata?.seguimiento?.period || 'Turno sin confirmar'}</small><p>{a.descripcion}</p>{canManage && !previewOnly && <button onClick={() => setUpdate({ initialUpdate: a })}>Corregir / completar registro</button>}</article>)}
      <h3>Eficiencia de toda la intervención: {selected.location !== 'Boulogne' ? 'fuera de alcance' : result.percent == null ? 'sin confirmar' : `${result.percent} %`}</h3><p>{result.reason}</p>
      <DayBreakdown result={result} onComplete={canManage && !previewOnly ? date => setUpdate({ initialDate: date }) : null} />
      {error && <p role="alert" className="tracking-error">{error}</p>}
    </section></div>}
    {importing && <ImportarPilotoModal events={events} onClose={() => setImporting(false)} onImported={load} />}
    {creating && <RegistroEventoModal locomotoras={locomotoras} selectedLoco={locomotoras.find(l => l.codigo === unit) || locomotoras[0]} onClose={() => setCreating(false)} onSave={create} />}
    {update && event && <ActualizacionEventoModal key={update.initialUpdate?.id || update.initialDate || 'new'} event={event} mode={event.estadoMantenimiento === 'finalizado' ? 'observacion' : 'avance'} {...update} onClose={() => setUpdate(null)} onSave={saveUpdate} />}
  </main>;
}
