require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || 'reproductores';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️  Faltan SUPABASE_URL o SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY en el entorno');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  Sin SUPABASE_SERVICE_ROLE_KEY, las subidas a Storage requieren políticas RLS de INSERT en el bucket');
}

const supabase = createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_KEY || 'placeholder-key'
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bloqueo de archivos heredados (por si quedan en disco)
app.get(['/pwd.json', '/reproductores.json'], (req, res) => {
    res.status(403).send('Acceso denegado');
});

// Servir la web estática
app.use(express.static(__dirname));

// --- Multer en memoria: el buffer va directo a Supabase Storage ---
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// --- Helpers de Supabase Storage ---
async function subirAStorage(file, carpeta) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const objectPath = `${carpeta}/${Date.now()}-${safeName}`;

    const { error } = await supabase
        .storage
        .from(STORAGE_BUCKET)
        .upload(objectPath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (error) throw new Error(`Storage upload falló: ${error.message}`);

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
    return { url: data.publicUrl, path: objectPath };
}

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

// --- Validación de credenciales contra Supabase ---
async function validarCredenciales(nombre, pwd) {
    if (!nombre || !pwd) return null;
    const { data, error } = await supabase
        .from('usuarios')
        .select('nombre, rol')
        .eq('nombre', nombre)
        .eq('pwd', pwd)
        .maybeSingle();
    if (error) {
        console.error('Error consultando usuarios:', error.message);
        return null;
    }
    return data || null;
}

// --- RUTAS ---

// LOGIN
app.post('/admin/login', async (req, res) => {
    const { nombre, pwd } = req.body;
    const usuario = await validarCredenciales(nombre, pwd);

    if (usuario) {
        console.log(`✅ Login exitoso: ${nombre}`);
        res.json({
            success: true,
            nombre: usuario.nombre,
            rol: usuario.rol
        });
    } else {
        console.log(`❌ Login fallido: ${nombre}`);
        res.status(401).json({ success: false, mensaje: 'Credenciales incorrectas' });
    }
});

// LISTA DE USUARIOS
app.get('/admin/usuarios', async (req, res) => {
    const { data, error } = await supabase.from('usuarios').select('nombre');
    if (error) {
        console.error('Error listando usuarios:', error.message);
        return res.status(500).json({ error: 'Error al consultar usuarios' });
    }
    res.json((data || []).map(u => u.nombre));
});

// LISTA DE REPRODUCTORES
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

// ALTA DE REPRODUCTOR
app.post('/reproductores', upload.fields([
    { name: 'imagen', maxCount: 1 },
    { name: 'documento', maxCount: 1 }
]), async (req, res) => {
    console.log('--- Intento de subida detectado ---');

    try {
        const { adminNombre, adminPwd } = req.body;
        const usuario = await validarCredenciales(adminNombre, adminPwd);

        if (!usuario) {
            console.log('❌ Autenticación fallida');
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (!req.files || !req.files.imagen) {
            console.log('❌ Error: No se recibió imagen');
            return res.status(400).json({ error: 'Falta la imagen' });
        }

        console.log(`✅ Autorizado por: ${usuario.nombre}`);

        const imagenUpload = await subirAStorage(req.files.imagen[0], 'imagenes');
        console.log(`📷 Imagen subida: ${imagenUpload.path}`);

        let documentoUpload = null;
        if (req.files.documento) {
            documentoUpload = await subirAStorage(req.files.documento[0], 'documentos');
            console.log(`📄 Documento subido: ${documentoUpload.path}`);
        }

        const nuevo = {
            id: Date.now(),
            nombre: req.body.nombre,
            categoria: req.body.categoria,
            destacado: req.body.destacado === 'true',
            rp: req.body.rp,
            fechaNac: req.body.fechaNac,
            peso: req.body.peso,
            imagen: imagenUpload.url,
            documento: documentoUpload ? documentoUpload.url : null,
            caracteristicas: req.body.caracteristicas ? req.body.caracteristicas.split(',').map(t => t.trim()) : [],
            descripcion: req.body.descripcion,
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
            // Rollback de archivos ya subidos
            await eliminarDeStorage(imagenUpload.url);
            if (documentoUpload) await eliminarDeStorage(documentoUpload.url);
            return res.status(500).json({ error: 'Error guardando datos' });
        }

        console.log(`💾 Registro guardado por ${usuario.nombre}`);
        res.json(data);
    } catch (error) {
        console.error('❌ Error crítico:', error);
        res.status(500).json({ error: error.message || 'Error interno' });
    }
});

// BAJA DE REPRODUCTOR
app.delete('/reproductores/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { adminNombre, adminPwd } = req.body;

    const usuario = await validarCredenciales(adminNombre, adminPwd);

    if (!usuario) {
        console.log('❌ Autenticación fallida al eliminar');
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
    });
}
