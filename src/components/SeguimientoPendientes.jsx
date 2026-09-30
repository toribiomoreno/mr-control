import { useEffect, useState } from 'react';
import { followUpLabels, pendingFollowUps } from '../domain/maintenance/followUp.js';
import { dateLabel, today } from '../domain/maintenance/types.js';
import { guardarResultadoSeguimiento } from '../services/estadoDiarioSupabaseService.js';
import VoiceTextarea from './VoiceTextarea.jsx';

const currentTime = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });
export default function SeguimientoPendientes({ events, canManage, onSaved, onNewMaintenance }) {
  const [clock, setClock] = useState(() => `${today()} ${currentTime()}`);
  const [request, setRequest] = useState(null);
  const [result, setResult] = useState('');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setClock(`${today()} ${currentTime()}`), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const pending = pendingFollowUps(events, clock.slice(0, 10), clock.slice(11)).filter(item => item.due);
  const open = item => { setRequest(item); setResult(''); setError(''); };
  async function submit(event) {
    event.preventDefault(); if (!canManage) return;
    const form = new FormData(event.currentTarget);
    const fecha = form.get('fecha');
    setSaving(true); setError('');
    try {
      const saved = await guardarResultadoSeguimiento(request, { result, fecha, hora: form.get('hora'), descripcion: form.get('descripcion') });
      await onSaved?.(); setRequest(null);
      if (saved.needsMaintenance) onNewMaintenance?.(request.codigo, fecha);
    } catch (cause) { setError(cause.message || 'No se pudo guardar el resultado.'); }
    finally { setSaving(false); }
  }
  return <>
    {pending.length > 0 && <section className="followup-notice" aria-label="Consultas de salidas y pruebas"><strong>¿Cómo quedaron después de salir?</strong>{pending.map(item => <div key={item.key}><span><b>{item.codigo}</b> · {followUpLabels[item.kind]} del {dateLabel(item.date)}</span>{canManage && <button type="button" onClick={() => open(item)}>Registrar resultado</button>}</div>)}</section>}
    {request && <div className="modal-backdrop"><form className="intervention-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label={`Resultado de ${request.codigo}`}>
      <div className="modal-heading"><div><span className="panel-kicker">{request.codigo} · {followUpLabels[request.kind]}</span><h2>¿Cómo volvió la máquina?</h2></div><button className="modal-close" type="button" disabled={saving} aria-label="Cerrar consulta" onClick={() => setRequest(null)}>×</button></div>
      <div className="tracking-choices">{[['sin_novedades', 'Sin novedades · operativa'], ['pendiente', 'Sigue pendiente'], ['nueva_falla', 'Detenida · nueva falla']].map(([value, label]) => <button type="button" key={value} aria-pressed={result === value} onClick={() => setResult(value)}>{label}</button>)}</div>
      <label>Fecha de la novedad<input name="fecha" type="date" min={request.date} max={today()} defaultValue={today()} required /></label>
      <label>Hora de la novedad<input name="hora" type="time" defaultValue={currentTime()} required /></label>
      <label>Novedad / resultado<VoiceTextarea key={result} name="descripcion" rows={3} defaultValue={result === 'sin_novedades' ? 'Regresó y se confirmó operativa, sin novedades en la salida o prueba.' : ''} required /></label>
      <p className="tracking-hint">La respuesta queda junto al registro de origen.{request.event.tipo === 'correctivo' || request.event.tipo === 'preventivo' ? ' Se agrega al mismo mantenimiento, sin computar trabajo no informado.' : ' Se registra como novedad de la misma máquina.'}{result === 'pendiente' && ' Se volverá a consultar mañana desde las 9.'}{result === 'nueva_falla' && ' Si el trabajo anterior ya terminó, tendrás que completar el ingreso del nuevo mantenimiento.'}</p>
      {error && <p className="tracking-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-action" disabled={saving} onClick={() => setRequest(null)}>Cancelar</button><button type="submit" className="primary-action" disabled={saving || !result}>{saving ? 'Guardando…' : 'Guardar resultado'}</button></div>
    </form></div>}
  </>;
}
