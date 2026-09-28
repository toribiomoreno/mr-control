import { useState } from 'react';
import { today } from '../domain/maintenance/types.js';
import VoiceTextarea from './VoiceTextarea.jsx';

function currentTime() { return new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' }); }

export default function ConfirmarEstadoModal({ loco, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError(''); setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await onSave({ codigo: loco.codigo, estado: form.get('estado'), fecha: form.get('fecha'), hora: form.get('hora'), fuente: form.get('fuente') });
      onClose();
    } catch (cause) { setError(cause.message || 'No se pudo guardar la confirmación.'); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><form className="intervention-modal fleet-confirm-modal" onSubmit={submit} onInvalidCapture={event => setError(`Falta completar: ${event.target.closest('label')?.firstChild?.textContent?.trim() || 'un dato obligatorio'}.`)}>
    <div className="modal-heading"><div><span className="panel-kicker">Parque · {loco.codigo}</span><h2>Confirmar estado</h2></div><button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">×</button></div>
    <p>Registrá el estado que verificaste y la fuente. Esta confirmación queda en el historial de la locomotora.</p>
    <label>Estado confirmado<select name="estado" defaultValue="" required><option value="" disabled>Elegir estado</option><option value="operativa">Operativa</option><option value="reserva">Reserva</option><option value="uso_excepcional">Uso excepcional</option></select></label>
    <label>Fecha de la verificación<input type="date" name="fecha" defaultValue={today()} max={today()} required /></label>
    <label>Hora de la verificación<input type="time" name="hora" defaultValue={currentTime()} required /></label>
    <label>¿Cómo confirmaste el estado?<VoiceTextarea name="fuente" rows={3} placeholder="Ej.: verificado en el taller y en el parte diario" required /></label>
    <p className="tracking-hint">Si la máquina está detenida, registrá el mantenimiento y su motivo para conservar el seguimiento y la eficiencia.</p>
    <div className="modal-actions"><button type="button" className="secondary-action" onClick={onClose}>Cancelar</button><button type="submit" className="primary-action" disabled={saving}>{saving ? 'Guardando…' : 'Guardar confirmación'}</button></div>
    {error && <p className="tracking-error" role="alert">{error}</p>}
  </form></div>;
}
