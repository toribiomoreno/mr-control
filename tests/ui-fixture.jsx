import { createRoot } from 'react-dom/client';
import SeguimientoMantenimiento from '../src/components/SeguimientoMantenimiento.jsx';
import '../src/index.css';
createRoot(document.getElementById('root')).render(<SeguimientoMantenimiento canManage locomotoras={[{codigo:'E701'},{codigo:'E702'}]} onOpenHistory={() => {}} />);
