import { useState } from 'react';
import { preparePilotImport } from '../domain/maintenance/import.js';
import { supabase } from '../lib/supabase.js';
export default function ImportarPilotoModal({ events, onClose, onImported }) {
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const eligible = rows.filter(r => !r.skipped && !r.issues.length);
  async function read(e) {
    setError(''); setRows([]);
    try { const file = e.target.files[0]; if (!file) return; if (file.size > 8 * 1024 * 1024) throw new Error('El archivo supera 8 MB.'); setRows(preparePilotImport(JSON.parse(await file.text()), events)); } catch (e) { setError(e.message); }
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const { error } = await supabase.rpc('importar_seguimiento_piloto', { registros: eligible }); if (error) throw error; await onImported(); onClose(); } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop"><form className="intervention-modal tracking-detail" onSubmit={save}><div className="modal-heading"><h2>Integrar datos del piloto</h2><button type="button" onClick={onClose} aria-label="Cerrar">×</button></div><p>Seleccioná el respaldo JSON del piloto. Primero revisamos los registros; el archivo no se publica ni se incorpora al código.</p><input type="file" accept="application/json,.json" onChange={read} /><p>El piloto registra días y turnos, no horas exactas. Se conservan los datos originales y se identifican las horas de referencia. El CSV sirve para consultar; la importación usa JSON para conservar todos los campos.</p>{rows.map(r => <article className="tracking-update" key={r.sourceId}><strong>{r.event.locomotoraCodigo} · {r.event.fecha} · {r.event.titulo}</strong><p>{r.skipped ? 'Ya importado: se omite, sin sobrescribir cambios.' : r.issues.length ? r.issues.join(' ') : `Listo: ${r.actualizaciones.length} novedades.`}</p></article>)}{eligible.length > 0 && <label className="tracking-confirm"><input type="checkbox" required /> Revisé los {eligible.length} mantenimientos listos para integrar. Los demás quedan fuera de esta importación.</label>}<button className="primary-action" disabled={busy || !eligible.length}>{busy ? 'Importando…' : `Importar ${eligible.length} mantenimientos`}</button>{error && <p className="tracking-error" role="alert">{error}</p>}</form></div>;
}
