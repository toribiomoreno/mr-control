import RailwayLoader from './components/RailwayLoader.jsx';
import { useCallback, useEffect, useState } from 'react';

import AreasMaterialRodante from './components/AreasMaterialRodante.jsx';
import SeguimientoMantenimiento from './components/SeguimientoMantenimiento.jsx';
import Home from './components/Home.jsx';
import HistorialLocomotora from './components/HistorialLocomotora.jsx';
import ImportarEstadoDiarioModal from './components/ImportarEstadoDiarioModal.jsx';
import Login from './components/Login.jsx';
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

function imagenLocomotora(loco) {
  if (!loco) return locoRoja;
  return loco.codigo === '7774' || loco.colorEspecial === 'azul' ? locoAzul : locoRoja;
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
  const [trackingLoaded, setTrackingLoaded] = useState(false);
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
  }, [tab, defaultHistoryLoco, loadHistoryEvents, trackingRevision]);

  useEffect(() => {
    if (!session || !perfil?.activo) return undefined;
    let active = true;
    Promise.all([fetchSeguimiento(), fetchFleetConfirmations()]).then(([events, confirmations]) => {
      if (active) { setTrackingEvents(events); setFleetConfirmations(confirmations); setTrackingError(''); setTrackingLoaded(true); }
    }).catch(error => { if (active) setTrackingError(error.message); });
    return () => { active = false; };
  }, [session, perfil?.activo, tab, trackingRevision]);

  useEffect(() => {
    if (!session || !perfil?.activo) return undefined;
    const refresh = () => setTrackingRevision(value => value + 1);
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [session, perfil?.activo]);

  const combinedTracking = [...trackingEvents, ...privatePreviewEvents.filter(preview =>
    !trackingEvents.some(saved => saved.metadata?.pilotSourceId === preview.metadata?.pilotSourceId))];
  const parque = fleetFromTracking(locomotoras, [...combinedTracking, ...fleetConfirmations]);
  const parqueSelected = selected ? parque.find(loco => loco.codigo === selected.codigo) : null;
  const parqueHistoryTarget = historyTarget ? parque.find(loco => loco.codigo === historyTarget.codigo) : null;

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
    if (tab === 'patio') return 'inicio';
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
      <Sidebar active={sidebarActive} onNavigate={(nextTab) => { setTrackingSelection(null); setTab(nextTab === 'patio' ? 'inicio' : nextTab); }} onSignOut={signOut} perfil={perfil} />

      <div className="app-content">
        {trackingError && <div className="history-modal-note" role="status">Base de seguimiento pendiente: {trackingError}</div>}
        {permissionMessage && (
          <div className="permission-toast" role="alert">
            {permissionMessage}
          </div>
        )}

        {tab === 'calendario' && <SeguimientoPendientes events={[...combinedTracking, ...fleetConfirmations]} canManage={canManageHistory} onSaved={() => { setTrackingRevision(value => value + 1); if (tab === 'historial') loadHistoryEvents(historyLoco); }} onNewMaintenance={(codigo, fecha) => beginMaintenance(parque.find(loco => loco.codigo === codigo), fecha)} />}

        {tab === 'inicio' && <Home locomotoras={parque} canManage={canManagePatioCalendar} onImportDailyState={openFleetImport} onOpenHistory={openHistory} loading={!trackingLoaded} />}

        {tab === 'areas' && <AreasMaterialRodante onNavigate={setTab} />}

        {tab === 'reportes' && <ReportesGestion onNavigate={setTab} />}

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
