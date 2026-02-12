const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const app = express();
const PORT = process.env.PORT || 10000;

// --- 1. CONFIGURACIÓN DE CLOUDINARY ---
cloudinary.config({ 
  cloud_name: 'dmtyidlfr', 
  api_key: '914869723251272', 
  api_secret: '' 
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'reproductores.json');
const PASS_FILE = path.join(__dirname, 'contraseñas.json');

// --- 2. MULTER EN MEMORIA ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 3. FUNCIÓN PARA VALIDAR CONTRASEÑA ---
function validarCredenciales(nombre, contraseña) {
    if (!fs.existsSync(PASS_FILE)) return null;
    const usuarios = JSON.parse(fs.readFileSync(PASS_FILE, 'utf8'));
    const usuario = usuarios.find(u => u.nombre === nombre && u.contraseña === contraseña);
    return usuario || null;
}

// --- 4. RUTAS ---

// LOGIN
app.post('/admin/login', (req, res) => {
    const { nombre, contraseña } = req.body;
    const usuario = validarCredenciales(nombre, contraseña);
    
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

// OBTENER LISTA DE USUARIOS (solo nombres, sin contraseñas)
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
app.post('/reproductores', upload.single('imagen'), async (req, res) => {
    console.log("--- Intento de subida detectado ---");
    
    try {
        // VALIDAR CREDENCIALES
        const { adminNombre, adminContraseña } = req.body;
        const usuario = validarCredenciales(adminNombre, adminContraseña);
        
        if (!usuario) {
            console.log("❌ Autenticación fallida al agregar reproductor");
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (!req.file) {
            console.log("❌ Error: No se recibió ningún archivo");
            return res.status(400).json({ error: 'No hay imagen' });
        }

        console.log(`Archivo recibido: ${req.file.originalname} (${req.file.size} bytes)`);
        console.log(`Autorizado por: ${usuario.nombre}`);

        // Subida a Cloudinary
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    { 
                        folder: "doña_magda",
                        format: "jpg"
                    }, 
                    (error, result) => {
                        if (result) resolve(result);
                        else {
                            console.error("❌ Error en Cloudinary:", error);
                            reject(error);
                        }
                    }
                );
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };

        const result = await streamUpload(req);
        console.log("✅ Subido y convertido a JPG con éxito:", result.secure_url);

        const nuevo = {
            id: Date.now(),
            nombre: req.body.nombre,
            categoria: req.body.categoria,
            destacado: req.body.destacado === 'true',
            rp: req.body.rp,
            fechaNac: req.body.fechaNac,
            peso: req.body.peso,
            imagen: result.secure_url,
            caracteristicas: req.body.caracteristicas ? req.body.caracteristicas.split(',').map(t => t.trim()) : [],
            descripcion: req.body.descripcion,
            publicadoPor: usuario.nombre, // GUARDAR QUIÉN LO PUBLICÓ
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
    const { adminNombre, adminContraseña } = req.body;
    
    // VALIDAR CREDENCIALES
    const usuario = validarCredenciales(adminNombre, adminContraseña);
    
    if (!usuario) {
        console.log("❌ Autenticación fallida al eliminar reproductor");
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error de lectura' });
        const filtrados = JSON.parse(data).filter(r => r.id !== id);
        fs.writeFile(DB_FILE, JSON.stringify(filtrados, null, 2), () => {
            console.log(`🗑️ Eliminado animal ID: ${id} por ${usuario.nombre}`);
            res.json({ ok: true });
        });
    });
});

app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));