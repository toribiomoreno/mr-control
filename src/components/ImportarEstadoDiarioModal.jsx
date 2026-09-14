import { useState } from 'react';

import {
  blockingErrorLabel,
  buildFleetImportPreview,
  extractFleetReportDateTime,
} from '../services/importacionEstadoFlotaService.js';

export default function ImportarEstadoDiarioModal({
  locomotoras,
  onClose,
  onConfirm,
  onForbidden,
  canManage = false,
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);

  const processText = () => {
    const nextPreview = buildFleetImportPreview({ date, time, text, locomotoras });
    if (!date && nextPreview.date) setDate(nextPreview.date);
    if (!time && nextPreview.time) setTime(nextPreview.time);
    setPreview(nextPreview);
  };

  const updateText = (value) => {
    setText(value);
    const detected = extractFleetReportDateTime(value);
    if (!date && detected.date) setDate(detected.date);
    if (!time && detected.time) setTime(detected.time);
  };

  const confirm = () => {
    if (!canManage) {
      onForbidden?.();
      return;
    }
    if (!preview?.canConfirm) return;
    onConfirm(preview, text);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="intervention-modal fleet-import-modal">
        <div className="modal-heading">
          <div>
            <span className="panel-kicker">Patio</span>
            <h2>Importar estado diario</h2>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Cerrar">x</button>
        </div>

        <div className="fleet-import-grid">
          <label>Fecha del parte<input onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label>
          <label>Hora del parte<input onChange={(event) => setTime(event.target.value)} type="time" value={time} /></label>
        </div>
        <label>Contenido del mail
          <textarea
            onChange={(event) => updateText(event.target.value)}
            placeholder="Pega la tabla o texto del parte diario..."
            rows="8"
            value={text}
          />
        </label>

        {preview?.blockingErrors?.length > 0 && (
          <div className="fleet-import-errors" role="alert">
            {preview.blockingErrors.map((error) => <span key={error}>{blockingErrorLabel(error)}</span>)}
          </div>
        )}

        {preview && (
          <div className="fleet-import-preview">
            <div className="fleet-import-summary">
              <span>Filas: <strong>{preview.summary.processedRows}</strong></span>
              <span>Esperadas: <strong>{preview.summary.expectedRows}</strong></span>
              <span>Validas: <strong>{preview.summary.validRows}</strong></span>
              <span>Desconocidas: <strong>{preview.summary.unknownUnits}</strong></span>
              <span>Duplicados: <strong>{preview.summary.duplicates}</strong></span>
              <span>Invalidas: <strong>{preview.summary.invalidRows}</strong></span>
              <span>Faltantes: <strong>{preview.summary.missingUnits}</strong></span>
            </div>

            {(preview.date || preview.time) && (
              <p className="history-modal-note">
                Parte detectado: {preview.date || 'sin fecha'} {preview.time || 'sin hora'}.
              </p>
            )}

            {preview.reportSummaries.length > 0 && (
              <div className="fleet-import-reported-summary">
                <strong>Resumen informado en el parte</strong>
                {preview.reportSummaries.map((line) => <span key={line}>{line}</span>)}
              </div>
            )}

            {preview.missingUnits.length > 0 && (
              <p className="history-modal-note">
                Faltan en el parte: {preview.missingUnits.join(', ')}.
              </p>
            )}

            <div className="fleet-import-table-wrap">
              <table className="fleet-import-table">
                <thead>
                  <tr>
                    <th>Unidad</th>
                    <th>Estado anterior</th>
                    <th>Estado nuevo</th>
                    <th>Observacion</th>
                    <th>Clasificacion</th>
                    <th>Tipo detectado</th>
                    <th>Fecha/hora parte</th>
                    <th>Advertencias</th>
                    <th>Validacion</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr className={row.valid ? '' : 'has-error'} key={`${row.lineNumber}-${row.unit || row.raw}`}>
                      <td>{row.unit || '-'}</td>
                      <td>{row.previousLabel || '-'}</td>
                      <td>{row.newLabel || '-'}</td>
                      <td>{row.reason || '-'}</td>
                      <td>{row.classificationLabel || '-'}</td>
                      <td>{row.detectionLabel || row.preventiveCode || '-'}</td>
                      <td>{row.reportDate && row.reportTime ? `${row.reportDate} ${row.reportTime}` : '-'}</td>
                      <td>{row.warnings.join(' ') || '-'}</td>
                      <td>{row.valid ? 'OK' : row.errors.map(blockingErrorLabel).join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose} type="button">Cancelar</button>
          <button className="secondary-action" onClick={processText} type="button">Procesar</button>
          <button className="primary-action fleet-import-confirm" disabled={!preview?.canConfirm} onClick={confirm} type="button">
            Confirmar actualizacion
          </button>
        </div>
      </section>
    </div>
  );
}
