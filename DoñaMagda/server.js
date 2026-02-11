const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

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
        // Crea la carpeta si no existe para evitar errores
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Nombre único con la fecha actual
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 3. RUTAS DEL CATÁLOGO ---

// Obtener lista de reproductores
app.get('/reproductores', (req, res) => {
    const filePath = path.join(__dirname, 'reproductores.json');
    
    // Si el archivo no existe, enviamos una lista vacía
    if (!fs.existsSync(filePath)) {
        return res.json([]);
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Error al leer la base de datos" });
        try {
            // Maneja archivos vacíos o con formato incorrecto
            const json = data.trim() === "" ? [] : JSON.parse(data);
            res.json(json);
        } catch (e) {
            res.json([]);
        }
    });
});

// Guardar nuevo reproductor
app.post('/reproductores', upload.single('imagen'), (req, res) => {
    const filePath = path.join(__dirname, 'reproductores.json');

    // Procesar las características para que siempre sean un Array
    let listaTags = [];
    if (req.body.caracteristicas) {
        listaTags = req.body.caracteristicas.split(',').map(tag => tag.trim());
    }

    const nuevo = {
        id: Date.now(),
        nombre: req.body.nombre,
        categoria: req.body.categoria,
        destacado: req.body.destacado === 'true',
        rp: req.body.rp,
        fechaNac: req.body.fechaNac,
        peso: req.body.peso,
        // Guardamos la ruta relativa para que funcione en cualquier puerto
        imagen: req.file ? `/uploads/${req.file.filename}` : '',
        caracteristicas: listaTags,
        descripcion: req.body.descripcion
    };

    // Leer, actualizar y guardar
    fs.readFile(filePath, 'utf8', (err, data) => {
        let reproductores = [];
        if (!err && data.trim() !== "") {
            try {
                reproductores = JSON.parse(data);
            } catch (e) {
                reproductores = [];
            }
        }

        reproductores.push(nuevo);

        fs.writeFile(filePath, JSON.stringify(reproductores, null, 2), (err) => {
            if (err) return res.status(500).send('Error al escribir el archivo');
            res.json(nuevo);
        });
    });
});

// --- 4. INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`Accede a tu web en: http://localhost:${PORT}/reproductores.html`);
});