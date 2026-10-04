// Clasificación acordada para las cargas nuevas. Los textos históricos se conservan.
export const subsystemsBySystem = {
  'Acople': ['Aparato de tracción'],
  'Cabina': ['Asientos', 'Puertas', 'Ventanas'],
  'Carrocería': ['Barandas y escaleras'],
  'Motor diésel': ['Circuito de combustible', 'Conjunto de fuerza', 'Dispositivo de baja presión', 'Gobernador Woodward', 'Inyectores'],
  'Registradores Ctrl.': ['Hombre vivo', 'Tacogenerador', 'Velocímetro'],
  'Sistema eléctrico': ['Generador auxiliar', 'Motores de tracción', 'Regulador de tensión'],
  'Sistema neumático': ['Cañería', 'Compresor', 'Mangas', 'Válvulas y presostatos'],
  'Bogies': ['Par montado', 'Cojinetes', 'Bastidor', 'Suspensión', 'Mesa'],
};
export const systems = Object.keys(subsystemsBySystem);
export const validClassification = (system, subsystem) => !!subsystemsBySystem[system]?.includes(subsystem);
