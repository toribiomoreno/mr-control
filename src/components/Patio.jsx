import { useEffect, useMemo, useRef, useState } from 'react';

import patioBackground from '../assets/patio/patio-retiro-bg.webp';
import locoAzul from '../assets/patio/loco-ferrovias-azul-7774.png';
import locoRoja from '../assets/patio/loco-ferrovias-roja.png';

const statusClassNames = {
  servicio: 'is-service',
  preventivo: 'is-preventive',
  correctivo: 'is-corrective',
  lavado: 'is-wash',
};

const locomotiveScaleBoost = 1.04;
const defaultRotation = -8;
const mapZoom = 1.12;
const baseYardHeight = 1024;
const baseYardWidth = 1536;

const serviceSlots = [
  { id: 'media-via-1-p1', x: 376, y: 573, scale: 0.135, rotate: -8, labelX: -9, labelY: -18 },
  { id: 'media-via-2-p1', x: 492, y: 535, scale: 0.132, rotate: -8, labelX: 9, labelY: 13 },
  { id: 'media-via-3-p1', x: 610, y: 498, scale: 0.129, rotate: -8, labelX: -9, labelY: -17 },
  { id: 'media-via-4-p1', x: 730, y: 461, scale: 0.126, rotate: -8, labelX: 9, labelY: 12 },
  { id: 'media-via-5-p1', x: 852, y: 424, scale: 0.123, rotate: -8, labelX: -9, labelY: -16 },
  { id: 'media-via-6-p1', x: 974, y: 390, scale: 0.12, rotate: -7.8, labelX: 9, labelY: 12 },
  { id: 'media-via-7-p1', x: 1098, y: 357, scale: 0.117, rotate: -7.6, labelX: -9, labelY: -15 },
  { id: 'media-via-8-p1', x: 1224, y: 326, scale: 0.114, rotate: -7.5, labelX: 9, labelY: 11 },
  { id: 'media-via-9-p1', x: 1346, y: 301, scale: 0.111, rotate: -7.5, labelX: -9, labelY: -14 },
  { id: 'media-via-1-p2', x: 480, y: 667, scale: 0.152, rotate: -8, labelX: 9, labelY: 14 },
  { id: 'media-via-2-p2', x: 604, y: 628, scale: 0.148, rotate: -8, labelX: -9, labelY: -17 },
  { id: 'media-via-3-p2', x: 730, y: 590, scale: 0.144, rotate: -8, labelX: 9, labelY: 13 },
  { id: 'media-via-4-p2', x: 858, y: 552, scale: 0.14, rotate: -8, labelX: -9, labelY: -16 },
  { id: 'media-via-5-p2', x: 988, y: 514, scale: 0.136, rotate: -8, labelX: 9, labelY: 12 },
  { id: 'media-via-6-p2', x: 1118, y: 477, scale: 0.132, rotate: -8, labelX: -9, labelY: -15 },
  { id: 'media-via-7-p2', x: 1248, y: 441, scale: 0.128, rotate: -7.8, labelX: 9, labelY: 11 },
  { id: 'media-via-8-p2', x: 1376, y: 408, scale: 0.124, rotate: -7.8, labelX: -9, labelY: -14 },
  { id: 'media-via-1-p3', x: 610, y: 737, scale: 0.166, rotate: -8, labelX: -9, labelY: -17 },
];

const maintenanceSlots = [
  { id: 'superior-puerta-2', x: 965, y: 225, scale: 0.096, rotate: -7.3, labelX: -10, labelY: -23 },
  { id: 'superior-puerta-3', x: 1052, y: 244, scale: 0.098, rotate: -7.3, labelX: 10, labelY: 13 },
  { id: 'superior-puerta-4', x: 1139, y: 264, scale: 0.1, rotate: -7.3, labelX: -10, labelY: -21 },
  { id: 'superior-puerta-5', x: 1228, y: 284, scale: 0.103, rotate: -7.3, labelX: 10, labelY: 12 },
  { id: 'superior-puerta-7', x: 1318, y: 305, scale: 0.106, rotate: -7.4, labelX: -10, labelY: -20 },
  { id: 'superior-puerta-9', x: 1406, y: 329, scale: 0.109, rotate: -7.4, labelX: 10, labelY: 12 },
  { id: 'superior-puerta-11', x: 1470, y: 358, scale: 0.112, rotate: -7.5, labelX: -10, labelY: -18 },
];

const correctiveSlots = [
  { id: 'inferior-via-1', x: 692, y: 816, scale: 0.182, rotate: -8, labelX: -10, labelY: -18 },
  { id: 'inferior-via-2', x: 838, y: 773, scale: 0.176, rotate: -8, labelX: 10, labelY: 13 },
  { id: 'inferior-via-3', x: 988, y: 730, scale: 0.17, rotate: -8, labelX: -10, labelY: -17 },
  { id: 'inferior-via-4', x: 1138, y: 688, scale: 0.164, rotate: -8, labelX: 10, labelY: 12 },
  { id: 'inferior-via-5', x: 1288, y: 646, scale: 0.158, rotate: -8, labelX: -10, labelY: -16 },
  { id: 'inferior-via-6', x: 1408, y: 604, scale: 0.152, rotate: -8, labelX: 10, labelY: 12 },
];

const washSlots = [
  { id: 'superior-lavado-puerta-8', x: 1360, y: 340, scale: 0.112, rotate: -7.5, labelX: 0, labelY: -22 },
  { id: 'superior-lavado-puerta-11', x: 1450, y: 366, scale: 0.116, rotate: -7.5, labelX: 0, labelY: 16 },
];

const filterOptions = [
  { id: 'all', label: 'Todas', className: 'all', predicate: () => true },
  { id: 'service', label: 'Operativas', className: 'service', predicate: (loco) => loco.estado === 'servicio' },
  { id: 'maintenance', label: 'Mantenimiento', className: 'maintenance', predicate: (loco) => loco.estado !== 'servicio' },
  { id: 'wash', label: 'Lavado', className: 'wash', predicate: (loco) => loco.lavadoProgramado },
];

function getStatusText(loco) {
  if (loco.lavadoProgramado) return 'Lavado';
  if (loco.estado === 'servicio') return 'Operativa';
  if (loco.estado === 'preventivo') return 'Preventivo';
  return 'Correctivo';
}

function getStatusClass(loco) {
  if (loco.lavadoProgramado) return statusClassNames.lavado;
  return statusClassNames[loco.estado] || statusClassNames.correctivo;
}

function getLocoImage(loco) {
  return loco.codigo === '7774' ? locoAzul : locoRoja;
}

function buildYardSlots(locomotoras) {
  const counters = { servicio: 0, preventive: 0, corrective: 0, lavado: 0 };

  return locomotoras.map((loco) => {
    const isWash = loco.lavadoProgramado;
    const isPreventive = loco.estado === 'preventivo';
    const isCorrective = loco.estado === 'correctivo';
    const slots = isWash ? washSlots : isPreventive ? maintenanceSlots : isCorrective ? correctiveSlots : serviceSlots;
    const counterKey = isWash ? 'lavado' : isPreventive ? 'preventive' : isCorrective ? 'corrective' : 'servicio';
    const index = counters[counterKey];
    const slot = slots[index % slots.length];
    const page = Math.floor(index / slots.length);
    counters[counterKey] += 1;

    return {
      loco,
      left: (slot.x + page * 36) * mapZoom,
      top: (slot.y + page * 22) * mapZoom,
      rotate: slot.rotate ?? defaultRotation,
      scale: slot.scale * locomotiveScaleBoost * mapZoom,
      labelX: slot.labelX || 0,
      labelY: slot.labelY || 0,
      zIndex: Math.round((slot.y + page * 22) * mapZoom),
    };
  });
}

export default function Patio({ locomotoras, selected, setSelected, onOpenHistory }) {
  const viewportRef = useRef(null);
  const locoRefs = useRef({});
  const dragState = useRef(null);
  const clickTimer = useRef(null);
  const clickScroll = useRef(null);
  const initialViewportPositioned = useRef(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const selectedFilter = filterOptions.find((option) => option.id === activeFilter) || filterOptions[0];
  const visibleLocomotoras = useMemo(
    () => locomotoras.filter(selectedFilter.predicate),
    [locomotoras, selectedFilter],
  );
  const positionedLocomotoras = useMemo(() => buildYardSlots(visibleLocomotoras), [visibleLocomotoras]);
  const yardHeight = baseYardHeight * mapZoom;
  const yardWidth = baseYardWidth * mapZoom;

  useEffect(() => {
    if (initialViewportPositioned.current || !viewportRef.current) return;
    viewportRef.current.scrollLeft = Math.max((baseYardWidth * mapZoom - viewportRef.current.clientWidth) * 0.58, 0);
    viewportRef.current.scrollTop = 48;
    initialViewportPositioned.current = true;
  }, []);

  const statusTotals = locomotoras.reduce(
    (totals, loco) => ({
      ...totals,
      [loco.estado]: totals[loco.estado] + 1,
      lavado: totals.lavado + (loco.lavadoProgramado ? 1 : 0),
    }),
    { servicio: 0, preventivo: 0, correctivo: 0, lavado: 0 },
  );
  const filterTotals = {
    all: locomotoras.length,
    service: statusTotals.servicio,
    maintenance: statusTotals.preventivo + statusTotals.correctivo,
    wash: statusTotals.lavado,
  };

  const selectLocomotive = (loco, shouldCenter = false) => {
    setSelected(loco);
    const node = locoRefs.current[loco.id];

    if (shouldCenter && node && viewportRef.current) {
      viewportRef.current.scrollTo({
        left: Math.max(node.offsetLeft - viewportRef.current.clientWidth / 2, 0),
        top: Math.max(node.offsetTop - 180, 0),
        behavior: 'smooth',
      });
    } else if (clickScroll.current && viewportRef.current) {
      const savedScroll = clickScroll.current;
      requestAnimationFrame(() => {
        if (!viewportRef.current) return;
        viewportRef.current.scrollLeft = savedScroll.left;
        viewportRef.current.scrollTop = savedScroll.top;
      });
    }
  };

  const captureClickScroll = (event) => {
    event.preventDefault();
    if (!viewportRef.current) return;
    clickScroll.current = {
      left: viewportRef.current.scrollLeft,
      top: viewportRef.current.scrollTop,
    };
  };

  const handleLocomotiveClick = (loco, shouldCenter = false) => {
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      selectLocomotive(loco, shouldCenter);
    }, 220);
  };

  const handleLocomotiveDoubleClick = (loco) => {
    window.clearTimeout(clickTimer.current);
    onOpenHistory(loco);
  };

  const startPan = (event) => {
    if (event.button !== 0 || event.target.closest?.('button')) return;

    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    };
    setIsDragging(true);
    viewportRef.current.setPointerCapture(event.pointerId);
  };

  const movePan = (event) => {
    if (!dragState.current) return;

    const deltaX = event.clientX - dragState.current.startX;
    const deltaY = event.clientY - dragState.current.startY;
    viewportRef.current.scrollLeft = dragState.current.scrollLeft - deltaX;
    viewportRef.current.scrollTop = dragState.current.scrollTop - deltaY;
  };

  const stopPan = () => {
    if (!dragState.current) return;

    if (viewportRef.current.hasPointerCapture(dragState.current.pointerId)) {
      viewportRef.current.releasePointerCapture(dragState.current.pointerId);
    }

    dragState.current = null;
    setIsDragging(false);
  };

  return (
    <section className="yard-shell">
      <div className="yard-toolbar">
        <div>
          <p className="eyebrow">Tablero operativo</p>
          <h2>Patio Ferroviario</h2>
        </div>

        <div className="yard-toolbar-actions">
          <div className="yard-filter" aria-label="Filtro rapido de locomotoras">
            {filterOptions.map((option) => (
              <button
                className={`filter-${option.className} ${activeFilter === option.id ? 'active' : ''}`}
                key={option.id}
                onClick={() => setActiveFilter(option.id)}
                type="button"
              >
                <strong>{filterTotals[option.id]}</strong>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`yard-viewport ${isDragging ? 'is-dragging' : ''}`}
        onPointerCancel={stopPan}
        onPointerDown={startPan}
        onPointerLeave={stopPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        ref={viewportRef}
      >
        <div className="yard-world" style={{ height: `${yardHeight}px`, width: `${yardWidth}px` }}>
          <img className="yard-background" src={patioBackground} alt="" draggable="false" />

          {positionedLocomotoras.map(({ loco, left, top, rotate, scale, labelX, labelY, zIndex }) => {
            const isSelected = selected?.id === loco.id;

            return (
              <button
                className={`locomotive-unit ${getStatusClass(loco)} ${isSelected ? 'is-selected' : ''}`}
                key={loco.id}
                onClick={() => handleLocomotiveClick(loco)}
                onDoubleClick={() => handleLocomotiveDoubleClick(loco)}
                onMouseDown={captureClickScroll}
                ref={(node) => {
                  if (node) locoRefs.current[loco.id] = node;
                }}
                style={{
                  '--code-x': `${labelX * -0.55}px`,
                  '--code-y': `${labelY * -0.45}px`,
                  '--label-x': `${labelX}px`,
                  '--label-y': `${labelY}px`,
                  '--loco-rotate': `${rotate}deg`,
                  left: `${left}px`,
                  top: `${top}px`,
                  zIndex,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                }}
                type="button"
                title={`${loco.codigo} - ${getStatusText(loco)}`}
              >
                <span className="locomotive-shadow" />
                <img alt={`Locomotora ${loco.codigo}`} src={getLocoImage(loco)} />
                <span className="locomotive-code">{loco.codigo}</span>
                <span className="locomotive-status">{getStatusText(loco)}</span>
              </button>
            );
          })}

          {visibleLocomotoras.length === 0 && (
            <div className="yard-empty">
              <strong>Sin resultados</strong>
              <span>No hay locomotoras para este filtro.</span>
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
