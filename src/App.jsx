import { useCallback, useEffect, useState } from 'react';

import AreasMaterialRodante from './components/AreasMaterialRodante.jsx';
import SeguimientoMantenimiento from './components/SeguimientoMantenimiento.jsx';
import Home from './components/Home.jsx';
import HistorialLocomotora from './components/HistorialLocomotora.jsx';
import ConfirmarEstadoModal from './components/ConfirmarEstadoModal.jsx';
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
import { previewPilotEvents } from './domain/maintenance/import.js';
import { fleetFromTracking } from './domain/maintenance/fleetState.js';
import { permisoDenegadoMensaje, puedeGestionarArchivoHistorico, puedeGestionarPatioCalendario } from './lib/permissions.js';
import { crearActualizacion } from './services/actualizacionesEventoSupabaseService.js';
import { createHistorialEvent, fetchHistorialByLocomotora } from './services/historialSupabaseService.js';
import { importarLibroNovedades } from './services/importacionLibroSupabaseService.js';
import { fetchSeguimiento } from './services/seguimientoService.js';
import { fetchFleetConfirmations, saveFleetConfirmation } from './services/fleetConfirmationService.js';

const interventionLabels = {
  correctivo: 'Correctivo',
  preventivo: 'Preventivo',
  lavado: 'Lavado',
  inspeccion: 'Inspeccion',
  prueba: 'Prueba',
};


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
  if (loco.estado === 'sin_confirmar') return 'Sin estado confirmado';
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
  if (estado === 'Sin estado confirmado') return 'is-reserve';
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
  const [trackingSelection, setTrackingSelection] = useState(null);
  const [privatePreviewEvents, setPrivatePreviewEvents] = useState([]);
  const [privatePreviewMessage, setPrivatePreviewMessage] = useState('');
  const [privatePreviewNotes, setPrivatePreviewNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalSource, setEventModalSource] = useState('archivo');
  const [permissionMessage, setPermissionMessage] = useState('');
  const [isFleetImportOpen, setIsFleetImportOpen] = useState(false);
  const [, setFleetStatusHistory] = useState([]);
  const [, setFleetImports] = useState([]);
  const [, setPatioCalendarActivities] = useState([]);

  // Archivo historico y estado del parque comparten el seguimiento.
  const [historyEvents, setHistoryEvents] = useState([]);
  const [trackingEvents, setTrackingEvents] = useState([]);
  const [fleetConfirmations, setFleetConfirmations] = useState([]);
  const [confirmationTarget, setConfirmationTarget] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingRevision, setTrackingRevision] = useState(0);
  const [historyStatus, setHistoryStatus] = useState('idle');
  const [historyError, setHistoryError] = useState('');

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

  useEffect(() => {
    if (!session || !perfil?.activo) return undefined;
    let active = true;
    Promise.all([fetchSeguimiento(), fetchFleetConfirmations()]).then(([events, confirmations]) => {
      if (active) { setTrackingEvents(events); setFleetConfirmations(confirmations); setTrackingError(''); }
    }).catch(error => { if (active) setTrackingError(error.message); });
    return () => { active = false; };
  }, [session, perfil?.activo, tab, trackingRevision]);

  const combinedTracking = [...trackingEvents, ...privatePreviewEvents.filter(preview =>
    !trackingEvents.some(saved => saved.metadata?.pilotSourceId === preview.metadata?.pilotSourceId))];
  const parque = fleetFromTracking(locomotoras, [...combinedTracking, ...fleetConfirmations]);
  const parqueSelected = selected ? parque.find(loco => loco.codigo === selected.codigo) : null;
  const parqueHistoryTarget = historyTarget ? parque.find(loco => loco.codigo === historyTarget.codigo) : null;

  const resumen = parque.reduce(
    (totales, loco) => ({
      ...totales,
      [loco.estado]: totales[loco.estado] + 1,
      lavado: totales.lavado + (loco.lavadoProgramado ? 1 : 0),
    }),
    { servicio: 0, operativa: 0, reserva: 0, uso_excepcional: 0, preventivo: 0, correctivo: 0, detenida: 0, sin_confirmar: 0, lavado: 0 },
  );
  const normalizedSelectedHistory = selected
    ? sortHistoryDescending(combinedTracking.filter(item => item.locomotoraCodigo === selected.codigo).map(item => ({
      id: item.id, date: item.fecha, type: item.titulo, interventionClass: item.tipo,
      preventiveCode: item.preventivoCodigo, area: item.especialidad,
      technician: item.responsable || 'Por confirmar', detail: item.descripcion,
    })))
    : [];
  const latestPreventiveIntervention = normalizedSelectedHistory.find((item) => item.interventionClass === 'preventivo');

  const openHistory = (loco) => {
    setSelected(loco);
    setHistoryTarget(loco);
    setTab('historial');
  };

  const resolvePendingFleet = (loco) => {
    const open = combinedTracking.filter(item => item.locomotoraCodigo === loco.codigo && ['preventivo', 'correctivo'].includes(item.tipo) && !item.anulado && item.estadoMantenimiento !== 'finalizado')
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    if (open) {
      setTrackingSelection({ id: open.id, codigo: loco.codigo, fecha: open.fecha });
      setTab('calendario');
      return;
    }
    setConfirmationTarget(loco);
  };

  const confirmFleet = async (data) => {
    if (!canManageHistory) throw new Error(permisoDenegadoMensaje);
    const saved = await saveFleetConfirmation(data, locomotoras, perfil?.nombre || perfil?.email, combinedTracking);
    setFleetConfirmations(current => [saved, ...current]);
    if (historyLoco?.codigo === data.codigo) await loadHistoryEvents(historyLoco);
  };

  const loadPrivatePreview = async (file) => {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('El archivo supera 8 MB.');
      const parsed = JSON.parse(await file.text());
      const next = previewPilotEvents(parsed);
      setPrivatePreviewEvents(next);
      setPrivatePreviewNotes(Array.isArray(parsed.notasPendientes) ? parsed.notasPendientes : []);
      setPrivatePreviewMessage(`Vista temporal: ${next.length} mantenimientos del archivo ${file.name}. Los datos se borran al cerrar esta pestaña.`);
    } catch (error) {
      setPrivatePreviewNotes([]);
      setPrivatePreviewMessage(error.message || 'No se pudo abrir el archivo privado.');
    }
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

  const saveHistoryEvent = async (event, files = []) => {
    if (!hasEventPermission(eventModalSource)) {
      denyPermission();
      throw new Error(permisoDenegadoMensaje);
    }


    const next = locomotoras.find((loco) => loco.codigo === event.locomotoraCodigo);
    const savedEvent = await createHistorialEvent(event, files, locomotoras);
    setTrackingRevision(value => value + 1);
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
    if (tab === 'configuracion') return 'configuracion';
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
      <Sidebar active={sidebarActive} onNavigate={(nextTab) => { setTrackingSelection(null); setTab(nextTab); }} onSignOut={signOut} perfil={perfil} />

      <div className="app-content">
        {privatePreviewMessage && <div className="history-modal-note" role="status">{privatePreviewMessage}{privatePreviewNotes.length > 0 && <details><summary>{privatePreviewNotes.length} datos por confirmar</summary><ul>{privatePreviewNotes.map((note) => <li key={note}>{note}</li>)}</ul></details>}</div>}
        {trackingError && <div className="history-modal-note" role="status">Base de seguimiento pendiente: {trackingError} Podés revisar un archivo privado temporalmente.</div>}
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
            canConfirm={canManageHistory}
            locomotoras={parque}
            onImportDailyState={openFleetImport}
            onOpenHistory={openHistory}
            onResolvePending={resolvePendingFleet}
            selected={parqueSelected}
            setSelected={setSelected}
          />

          <aside className="side-panel">
            {parqueSelected ? (
              <>
                <div className="panel-heading">
                  <div>
                    <span className="panel-kicker">Locomotora seleccionada</span>
                    <h2>{parqueSelected.codigo}</h2>
                  </div>

                  <span className={`status-pill ${estadoOperativoClase(parqueSelected)}`}>
                    {estadoOperativo(parqueSelected)}
                  </span>
                </div>

                <div className={`panel-loco-preview ${parqueSelected.codigo === '7774' ? 'blue' : 'red'}`}>
                  <img alt={`Locomotora ${parqueSelected.codigo}`} src={imagenLocomotora(parqueSelected)} />
                </div>

                <div className="panel-section">
                  <h3>Estado actual</h3>

                  {['correctivo', 'detenida'].includes(parqueSelected.estado) && (
                    <>
                      <p><strong>Estado:</strong><br />Detenida</p>
                      <p><strong>Motivo:</strong><br />{parqueSelected.observacion || 'Sin clasificar'}</p>
                    </>
                  )}

                  {parqueSelected.estado === 'preventivo' && (
                    <>
                      <p><strong>Estado:</strong><br />Mantenimiento preventivo</p>
                      <p><strong>Tipo preventivo:</strong><br />{parqueSelected.tipoPreventivo || 'Pendiente de carga'}</p>
                    </>
                  )}

                  {(['servicio', 'operativa', 'reserva', 'uso_excepcional'].includes(parqueSelected.estado) || parqueSelected.lavadoProgramado) && (
                    <>
                      <p><strong>Estado:</strong><br />{estadoOperativo(parqueSelected)}</p>
                      <p><strong>Ultima intervencion preventiva:</strong><br />{latestPreventiveIntervention ? `${formatDateDisplay(latestPreventiveIntervention.date)} - ${interventionTitle(latestPreventiveIntervention)}` : 'Pendiente de carga'}</p>
                    </>
                  )}

                  {parqueSelected.fechaHoraParte && (
                    <p><strong>Último parte:</strong><br />{parqueSelected.fechaParte} {parqueSelected.horaParte}</p>
                  )}
                  <p><strong>Estado registrado:</strong><br />{parqueSelected.fuenteEstado}</p>
                  <p><strong>Observaciones:</strong><br />{parqueSelected.observacion || 'Sin observaciones'}</p>
                  {(parqueSelected.estado === 'sin_confirmar' || parqueSelected.estadoConfirmado === false) && canManageHistory && <button className="primary-action" type="button" onClick={() => resolvePendingFleet(parqueSelected)}>Completar estado pendiente</button>}
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

      {confirmationTarget && <ConfirmarEstadoModal loco={confirmationTarget} onClose={() => setConfirmationTarget(null)} onSave={confirmFleet} />}

        {tab === 'historial' && (
        <HistorialLocomotora
          canManage={canManageHistory}
          events={[...historyEvents, ...combinedTracking.filter((item) => item.origen === 'vista-previa-privada')]}
          loadError={privatePreviewEvents.length ? '' : historyError}
          loading={historyStatus === 'loading' && !privatePreviewEvents.length}
          loco={parqueHistoryTarget || parqueSelected || parque.find(loco => loco.codigo === defaultHistoryLoco.codigo)}
          locomotoras={parque}
          locomotiveImage={imagenLocomotora}
          onCreateActualizacion={saveActualizacionEvento}
          onForbidden={denyPermission}
          onImportLibro={importLibroNovedades}
          onPreviewFile={loadPrivatePreview}
          onRegisterEvent={(loco) => openEventModal(loco, 'archivo')}
          onRetry={() => loadHistoryEvents(defaultHistoryLoco)}
          onOpenMaintenance={(id, codigo, fecha, place) => {
            setTrackingSelection({ id, codigo, fecha, place });
            setTab('calendario');
          }}
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
        <SeguimientoMantenimiento
          initialSelection={trackingSelection}
          privatePreviewEvents={privatePreviewEvents}
          onChanged={() => setTrackingRevision(value => value + 1)}
          canManage={canManageHistory}
          locomotoras={parque}
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
