-- ============================================================
-- Cabaña Doña Magda — Esquema Supabase
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- Tabla de usuarios administradores
create table if not exists public.usuarios (
    nombre text primary key,
    pwd    text not null,
    rol    text not null default 'administrador'
);

-- Tabla de reproductores
create table if not exists public.reproductores (
    id                bigint primary key,
    nombre            text,
    categoria         text,
    destacado         boolean default false,
    rp                text,
    "fechaNac"        text,
    peso              text,
    imagen            text,
    documento         text,
    caracteristicas   text[] default '{}',
    descripcion       text,
    "publicadoPor"    text,
    "fechaPublicacion" timestamptz default now()
);

-- ============================================================
-- Seed de usuarios (los 3 actuales en pwd.json)
-- ============================================================
insert into public.usuarios (nombre, pwd, rol) values
    ('Roberto Comparin', 'donamgda2024', 'administrador'),
    ('Luis Ginatace',    'brangus2024',  'administrador'),
    ('L. Barrera',       'campo2024',    'administrador')
on conflict (nombre) do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================
-- Si vas a usar SUPABASE_ANON_KEY en el servidor, podés:
--   a) dejar RLS desactivado (más simple, pero cualquiera con la key puede leer/escribir)
--   b) activar RLS y usar SUPABASE_SERVICE_ROLE_KEY en el servidor (recomendado)
--
-- Recomendado: activar RLS en ambas tablas y usar service_role en el server:
-- alter table public.usuarios       enable row level security;
-- alter table public.reproductores  enable row level security;

-- ============================================================
-- Supabase Storage — bucket para imágenes y documentos
-- ============================================================
-- En Supabase Dashboard → Storage → New bucket:
--   - Name: reproductores
--   - Public bucket: ✅ (para que las URLs sean accesibles desde el navegador)
--   - File size limit: 10 MB
--
-- IMPORTANTE: como el browser sube los archivos directo a Storage usando
-- la anon key (para evitar el límite de 4.5MB de Vercel), hay que crear
-- una política que permita INSERT al rol anon en este bucket:
--
-- Storage → Policies → New policy → For full customization:
--   - Policy name: Public anon insert
--   - Allowed operation: INSERT
--   - Target roles: anon, authenticated
--   - WITH CHECK expression: bucket_id = 'reproductores'
--
-- El DELETE sigue siendo solo desde el server con SUPABASE_SERVICE_ROLE_KEY.
--
-- Estructura interna del bucket:
--   reproductores/
--     ├── imagenes/<timestamp>-<archivo>
--     └── documentos/<timestamp>-<archivo>
--
-- ============================================================
-- Galería de reproductores.html — bucket 'media'
-- ============================================================
-- Las fotos y videos del carrusel viven en un bucket aparte, 'media',
-- con los archivos en la raíz:
--   media/
--     ├── IMG_1058.mp4
--     └── <foto o video>...
--
-- El endpoint GET /galeria lista ese bucket y devuelve las URLs públicas.
-- No usa base de datos: alcanza con subir los archivos.
--
-- El bucket tiene que ser público para que las URLs se vean en el navegador.
--
-- IMPORTANTE: listar un bucket NO está permitido para el rol anon (devuelve
-- lista vacía). El server necesita sí o sí SUPABASE_SERVICE_ROLE_KEY, o la
-- galería queda oculta aunque los archivos estén subidos.
--
-- El orden del carrusel es alfabético por nombre, así que conviene
-- prefijarlos: 01-toro.jpg, 02-rodeo.mp4, 03-campo.jpg...
--
-- Variables de entorno de la galería:
--   GALERIA_BUCKET         → bucket de la galería (default: el del sitio) → media
--   GALERIA_CARPETA        → subcarpeta dentro del bucket (default: raíz)
--   GALERIA_SUPABASE_URL   → solo si vive en OTRO proyecto de Supabase
--   GALERIA_SUPABASE_KEY   → service_role de ese otro proyecto
