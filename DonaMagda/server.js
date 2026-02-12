const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000; 

// --- 1. CONFIGURACIÓN ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas absolutas para evitar errores en Render
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'reproductores.json');

// Servir archivos estáticos
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- 2. MULTER (ALMACENAMIENTO) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const nombreLimpio = file.originalname.replace(/\s+/g, '-');
        cb(null, Date.now() + '-' + nombreLimpio);
    }
});
const upload = multer({ storage: storage });

// --- 3. RUTAS API ---

app.get('/', (req, res) => res.redirect('/index.html'));

// Obtener JSON
app.get('/reproductores', (req, res) => {
    if (!fs.existsSync(DB_FILE)) return res.json([]);
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Error de lectura" });
        res.json(data ? JSON.parse(data) : []);
    });
});

// Guardar
app.post('/reproductores', upload.single('imagen'), (req, res) => {
    let listaTags = req.body.caracteristicas ? req.body.caracteristicas.split(',').map(t => t.trim()) : [];

    const nuevo = {
        id: Date.now(),
        nombre: req.body.nombre,
        categoria: req.body.categoria,
        destacado: req.body.destacado === 'true',
        rp: req.body.rp,
        fechaNac: req.body.fechaNac,
        peso: req.body.peso,
        imagen: req.file ? `/uploads/${req.file.filename}` : '',
        caracteristicas: listaTags,
        descripcion: req.body.descripcion
    };

    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        let reproductores = (!err && data) ? JSON.parse(data) : [];
        reproductores.push(nuevo);
        fs.writeFile(DB_FILE, JSON.stringify(reproductores, null, 2), () => {
            res.json(nuevo);
        });
    });
});

// Eliminar
app.delete('/reproductores/:id', (req, res) => {
    const id = parseInt(req.params.id);
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).send();
        const filtrados = JSON.parse(data).filter(r => r.id !== id);
        fs.writeFile(DB_FILE, JSON.stringify(filtrados, null, 2), () => res.json({ ok: true }));
    });
});

app.listen(PORT, () => console.log(`🚀 Puerto: ${PORT}`));