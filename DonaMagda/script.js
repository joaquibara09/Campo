// --- CONFIGURACIÓN ---
const API_URL = '/reproductores';
let modoAdmin = false;
let adminActual = null;
let supabaseClient = null;
let storageBucket = 'reproductores';

async function initSupabase() {
    try {
        const res = await fetch('/config');
        const cfg = await res.json();
        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
            console.error('Falta config de Supabase en el server');
            return;
        }
        storageBucket = cfg.bucket || 'reproductores';
        supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    } catch (e) {
        console.error('No pude inicializar Supabase:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    cargarReproductores();
    verificarModoAdmin();
    cargarGaleria();
});

async function subirArchivoAStorage(file, carpeta) {
    if (!supabaseClient) throw new Error('Supabase no inicializado');
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const objectPath = `${carpeta}/${Date.now()}-${safeName}`;
    const { error } = await supabaseClient.storage
        .from(storageBucket)
        .upload(objectPath, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`Subida falló: ${error.message}`);
    const { data } = supabaseClient.storage.from(storageBucket).getPublicUrl(objectPath);
    return data.publicUrl;
}

async function cargarReproductores() {
    try {
        const response = await fetch(API_URL);
        const reproductores = await response.json();
        renderizarReproductores(reproductores);
    } catch (error) {
        console.error('Error cargando datos:', error);
        const grid = document.getElementById('grid-reproductores');
        if (grid) grid.innerHTML = '<p>Error al cargar el catálogo.</p>';
    }
}

function renderizarReproductores(lista) {
    const grid = document.getElementById('grid-reproductores');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    lista.forEach(animal => {
        const claseSexo = animal.categoria === 'macho' ? 'machos' : 'hembras';
        const claseDestacado = animal.destacado ? 'destacados' : '';
        const badgeHTML = animal.destacado ? `<div class="reproductor-badge ${animal.categoria === 'hembra' ? 'badge-destacado' : ''}">Destacado</div>` : '';
        const colorCategoria = animal.categoria === 'hembra' ? 'categoria-hembra' : '';
        const tagsHTML = animal.caracteristicas.map(tag => `<span class="tag">${tag}</span>`).join('');
        
        const btnEliminarHTML = modoAdmin ? 
            `<button class="btn-eliminar" onclick="eliminarReproductor(${animal.id})" title="Eliminar">×</button>` : '';
        
        const infoPublicacionHTML = modoAdmin && animal.publicadoPor ? 
            `<p class="info-publicacion">Publicado por: ${animal.publicadoPor}</p>` : '';

        const itemHTML = `
            <div class="reproductor-item ${claseSexo} ${claseDestacado}" data-categoria="${claseSexo}" data-id="${animal.id}">
                <div class="reproductor-imagen">
                    <img src="${animal.imagen}" alt="${animal.nombre}">
                    ${badgeHTML}
                    ${btnEliminarHTML}
                </div>
                <div class="reproductor-info">
                    <div class="reproductor-categoria ${colorCategoria}">${animal.categoria}</div>
                    <h3 class="reproductor-nombre">${animal.nombre}</h3>
                    <div class="reproductor-detalles">
                        <div class="detalle-item"><span class="detalle-label">RP:</span><span class="detalle-valor">${animal.rp}</span></div>
                        <div class="detalle-item"><span class="detalle-label">Fecha Nac:</span><span class="detalle-valor">${animal.fechaNac}</span></div>
                        <div class="detalle-item"><span class="detalle-label">Peso:</span><span class="detalle-valor">${animal.peso} kg</span></div>
                    </div>
                    <p class="reproductor-descripcion">${animal.descripcion}</p>
                    <div class="reproductor-caracteristicas">${tagsHTML}</div>
                    ${infoPublicacionHTML}
                    ${animal.documento ? `<a href="${animal.documento}" target="_blank" class="btn-documento">📄 Ver DEP's</a>` : ''}
                    <button class="btn-consultar" onclick="consultarWhatsapp('${animal.nombre}', '${animal.rp}')">Consultar Disponibilidad</button>
                </div>
            </div>
        `;
        grid.innerHTML += itemHTML;
    });
}

async function intentarLogin() {
    const nombre = document.getElementById('inputUsuario').value.trim();
    const pwd = document.getElementById('inputPassword').value;
    
    if (!nombre || !pwd) {
        alert('Por favor completá todos los campos');
        return;
    }
    
    try {
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, pwd })
        });
        
        const data = await response.json();
        
        if (data.success) {
            modoAdmin = true;
            adminActual = data.nombre;
            localStorage.setItem('modoAdmin', 'true');
            localStorage.setItem('adminNombre', data.nombre);
            
            alert(`¡Bienvenido ${data.nombre}! Modo administrador activado.`);
            cerrarModalLogin();
            actualizarInterfazAdmin();
            cargarReproductores(); 
        } else {
            alert('Usuario o contraseña incorrecta');
        }
    } catch (error) {
        console.error('Error en login:', error);
        alert('Error de conexión');
    }
}

function verificarModoAdmin() {
    const guardado = localStorage.getItem('modoAdmin');
    const nombre = localStorage.getItem('adminNombre');
    
    if (guardado === 'true' && nombre) {
        modoAdmin = true;
        adminActual = nombre;
        actualizarInterfazAdmin();
    }
}

function actualizarInterfazAdmin() {
    const btnFloat = document.querySelector('.btn-floating');
    const btnAdmin = document.querySelector('.btn-admin');
    const indicadorAdmin = document.getElementById('indicador-admin');
    
    if (modoAdmin) {
        if (btnFloat) btnFloat.style.display = 'flex';
        if (btnAdmin) {
            btnAdmin.textContent = '🔓 Cerrar Sesión';
            btnAdmin.onclick = cerrarSesion;
        }
        if (indicadorAdmin) {
            indicadorAdmin.style.display = 'block';
            indicadorAdmin.textContent = `Admin: ${adminActual}`;
        }
    } else {
        if (btnFloat) btnFloat.style.display = 'none';
        if (btnAdmin) {
            btnAdmin.textContent = '🔒';
            btnAdmin.onclick = abrirModalLogin;
        }
        if (indicadorAdmin) indicadorAdmin.style.display = 'none';
    }
}

function cerrarSesion() {
    if (confirm('¿Cerrar sesión de administrador?')) {
        modoAdmin = false;
        adminActual = null;
        localStorage.removeItem('modoAdmin');
        localStorage.removeItem('adminNombre');
        
        actualizarInterfazAdmin();
        cargarReproductores();
        alert('Sesión cerrada');
    }
}

async function eliminarReproductor(id) {
    if (!modoAdmin) {
        alert('Necesitás estar en modo administrador');
        return;
    }
    
    if (!confirm('¿Estás seguro de eliminar este reproductor?')) return;
    
    const adminNombre = localStorage.getItem('adminNombre');
    const adminPwd = prompt(`🔐 ${adminNombre}, confirmá tu contraseña para eliminar:`);
    
    if (!adminPwd) {
        alert('Eliminación cancelada');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/${id}`, { 
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminNombre, adminPwd })
        });
        
        if (response.ok) {
            alert('Reproductor eliminado');
            cargarReproductores();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'Contraseña incorrecta'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar');
    }
}

const form = document.getElementById('formNuevoReproductor');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!modoAdmin) {
            alert('Necesitás estar en modo administrador');
            return;
        }
        
        const adminNombre = localStorage.getItem('adminNombre');
        const adminPwd = document.getElementById('adminPasswordAgregar').value;
        
        if (!adminPwd) {
            alert('Por favor ingresá tu contraseña');
            return;
        }

        const inputImagen = form.querySelector('input[name="imagen"]');
        const inputDocumento = form.querySelector('input[name="documento"]');

        if (!inputImagen || inputImagen.files.length === 0) {
            alert('Tenés que seleccionar una imagen');
            return;
        }

        const archivoImagen = inputImagen.files[0];
        if (archivoImagen.name.toLowerCase().endsWith('.heic')) {
            alert('⚠️ Formato .HEIC (iPhone) no soportado. Usá .JPG o .PNG.');
            return;
        }

        if (!supabaseClient) {
            alert('Supabase no se inicializó. Refrescá la página y reintenta.');
            return;
        }

        const btnSubmit = form.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit ? btnSubmit.textContent : '';
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Subiendo imagen...'; }

        try {
            const imagenUrl = await subirArchivoAStorage(archivoImagen, 'imagenes');

            let documentoUrl = null;
            if (inputDocumento && inputDocumento.files.length > 0) {
                if (btnSubmit) btnSubmit.textContent = 'Subiendo documento...';
                documentoUrl = await subirArchivoAStorage(inputDocumento.files[0], 'documentos');
            }

            if (btnSubmit) btnSubmit.textContent = 'Guardando...';

            const payload = {
                adminNombre,
                adminPwd,
                nombre: form.nombre.value,
                categoria: form.categoria.value,
                destacado: form.destacado.value,
                rp: form.rp.value,
                fechaNac: form.fechaNac.value,
                peso: form.peso.value,
                caracteristicas: form.caracteristicas.value,
                descripcion: form.descripcion.value,
                imagen: imagenUrl,
                documento: documentoUrl
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert('¡Reproductor agregado con éxito!');
                form.reset();
                cerrarModal();
                cargarReproductores();
            } else {
                const error = await response.json();
                alert('Error: ' + (error.error || 'No autorizado'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        } finally {
            if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = textoOriginal; }
        }
    });
}

function abrirModal() { 
    if (!modoAdmin) {
        alert('Necesitás iniciar sesión como administrador');
        abrirModalLogin();
        return;
    }
    document.getElementById('modalAgregar').style.display = 'flex'; 
}

function cerrarModal() { 
    document.getElementById('modalAgregar').style.display = 'none'; 
}

function abrirModalLogin() { 
    document.getElementById('modalLogin').style.display = 'flex'; 
}

function cerrarModalLogin() { 
    document.getElementById('modalLogin').style.display = 'none'; 
}

function consultarWhatsapp(nombre, rp) {
    const mensaje = `Hola, me interesa el reproductor ${nombre} (RP: ${rp}). ¿Está disponible?`;
    window.open(`https://wa.me/5493764231576?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// ============================================================
// GALERÍA — carrusel horizontal con fondo difuminado
// Las fotos pasan solas cada X segundos; los videos, al terminar.
// ============================================================
const GALERIA_SEGUNDOS_FOTO = 6000;
const GALERIA_FPS_FONDO = 100; // cada cuántos ms se repinta el fondo de un video

let galeriaMedios = [];
let galeriaIndice = 0;
let galeriaTimer = null;
let galeriaFondoTimer = null;
let galeriaPausada = false;
let galeriaAvancePendiente = false;

async function cargarGaleria() {
    const seccion = document.getElementById('galeria');
    if (!seccion) return;

    try {
        const res = await fetch('/galeria');
        if (!res.ok) throw new Error(`respuesta ${res.status}`);
        galeriaMedios = await res.json();
    } catch (error) {
        console.error('Error cargando galería:', error);
        galeriaMedios = [];
    }

    // Sin medios no mostramos un carrusel vacío.
    if (!Array.isArray(galeriaMedios) || galeriaMedios.length === 0) {
        seccion.style.display = 'none';
        return;
    }

    renderizarGaleria();
    seccion.style.display = '';
    irAGaleria(0);
}

function renderizarGaleria() {
    const track = document.getElementById('galeria-track');
    const dots = document.getElementById('galeria-dots');
    if (!track || !dots) return;

    track.innerHTML = galeriaMedios.map((medio, i) => medio.tipo === 'video'
        ? `<div class="galeria-slide" data-tipo="video">
               <canvas class="galeria-fondo" width="64" height="36" aria-hidden="true"></canvas>
               <video class="galeria-media" src="${medio.url}" muted playsinline preload="${i === 0 ? 'auto' : 'none'}"></video>
           </div>`
        : `<div class="galeria-slide" data-tipo="imagen">
               <img class="galeria-fondo" src="${medio.url}" alt="" aria-hidden="true">
               <img class="galeria-media" src="${medio.url}" alt="Ejemplar de Cabaña Doña Magda" loading="${i === 0 ? 'eager' : 'lazy'}">
           </div>`
    ).join('');

    dots.innerHTML = galeriaMedios.map((_, i) =>
        `<button type="button" class="galeria-dot" data-indice="${i}" aria-label="Ir al elemento ${i + 1}"></button>`
    ).join('');

    // Un video termina → pasa al siguiente (salvo que el avance esté pausado).
    track.querySelectorAll('video').forEach(video => {
        video.addEventListener('ended', () => {
            if (galeriaPausada) {
                galeriaAvancePendiente = true;
                return;
            }
            irAGaleria(galeriaIndice + 1);
        });
    });

    dots.querySelectorAll('.galeria-dot').forEach(dot => {
        dot.addEventListener('click', () => irAGaleria(parseInt(dot.dataset.indice)));
    });

    const btnPrev = document.getElementById('galeria-prev');
    const btnNext = document.getElementById('galeria-next');
    if (btnPrev) btnPrev.addEventListener('click', () => irAGaleria(galeriaIndice - 1));
    if (btnNext) btnNext.addEventListener('click', () => irAGaleria(galeriaIndice + 1));

    const carrusel = document.getElementById('galeria-carrusel');
    if (carrusel) {
        carrusel.addEventListener('mouseenter', pausarGaleria);
        carrusel.addEventListener('mouseleave', reanudarGaleria);
        carrusel.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') irAGaleria(galeriaIndice - 1);
            if (e.key === 'ArrowRight') irAGaleria(galeriaIndice + 1);
        });

        let inicioX = null;
        carrusel.addEventListener('touchstart', e => { inicioX = e.touches[0].clientX; }, { passive: true });
        carrusel.addEventListener('touchend', e => {
            if (inicioX === null) return;
            const delta = e.changedTouches[0].clientX - inicioX;
            if (Math.abs(delta) > 40) irAGaleria(galeriaIndice + (delta < 0 ? 1 : -1));
            inicioX = null;
        }, { passive: true });
    }

    // Si la pestaña queda en segundo plano, no seguimos consumiendo datos.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pausarGaleria();
            clearInterval(galeriaFondoTimer);
            const video = slideActualGaleria() && slideActualGaleria().querySelector('video');
            if (video) video.pause();
        } else {
            mostrarSlideGaleria();
            reanudarGaleria();
        }
    });
}

function slideActualGaleria() {
    return document.querySelectorAll('.galeria-slide')[galeriaIndice] || null;
}

function irAGaleria(indice) {
    const total = galeriaMedios.length;
    if (total === 0) return;
    galeriaIndice = ((indice % total) + total) % total;
    galeriaAvancePendiente = false;
    mostrarSlideGaleria();
    programarAvanceGaleria();
}

// Mueve el carrusel y arranca el medio activo. La reproducción no depende
// de la pausa: el hover solo frena el avance automático, no el video.
function mostrarSlideGaleria() {
    const track = document.getElementById('galeria-track');
    if (!track) return;

    clearInterval(galeriaFondoTimer);
    track.style.transform = `translateX(-${galeriaIndice * 100}%)`;

    document.querySelectorAll('.galeria-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === galeriaIndice);
    });

    const slides = track.querySelectorAll('.galeria-slide');
    slides.forEach((slide, i) => {
        slide.classList.toggle('activo', i === galeriaIndice);
        const video = slide.querySelector('video');
        if (video && i !== galeriaIndice) {
            video.pause();
            video.currentTime = 0;
        }
    });

    const actual = slides[galeriaIndice];
    if (!actual) return;

    const video = actual.querySelector('video');
    if (!video) return;

    video.preload = 'auto';
    const indiceAlReproducir = galeriaIndice;
    // Si el navegador bloquea el autoplay, el video no dispara 'ended':
    // avanzamos por tiempo para que la galería no quede trabada.
    video.play().catch(() => {
        if (indiceAlReproducir !== galeriaIndice || galeriaPausada) return;
        clearTimeout(galeriaTimer);
        galeriaTimer = setTimeout(() => irAGaleria(galeriaIndice + 1), GALERIA_SEGUNDOS_FOTO);
    });
    pintarFondoVideo(actual);
}

// Las fotos avanzan por tiempo; los videos, con su evento 'ended'.
function programarAvanceGaleria() {
    clearTimeout(galeriaTimer);
    if (galeriaPausada) return;

    const actual = slideActualGaleria();
    if (!actual || actual.dataset.tipo === 'video') return;

    galeriaTimer = setTimeout(() => irAGaleria(galeriaIndice + 1), GALERIA_SEGUNDOS_FOTO);
}

// Fondo difuminado de los videos: copiamos el cuadro actual a un canvas
// diminuto (64x36) y lo estiramos con blur por CSS. Un solo decode de video.
function pintarFondoVideo(slide) {
    const video = slide.querySelector('video');
    const canvas = slide.querySelector('canvas');
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    const pintar = () => {
        if (video.readyState < 2) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    };

    // Al activarse el slide el video puede no tener datos todavía.
    pintar();
    video.addEventListener('loadeddata', pintar, { once: true });

    if (typeof video.requestVideoFrameCallback === 'function') {
        const porCuadro = () => {
            pintar();
            if (slide.classList.contains('activo')) video.requestVideoFrameCallback(porCuadro);
        };
        video.requestVideoFrameCallback(porCuadro);
    } else {
        galeriaFondoTimer = setInterval(pintar, GALERIA_FPS_FONDO);
    }
}

function pausarGaleria() {
    galeriaPausada = true;
    clearTimeout(galeriaTimer);
}

function reanudarGaleria() {
    if (!galeriaPausada) return;
    galeriaPausada = false;

    // Si el video terminó mientras estaba pausado, avanzamos ahora.
    if (galeriaAvancePendiente) {
        galeriaAvancePendiente = false;
        irAGaleria(galeriaIndice + 1);
        return;
    }

    programarAvanceGaleria();
}

document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const filtro = this.getAttribute('data-filter');
        document.querySelectorAll('.reproductor-item').forEach(item => {
            item.style.display = (filtro === 'todos' || item.classList.contains(filtro)) ? 'block' : 'none';
        });
    });
});