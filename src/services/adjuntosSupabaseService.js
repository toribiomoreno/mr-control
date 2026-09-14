import { assertSupabaseConfig, supabase } from '../lib/supabase.js';

const BUCKET = 'eventos-adjuntos';

function sanitizeFileName(name) {
  return String(name || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'archivo';
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function attachmentKind(file) {
  const name = String(file?.name || '').toLowerCase();
  if (file?.type?.startsWith('image/')) return 'Foto';
  if (file?.type === 'application/pdf' || name.endsWith('.pdf')) return 'PDF';
  if (name.includes('ot')) return 'OT';
  return 'OT';
}

export async function createSignedAttachmentUrl(storagePath) {
  assertSupabaseConfig();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadEventAttachments({ eventId, locomotoraCodigo, files }) {
  assertSupabaseConfig();
  const uploadFiles = Array.from(files || []).filter((file) => file?.name);
  if (uploadFiles.length === 0) return [];

  const rows = [];

  for (const [index, file] of uploadFiles.entries()) {
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${locomotoraCodigo}/${eventId}/${randomId()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadError) throw uploadError;

    rows.push({
      evento_id: eventId,
      tipo: attachmentKind(file),
      nombre_archivo: file.name,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size || 0,
      orden: index,
    });
  }

  const { data, error } = await supabase
    .from('adjuntos_evento')
    .insert(rows)
    .select('*');

  if (error) throw error;
  return data || [];
}

export async function deleteEventAttachmentFiles(eventId) {
  assertSupabaseConfig();
  const { data, error } = await supabase
    .from('adjuntos_evento')
    .select('storage_path')
    .eq('evento_id', eventId);

  if (error) throw error;

  const paths = (data || []).map((item) => item.storage_path).filter(Boolean);
  if (paths.length === 0) return;

  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) throw removeError;
}

export async function mapAttachmentRows(rows = []) {
  const mapped = [];

  for (const row of rows) {
    let url;
    try {
      url = row.storage_path ? await createSignedAttachmentUrl(row.storage_path) : '#';
    } catch {
      url = '#';
    }

    mapped.push({
      id: row.id,
      tipo: row.tipo,
      nombre: row.nombre_archivo,
      storageBucket: row.storage_bucket || BUCKET,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      orden: row.orden,
      url,
    });
  }

  return mapped.sort((a, b) => (a.orden || 0) - (b.orden || 0));
}
