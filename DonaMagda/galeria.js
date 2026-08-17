// ============================================================
// CARRUSEL — horizontal, con fondo difuminado para medios verticales
// Las fotos pasan solas cada X segundos; los videos, al terminar.
//
// Puede haber varios en una misma página: cada .galeria-carrusel es una
// instancia y lee su propia carpeta del Storage vía data-carpeta.
// Es independiente de script.js: no necesita el SDK de Supabase.
// ============================================================
const GALERIA_SEGUNDOS_FOTO = 6000;
const GALERIA_FPS_FONDO = 100; // cada cuántos ms se repinta el fondo de un video

class Carrusel {
    constructor(elemento) {
        this.el = elemento;
        this.carpeta = elemento.dataset.carpeta || '';
        // Si no hay medios escondemos toda la caja (la sección o la columna).
        this.caja = elemento.closest('[data-galeria-caja]') || elemento;
        this.track = elemento.querySelector('.galeria-track');
        this.dots = elemento.querySelector('.galeria-dots');

        this.medios = [];
        this.indice = 0;
        this.timer = null;
        this.fondoTimer = null;
        this.pausado = false;
        this.avancePendiente = false;
        this.visible = true;
    }

    async cargar() {
        if (!this.track || !this.dots) return;

        const url = this.carpeta ? `/galeria?carpeta=${encodeURIComponent(this.carpeta)}` : '/galeria';
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`respuesta ${res.status}`);
            this.medios = await res.json();
        } catch (error) {
            console.error(`Error cargando carrusel "${this.carpeta}":`, error);
            this.medios = [];
        }

        // Sin medios no mostramos un carrusel vacío.
        if (!Array.isArray(this.medios) || this.medios.length === 0) {
            this.caja.style.display = 'none';
            return;
        }

        this.renderizar();
        this.caja.style.display = '';
        this.irA(0);
    }

    renderizar() {
        this.track.innerHTML = this.medios.map((medio, i) => medio.tipo === 'video'
            ? `<div class="galeria-slide" data-tipo="video">
                   <canvas class="galeria-fondo" width="64" height="36" aria-hidden="true"></canvas>
                   <video class="galeria-media" src="${medio.url}" muted playsinline preload="${i === 0 ? 'auto' : 'none'}"></video>
               </div>`
            : `<div class="galeria-slide" data-tipo="imagen">
                   <img class="galeria-fondo" src="${medio.url}" alt="" aria-hidden="true">
                   <img class="galeria-media" src="${medio.url}" alt="Cabaña Doña Magda" loading="${i === 0 ? 'eager' : 'lazy'}">
               </div>`
        ).join('');

        this.dots.innerHTML = this.medios.map((_, i) =>
            `<button type="button" class="galeria-dot" data-indice="${i}" aria-label="Ir al elemento ${i + 1}"></button>`
        ).join('');

        // Un video termina → pasa al siguiente (salvo que el avance esté pausado).
        this.track.querySelectorAll('video').forEach(video => {
            video.addEventListener('ended', () => {
                if (this.pausado) {
                    this.avancePendiente = true;
                    return;
                }
                this.irA(this.indice + 1);
            });
        });

        this.dots.querySelectorAll('.galeria-dot').forEach(dot => {
            dot.addEventListener('click', () => this.irA(parseInt(dot.dataset.indice)));
        });

        const btnPrev = this.el.querySelector('.galeria-prev');
        const btnNext = this.el.querySelector('.galeria-next');
        if (btnPrev) btnPrev.addEventListener('click', () => this.irA(this.indice - 1));
        if (btnNext) btnNext.addEventListener('click', () => this.irA(this.indice + 1));

        this.el.addEventListener('mouseenter', () => this.pausar());
        this.el.addEventListener('mouseleave', () => this.reanudar());
        this.el.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') this.irA(this.indice - 1);
            if (e.key === 'ArrowRight') this.irA(this.indice + 1);
        });

        let inicioX = null;
        this.el.addEventListener('touchstart', e => { inicioX = e.touches[0].clientX; }, { passive: true });
        this.el.addEventListener('touchend', e => {
            if (inicioX === null) return;
            const delta = e.changedTouches[0].clientX - inicioX;
            if (Math.abs(delta) > 40) this.irA(this.indice + (delta < 0 ? 1 : -1));
            inicioX = null;
        }, { passive: true });

        // Si la pestaña queda en segundo plano, no seguimos consumiendo datos.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.dormir();
            else if (this.visible) this.despertar();
        });

        // Con varios carruseles en la página, solo trabaja el que está a la vista.
        if ('IntersectionObserver' in window) {
            const observador = new IntersectionObserver(entradas => {
                entradas.forEach(entrada => {
                    this.visible = entrada.isIntersecting;
                    if (this.visible) this.despertar();
                    else this.dormir();
                });
            }, { threshold: 0.25 });
            observador.observe(this.el);
        }
    }

    slideActual() {
        return this.track.querySelectorAll('.galeria-slide')[this.indice] || null;
    }

    irA(indice) {
        const total = this.medios.length;
        if (total === 0) return;
        this.indice = ((indice % total) + total) % total;
        this.avancePendiente = false;
        this.mostrar();
        this.programarAvance();
    }

    // Mueve el carrusel y arranca el medio activo. La reproducción no depende
    // de la pausa: el hover solo frena el avance automático, no el video.
    mostrar() {
        clearInterval(this.fondoTimer);
        this.track.style.transform = `translateX(-${this.indice * 100}%)`;

        this.dots.querySelectorAll('.galeria-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === this.indice);
        });

        const slides = this.track.querySelectorAll('.galeria-slide');
        slides.forEach((slide, i) => {
            slide.classList.toggle('activo', i === this.indice);
            const video = slide.querySelector('video');
            if (video && i !== this.indice) {
                video.pause();
                video.currentTime = 0;
            }
        });

        const actual = slides[this.indice];
        if (!actual) return;

        const video = actual.querySelector('video');
        if (!video) return;

        video.preload = 'auto';
        const indiceAlReproducir = this.indice;
        // Si el navegador bloquea el autoplay, el video no dispara 'ended':
        // avanzamos por tiempo para que el carrusel no quede trabado.
        video.play().catch(() => {
            if (indiceAlReproducir !== this.indice || this.pausado) return;
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.irA(this.indice + 1), GALERIA_SEGUNDOS_FOTO);
        });
        this.pintarFondo(actual);
    }

    // Las fotos avanzan por tiempo; los videos, con su evento 'ended'.
    programarAvance() {
        clearTimeout(this.timer);
        if (this.pausado) return;

        const actual = this.slideActual();
        if (!actual || actual.dataset.tipo === 'video') return;

        this.timer = setTimeout(() => this.irA(this.indice + 1), GALERIA_SEGUNDOS_FOTO);
    }

    // Fondo difuminado de los videos: copiamos el cuadro actual a un canvas
    // diminuto (64x36) y lo estiramos con blur por CSS. Un solo decode de video.
    pintarFondo(slide) {
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
            this.fondoTimer = setInterval(pintar, GALERIA_FPS_FONDO);
        }
    }

    pausar() {
        this.pausado = true;
        clearTimeout(this.timer);
    }

    reanudar() {
        if (!this.pausado) return;
        this.pausado = false;

        // Si el video terminó mientras estaba pausado, avanzamos ahora.
        if (this.avancePendiente) {
            this.avancePendiente = false;
            this.irA(this.indice + 1);
            return;
        }

        this.programarAvance();
    }

    // Fuera de pantalla o pestaña oculta: frenamos todo, incluido el video.
    dormir() {
        this.pausar();
        clearInterval(this.fondoTimer);
        const actual = this.slideActual();
        const video = actual && actual.querySelector('video');
        if (video) video.pause();
    }

    despertar() {
        if (document.hidden) return;
        this.mostrar();
        this.reanudar();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.galeria-carrusel').forEach(el => new Carrusel(el).cargar());
});
