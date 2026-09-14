# Webferro MR Control

Frontend React + Vite para la gestion visual de Material Rodante.

## Modulos actuales

- Inicio
- Patio de locomotoras
- Archivo Historico
- Calendario de mantenimiento
- Inventario de locomotoras
- Placeholder de coches

## Ejecutar el proyecto

Con Node.js disponible:

```bash
npm install
npm run dev
```

Vite mostrara la direccion local, normalmente:

```text
http://localhost:5173
```

Para validar una compilacion:

```bash
npm run lint
npm run build
```

## Vista previa sin Node

El proyecto conserva una vista estatica para equipos donde no se puede instalar Node:

- `preview.html`: copia estatica navegable del frontend.
- `static-preview-server.ps1`: servidor local de PowerShell para abrir esa vista.
- `ferrovias-f.png`: logo usado por la vista estatica.

Desde PowerShell, en la carpeta del proyecto:

```powershell
.\static-preview-server.ps1
```

Luego abrir:

```text
http://localhost:5173
```

La vista estatica sirve para presentacion y revision visual. No reemplaza la aplicacion React ni se actualiza automaticamente al modificar `src/`.

## Estructura principal

```text
src/
├─ assets/                  Imagenes usadas por React
├─ components/              Pantallas y componentes activos
├─ data/                    Datos mock de locomotoras, historial y calendario
├─ services/                Claves y servicios compartidos
├─ App.jsx                  Navegacion y estado general
├─ index.css                Estilos globales
└─ main.jsx                 Punto de entrada

public/
├─ ferrovias-f.png          Logo servido por Vite
├─ favicon.svg
└─ icons.svg
```

## Persistencia actual

El panel de historial reciente del Patio utiliza `localStorage` mediante la clave:

```text
webferro-intervention-history
```

El Archivo Historico completo todavia trabaja con datos locales en memoria y datos mock. La conexion con Supabase se agregara en una etapa posterior.

## Variables de entorno

`.env.local` no debe subirse ni compartirse. Para la futura conexion con Supabase, copiar `.env.example` como `.env.local` y completar:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Nunca colocar una clave `service_role` o una clave secreta dentro del frontend.

## Archivos duplicados intencionalmente

Existen dos copias de `ferrovias-f.png` por motivos distintos:

- `/ferrovias-f.png`: usada por `preview.html`.
- `public/ferrovias-f.png`: usada por la aplicacion Vite.

No eliminar una de ellas sin actualizar su referencia correspondiente.

Aplicación desplegada mediante Vercel.