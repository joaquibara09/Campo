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
  api_secret: 'x-w02FIMxH0ugMwrMbLWAgzNpic' 
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'reproductores.json');

// --- 2. MULTER EN MEMORIA ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 3. RUTAS ---

app.get('/reproductores', (req, res) => {
    if (!fs.existsSync(DB_FILE)) return res.json([]);
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Error de lectura" });
        res.json(data ? JSON.parse(data) : []);
    });
});

// POST CON CLOUDINARY + CONVERSIÓN A JPG
app.post('/reproductores', upload.single('imagen'), async (req, res) => {
    console.log("--- Intento de subida detectado ---");
    
    try {
        if (!req.file) {
            console.log("❌ Error: No se recibió ningún archivo en el servidor.");
            return res.status(400).send('No hay imagen en la petición');
        }

        console.log(`Archivo recibido: ${req.file.originalname} (${req.file.size} bytes)`);

        // Subida a Cloudinary con transformación automática
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    { 
                        folder: "doña_magda",
                        format: "jpg" // <--- FORZAMOS JPG PARA COMPATIBILIDAD TOTAL
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
            imagen: result.secure_url, // URL final de Cloudinary
            caracteristicas: req.body.caracteristicas ? req.body.caracteristicas.split(',').map(t => t.trim()) : [],
            descripcion: req.body.descripcion
        };

        // Guardar en JSON
        fs.readFile(DB_FILE, 'utf8', (err, data) => {
            let reproductores = (!err && data) ? JSON.parse(data) : [];
            reproductores.push(nuevo);
            fs.writeFile(DB_FILE, JSON.stringify(reproductores, null, 2), (err) => {
                if (err) {
                    console.error("❌ Error al escribir el JSON:", err);
                    return res.status(500).send("Error guardando datos");
                }
                console.log("💾 Registro guardado en reproductores.json");
                res.json(nuevo);
            });
        });

    } catch (error) {
        console.error("❌ Error crítico en el proceso:", error);
        res.status(500).send('Error interno en el servidor');
    }
});

app.delete('/reproductores/:id', (req, res) => {
    const id = parseInt(req.params.id);
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).send();
        const filtrados = JSON.parse(data).filter(r => r.id !== id);
        fs.writeFile(DB_FILE, JSON.stringify(filtrados, null, 2), () => {
            console.log(`🗑️ Eliminado animal ID: ${id}`);
            res.json({ ok: true });
        });
    });
});

app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));