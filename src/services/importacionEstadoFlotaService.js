export const fleetOperationalStates = {
  operativa: 'Operativa',
  reserva: 'Reserva',
  uso_excepcional: 'Uso excepcional',
  detenida: 'Detenida',
};

export const detentionClassifications = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
  sin_clasificar: 'Sin clasificar',
};

const blockingErrorMessages = {
  fecha_faltante: 'Falta la fecha del parte.',
  hora_faltante: 'Falta la hora del parte.',
  texto_vacio: 'Pega el contenido del parte antes de procesar.',
  unidad_desconocida: 'Unidad desconocida.',
  unidad_duplicada: 'Unidad duplicada en el parte.',
  estado_desconocido: 'Estado no reconocido.',
  fila_invalida: 'Fila sin unidad reconocida.',
  parte_incompleto: 'El parte no contiene toda la flota.',
};

const stateStartDefinitions = [
  { label: 'uso condicional', words: 2 },
  { label: 'uso excepcional', words: 2 },
  { label: 'en servicio', words: 2 },
  { label: 'fuera de servicio', words: 3 },
  { label: 'condicional', words: 1 },
  { label: 'excepcional', words: 1 },
  { label: 'operativa', words: 1 },
  { label: 'operativo', words: 1 },
  { label: 'servicio', words: 1 },
  { label: 'reserva', words: 1 },
  { label: 'detenida', words: 1 },
  { label: 'detenido', words: 1 },
];

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value) {
  return stripAccents(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseReportDate(day, month, year) {
  const parsedDay = Number(day);
  const parsedMonth = Number(month);
  const parsedYear = Number(year.length === 2 ? `20${year}` : year);
  const date = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));

  if (
    date.getUTCFullYear() !== parsedYear
    || date.getUTCMonth() !== parsedMonth - 1
    || date.getUTCDate() !== parsedDay
  ) {
    return '';
  }

  return `${parsedYear}-${pad2(parsedMonth)}-${pad2(parsedDay)}`;
}

export function extractFleetReportDateTime(text) {
  const source = String(text || '');
  const normalized = stripAccents(source).replace(/\s+/g, ' ');
  const dateTimeMatch = normalized.match(/(?:\bal\b\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4}).{0,80}?\ba\s+las\s+(\d{1,2}):(\d{2})\s*(?:hs?\.?|horas?)?/i);
  const dateOnlyMatch = normalized.match(/(?:\bal\b\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  const timeOnlyMatch = normalized.match(/\ba\s+las\s+(\d{1,2}):(\d{2})\s*(?:hs?\.?|horas?)?/i);
  const dateMatch = dateTimeMatch || dateOnlyMatch;
  const timeMatch = dateTimeMatch || timeOnlyMatch;

  return {
    date: dateMatch ? parseReportDate(dateMatch[1], dateMatch[2], dateMatch[3]) : '',
    time: timeMatch ? `${pad2(Number(timeMatch[4] || timeMatch[1]))}:${pad2(Number(timeMatch[5] || timeMatch[2]))}` : '',
    source: dateTimeMatch ? dateTimeMatch[0].trim() : '',
  };
}

export function normalizeUnitCode(value) {
  const compact = String(value || '').replace(/\s+/g, '').toUpperCase();
  const threeDigitMatch = compact.match(/^E?(\d{3})$/);
  const emMatch = compact.match(/^EM(\d{1,2})$/);

  if (threeDigitMatch) {
    const number = Number(threeDigitMatch[1]);
    if (number >= 701 && number <= 721) return `E${threeDigitMatch[1]}`;
    return threeDigitMatch[1];
  }

  if (/^\d{4}$/.test(compact)) return compact;
  if (emMatch) return `EM${pad2(Number(emMatch[1]))}`;
  return compact;
}

export function normalizeOperationalState(value) {
  const normalized = normalizeText(value);
  if (!normalized) return { state: 'operativa', label: fleetOperationalStates.operativa };
  if (['servicio', 'operativa', 'operativo', 'en servicio'].includes(normalized)) return { state: 'operativa', label: fleetOperationalStates.operativa };
  if (normalized === 'reserva') return { state: 'reserva', label: fleetOperationalStates.reserva };
  if (['uso excepcional', 'uso condicional', 'condicional', 'excepcional'].includes(normalized)) return { state: 'uso_excepcional', label: fleetOperationalStates.uso_excepcional };
  if (['detenida', 'detenido', 'fuera de servicio'].includes(normalized)) return { state: 'detenida', label: fleetOperationalStates.detenida };
  return { state: '', label: '', error: 'estado_desconocido' };
}

export function operationalStateFromLocomotive(loco) {
  if (!loco) return '';
  if (loco.estado === 'operativa' || loco.estado === 'servicio') return 'operativa';
  if (loco.estado === 'reserva') return 'reserva';
  if (loco.estado === 'uso_excepcional') return 'uso_excepcional';
  if (loco.estado === 'detenida' || loco.estado === 'preventivo' || loco.estado === 'correctivo') return 'detenida';
  if (String(loco.observacion || '').toLowerCase().includes('uso excepcional')) return 'uso_excepcional';
  return 'operativa';
}

function titleCaseNumeral(value) {
  const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^numeral/i, 'Numeral');
}

export function classifyDetentionReason(reason) {
  const rawReason = String(reason || '').trim();
  const normalized = normalizeText(rawReason);
  if (!normalized) {
    return {
      classification: 'sin_clasificar',
      preventiveCode: '',
      subtype: '',
      identifier: '',
      detectionLabel: '',
    };
  }

  const numeralMatch = rawReason.match(/\bnumeral(?:\s+(\d+)|(?:\s+en\s+[^.;,\n]+))?/i);
  if (numeralMatch) {
    const detectionLabel = titleCaseNumeral(numeralMatch[0]);
    return {
      classification: 'preventivo',
      preventiveCode: detectionLabel,
      subtype: 'Numeral',
      identifier: numeralMatch[1] || detectionLabel,
      detectionLabel,
    };
  }

  const preventiveMatch = normalized.match(/\b(?:mantenimiento\s+)?preventivo\s+(abc|ab|a|e)\b/);
  if (preventiveMatch) {
    const preventiveCode = preventiveMatch[1].toUpperCase();
    return {
      classification: 'preventivo',
      preventiveCode,
      subtype: 'Preventivo',
      identifier: preventiveCode,
      detectionLabel: `Preventivo ${preventiveCode}`,
    };
  }

  if (/\b(examen|preventivo)\b/.test(normalized)) {
    return {
      classification: 'preventivo',
      preventiveCode: '',
      subtype: normalized.includes('examen') ? 'Examen' : 'Preventivo',
      identifier: '',
      detectionLabel: normalized.includes('examen') ? 'Examen' : 'Preventivo',
    };
  }

  if (/\b(correctivo|falla|averia|motor|freno|traccion|generador|compresor|bateria|perdida|no arranca|fuera de servicio por falla)\b/.test(normalized)) {
    return {
      classification: 'correctivo',
      preventiveCode: '',
      subtype: 'Correctivo',
      identifier: '',
      detectionLabel: 'Correctivo',
    };
  }

  return {
    classification: 'sin_clasificar',
    preventiveCode: '',
    subtype: '',
    identifier: '',
    detectionLabel: '',
  };
}

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(';')) return line.split(';');
  if ((line.match(/,/g) || []).length >= 2) return line.split(',');
  return line.split(/\s{2,}/);
}

function detectColumns(cells) {
  const normalized = cells.map(normalizeText);
  if (
    normalized.length === 1
    && ['loc', 'loc.', 'unidad', 'locomotora'].some((name) => normalized[0].includes(name))
    && normalized[0].includes('estado')
    && ['observacion', 'observaciones', 'detalle', 'motivo'].some((name) => normalized[0].includes(name))
  ) {
    return { unitIndex: 0, stateIndex: 1, reasonIndex: 2 };
  }

  const unitIndex = normalized.findIndex((cell) => ['loc.', 'loc', 'unidad', 'locomotora', 'maquina', 'codigo'].some((name) => cell === name || cell.includes(name)));
  const stateIndex = normalized.findIndex((cell) => cell === 'estado' || cell.includes('estado'));
  const reasonIndex = normalized.findIndex((cell) => ['motivo', 'detalle', 'observacion', 'observaciones', 'novedad'].some((name) => cell === name || cell.includes(name)));

  if (unitIndex === -1) return null;
  return {
    unitIndex: unitIndex === -1 ? 0 : unitIndex,
    stateIndex: stateIndex === -1 ? null : stateIndex,
    reasonIndex: reasonIndex === -1 ? null : reasonIndex,
  };
}

function extractStateFromRemainder(remainder) {
  const normalizedRemainder = normalizeText(remainder);
  const match = stateStartDefinitions.find((definition) => (
    normalizedRemainder === definition.label
    || normalizedRemainder.startsWith(`${definition.label} `)
  ));

  if (!match) {
    return { rawState: remainder.trim(), reason: '' };
  }

  const words = remainder.trim().split(/\s+/);
  return {
    rawState: words.slice(0, match.words).join(' '),
    reason: words.slice(match.words).join(' ').trim(),
  };
}

function parseLooseLine(line) {
  const unitMatch = line.match(/^\s*((?:E\s*)?\d{3}|\d{4}|EM\s*\d{1,2})\b/i);
  if (!unitMatch) return null;

  const unit = normalizeUnitCode(unitMatch[1]);
  const remainder = line.slice(unitMatch[0].length).trim();
  if (!remainder) return { unit, rawState: '', reason: '' };

  return {
    unit,
    ...extractStateFromRemainder(remainder),
  };
}

function rowFromCells(cells, columns, rawLine) {
  if (cells.length <= 1) {
    const looseRow = parseLooseLine(rawLine);
    if (looseRow) return looseRow;
  }

  return {
    unit: normalizeUnitCode(cells[columns.unitIndex]),
    rawState: columns.stateIndex === null ? '' : String(cells[columns.stateIndex] || '').trim(),
    reason: columns.reasonIndex === null ? '' : String(cells[columns.reasonIndex] || '').trim(),
  };
}

function isSummaryLine(line) {
  const normalized = normalizeText(line);
  return /^(formaciones|maquinas|maquinas para|maquinas disponibles)/.test(normalized);
}

function isIgnorableLine(line) {
  const normalized = normalizeText(line);
  if (!normalized) return true;
  if (normalized === 'detenida') return true;
  if (normalized.startsWith('estado del parque tractivo')) return true;
  if (isSummaryLine(line)) return true;
  return false;
}

export function extractFleetReportSummaries(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && isSummaryLine(line));
}

export function parseFleetStatusText(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let columns = { unitIndex: 0, stateIndex: 1, reasonIndex: 2 };
  let tableStarted = false;
  const rows = [];

  lines.forEach((line, index) => {
    if (isIgnorableLine(line)) return;

    const cells = splitLine(line).map((cell) => cell.trim()).filter((cell) => cell !== '');
    const detectedColumns = detectColumns(cells);

    if (detectedColumns) {
      columns = detectedColumns;
      tableStarted = true;
      return;
    }

    const looseRow = parseLooseLine(line);
    if (!tableStarted && !looseRow) return;

    const row = rowFromCells(cells, columns, line);
    if (!row?.unit) {
      rows.push({
        lineNumber: index + 1,
        raw: line,
        unit: '',
        rawState: '',
        reason: '',
      });
      return;
    }

    tableStarted = true;
    rows.push({
      lineNumber: index + 1,
      raw: line,
      ...row,
    });
  });

  return rows;
}

export function buildFleetImportPreview({ date, time, text, locomotoras }) {
  const detectedDateTime = extractFleetReportDateTime(text);
  const effectiveDate = date || detectedDateTime.date;
  const effectiveTime = time || detectedDateTime.time;
  const validCodes = new Set(locomotoras.map((loco) => normalizeUnitCode(loco.codigo)));
  const rows = parseFleetStatusText(text);
  const seen = new Map();
  const errors = [];

  if (!effectiveDate) errors.push('fecha_faltante');
  if (!effectiveTime) errors.push('hora_faltante');
  if (!String(text || '').trim()) errors.push('texto_vacio');

  const previewRows = rows.map((row) => {
    const warnings = [];
    const rowErrors = [];
    const isKnown = validCodes.has(row.unit);
    const duplicate = row.unit && seen.has(row.unit);
    const stateResult = normalizeOperationalState(row.rawState);
    const locomotive = locomotoras.find((loco) => normalizeUnitCode(loco.codigo) === row.unit);
    const previousState = operationalStateFromLocomotive(locomotive);
    const classification = stateResult.state === 'detenida'
      ? classifyDetentionReason(row.reason)
      : { classification: '', preventiveCode: '', subtype: '', identifier: '', detectionLabel: '' };

    if (!row.unit) rowErrors.push('fila_invalida');
    if (row.unit && !isKnown) rowErrors.push('unidad_desconocida');
    if (duplicate) rowErrors.push('unidad_duplicada');
    if (stateResult.error) rowErrors.push(stateResult.error);
    if (row.unit && !duplicate) seen.set(row.unit, row);
    if (stateResult.state === 'detenida' && classification.classification === 'sin_clasificar') warnings.push('Detencion sin clasificar.');

    return {
      ...row,
      previousState,
      previousLabel: fleetOperationalStates[previousState] || '',
      newState: stateResult.state,
      newLabel: stateResult.label,
      classification: classification.classification,
      classificationLabel: detentionClassifications[classification.classification] || '',
      preventiveCode: classification.preventiveCode,
      detentionSubtype: classification.subtype,
      detentionIdentifier: classification.identifier,
      detectionLabel: classification.detectionLabel,
      reportDate: effectiveDate,
      reportTime: effectiveTime,
      warnings,
      errors: rowErrors,
      valid: rowErrors.length === 0,
    };
  });

  const presentCodes = new Set(previewRows.filter((row) => row.valid).map((row) => row.unit));
  const missingUnits = locomotoras.map((loco) => normalizeUnitCode(loco.codigo)).filter((code) => !presentCodes.has(code));
  if (missingUnits.length > 0 && rows.length > 0) errors.push('parte_incompleto');

  const uniqueErrors = Array.from(new Set([
    ...errors,
    ...previewRows.flatMap((row) => row.errors),
  ]));

  return {
    date: effectiveDate,
    time: effectiveTime,
    detectedDateTime,
    reportSummaries: extractFleetReportSummaries(text),
    rows: previewRows,
    missingUnits,
    blockingErrors: uniqueErrors,
    canConfirm: uniqueErrors.length === 0,
    summary: {
      processedRows: rows.length,
      validRows: previewRows.filter((row) => row.valid).length,
      expectedRows: locomotoras.length,
      unknownUnits: previewRows.filter((row) => row.errors.includes('unidad_desconocida')).length,
      duplicates: previewRows.filter((row) => row.errors.includes('unidad_duplicada')).length,
      invalidRows: previewRows.filter((row) => row.errors.length > 0).length,
      missingUnits: missingUnits.length,
    },
  };
}

export function buildFleetImportParserExamples(locomotoras = []) {
  const sampleText = [
    'Estado del parque tractivo, al 30/06/2026 a las 5:49 hs',
    'Formaciones para el servicio 14 + 1 de reserva = 15',
    'Maquinas disponibles: 19 + 3 Excepcional',
    'Detenida',
    'Loc. Estado Observaciones',
    '701',
    '703 Reserva Revision actuacion PCS',
    '704 Uso condicional',
    '707 Detenida numeral 6',
    '708 Detenida Numeral en EMEPA.',
    '713 Detenida Mantenimiento preventivo E Turno tarde',
    '7774 Servicio Disponible',
    '999 Detenida falla de motor',
    '707 Detenida numeral 8',
  ].join('\n');

  const parsedRows = parseFleetStatusText(sampleText);
  return {
    detectedDateTime: extractFleetReportDateTime(sampleText),
    parsedRows,
    preview: locomotoras.length > 0
      ? buildFleetImportPreview({ date: '', time: '', text: sampleText, locomotoras })
      : null,
  };
}

export function blockingErrorLabel(error) {
  return blockingErrorMessages[error] || 'Hay errores en el parte.';
}
