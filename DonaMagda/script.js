// --- CONFIGURACIÓN ---
const API_URL = '/reproductores';
let modoAdmin = false;
let adminActual = null;

// 1. CARGAR REPRODUCTORES AL INICIAR
document.addEventListener('DOMContentLoaded', () => {
    cargarReproductores();
    cargarUsuarios();
    verificarModoAdmin();
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

// 2. RENDERIZAR REPRODUCTORES
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
        
        // BOTÓN ELIMINAR SOLO SI ESTÁ EN MODO ADMIN
        const btnEliminarHTML = modoAdmin ? 
            `<button class="btn-eliminar" onclick="eliminarReproductor(${animal.id})" title="Eliminar">×</button>` : '';
        
        // INFO DE PUBLICACIÓN (SOLO EN MODO ADMIN)
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
                    <button class="btn-consultar" onclick="consultarWhatsapp('${animal.nombre}', '${animal.rp}')">Consultar Disponibilidad</button>
                </div>
            </div>
        `;
        grid.innerHTML += itemHTML;
    });
}

// 3. CARGAR LISTA DE USUARIOS
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

// 4. SISTEMA DE LOGIN
async function intentarLogin() {
    const nombre = document.getElementById('selectUsuario').value;
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
            // NO GUARDAMOS LA CONTRASEÑA - se pedirá en cada operación
            
            alert(`¡Bienvenido ${data.nombre}! Modo administrador activado.`);
            cerrarModalLogin();
            actualizarInterfazAdmin();
            cargarReproductores(); // Recargar para mostrar botones de eliminar
        } else {
            alert('Usuario o contraseña incorrecta');
        }
    } catch (error) {
        console.error('Error en login:', error);
        alert('Error de conexión');
    }
}

// 5. VERIFICAR SI YA ESTABA LOGUEADO
function verificarModoAdmin() {
    const guardado = localStorage.getItem('modoAdmin');
    const nombre = localStorage.getItem('adminNombre');
    
    if (guardado === 'true' && nombre) {
        modoAdmin = true;
        adminActual = nombre;
        actualizarInterfazAdmin();
    }
}

// 6. ACTUALIZAR INTERFAZ SEGÚN MODO ADMIN
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

// 7. CERRAR SESIÓN
function cerrarSesion() {
    if (confirm('¿Cerrar sesión de administrador?')) {
        modoAdmin = false;
        adminActual = null;
        localStorage.removeItem('modoAdmin');
        localStorage.removeItem('adminNombre');
        // No hay contraseña guardada para borrar
        
        actualizarInterfazAdmin();
        cargarReproductores();
        alert('Sesión cerrada');
    }
}

// 8. ELIMINAR REPRODUCTOR (CON AUTENTICACIÓN)
async function eliminarReproductor(id) {
    if (!modoAdmin) {
        alert('Necesitás estar en modo administrador');
        return;
    }
    
    if (!confirm('¿Estás seguro de eliminar este reproductor?')) return;
    
    // PEDIR CONTRASEÑA PARA CONFIRMAR
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

// 9. AGREGAR REPRODUCTOR (CON AUTENTICACIÓN)
const form = document.getElementById('formNuevoReproductor');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!modoAdmin) {
            alert('Necesitás estar en modo administrador');
            return;
        }
        
        const formData = new FormData(form);
        
        // TOMAR CONTRASEÑA DEL FORMULARIO (no del LocalStorage)
        const adminNombre = localStorage.getItem('adminNombre');
        const adminPwd = document.getElementById('adminPasswordAgregar').value;
        
        if (!adminPwd) {
            alert('Por favor ingresá tu contraseña');
            return;
        }
        
        formData.append('adminNombre', adminNombre);
        formData.append('adminPwd', adminPwd);
        
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
                alert('Error: ' + (error.error || 'Contraseña incorrecta o no autorizado'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error de conexión');
        }
    });
}

// 10. MODALES
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

// 11. WHATSAPP
function consultarWhatsapp(nombre, rp) {
    const mensaje = `Hola, me interesa el reproductor ${nombre} (RP: ${rp}). ¿Está disponible?`;
    window.open(`https://wa.me/5493764231576?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// 12. FILTROS
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