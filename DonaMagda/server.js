const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🚨 BLOQUEO DE SEGURIDAD VITAL: Evita que el público pueda descargar tus contraseñas y base de datos
app.get(['/pwd.json', '/reproductores.json'], (req, res) => {
    res.status(403).send('Acceso denegado');
});

// Servir la web estática
app.use(express.static(__dirname));

// SERVIR ARCHIVOS DE UPLOADS
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const DB_FILE = path.join(__dirname, 'reproductores.json');
const PASS_FILE = path.join(__dirname, 'pwd.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// CREAR CARPETA UPLOADS SI NO EXISTE
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
    console.log('📁 Carpeta uploads creada');
}

// --- CONFIGURACIÓN DE MULTER (GUARDAR EN DISCO) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Saneamiento estricto: Elimina acentos, ñ, #, ?, +, etc. Solo letras, números, puntos y guiones.
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const uniqueName = Date.now() + '-' + safeName;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite 10MB
});

// --- FUNCIÓN PARA VALIDAR CONTRASEÑA ---
function validarCredenciales(nombre, pwd) {
    if (!fs.existsSync(PASS_FILE)) return null;
    const usuarios = JSON.parse(fs.readFileSync(PASS_FILE, 'utf8'));
    const usuario = usuarios.find(u => u.nombre === nombre && u.pwd === pwd);
    return usuario || null;
}

// --- RUTAS ---

// LOGIN
app.post('/admin/login', (req, res) => {
    const { nombre, pwd } = req.body;
    const usuario = validarCredenciales(nombre, pwd);
    
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

// OBTENER LISTA DE USUARIOS
app.get('/admin/usuarios', (req, res) => {
    if (!fs.existsSync(PASS_FILE)) return res.json([]);
    const usuarios = JSON.parse(fs.readFileSync(PASS_FILE, 'utf8'));
    const nombres = usuarios.map(u => u.nombre);
    res.json(nombres);
});

// OBTENER REPRODUCTORES
app.get('/reproductores', (req, res) => {
    if (!fs.existsSync(DB_FILE)) return res.json([]);
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Error de lectura" });
        res.json(data ? JSON.parse(data) : []);
    });
});

// AGREGAR REPRODUCTOR (CON AUTENTICACIÓN)
app.post('/reproductores', upload.fields([
    { name: 'imagen', maxCount: 1 },
    { name: 'documento', maxCount: 1 }
]), async (req, res) => {
    console.log("--- Intento de subida detectado ---");
    
    try {
        const { adminNombre, adminPwd } = req.body;
        const usuario = validarCredenciales(adminNombre, adminPwd);
        
        if (!usuario) {
            console.log("❌ Autenticación fallida");
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (!req.files || !req.files.imagen) {
            console.log("❌ Error: No se recibió imagen");
            return res.status(400).json({ error: 'Falta la imagen' });
        }

        console.log(`✅ Autorizado por: ${usuario.nombre}`);
        console.log(`📷 Imagen: ${req.files.imagen[0].filename}`);
        
        if (req.files.documento) {
            console.log(`📄 Documento: ${req.files.documento[0].filename}`);
        }

        const nuevo = {
            id: Date.now(),
            nombre: req.body.nombre,
            categoria: req.body.categoria,
            destacado: req.body.destacado === 'true',
            rp: req.body.rp,
            fechaNac: req.body.fechaNac,
            peso: req.body.peso,
            imagen: '/uploads/' + req.files.imagen[0].filename, // Ruta relativa correcta
            documento: req.files.documento ? '/uploads/' + req.files.documento[0].filename : null,
            caracteristicas: req.body.caracteristicas ? req.body.caracteristicas.split(',').map(t => t.trim()) : [],
            descripcion: req.body.descripcion,
            publicadoPor: usuario.nombre,
            fechaPublicacion: new Date().toISOString()
        };

        // Guardar en JSON
        fs.readFile(DB_FILE, 'utf8', (err, data) => {
            let reproductores = (!err && data) ? JSON.parse(data) : [];
            reproductores.push(nuevo);
            fs.writeFile(DB_FILE, JSON.stringify(reproductores, null, 2), (err) => {
                if (err) {
                    console.error("❌ Error al escribir el JSON:", err);
                    return res.status(500).json({ error: 'Error guardando datos' });
                }
                console.log(`💾 Registro guardado por ${usuario.nombre}`);
                res.json(nuevo);
            });
        });

    } catch (error) {
        console.error("❌ Error crítico:", error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ELIMINAR REPRODUCTOR (CON AUTENTICACIÓN)
app.delete('/reproductores/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { adminNombre, adminPwd } = req.body;
    
    const usuario = validarCredenciales(adminNombre, adminPwd);
    
    if (!usuario) {
        console.log("❌ Autenticación fallida al eliminar");
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error de lectura' });
        
        const reproductores = JSON.parse(data);
        const reproductor = reproductores.find(r => r.id === id);
        
        if (reproductor) {
            // ELIMINAR ARCHIVOS DEL DISCO (CORREGIDO)
            if (reproductor.imagen) {
                // Se usa path.basename para extraer solo "123-foto.jpg" y evitar errores de ruta
                const imagePath = path.join(UPLOADS_DIR, path.basename(reproductor.imagen));
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                    console.log(`🗑️ Imagen eliminada del disco`);
                }
            }
            
            if (reproductor.documento) {
                const docPath = path.join(UPLOADS_DIR, path.basename(reproductor.documento));
                if (fs.existsSync(docPath)) {
                    fs.unlinkSync(docPath);
                    console.log(`🗑️ Documento eliminado del disco`);
                }
            }
        }
        
        const filtrados = reproductores.filter(r => r.id !== id);
        fs.writeFile(DB_FILE, JSON.stringify(filtrados, null, 2), () => {
            console.log(`🗑️ Eliminado animal ID: ${id} por ${usuario.nombre}`);
            res.json({ ok: true });
        });
    });
});
module.exports = app;
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en puerto ${PORT}`);
    console.log(`📂 Uploads en: ${UPLOADS_DIR}`);
});