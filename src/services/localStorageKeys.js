// Claves de persistencia local que siguen activas en el frontend actual.
export const localStorageKeys = {
  histories: 'webferro-intervention-history',
};

export function removeLegacyHistoryStorage() {
  localStorage.removeItem(localStorageKeys.histories);
}
