// --- CONFIGURACIÓN ---
const API_URL = '/reproductores';
let modoAdmin = false;
let adminActual = null;

// 1. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    cargarReproductores();
    cargarUsuarios();
    verificarModoAdmin();
});

// 2. CARGAR REPRODUCTORES DESDE EL SERVIDOR
async function cargarReproductores() {
    try {
        const response = await fetch(API_URL);
        const reproductores = await response.json();
        renderizarReproductores(reproductores);
    } catch (error) {
        console.error('Error cargando datos:', error);
        const grid = document.getElementById('grid-reproductores');
        if (grid) grid.innerHTML = '<p style="text-align:center; width:100%;">Error al cargar el catálogo. Por favor intentá más tarde.</p>';
    }
}

// 3. RENDERIZAR EN EL DOM
function renderizarReproductores(lista) {
    const grid = document.getElementById('grid-reproductores');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    if (lista.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%;">No hay animales cargados aún.</p>';
        return;
    }

    lista.forEach(animal => {
        const claseSexo = animal.categoria === 'macho' ? 'machos' : 'hembras';
        const claseDestacado = animal.destacado ? 'destacados' : '';
        const badgeHTML = animal.destacado ? `<div class="reproductor-badge ${animal.categoria === 'hembra' ? 'badge-destacado' : ''}">Destacado</div>` : '';
        const colorCategoria = animal.categoria === 'hembra' ? 'categoria-hembra' : '';
        
        // Manejo de características (array o string)
        let tagsHTML = '';
        if (Array.isArray(animal.caracteristicas)) {
            tagsHTML = animal.caracteristicas.map(tag => `<span class="tag">${tag}</span>`).join('');
        }
        
        // BOTÓN ELIMINAR (Solo visible en modo Admin)
        const btnEliminarHTML = modoAdmin ? 
            `<button class="btn-eliminar" onclick="eliminarReproductor(${animal.id})" title="Eliminar">×</button>` : '';
        
        // INFO PUBLICACIÓN (Solo visible en modo Admin)
        const infoPublicacionHTML = (modoAdmin && animal.publicadoPor) ? 
            `<p class="info-publicacion"><small>Subido por: ${animal.publicadoPor}</small></p>` : '';

        const itemHTML = `
            <div class="reproductor-item ${claseSexo} ${claseDestacado}" data-categoria="${claseSexo}" data-id="${animal.id}">
                <div class="reproductor-imagen">
                    <img src="${animal.imagen}" alt="${animal.nombre}" loading="lazy">
                    ${badgeHTML}
                    ${btnEliminarHTML}
                </div>
                <div class="reproductor-info">
                    <div class="reproductor-categoria ${colorCategoria}">${animal.categoria}</div>
                    <h3 class="reproductor-nombre">${animal.nombre}</h3>
                    <div class="reproductor-detalles">
                        <div class="detalle-item"><span class="detalle-label">RP:</span><span class="detalle-valor">${animal.rp}</span></div>
                        <div class="detalle-item"><span class="detalle-label">Nac:</span><span class="detalle-valor">${animal.fechaNac}</span></div>
                        <div class="detalle-item"><span class="detalle-label">Peso:</span><span class="detalle-valor">${animal.peso} kg</span></div>
                    </div>
                    <p class="reproductor-descripcion">${animal.descripcion}</p>
                    <div class="reproductor-caracteristicas">${tagsHTML}</div>
                    ${infoPublicacionHTML}
                    <button class="btn-consultar" onclick="consultarWhatsapp('${animal.nombre}', '${animal.rp}')">Consultar Disponibilidad</button>
                </div>
            </div>
        `;
        grid.innerHTML += itemHTML;
    });
}

// 4. CARGAR LISTA DE USUARIOS (Para el Select del Login)
async function cargarUsuarios() {
    try {
        const response = await fetch('/admin/usuarios');
        const usuarios = await response.json();
        const select = document.getElementById('selectUsuario');
        if (select) {
            select.innerHTML = '<option value="">Seleccionar usuario...</option>';
            usuarios.forEach(nombre => {
                select.innerHTML += `<option value="${nombre}">${nombre}</option>`;
            });
        }
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

// 5. LOGIN DE ADMINISTRADOR
async function intentarLogin() {
    const nombre = document.getElementById('selectUsuario').value;
    const contraseña = document.getElementById('inputContraseña').value.trim(); // .trim() elimina espacios accidentales
    
    if (!nombre || !contraseña) {
        alert('Por favor completá todos los campos');
        return;
    }
    
    try {
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, contraseña })
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
            cargarReproductores(); // Recargar para mostrar botones
        } else {
            alert('Usuario o contraseña incorrecta');
        }
    } catch (error) {
        console.error('Error en login:', error);
        alert('Error de conexión');
    }
}

// 6. VERIFICAR SESIÓN EXISTENTE
function verificarModoAdmin() {
    const guardado = localStorage.getItem('modoAdmin');
    const nombre = localStorage.getItem('adminNombre');
    
    if (guardado === 'true' && nombre) {
        modoAdmin = true;
        adminActual = nombre;
        actualizarInterfazAdmin();
    }
}

// 7. ACTUALIZAR UI (Botones, Footer, etc.)
function actualizarInterfazAdmin() {
    const btnFloat = document.querySelector('.btn-floating');
    const btnAdmin = document.querySelector('.btn-admin');
    const indicadorAdmin = document.getElementById('indicador-admin');
    
    if (modoAdmin) {
        // Mostrar controles de admin
        if (btnFloat) btnFloat.style.display = 'flex';
        
        // Cambiar botón del footer
        if (btnAdmin) {
            btnAdmin.textContent = '🔓 Cerrar Sesión';
            btnAdmin.onclick = cerrarSesion;
        }
        
        // Mostrar barra flotante inferior
        if (indicadorAdmin) {
            indicadorAdmin.style.display = 'block';
            indicadorAdmin.textContent = `Admin: ${adminActual}`;
        }
    } else {
        // Ocultar controles
        if (btnFloat) btnFloat.style.display = 'none';
        
        if (btnAdmin) {
            btnAdmin.textContent = '🔒 Admin';
            btnAdmin.onclick = abrirModalLogin;
        }
        
        if (indicadorAdmin) {
            indicadorAdmin.style.display = 'none';
        }
    }
}

// 8. CERRAR SESIÓN
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

// 9. ELIMINAR REPRODUCTOR
async function eliminarReproductor(id) {
    if (!modoAdmin) {
        alert('Necesitás estar en modo administrador');
        return;
    }
    
    if (!confirm('¿Estás seguro de eliminar este reproductor? Esta acción no se puede deshacer.')) return;
    
    const adminNombre = localStorage.getItem('adminNombre');
    
    // Pedir contraseña nuevamente para confirmar acción destructiva
    const adminContraseña = prompt(`🔐 ${adminNombre}, confirmá tu contraseña para eliminar:`);
    
    if (!adminContraseña) return; // Si cancela, no hacemos nada
    
    try {
        const response = await fetch(`${API_URL}/${id}`, { 
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                adminNombre: adminNombre, 
                adminContraseña: adminContraseña.trim() // Limpiar espacios
            })
        });
        
        if (response.ok) {
            alert('Reproductor eliminado correctamente.');
            cargarReproductores();
        } else {
            const error = await response.json();
            alert('⛔ Error: ' + (error.error || 'Contraseña incorrecta'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al intentar eliminar');
    }
}

// 10. AGREGAR REPRODUCTOR (Formulario)
const form = document.getElementById('formNuevoReproductor');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!modoAdmin) {
            alert('Necesitás estar en modo administrador');
            return;
        }
        
        const formData = new FormData(form);
        
        // Recuperar credenciales para autorizar la subida
        const adminNombre = localStorage.getItem('adminNombre');
        const adminContraseñaInput = document.getElementById('adminPasswordAgregar');
        const adminContraseña = adminContraseñaInput.value.trim();
        
        if (!adminNombre) {
            alert('Error de sesión: Por favor recargá la página e ingresá de nuevo.');
            return;
        }

        if (!adminContraseña) {
            alert('Por favor ingresá tu contraseña para confirmar la publicación.');
            return;
        }
        
        // Agregar credenciales al FormData
        formData.append('adminNombre', adminNombre);
        formData.append('adminContraseña', adminContraseña);
        
        try {
            const response = await fetch(API_URL, { 
                method: 'POST', 
                body: formData 
            });
            
            if (response.ok) {
                alert('¡Reproductor agregado con éxito!');
                form.reset();
                cerrarModal();
                cargarReproductores();
            } else {
                const error = await response.json();
                alert('⛔ Error: ' + (error.error || 'No autorizado. Verificá tu contraseña.'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error de conexión con el servidor');
        }
    });
}

// 11. FUNCIONES AUXILIARES (Modales, WhatsApp, Filtros)
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

// Filtros de categoría
document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const filtro = this.getAttribute('data-filter');
        document.querySelectorAll('.reproductor-item').forEach(item => {
            item.style.display = (filtro === 'todos' || item.classList.contains(filtro)) ? 'flex' : 'none';
        });
    });
});