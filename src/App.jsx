import RailwayLoader from './components/RailwayLoader.jsx';
import { useCallback, useEffect, useState } from 'react';

import AreasMaterialRodante from './components/AreasMaterialRodante.jsx';
import SeguimientoMantenimiento from './components/SeguimientoMantenimiento.jsx';
import Home from './components/Home.jsx';
import HistorialLocomotora from './components/HistorialLocomotora.jsx';
import ImportarEstadoDiarioModal from './components/ImportarEstadoDiarioModal.jsx';
import Login from './components/Login.jsx';
import Patio from './components/Patio.jsx';
import ReportesGestion from './components/ReportesGestion.jsx';
import Sidebar from './components/Sidebar.jsx';
import locoAzul from './assets/loco_azul.webp';
import locoRoja from './assets/loco_roja.webp';
import { useAuth } from './context/useAuth.js';
import initialLocomotoras from './data/locomotoras.js';
import SeguimientoPendientes from './components/SeguimientoPendientes.jsx';
import { guardarEstadoDiario } from './services/estadoDiarioSupabaseService.js';
import { fleetFromTracking } from './domain/maintenance/fleetState.js';
import { permisoDenegadoMensaje, puedeGestionarArchivoHistorico, puedeGestionarPatioCalendario } from './lib/permissions.js';
import { fetchHistorialByLocomotora } from './services/historialSupabaseService.js';
import { fetchSeguimiento } from './services/seguimientoService.js';
import { fetchFleetConfirmations } from './services/fleetConfirmationService.js';

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
  if (loco.estado === 'uso_excepcional') return 'Uso condicional';
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
  if (loco.estado === 'uso_excepcional') return 'Uso condicional';
  if (['detenida', 'preventivo', 'correctivo'].includes(loco.estado)) return 'Detenida';
  return 'Operativa';
}

function estadoOperativoClase(loco) {
  const estado = estadoOperativo(loco);
  if (estado === 'Operativa') return 'is-service';
  if (estado === 'Reserva') return 'is-reserve';
  if (estado === 'Uso condicional') return 'is-exceptional';
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
  return [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id || '').localeCompare(String(a.id || '')));
}

export default function App() {
  const { session, perfil, loading: authLoading, authError, signOut } = useAuth();
  const canManageHistory = puedeGestionarArchivoHistorico(perfil);
  const canManagePatioCalendar = puedeGestionarPatioCalendario(perfil);

  // Navegacion y seleccion de locomotoras.
  const [locomotoras] = useState(initialLocomotoras);
  const [tab, setTab] = useState('inicio');
  const [trackingSelection, setTrackingSelection] = useState(null);
  const [privatePreviewEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [isFleetImportOpen, setIsFleetImportOpen] = useState(false);

  // Archivo historico y estado del parque comparten el seguimiento.
  const [historyEvents, setHistoryEvents] = useState([]);
  const [trackingEvents, setTrackingEvents] = useState([]);
  const [fleetConfirmations, setFleetConfirmations] = useState([]);
  const [trackingError, setTrackingError] = useState('');
  const [trackingRevision, setTrackingRevision] = useState(0);
  const [historyStatus, setHistoryStatus] = useState('idle');
  const [historyError, setHistoryError] = useState('');

  const historyLoco = historyTarget || selected;
  const defaultHistoryLoco = historyLoco || locomotoras.find((loco) => loco.codigo === 'E721') || locomotoras[0];

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
    ? sortHistoryDescending(combinedTracking.filter(item => item.locomotoraCodigo === selected.codigo && !item.anulado && item.estadoMantenimiento !== 'cancelado').map(item => ({
      id: item.id, date: item.fecha, type: item.titulo, interventionClass: item.tipo,
      preventiveCode: item.preventivoCodigo, area: item.especialidad,
      technician: item.responsable || 'Por confirmar', detail: item.descripcion,
    })))
    : [];

  const openHistory = (loco) => {
    setSelected(loco);
    setHistoryTarget(loco);
    setTab('historial');
  };

  const denyPermission = useCallback(() => {
    setPermissionMessage(permisoDenegadoMensaje);
    window.setTimeout(() => setPermissionMessage(''), 3200);
  }, []);

  const openFleetImport = () => {
    if (!canManagePatioCalendar) {
      denyPermission();
      return;
    }
    setIsFleetImportOpen(true);
  };

  const applyFleetImport = async (preview) => {
    if (!canManagePatioCalendar) throw new Error(permisoDenegadoMensaje);
    await guardarEstadoDiario(preview);
    setTrackingRevision(value => value + 1);
    if (tab === 'historial') await loadHistoryEvents(historyLoco);
  };

  const beginMaintenance = (loco, fecha = loco.fechaParte) => {
    setTrackingSelection({ newMaintenance: true, codigo: loco.codigo, fecha });
    setTab('calendario');
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
          <RailwayLoader label="Cargando sesión…" />
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
        {trackingError && <div className="history-modal-note" role="status">Base de seguimiento pendiente: {trackingError}</div>}
        {permissionMessage && (
          <div className="permission-toast" role="alert">
            {permissionMessage}
          </div>
        )}

        {tab !== 'patio' && <SeguimientoPendientes events={[...combinedTracking, ...fleetConfirmations]} canManage={canManageHistory} onSaved={() => { setTrackingRevision(value => value + 1); if (tab === 'historial') loadHistoryEvents(historyLoco); }} onNewMaintenance={(codigo, fecha) => beginMaintenance(parque.find(loco => loco.codigo === codigo), fecha)} />}

        {tab === 'inicio' && <Home onNavigate={setTab} />}

        {tab === 'areas' && <AreasMaterialRodante onNavigate={setTab} />}

        {tab === 'reportes' && <ReportesGestion onNavigate={setTab} />}

      {tab === 'patio' && (
        <main className="operations-layout">
          <Patio
            canManage={canManagePatioCalendar}
            locomotoras={parque}
            onImportDailyState={openFleetImport}
            onOpenHistory={openHistory}
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

                  <p><strong>Estado actual:</strong><br />{estadoOperativo(parqueSelected)}</p>
                  <p><strong>Último parte:</strong><br />{parqueSelected.fechaParte ? `${formatDateDisplay(parqueSelected.fechaParte)} ${parqueSelected.horaParte || ''}` : 'Sin parte diario cargado'}</p>
                  <p><strong>Observaciones:</strong><br />{parqueSelected.observacion || 'Sin observaciones'}</p>
                  {parqueSelected.conflictoEstado && <p className="tracking-hint">El parte y el mantenimiento abierto no coinciden. Se conserva detenida hasta confirmar el cierre.</p>}
                </div>

                <div className="panel-section timeline">
                  <h3>Historial reciente</h3>

                  {normalizedSelectedHistory.length > 0 ? (
                    normalizedSelectedHistory.slice(0, 1).map((item) => (
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
                    <p>Sin mantenimiento registrado.</p>
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
          events={[...historyEvents, ...combinedTracking.filter((item) => item.origen === 'vista-previa-privada')]}
          loadError={privatePreviewEvents.length ? '' : historyError}
          loading={historyStatus === 'loading' && !privatePreviewEvents.length}
          loco={parqueHistoryTarget || parqueSelected || parque.find(loco => loco.codigo === defaultHistoryLoco.codigo)}
          locomotoras={parque}
          locomotiveImage={imagenLocomotora}
          onForbidden={denyPermission}
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
          key={`${trackingSelection?.id || ''}:${trackingSelection?.codigo || ''}:${trackingSelection?.newMaintenance || ''}`}
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
            {parque.map((loco) => (
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
          maintenanceEvents={combinedTracking}
          locomotoras={parque}
          onClose={() => setIsFleetImportOpen(false)}
          onConfirm={applyFleetImport}
          onForbidden={denyPermission}
        />
      )}
    </div>
  );
}
