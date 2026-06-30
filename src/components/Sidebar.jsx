import { useState } from 'react';

import { rolLegible } from '../lib/permissions.js';

const locomotiveItems = [
  { id: 'patio', label: 'Patio', tab: 'patio' },
  { id: 'inventario', label: 'Inventario', tab: 'locos' },
  { id: 'archivo', label: 'Archivo historico', tab: 'historial' },
];

const sidebarItems = [
  { id: 'inicio', label: 'Inicio', tab: 'inicio' },
  { id: 'locomotoras', label: 'Locomotoras', children: locomotiveItems },
  { id: 'coches', label: 'Coches', tab: 'coches' },
  { id: 'calendario', label: 'Calendario', tab: 'calendario' },
  { id: 'configuracion', label: 'Configuracion', tab: 'historial' },
];

export default function Sidebar({ active = 'locomotoras', onNavigate, onSignOut, perfil }) {
  const [collapsed, setCollapsed] = useState(false);
  const [locomotivesOpen, setLocomotivesOpen] = useState(true);
  const isLocomotivesActive = ['locomotoras', 'patio', 'inventario', 'archivo'].includes(active);
  const userName = perfil?.nombre || perfil?.email || 'Usuario';

  return (
    <aside className={`history-sidebar app-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Navegacion principal">
      <div className="history-sidebar-brand">
        <img className="history-sidebar-logo" src="/ferrovias-f.png" alt="" />
        <div>
          <strong>Material Rodante</strong>
          <small>Ferrovias</small>
        </div>
        <button
          aria-label={collapsed ? 'Abrir menu lateral' : 'Cerrar menu lateral'}
          className="sidebar-toggle"
          onClick={() => setCollapsed((current) => !current)}
          type="button"
        >
          {collapsed ? '>' : '<'}
        </button>
      </div>

      <nav className="history-sidebar-nav">
        {sidebarItems.map((item) => {
          if (item.children) {
            return (
              <div className="sidebar-group" key={item.id}>
                <button
                  className={isLocomotivesActive ? 'active' : ''}
                  onClick={() => {
                    if (collapsed) {
                      onNavigate?.('historial');
                      return;
                    }
                    setLocomotivesOpen((current) => !current);
                  }}
                  type="button"
                >
                  <span className="history-nav-dot" />
                  <span className="sidebar-label">{item.label}</span>
                  <span className="sidebar-chevron">{locomotivesOpen ? 'v' : '>'}</span>
                </button>

                {locomotivesOpen && !collapsed && (
                  <div className="sidebar-subnav">
                    {item.children.map((child) => (
                      <button
                        className={active === child.id ? 'active' : ''}
                        key={child.id}
                        onClick={() => onNavigate?.(child.tab)}
                        type="button"
                      >
                        <span className="history-nav-dot" />
                        <span className="sidebar-label">{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              className={active === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => onNavigate?.(item.tab)}
              type="button"
            >
              <span className="history-nav-dot" />
              <span className="sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="history-sidebar-footer">
        <strong>{userName}</strong>
        <span>{rolLegible(perfil?.rol)}</span>
        {perfil?.es_desarrollador && <small className="developer-badge">Desarrollador</small>}
        <button className="sidebar-signout" onClick={onSignOut} type="button">
          Cerrar sesión
        </button>
        <small>v2.3.0</small>
      </div>
    </aside>
  );
}
