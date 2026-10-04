import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { createSignedAttachmentUrl, uploadEventAttachments } from '../services/adjuntosSupabaseService.js';

export default function MaintenanceSheet({ event, canManage, onClose, onSaved }) {
  const [files, setFiles] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const ids = event.metadata?.maintenanceSheets || [];
    if (ids.length) supabase.from('adjuntos_evento').select('id,nombre_archivo,storage_path').eq('evento_id', event.id).in('id', ids).then(({data,error}) => { if(active) { setFiles(data || []); if(error) setError(error.message); } });
    return () => { active = false; };
  }, [event]);
  async function upload(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const attachments = new FormData(e.currentTarget).getAll('ficha').filter(f=>f?.name);
      if (!attachments.length) throw new Error('Seleccioná la ficha en PDF o imagen.');
      const rows = await uploadEventAttachments({eventId:event.id,locomotoraCodigo:event.locomotoraCodigo,files:attachments});
      const metadata = {...event.metadata,maintenanceSheets:[...(event.metadata?.maintenanceSheets || []),...rows.map(r=>r.id)]};
      const { data, error } = await supabase.from('eventos_historial').update({metadata}).eq('id',event.id).eq('metadata',JSON.stringify(event.metadata || {})).select('id');
      if(error) throw error;
      if(!data?.length) throw new Error('El mantenimiento cambió. Los archivos quedaron adjuntos; actualizá antes de vincular la ficha.');
      setFiles(previous=>[...previous,...rows]); await onSaved?.();
    } catch(cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function open(file) { try { const url=await createSignedAttachmentUrl(file.storage_path); window.open(url,'_blank','noopener,noreferrer'); } catch(cause) { setError(cause.message); } }
  return <div className="modal-backdrop"><section className="intervention-modal" role="dialog" aria-modal="true" aria-label="Ficha del mantenimiento"><div className="modal-heading"><div><span className="panel-kicker">{event.locomotoraCodigo} · Preventivo {event.preventivoCodigo}</span><h2>Ficha del mantenimiento</h2></div><button className="modal-close" aria-label="Cerrar ficha" onClick={onClose}>×</button></div>{!files.length && <p>No hay una ficha cargada para este mantenimiento. Podés adjuntar la ficha actual; la versión digital integrada queda para una próxima etapa.</p>}<ul>{files.map(file=><li key={file.id}><button onClick={()=>open(file)}>{file.nombre_archivo}</button></li>)}</ul>{canManage && <form onSubmit={upload}><label>Adjuntar ficha<input type="file" name="ficha" accept="application/pdf,image/*" required multiple /></label><button className="primary-action" disabled={busy}>{busy?'Guardando…':'Guardar ficha'}</button></form>}{error && <p className="tracking-error" role="alert">{error}</p>}</section></div>;
}
