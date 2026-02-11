const API_URL = '/reproductores';
const grid = document.getElementById('grid-reproductores');

// 1. CARGAR REPRODUCTORES AL INICIAR
document.addEventListener('DOMContentLoaded', () => {
    cargarReproductores();
});

async function cargarReproductores() {
    try {
        const response = await fetch(API_URL);
        const reproductores = await response.json();
        renderizarReproductores(reproductores);
    } catch (error) {
        console.error('Error cargando datos:', error);
        grid.innerHTML = '<p>Error al cargar el catálogo. Asegúrate de encender el servidor.</p>';
    }
}

// 2. FUNCIÓN PARA DIBUJAR EL HTML (Render)
function renderizarReproductores(lista) {
    grid.innerHTML = ''; // Limpiar
    
    lista.forEach(animal => {
        // Clases dinámicas según datos
        const claseSexo = animal.categoria === 'macho' ? 'machos' : 'hembras';
        const claseDestacado = animal.destacado ? 'destacados' : '';
        const badgeHTML = animal.destacado ? `<div class="reproductor-badge ${animal.categoria === 'hembra' ? 'badge-destacado' : ''}">Destacado</div>` : '';
        const colorCategoria = animal.categoria === 'hembra' ? 'categoria-hembra' : '';

        // Generar HTML de características (tags)
        const tagsHTML = animal.caracteristicas.map(tag => `<span class="tag">${tag}</span>`).join('');

        const itemHTML = `
            <div class="reproductor-item ${claseSexo} ${claseDestacado}" data-categoria="${claseSexo}">
                <div class="reproductor-imagen">
                    <img src="${animal.imagen}" alt="${animal.nombre}">
                    ${badgeHTML}
                </div>
                <div class="reproductor-info">
                    <div class="reproductor-categoria ${colorCategoria}">${animal.categoria}</div>
                    <h3 class="reproductor-nombre">${animal.nombre}</h3>
                    <div class="reproductor-detalles">
                        <div class="detalle-item">
                            <span class="detalle-label">RP:</span>
                            <span class="detalle-valor">${animal.rp}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Fecha Nac:</span>
                            <span class="detalle-valor">${animal.fechaNac}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Peso:</span>
                            <span class="detalle-valor">${animal.peso} kg</span>
                        </div>
                    </div>
                    <p class="reproductor-descripcion">${animal.descripcion}</p>
                    <div class="reproductor-caracteristicas">
                        ${tagsHTML}
                    </div>
                    <button class="btn-consultar" onclick="consultarWhatsapp('${animal.nombre}', '${animal.rp}')">Consultar Disponibilidad</button>
                </div>
            </div>
        `;
        grid.innerHTML += itemHTML;
    });
}

// 3. LÓGICA DEL FORMULARIO (SUBIDA DE DATOS)
const form = document.getElementById('formNuevoReproductor');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData // Fetch maneja automáticamente el multipart/form-data
        });

        if (response.ok) {
            alert('¡Reproductor agregado con éxito!');
            form.reset();
            cerrarModal();
            cargarReproductores(); // Recargar la lista
        } else {
            alert('Error al guardar');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión con el servidor');
    }
});

// 4. FUNCIONES DE UI (MODAL Y WHATSAPP)
function abrirModal() {
    document.getElementById('modalAgregar').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalAgregar').style.display = 'none';
}

// Cerrar si se hace click fuera del modal
window.onclick = function(event) {
    const modal = document.getElementById('modalAgregar');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function consultarWhatsapp(nombre, rp) {
    const mensaje = `Hola, me interesa el reproductor ${nombre} (RP: ${rp}). ¿Está disponible?`;
    const whatsapp = `https://wa.me/5493764231576?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsapp, '_blank');
}

// 5. SISTEMA DE FILTROS (Adaptado para trabajar con los nuevos elementos)
document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // UI Botones
        document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const filtro = this.getAttribute('data-filter');
        const items = document.querySelectorAll('.reproductor-item');
        
        items.forEach(item => {
            if (filtro === 'todos') {
                item.style.display = 'block';
            } else {
                if (item.classList.contains(filtro)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            }
        });
    });
});