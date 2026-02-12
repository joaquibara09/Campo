// --- CONFIGURACIÓN UNIVERSAL ---
const API_URL = '/reproductores'; 

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
        const grid = document.getElementById('grid-reproductores');
        if (grid) grid.innerHTML = '<p>Error al cargar el catálogo.</p>';
    }
}

// 2. FUNCIÓN PARA DIBUJAR EL HTML
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

        const itemHTML = `
            <div class="reproductor-item ${claseSexo} ${claseDestacado}" data-categoria="${claseSexo}" data-id="${animal.id}">
                <div class="reproductor-imagen">
                    <img src="${animal.imagen}" alt="${animal.nombre}">
                    ${badgeHTML}
                    <button class="btn-eliminar" onclick="eliminarReproductor(${animal.id})" title="Eliminar">×</button>
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
                    <button class="btn-consultar" onclick="consultarWhatsapp('${animal.nombre}', '${animal.rp}')">Consultar Disponibilidad</button>
                </div>
            </div>
        `;
        grid.innerHTML += itemHTML;
    });
}

// 3. ELIMINAR REPRODUCTOR
async function eliminarReproductor(id) {
    if (!confirm('¿Estás seguro de que querés eliminarlo?')) return;
    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (response.ok) {
            alert('Eliminado');
            cargarReproductores();
        }
    } catch (error) {
        alert('Error al eliminar');
    }
}

// 4. LÓGICA DEL FORMULARIO
const form = document.getElementById('formNuevoReproductor');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        try {
            const response = await fetch(API_URL, { method: 'POST', body: formData });
            if (response.ok) {
                alert('¡Guardado con éxito!');
                form.reset();
                cerrarModal();
                cargarReproductores();
            }
        } catch (error) {
            alert('Error de conexión');
        }
    });
}

// 5. UI Y WHATSAPP
function abrirModal() { document.getElementById('modalAgregar').style.display = 'flex'; }
function cerrarModal() { document.getElementById('modalAgregar').style.display = 'none'; }

function consultarWhatsapp(nombre, rp) {
    const mensaje = `Hola, me interesa el reproductor ${nombre} (RP: ${rp}). ¿Está disponible?`;
    window.open(`https://wa.me/5493764231576?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// 6. FILTROS
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