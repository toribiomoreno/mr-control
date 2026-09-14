export const permisoDenegadoMensaje = 'No tenés permisos para realizar esta acción';

export const roleLabels = {
  observador: 'Observador',
  supervisor: 'Supervisor',
  jefatura: 'Jefatura',
};

export function rolLegible(rol) {
  return roleLabels[rol] || 'Sin rol';
}

function isDeveloper(perfil) {
  return Boolean(perfil?.es_desarrollador);
}

export function puedeGestionarArchivoHistorico(perfil) {
  return ['supervisor', 'jefatura'].includes(perfil?.rol) || isDeveloper(perfil);
}

export function puedeGestionarPatioCalendario(perfil) {
  return perfil?.rol === 'jefatura' || isDeveloper(perfil);
}

export function puedeGestionarUsuarios(perfil) {
  return isDeveloper(perfil);
}
