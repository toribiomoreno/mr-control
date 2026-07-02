import MaterialIcon from './MaterialIcon.jsx';

const materialTabs = [
  { id: 'locomotoras', icon: 'locomotive', label: 'Locomotoras', tab: 'locos' },
  { id: 'coches', icon: 'coach', label: 'Coches', tab: 'coches' },
  { id: 'areas', icon: 'areas', label: 'Areas', tab: 'areas' },
  { id: 'reportes', icon: 'reports', label: 'Reportes', tab: 'reportes' },
];

export default function MaterialModuleTabs({ active = 'locomotoras', onNavigate }) {
  return (
    <nav className="material-top-tabs" aria-label="Navegacion de Material Rodante">
      {materialTabs.map((item) => (
        <button
          aria-current={active === item.id ? 'page' : undefined}
          className={active === item.id ? 'active' : ''}
          key={item.id}
          onClick={() => onNavigate?.(item.tab)}
          type="button"
        >
          <MaterialIcon className="material-tab-icon" name={item.icon} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
