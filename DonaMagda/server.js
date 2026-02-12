const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000; // ✅ Puerto dinámico para Render

// --- 1. CONFIGURACIÓN DE MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (HTML, CSS, JS y las fotos subidas)
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 2. CONFIGURACIÓN DE ALMACENAMIENTO (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        // Crea la carpeta si no existe
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Nombre único con timestamp
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 3. RUTAS DEL CATÁLOGO ---

// Ruta raíz redirige a reproductores.html
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// Obtener lista de reproductores
app.get('/reproductores', (req, res) => {
    const filePath = path.join(__dirname, 'reproductores.json');
    
    // Si el archivo no existe, crear uno vacío
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]', 'utf8');
        return res.json([]);
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer reproductores.json:', err);
            return res.status(500).json({ error: "Error al leer la base de datos" });
        }
        try {
            const json = data.trim() === "" ? [] : JSON.parse(data);
            res.json(json);
        } catch (e) {
            console.error('Error al parsear JSON:', e);
            res.json([]);
        }
    });
});

// Guardar nuevo reproductor
app.post('/reproductores', upload.single('imagen'), (req, res) => {
    const filePath = path.join(__dirname, 'reproductores.json');

    // Validación básica
    if (!req.body.nombre || !req.body.rp) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Procesar las características
    let listaTags = [];
    if (req.body.caracteristicas) {
        listaTags = req.body.caracteristicas.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    const nuevo = {
        id: Date.now(),
        nombre: req.body.nombre,
        categoria: req.body.categoria || 'macho',
        destacado: req.body.destacado === 'true',
        rp: req.body.rp,
        fechaNac: req.body.fechaNac,
        peso: req.body.peso,
        imagen: req.file ? `/uploads/${req.file.filename}` : '',
        caracteristicas: listaTags,
        descripcion: req.body.descripcion || ''
    };

    // Leer, actualizar y guardar
    fs.readFile(filePath, 'utf8', (err, data) => {
        let reproductores = [];
        if (!err && data.trim() !== "") {
            try {
                reproductores = JSON.parse(data);
            } catch (e) {
                console.error('Error parseando JSON existente:', e);
                reproductores = [];
            }
        }

        reproductores.push(nuevo);

        fs.writeFile(filePath, JSON.stringify(reproductores, null, 2), (err) => {
            if (err) {
                console.error('Error al escribir reproductores.json:', err);
                return res.status(500).json({ error: 'Error al guardar' });
            }
            console.log('✅ Nuevo reproductor agregado:', nuevo.nombre);
            res.json(nuevo);
        });
    });
});

// Eliminar reproductor (BONUS - opcional)
app.delete('/reproductores/:id', (req, res) => {
    const filePath = path.join(__dirname, 'reproductores.json');
    const idBuscado = parseInt(req.params.id);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer' });

        try {
            let reproductores = JSON.parse(data);
            const filtrados = reproductores.filter(r => r.id !== idBuscado);

            fs.writeFile(filePath, JSON.stringify(filtrados, null, 2), (err) => {
                if (err) return res.status(500).json({ error: 'Error al eliminar' });
                res.json({ mensaje: 'Reproductor eliminado' });
            });
        } catch (e) {
            res.status(500).json({ error: 'Error al procesar' });
        }
    });
});

// --- 4. MANEJO DE ERRORES ---
app.use((err, req, res, next) => {
    console.error('Error del servidor:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// --- 5. INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto: ${PORT}`);
    console.log(`📂 Accede a: http://localhost:${PORT}`);
    console.log(`📋 Reproductores: http://localhost:${PORT}/reproductores.html`);
});