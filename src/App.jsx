import { useCallback, useEffect, useState } from 'react';

import AreasMaterialRodante from './components/AreasMaterialRodante.jsx';
import CalendarioMantenimiento from './components/CalendarioMantenimiento.jsx';
import Home from './components/Home.jsx';
import HistorialLocomotora from './components/HistorialLocomotora.jsx';
import ImportarEstadoDiarioModal from './components/ImportarEstadoDiarioModal.jsx';
import Login from './components/Login.jsx';
import Patio from './components/Patio.jsx';
import RegistroEventoModal from './components/RegistroEventoModal.jsx';
import ReportesGestion from './components/ReportesGestion.jsx';
import Sidebar from './components/Sidebar.jsx';
import locoAzul from './assets/loco_azul.webp';
import locoRoja from './assets/loco_roja.webp';
import { useAuth } from './context/useAuth.js';
import initialLocomotoras from './data/locomotoras.js';
import { permisoDenegadoMensaje, puedeGestionarArchivoHistorico, puedeGestionarPatioCalendario } from './lib/permissions.js';
import { crearActualizacion } from './services/actualizacionesEventoSupabaseService.js';
import { createHistorialEvent, fetchHistorialByLocomotora } from './services/historialSupabaseService.js';
import { importarLibroNovedades } from './services/importacionLibroSupabaseService.js';
import { localStorageKeys } from './services/localStorageKeys.js';

// Historial local usado por el panel de intervenciones recientes del Patio.
const historyStorageKey = localStorageKeys.histories;

const interventionLabels = {
  correctivo: 'Correctivo',
  preventivo: 'Preventivo',
  lavado: 'Lavado',
  inspeccion: 'Inspeccion',
  prueba: 'Prueba',
};

function interventionClassFromType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized.includes('prevent')) return 'preventivo';
  if (normalized.includes('lavado')) return 'lavado';
  if (normalized.includes('inspe')) return 'inspeccion';
  if (normalized.includes('prueba')) return 'prueba';
  return 'correctivo';
}

function interventionTitle(item) {
  if (item.interventionClass !== 'preventivo') {
    return interventionLabels[item.interventionClass] || item.type || 'Intervencion';
  }

  const code = item.preventiveCode || 'sin codigo';
  const modality = item.modality === 'Externo' ? ' - Externo' : '';
  return `Preventivo ${code}${modality}`;
}

function formatDateDisplay(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function estadoEtiqueta(loco) {
  if (!loco) return '';
  if (loco.lavadoProgramado) return 'Programada para Lavado';
  if (['servicio', 'operativa'].includes(loco.estado)) return 'Operativa';
  if (loco.estado === 'reserva') return 'Reserva';
  if (loco.estado === 'uso_excepcional') return 'Uso excepcional';
  if (loco.estado === 'detenida') return 'Detenida';
  if (loco.estado === 'preventivo') {
    if (loco.tipoPreventivo && loco.modalidad) return `Preventivo ${loco.tipoPreventivo} - ${loco.modalidad}`;
    if (loco.tipoPreventivo) return `Preventivo ${loco.tipoPreventivo}`;
    return 'Mantenimiento Preventivo';
  }

  return 'Mantenimiento Correctivo';
}

function estadoOperativo(loco) {
  if (!loco) return '';
  if (loco.lavadoProgramado) return 'Operativa';
  if (loco.estado === 'reserva') return 'Reserva';
  if (loco.estado === 'uso_excepcional') return 'Uso excepcional';
  if (['detenida', 'preventivo', 'correctivo'].includes(loco.estado)) return 'Detenida';
  return 'Operativa';
}

function estadoOperativoClase(loco) {
  const estado = estadoOperativo(loco);
  if (estado === 'Operativa') return 'is-service';
  if (estado === 'Reserva') return 'is-reserve';
  if (estado === 'Uso excepcional') return 'is-exceptional';
  return 'is-corrective';
}

function estadoClase(estado) {
  if (estado?.lavadoProgramado) return 'is-wash';
  if (estado === 'servicio' || estado === 'operativa') return 'is-service';
  if (estado === 'reserva') return 'is-reserve';
  if (estado === 'uso_excepcional') return 'is-exceptional';
  if (estado === 'preventivo') return 'is-preventive';
  return 'is-corrective';
}

function imagenLocomotora(loco) {
  if (!loco) return locoRoja;
  return loco.codigo === '7774' || loco.colorEspecial === 'azul' ? locoAzul : locoRoja;
}

function areaClase(area) {
  if (area === 'Electrica') return 'electrical';
  if (area === 'Mecanica') return 'mechanical';
  return 'general';
}

function dotClase(area) {
  if (area === 'Electrica') return 'electric';
  if (area === 'Mecanica') return 'mechanic';
  return 'service';
}

function normalizeHistoryItem(item, loco) {
  const interventionClass = item.interventionClass || interventionClassFromType(item.type);
  const preventiveCode = interventionClass === 'preventivo' ? item.preventiveCode || item.preventiveType || '' : '';
  const preventiveFamily = interventionClass === 'preventivo'
    ? item.preventiveFamily || (String(preventiveCode || item.type || '').toLowerCase().includes('numeral') ? 'numeral' : 'liviana')
    : '';
  const modality = interventionClass === 'preventivo'
    ? preventiveFamily === 'numeral'
      ? item.modality || item.modalidad || 'Interno'
      : 'Interno'
    : '';

  return {
    ...item,
    interventionClass,
    preventiveFamily,
    preventiveCode,
    modality,
    type: item.type || interventionLabels[interventionClass] || 'Intervencion',
    locomotoraId: item.locomotoraId || loco.id,
    locomotoraCodigo: item.locomotoraCodigo || loco.codigo,
    area: item.area || 'General',
  };
}

function sortHistoryDescending(items) {
  return [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.id || 0) - (a.id || 0));
}

export default function App() {
  const { session, perfil, loading: authLoading, authError, signOut } = useAuth();
  const canManageHistory = puedeGestionarArchivoHistorico(perfil);
  const canManagePatioCalendar = puedeGestionarPatioCalendario(perfil);

  // Navegacion y seleccion de locomotoras.
  const [locomotoras, setLocomotoras] = useState(initialLocomotoras);
  const [tab, setTab] = useState('inicio');
  const [selected, setSelected] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalSource, setEventModalSource] = useState('archivo');
  const [permissionMessage, setPermissionMessage] = useState('');
  const [isFleetImportOpen, setIsFleetImportOpen] = useState(false);
  const [, setFleetStatusHistory] = useState([]);
  const [, setFleetImports] = useState([]);
  const [patioCalendarActivities, setPatioCalendarActivities] = useState([]);

  // Archivo historico completo y resumen local separado para el Patio.
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyStatus, setHistoryStatus] = useState('idle');
  const [historyError, setHistoryError] = useState('');
  const [histories, setHistories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(historyStorageKey)) || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(historyStorageKey, JSON.stringify(histories));
  }, [histories]);

  const historyLoco = historyTarget || selected;
  const defaultHistoryLoco = historyLoco || locomotoras.find((loco) => loco.codigo === '7774') || locomotoras[0];

  const loadHistoryEvents = useCallback(async (loco = defaultHistoryLoco) => {
    if (!loco?.codigo) return;
    setHistoryStatus('loading');
    setHistoryError('');

    try {
      const events = await fetchHistorialByLocomotora(loco.codigo, {
        canSyncMantenimiento: canManageHistory,
      });
      setHistoryEvents(events);
      setHistoryStatus('ready');
    } catch (error) {
      setHistoryEvents([]);
      setHistoryError(error.message || 'No fue posible conectarse con Supabase.');
      setHistoryStatus('error');
    }
  }, [canManageHistory, defaultHistoryLoco]);

  useEffect(() => {
    if (tab !== 'historial') return undefined;
    const timeoutId = window.setTimeout(() => loadHistoryEvents(defaultHistoryLoco), 0);
    return () => window.clearTimeout(timeoutId);
  }, [tab, defaultHistoryLoco, loadHistoryEvents]);

  const resumen = locomotoras.reduce(
    (totales, loco) => ({
      ...totales,
      [loco.estado]: totales[loco.estado] + 1,
      lavado: totales.lavado + (loco.lavadoProgramado ? 1 : 0),
    }),
    { servicio: 0, operativa: 0, reserva: 0, uso_excepcional: 0, preventivo: 0, correctivo: 0, detenida: 0, lavado: 0 },
  );
  const selectedHistory = selected ? histories[selected.id] || [] : [];
  const normalizedSelectedHistory = selected
    ? sortHistoryDescending(selectedHistory.map((item) => normalizeHistoryItem(item, selected)))
    : [];
  const latestPreventiveIntervention = normalizedSelectedHistory.find((item) => item.interventionClass === 'preventivo');
  const latestCorrectiveIntervention = normalizedSelectedHistory.find((item) => item.interventionClass === 'correctivo');
  const currentPreventiveType = selected?.tipoPreventivo || latestPreventiveIntervention?.preventiveCode || '';
  const currentCorrectiveType = latestCorrectiveIntervention?.area || 'General';

  const openHistory = (loco) => {
    setSelected(loco);
    setHistoryTarget(loco);
    setTab('historial');
  };

  const denyPermission = useCallback(() => {
    setPermissionMessage(permisoDenegadoMensaje);
    window.setTimeout(() => setPermissionMessage(''), 3200);
  }, []);

  const hasEventPermission = useCallback((source) => (
    source === 'patio' ? canManagePatioCalendar : canManageHistory
  ), [canManageHistory, canManagePatioCalendar]);

  const openEventModal = (loco = defaultHistoryLoco, source = 'archivo') => {
    if (!hasEventPermission(source)) {
      denyPermission();
      return;
    }

    setSelected(loco);
    setHistoryTarget(loco);
    setEventModalSource(source);
    setIsEventModalOpen(true);
  };

  const saveLocalInterventionEvent = (event) => {
    const next = locomotoras.find((loco) => loco.codigo === event.locomotoraCodigo);
    if (next) {
      const panelItem = {
        id: event.id || `${event.locomotoraCodigo}-${Date.now()}`,
        date: event.fecha,
        type: event.titulo,
        interventionClass: event.tipo,
        preventiveCode: event.tipo === 'preventivo' ? event.preventivoCodigo || event.titulo.replace('Preventivo ', '') : '',
        area: event.especialidad || 'General',
        locomotoraId: next.id,
        locomotoraCodigo: next.codigo,
        technician: event.responsable || 'Sin responsable asignado',
        detail: event.descripcion,
        criticidad: event.criticidad || 'baja',
      };

      setHistories((current) => ({
        ...current,
        [next.id]: sortHistoryDescending([panelItem, ...(current[next.id] || [])]),
      }));
      setSelected(next);
      setHistoryTarget(next);
    }
  };

  const saveHistoryEvent = async (event, files = []) => {
    if (!hasEventPermission(eventModalSource)) {
      denyPermission();
      throw new Error(permisoDenegadoMensaje);
    }

    if (eventModalSource !== 'archivo') {
      saveLocalInterventionEvent(event);
      setIsEventModalOpen(false);
      return;
    }

    const next = locomotoras.find((loco) => loco.codigo === event.locomotoraCodigo);
    const savedEvent = await createHistorialEvent(event, files, locomotoras);
    setHistoryEvents((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== savedEvent.id);
      return [savedEvent, ...withoutDuplicate];
    });

    if (next) {
      setSelected(next);
      setHistoryTarget(next);
    }

    setIsEventModalOpen(false);
  };

  const importLibroNovedades = async (file) => {
    if (!canManageHistory) {
      denyPermission();
      throw new Error(permisoDenegadoMensaje);
    }

    const csvText = await file.text();
    const result = await importarLibroNovedades({
      csvText,
      archivoOrigen: file.name,
      locomotoras,
    });

    await loadHistoryEvents(defaultHistoryLoco);
    return result;
  };

  const saveActualizacionEvento = async (event, actualizacion, files = []) => {
    if (!canManageHistory) {
      denyPermission();
      throw new Error(permisoDenegadoMensaje);
    }

    await crearActualizacion(actualizacion, files, event);
    await loadHistoryEvents(defaultHistoryLoco);
  };

  const openFleetImport = () => {
    if (!canManagePatioCalendar) {
      denyPermission();
      return;
    }
    setIsFleetImportOpen(true);
  };

  const activityTypeFromImportRow = (row) => {
    if (row.classification === 'preventivo') {
      return String(row.preventiveCode || '').toLowerCase().includes('numeral') ? 'numeral' : 'preventivo';
    }
    if (row.classification === 'correctivo') return 'correctivo';
    return 'detenida';
  };

  const applyFleetImport = (preview, originalText) => {
    if (!canManagePatioCalendar) {
      denyPermission();
      return;
    }

    const importId = `fleet-import-${Date.now()}`;
    const partDateTime = `${preview.date}T${preview.time}`;
    const rowsByUnit = new Map(preview.rows.filter((row) => row.valid).map((row) => [row.unit, row]));

    const nextLocomotoras = locomotoras.map((loco) => {
      const row = rowsByUnit.get(loco.codigo);
      if (!row) return loco;

      return {
        ...loco,
        estado: row.newState,
        observacion: row.reason,
        motivoEstado: row.reason,
        clasificacionDetencion: row.classification || '',
        tipoPreventivo: row.classification === 'preventivo' ? row.preventiveCode || loco.tipoPreventivo || '' : '',
        fechaHoraParte: partDateTime,
        fechaParte: preview.date,
        horaParte: preview.time,
        ultimaImportacionEstadoId: importId,
      };
    });

    const nextSelected = selected ? nextLocomotoras.find((loco) => loco.id === selected.id) : null;
    const nextHistoryTarget = historyTarget ? nextLocomotoras.find((loco) => loco.id === historyTarget.id) : null;

    setLocomotoras(nextLocomotoras);
    if (nextSelected) setSelected(nextSelected);
    if (nextHistoryTarget) setHistoryTarget(nextHistoryTarget);

    setFleetImports((current) => [{
      id: importId,
      fechaHoraParte: partDateTime,
      contenidoOriginal: originalText,
      cantidadFilas: preview.summary.processedRows,
      cantidadValidas: preview.summary.validRows,
      cantidadErrores: preview.summary.invalidRows,
      creadoEn: new Date().toISOString(),
    }, ...current]);

    setFleetStatusHistory((current) => [
      ...preview.rows.filter((row) => row.valid).map((row) => ({
        id: `${importId}-${row.unit}`,
        importacionId: importId,
        locomotoraCodigo: row.unit,
        estadoAnterior: row.previousState,
        estadoNuevo: row.newState,
        motivo: row.reason,
        clasificacionDetencion: row.classification || '',
        fechaHoraParte: partDateTime,
        creadoEn: new Date().toISOString(),
      })),
      ...current,
    ]);

    setPatioCalendarActivities((current) => {
      let next = current.map((activity) => ({ ...activity }));

      preview.rows.filter((row) => row.valid).forEach((row) => {
        const activeIndex = next.findIndex((activity) => activity.origin === 'patio' && activity.unit === row.unit && activity.active);

        if (row.newState !== 'detenida') {
          if (activeIndex !== -1) {
            next[activeIndex] = {
              ...next[activeIndex],
              active: false,
              endDate: preview.date,
              lastReportedAt: partDateTime,
            };
          }
          return;
        }

        const existing = activeIndex === -1 ? null : next[activeIndex];
        const activity = {
          ...(existing || {}),
          id: existing?.id || `patio-${row.unit}-${Date.now()}`,
          type: activityTypeFromImportRow(row),
          origin: 'patio',
          readOnly: true,
          active: true,
          unit: row.unit,
          startDate: existing?.startDate || preview.date,
          endDate: preview.date,
          lastReportedAt: partDateTime,
          description: row.reason || 'Detenida sin clasificar',
          classification: row.classification || 'sin_clasificar',
          preventiveCode: row.preventiveCode || '',
          numeral: String(row.preventiveCode || '').toLowerCase().includes('numeral') ? row.preventiveCode : '',
        };

        if (existing) next[activeIndex] = activity;
        else next = [activity, ...next];
      });

      return next;
    });
  };

  const sidebarActive = (() => {
    if (['inicio', 'areas', 'reportes'].includes(tab)) return 'inicio';
    if (tab === 'patio') return 'patio';
    if (tab === 'coches') return 'coches';
    if (tab === 'calendario') return 'calendario';
    if (tab === 'locos') return 'inventario';
    return 'archivo';
  })();

  if (authLoading) {
    return (
      <main className="auth-screen">
        <section className="auth-status-panel">
          <span className="panel-kicker">MR Control</span>
          <h1>Cargando sesión...</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (!perfil) {
    return (
      <main className="auth-screen">
        <section className="auth-status-panel">
          <span className="panel-kicker">Acceso pendiente</span>
          <h1>El acceso de este usuario todavía no está configurado</h1>
          {authError && <p>{authError}</p>}
          <button className="secondary-action" onClick={signOut} type="button">Cerrar sesión</button>
        </section>
      </main>
    );
  }

  if (!perfil.activo) {
    return (
      <main className="auth-screen">
        <section className="auth-status-panel">
          <span className="panel-kicker">Acceso pendiente</span>
          <h1>Usuario pendiente de habilitación</h1>
          <button className="secondary-action" onClick={signOut} type="button">Cerrar sesión</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar active={sidebarActive} onNavigate={setTab} onSignOut={signOut} perfil={perfil} />

      <div className="app-content">
        {permissionMessage && (
          <div className="permission-toast" role="alert">
            {permissionMessage}
          </div>
        )}

        {tab === 'inicio' && <Home onNavigate={setTab} />}

        {tab === 'areas' && <AreasMaterialRodante onNavigate={setTab} />}

        {tab === 'reportes' && <ReportesGestion onNavigate={setTab} />}

      {tab === 'patio' && (
        <main className="operations-layout">
          <Patio
            canManage={canManagePatioCalendar}
            locomotoras={locomotoras}
            onImportDailyState={openFleetImport}
            onOpenHistory={openHistory}
            selected={selected}
            setSelected={setSelected}
          />

          <aside className="side-panel">
            {selected ? (
              <>
                <div className="panel-heading">
                  <div>
                    <span className="panel-kicker">Locomotora seleccionada</span>
                    <h2>{selected.codigo}</h2>
                  </div>

                  <span className={`status-pill ${estadoOperativoClase(selected)}`}>
                    {estadoOperativo(selected)}
                  </span>
                </div>

                <div className={`panel-loco-preview ${selected.codigo === '7774' ? 'blue' : 'red'}`}>
                  <img alt={`Locomotora ${selected.codigo}`} src={imagenLocomotora(selected)} />
                </div>

                <div className="panel-section">
                  <h3>Estado actual</h3>

                  {['correctivo', 'detenida'].includes(selected.estado) && (
                    <>
                      <p><strong>Estado:</strong><br />Detenida</p>
                      <p><strong>ClasificaciÃ³n:</strong><br />{selected.clasificacionDetencion || currentCorrectiveType || 'Sin clasificar'}</p>
                    </>
                  )}

                  {selected.estado === 'preventivo' && (
                    <>
                      <p><strong>Estado:</strong><br />Mantenimiento preventivo</p>
                      <p><strong>Tipo preventivo:</strong><br />{currentPreventiveType || 'Pendiente de carga'}</p>
                    </>
                  )}

                  {(['servicio', 'operativa', 'reserva', 'uso_excepcional'].includes(selected.estado) || selected.lavadoProgramado) && (
                    <>
                      <p><strong>Estado:</strong><br />{estadoOperativo(selected)}</p>
                      <p><strong>Ultima intervencion preventiva:</strong><br />{latestPreventiveIntervention ? `${formatDateDisplay(latestPreventiveIntervention.date)} - ${interventionTitle(latestPreventiveIntervention)}` : 'Pendiente de carga'}</p>
                    </>
                  )}

                  {selected.fechaHoraParte && (
                    <p><strong>Ãšltimo parte:</strong><br />{selected.fechaParte} {selected.horaParte}</p>
                  )}
                  <p><strong>Observaciones:</strong><br />{selected.observacion || 'Sin observaciones'}</p>
                </div>

                <div className="panel-section timeline">
                  <h3>Historial reciente</h3>

                  {normalizedSelectedHistory.length > 0 ? (
                    normalizedSelectedHistory.slice(0, 5).map((item) => (
                      <article key={item.id}>
                        <b className={`dot ${dotClase(item.area)}`} />
                        <span>
                          {interventionTitle(item)}{' '}
                          <em className={`area-tag ${areaClase(item.area)}`}>{item.area || 'General'}</em>
                        </span>
                        <small>{formatDateDisplay(item.date)} - {item.technician}</small>
                        <p>{item.detail}</p>
                      </article>
                    ))
                  ) : (
                    <>
                      <article>
                        <b className="dot service" />
                        <span>Estado actualizado</span>
                        <small>Registro inicial</small>
                      </article>

                      <article>
                        <b className="dot preventive" />
                        <span>Datos cargados desde planilla</span>
                        <small>Estado actual</small>
                      </article>
                    </>
                  )}
                </div>

                <button className="secondary-action panel-history-action" onClick={() => openHistory(selected)} type="button">
                  Ver historial completo
                </button>
              </>
            ) : (
              <div className="empty-panel">
                <h2>Panel locomotora</h2>
                <p>Seleccione una locomotora del patio para ver su ficha tecnica.</p>

                <div className="panel-summary">
                  <span><strong>{resumen.servicio + resumen.operativa}</strong> Operativas</span>
                  <span><strong>{resumen.preventivo}</strong> Preventivo</span>
                  <span><strong>{resumen.correctivo + resumen.detenida}</strong> Detenidas</span>
                  <span><strong>{resumen.lavado}</strong> Lavado</span>
                </div>
              </div>
            )}
          </aside>
        </main>
      )}

      {tab === 'historial' && (
        <HistorialLocomotora
          canManage={canManageHistory}
          events={historyEvents}
          loadError={historyError}
          loading={historyStatus === 'loading'}
          loco={defaultHistoryLoco}
          locomotoras={locomotoras}
          locomotiveImage={imagenLocomotora}
          onCreateActualizacion={saveActualizacionEvento}
          onForbidden={denyPermission}
          onImportLibro={importLibroNovedades}
          onRegisterEvent={(loco) => openEventModal(loco, 'archivo')}
          onRetry={() => loadHistoryEvents(defaultHistoryLoco)}
          onLocomotiveChange={(codigo) => {
            const next = locomotoras.find((loco) => loco.codigo === codigo);
            setHistoryTarget(next || null);
            if (next) setSelected(next);
          }}
        />
      )}

      {isEventModalOpen && (
        <RegistroEventoModal
          locomotoras={locomotoras}
          onClose={() => setIsEventModalOpen(false)}
          onSave={saveHistoryEvent}
          selectedLoco={defaultHistoryLoco}
        />
      )}

      {tab === 'coches' && (
        <main className="module-placeholder">
          <section>
            <p className="eyebrow">Modulo pendiente</p>
            <h2>Coches</h2>
            <p>Este apartado queda reservado para inventario, patio, intervenciones e historial de coches cuando terminemos el modulo de locomotoras.</p>
          </section>
        </main>
      )}

      {tab === 'calendario' && (
        <CalendarioMantenimiento
          canManage={canManagePatioCalendar}
          locomotoras={locomotoras}
          onForbidden={denyPermission}
          patioActivities={patioCalendarActivities}
          onTaskRealized={saveLocalInterventionEvent}
        />
      )}

      {tab === 'locos' && (
        <main className="locomotive-list">
          <div className="yard-toolbar">
            <div>
              <p className="eyebrow">Inventario</p>
              <h2>Locomotoras</h2>
            </div>
          </div>

          <div className="list-grid">
            {locomotoras.map((loco) => (
              <article className={`inventory-card ${loco.lavadoProgramado ? 'is-wash' : estadoClase(loco.estado)}`} key={loco.id}>
                <img alt={`Locomotora ${loco.codigo}`} src={imagenLocomotora(loco)} />
                <div>
                  <h3>{loco.codigo}</h3>
                  <p>{estadoEtiqueta(loco)}</p>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}
      </div>
      {isFleetImportOpen && (
        <ImportarEstadoDiarioModal
          canManage={canManagePatioCalendar}
          locomotoras={locomotoras}
          onClose={() => setIsFleetImportOpen(false)}
          onConfirm={applyFleetImport}
          onForbidden={denyPermission}
        />
      )}
    </div>
  );
}
