// ============================================================
// GALERÍA — carrusel horizontal con fondo difuminado
// Las fotos pasan solas cada X segundos; los videos, al terminar.
//
// Lee los medios de GET /galeria. Es independiente de script.js:
// no necesita el SDK de Supabase ni el modo administrador.
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

document.addEventListener('DOMContentLoaded', cargarGaleria);
