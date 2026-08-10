require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || 'reproductores';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  Faltan SUPABASE_URL o SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY en el entorno');
}

const supabase = createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_SERVICE_KEY || 'placeholder-key'
);

// --- Galería: puede vivir en otro proyecto de Supabase ---
// Si no se definen estas variables, usa el mismo proyecto/bucket que el resto del sitio.
const GALERIA_URL = process.env.GALERIA_SUPABASE_URL || SUPABASE_URL;
const GALERIA_KEY = process.env.GALERIA_SUPABASE_KEY || SUPABASE_SERVICE_KEY;
const GALERIA_BUCKET = process.env.GALERIA_BUCKET || STORAGE_BUCKET;
const GALERIA_CARPETA = process.env.GALERIA_CARPETA ?? 'galeria';

const supabaseGaleria = (GALERIA_URL === SUPABASE_URL && GALERIA_KEY === SUPABASE_SERVICE_KEY)
    ? supabase
    : createClient(
        GALERIA_URL || 'https://placeholder.supabase.co',
        GALERIA_KEY || 'placeholder-key'
    );

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

// --- Config pública para el frontend (URL + anon key) ---
app.get('/config', (req, res) => {
    res.json({
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
        bucket: STORAGE_BUCKET
    });
});

function pathDesdeUrl(publicUrl) {
    if (!publicUrl) return null;
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
}

async function eliminarDeStorage(publicUrl) {
    const objectPath = pathDesdeUrl(publicUrl);
    if (!objectPath) return;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    if (error) console.warn(`No se pudo borrar ${objectPath}: ${error.message}`);
}

function normalizarNombre(s) {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

async function validarCredenciales(nombre, pwd) {
    if (!nombre || !pwd) return null;
    const { data, error } = await supabase
        .from('usuarios')
        .select('nombre, rol')
        .eq('pwd', pwd);
    if (error) {
        console.error('Error consultando usuarios:', error.message);
        return null;
    }
    if (!data || data.length === 0) return null;
    const target = normalizarNombre(nombre);
    return data.find(u => normalizarNombre(u.nombre) === target) || null;
}

app.post('/admin/login', async (req, res) => {
    const { nombre, pwd } = req.body;
    const usuario = await validarCredenciales(nombre, pwd);

    if (usuario) {
        console.log(`✅ Login exitoso: ${nombre}`);
        res.json({ success: true, nombre: usuario.nombre, rol: usuario.rol });
    } else {
        console.log(`❌ Login fallido: ${nombre}`);
        res.status(401).json({ success: false, mensaje: 'Credenciales incorrectas' });
    }
});

app.get('/admin/usuarios', async (req, res) => {
    const { data, error } = await supabase.from('usuarios').select('nombre');
    if (error) {
        console.error('Error listando usuarios:', error.message);
        return res.status(500).json({ error: 'Error al consultar usuarios' });
    }
    res.json((data || []).map(u => u.nombre));
});

// --- GALERÍA — lista los medios de la carpeta en Storage (no usa base de datos) ---
const EXT_VIDEO = /\.(mp4|webm|mov|m4v|ogv)$/i;
const EXT_IMAGEN = /\.(jpe?g|png|webp|gif|avif)$/i;

app.get('/galeria', async (req, res) => {
    const { data, error } = await supabaseGaleria.storage
        .from(GALERIA_BUCKET)
        .list(GALERIA_CARPETA, { limit: 200, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
        console.error('Error listando galería:', error.message);
        return res.status(500).json({ error: 'Error al leer la galería' });
    }

    const medios = (data || [])
        .filter(f => f.name && (EXT_VIDEO.test(f.name) || EXT_IMAGEN.test(f.name)))
        .map(f => {
            const ruta = GALERIA_CARPETA ? `${GALERIA_CARPETA}/${f.name}` : f.name;
            const { data: pub } = supabaseGaleria.storage.from(GALERIA_BUCKET).getPublicUrl(ruta);
            return {
                nombre: f.name,
                tipo: EXT_VIDEO.test(f.name) ? 'video' : 'imagen',
                url: pub.publicUrl
            };
        });

    res.set('Cache-Control', 'public, max-age=60, must-revalidate');
    res.json(medios);
});

app.get('/reproductores', async (req, res) => {
    const { data, error } = await supabase
        .from('reproductores')
        .select('*')
        .order('id', { ascending: false });
    if (error) {
        console.error('Error leyendo reproductores:', error.message);
        return res.status(500).json({ error: 'Error de lectura' });
    }
    res.json(data || []);
});

// ALTA — el frontend ya subió a Storage, recibimos solo URLs + metadata.
app.post('/reproductores', async (req, res) => {
    try {
        const { adminNombre, adminPwd, ...datos } = req.body;
        const usuario = await validarCredenciales(adminNombre, adminPwd);

        if (!usuario) {
            console.log('❌ Autenticación fallida');
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (!datos.imagen) {
            return res.status(400).json({ error: 'Falta la URL de la imagen' });
        }

        const nuevo = {
            id: Date.now(),
            nombre: datos.nombre,
            categoria: datos.categoria,
            destacado: datos.destacado === true || datos.destacado === 'true',
            rp: datos.rp,
            fechaNac: datos.fechaNac,
            peso: datos.peso,
            imagen: datos.imagen,
            documento: datos.documento || null,
            caracteristicas: Array.isArray(datos.caracteristicas)
                ? datos.caracteristicas
                : (datos.caracteristicas || '').split(',').map(t => t.trim()).filter(Boolean),
            descripcion: datos.descripcion,
            publicadoPor: usuario.nombre,
            fechaPublicacion: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('reproductores')
            .insert(nuevo)
            .select()
            .single();

        if (error) {
            console.error('❌ Error al insertar:', error.message);
            await eliminarDeStorage(nuevo.imagen);
            if (nuevo.documento) await eliminarDeStorage(nuevo.documento);
            return res.status(500).json({ error: 'Error guardando datos' });
        }

        console.log(`💾 Reproductor guardado por ${usuario.nombre}`);
        res.json(data);
    } catch (error) {
        console.error('❌ Error crítico:', error);
        res.status(500).json({ error: error.message || 'Error interno' });
    }
});

app.delete('/reproductores/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { adminNombre, adminPwd } = req.body;

    const usuario = await validarCredenciales(adminNombre, adminPwd);
    if (!usuario) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const { data: reproductor, error: fetchError } = await supabase
        .from('reproductores')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (fetchError) {
        console.error('Error buscando reproductor:', fetchError.message);
        return res.status(500).json({ error: 'Error de lectura' });
    }

    if (reproductor) {
        if (reproductor.imagen) await eliminarDeStorage(reproductor.imagen);
        if (reproductor.documento) await eliminarDeStorage(reproductor.documento);
    }

    const { error: deleteError } = await supabase
        .from('reproductores')
        .delete()
        .eq('id', id);

    if (deleteError) {
        console.error('Error eliminando reproductor:', deleteError.message);
        return res.status(500).json({ error: 'Error al eliminar' });
    }

    console.log(`🗑️ Eliminado animal ID: ${id} por ${usuario.nombre}`);
    res.json({ ok: true });
});

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor listo en puerto ${PORT}`);
        console.log(`🪣 Bucket de Storage: ${STORAGE_BUCKET}`);
        console.log(`🖼️  Galería: ${GALERIA_BUCKET}/${GALERIA_CARPETA} en ${GALERIA_URL}`);
    });
}
