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
// ¡ASEGURATE DE QUE TUS CLAVES ESTÉN ACÁ!
cloudinary.config({ 
  cloud_name: 'dmtyidlfr', 
  api_key: '914869723251272', 
  api_secret: 'x-w02FIMxH0ugMwrMbLWAgzNpic' 
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'reproductores.json');
const PASS_FILE = path.join(__dirname, 'contraseñas.json');

// --- DATOS DE ADMINISTRADORES (Respaldo Automático) ---
const USUARIOS_DEFAULT = [
  { "nombre": "Roberto Comparin", "contraseña": "donamgda2024", "rol": "administrador" },
  { "nombre": "Luis Ginatace", "contraseña": "brangus2024", "rol": "administrador" },
  { "nombre": "L. Barrera", "contraseña": "campo2024", "rol": "administrador" }
];

// Iniciar: Si no existe el archivo de contraseñas, crearlo automáticamente
if (!fs.existsSync(PASS_FILE)) {
    fs.writeFileSync(PASS_FILE, JSON.stringify(USUARIOS_DEFAULT, null, 2));
    console.log("✅ Archivo contraseñas.json creado automáticamente.");
}

// --- 2. MULTER ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 3. VALIDACIÓN SEGURA ---
function validarCredenciales(nombre, contraseña) {
    // Recargar archivo por si hubo cambios o se regeneró
    if (!fs.existsSync(PASS_FILE)) {
        // Intento de emergencia de recrearlo
        fs.writeFileSync(PASS_FILE, JSON.stringify(USUARIOS_DEFAULT, null, 2));
    }
    
    try {
        const usuarios = JSON.parse(fs.readFileSync(PASS_FILE, 'utf8'));
        // Usamos trim() para borrar espacios accidentales
        const usuario = usuarios.find(u => 
            u.nombre === nombre && 
            u.contraseña === contraseña.trim()
        );
        return usuario || null;
    } catch (e) {
        console.error("Error leyendo contraseñas:", e);
        return null;
    }
}

// --- RUTAS ---

// LOGIN
app.post('/admin/login', (req, res) => {
    const { nombre, contraseña } = req.body;
    const usuario = validarCredenciales(nombre, contraseña);
    
    if (usuario) {
        console.log(`✅ Login exitoso: ${nombre}`);
        res.json({ success: true, nombre: usuario.nombre, rol: usuario.rol });
    } else {
        console.log(`❌ Intento fallido para: ${nombre}`);
        res.status(401).json({ success: false, mensaje: 'Credenciales incorrectas' });
    }
});

app.get('/admin/usuarios', (req, res) => {
    if (!fs.existsSync(PASS_FILE)) return res.json([]);
    const usuarios = JSON.parse(fs.readFileSync(PASS_FILE, 'utf8'));
    res.json(usuarios.map(u => u.nombre));
});

app.get('/reproductores', (req, res) => {
    if (!fs.existsSync(DB_FILE)) return res.json([]);
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Error" });
        res.json(data ? JSON.parse(data) : []);
    });
});

// AGREGAR (PROTEGIDO)
app.post('/reproductores', upload.single('imagen'), async (req, res) => {
    try {
        // Logs para diagnosticar qué llega
        console.log("--- Intento de POST ---");
        console.log("Body recibido:", req.body); 

        const { adminNombre, adminContraseña } = req.body;
        
        if (!adminNombre || !adminContraseña) {
             console.log("❌ Faltan credenciales en la petición");
             return res.status(401).json({ error: 'Faltan datos de autenticación' });
        }

        const usuario = validarCredenciales(adminNombre, adminContraseña);
        
        if (!usuario) {
            console.log(`❌ Rechazado: ${adminNombre} - Contraseña incorrecta`);
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        if (!req.file) return res.status(400).json({ error: 'No hay imagen' });

        // Subida Cloudinary
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    { folder: "doña_magda", format: "jpg" }, 
                    (error, result) => { if (result) resolve(result); else reject(error); }
                );
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };

        const result = await streamUpload(req);

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
            publicadoPor: usuario.nombre,
            fechaPublicacion: new Date().toISOString()
        };

        fs.readFile(DB_FILE, 'utf8', (err, data) => {
            let reproductores = (!err && data) ? JSON.parse(data) : [];
            reproductores.push(nuevo);
            fs.writeFile(DB_FILE, JSON.stringify(reproductores, null, 2), (err) => {
                if(err) return res.status(500).json({error: "Error guardando"});
                console.log(`💾 Guardado por ${usuario.nombre}`);
                res.json(nuevo);
            });
        });

    } catch (error) {
        console.error("❌ Error server:", error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ELIMINAR (PROTEGIDO)
app.delete('/reproductores/:id', (req, res) => {
    const { adminNombre, adminContraseña } = req.body;
    const usuario = validarCredenciales(adminNombre, adminContraseña);

    if (!usuario) {
        console.log("❌ Eliminación rechazada: credenciales inválidas");
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const id = parseInt(req.params.id);
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).send();
        const filtrados = JSON.parse(data).filter(r => r.id !== id);
        fs.writeFile(DB_FILE, JSON.stringify(filtrados, null, 2), () => {
            console.log(`🗑️ Eliminado por ${usuario.nombre}`);
            res.json({ ok: true });
        });
    });
});

app.listen(PORT, () => console.log(`🚀 Server listo en ${PORT}`));