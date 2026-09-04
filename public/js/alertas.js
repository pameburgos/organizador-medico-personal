//estas variables guardan las rutas de la api
const API_ALERTAS = '/alertas';
const API_CONSULTAS = '/consultas';

//variables disponibles durante toda la ejecución
let alertasCache = [];//[] almacena las alertas descargadas del servidor
let consultasCache = [];//guarda consultas medicas
let emailUsuario = localStorage.getItem('alertas_email') || '';//busca en el navegador si el usuario guardó correo
let tipoModalActual = null;//sirve para recordar que tipo de ventana-modal esta abierta

//quiere decir: cuando termina de cargarse todo el html ejecuta este codigo
document.addEventListener('DOMContentLoaded', async () => {
    mostrarBannerEmail();//ejecutará esto
    await cargarConsultas();//descarga las consultas
    await cargarAlertas();//descarga las alertas
    await cargarHistorial();//carga el historial
});

//esta funcion decide que mostrar dependiendo de si el usuario tiene correo guardado
function mostrarBannerEmail() {
    const banner = document.getElementById('bannerEmail');
    const aviso = document.getElementById('avisoSinEmail');
    if (emailUsuario) {
        banner.style.display = 'flex';
        aviso.style.display = 'none';
        document.getElementById('emailMostrado').textContent = emailUsuario;
    } else {
        banner.style.display = 'none';
        aviso.style.display = 'flex';
    }
}
//esto coloca el correo dentro del imput y agg la clase css
function abrirModalConfigEmail() {
    document.getElementById('inpEmail').value = emailUsuario;
    document.getElementById('modalEmail').classList.add('abierto');
}
function cerrarModalEmail() {
    document.getElementById('modalEmail').classList.remove('abierto');
}
function guardarEmail() {
    const val = document.getElementById('inpEmail').value.trim();
    if (!val || !val.includes('@')) {
        alert('Ingresá un email válido.');
        return;
    }
    emailUsuario = val;
    localStorage.setItem('alertas_email', val);
    mostrarBannerEmail();
    cerrarModalEmail();
}

//esta funcion obtiene las consultas medicas del servidor
async function cargarConsultas() {
    try {
        const res = await fetch(API_CONSULTAS);
        const data = await res.json();
        // solo las programadas y futuras
        consultasCache = data.filter(c => c.ESTADO === 'Programada');

        const select = document.getElementById('inpConsulta');
        if (consultasCache.length === 0) {
            select.innerHTML = '<option value="">No hay consultas programadas</option>';
        } else {
            select.innerHTML = '<option value="">Seleccioná una consulta…</option>' +
                consultasCache.map(c =>
                    `<option value="${c.ID_CONSULTA}">${c.NOMBRE_ESPECIALIDAD} — ${formatearFecha(c.FECHA)} ${c.HORA}</option>`
                ).join('');
        }
    } catch (err) {
        console.error('Error cargando consultas:', err);
    }
}

//obtiene todas las alertas de la bd
async function cargarAlertas() {
    try {
        const res = await fetch(API_ALERTAS);
        alertasCache = await res.json();
        renderAlertas();
    } catch (err) {
        console.error('Error cargando alertas:', err);
        alertasCache = [];
        renderAlertas();
    }
}
//organiza las alertas por tipo
function renderAlertas() {
    const porConsulta = alertasCache.filter(a => a.TIPO === 'consulta');
    const porMedicacion = alertasCache.filter(a => a.TIPO === 'medicacion');

    renderListaAlertas('listaAlertasConsulta', porConsulta, 'consulta');
    renderListaAlertas('listaAlertasMedicacion', porMedicacion, 'medicacion');
    renderPendientes();
}

//muestra en la pestaña "pendientes" solo las alertas activas, divididas por tipo
function renderPendientes() {
    const pendConsulta = alertasCache.filter(a => a.TIPO === 'consulta' && a.ACTIVA);
    const pendMedicacion = alertasCache.filter(a => a.TIPO === 'medicacion' && a.ACTIVA);

    renderListaAlertas('listaPendientesConsulta', pendConsulta, 'consulta');
    renderListaAlertas('listaPendientesMedicacion', pendMedicacion, 'medicacion');
}

//cambia entre la pestaña "Pendientes" y "Enviadas"
function cambiarTabAlertas(tab) {
    const esPendientes = tab === 'pendientes';

    document.getElementById('tabPendientes').classList.toggle('hidden', !esPendientes);
    document.getElementById('tabEnviadas').classList.toggle('hidden', esPendientes);

    document.getElementById('tabBtnPendientes').classList.toggle('tab-activo', esPendientes);
    document.getElementById('tabBtnEnviadas').classList.toggle('tab-activo', !esPendientes);
}


//esta funcion construye el html que ve el usuario
function renderListaAlertas(idLista, items, tipo) {
    const ul = document.getElementById(idLista);
    if (items.length === 0) {
        ul.innerHTML = `<li class="text-xs text-gray-400 text-center py-4">
            Sin alertas. Usá "Agregar" para crear una.
        </li>`;
        return;
    }
    ul.innerHTML = items.map(a => `
        <li class="alerta-item">
            <div class="alerta-item-info">
                <div class="alerta-item-titulo">${tituloAlerta(a, tipo)}</div>
                <div class="alerta-item-sub">${subtituloAlerta(a, tipo)}</div>
                ${tipo === 'consulta' && a.DESCRIPCION ? `<div class="alerta-item-desc">${a.DESCRIPCION}</div>` : ''}
            </div>
            <span class="${a.ACTIVA ? 'badge-activa' : 'badge-inactiva'}">
                ${a.ACTIVA ? 'Activa' : 'Pausada'}
            </span>
            <label class="toggle-switch" title="${a.ACTIVA ? 'Pausar' : 'Activar'}">
                <input type="checkbox" ${a.ACTIVA ? 'checked' : ''}
                    onchange="toggleAlerta(${a.ID_ALERTA}, this.checked)">
                <span class="toggle-slider"></span>
            </label>
            <button class="btn-eliminar-item" onclick="eliminarAlerta(${a.ID_ALERTA})"
                title="Eliminar alerta">
                <i class="ti ti-trash"></i>
            </button>
        </li>
    `).join('');
}
//esta funcion devuelve el nombre de la alerta
function tituloAlerta(a, tipo) {
    if (tipo === 'consulta') {
        const c = consultasCache.find(c => c.ID_CONSULTA == a.ID_CONSULTA);
        return c ? c.NOMBRE_ESPECIALIDAD : `Consulta #${a.ID_CONSULTA}`;
    }
    return a.DESCRIPCION || 'Medicamento';
}
//esta funcion construye el pequeño texto debajo del titulo
function subtituloAlerta(a, tipo) {
    if (tipo === 'consulta') {
        const c = consultasCache.find(c => c.ID_CONSULTA == a.ID_CONSULTA);
        if (c) {
            const lugar = c.LUGAR ? `${c.LUGAR} · ` : '';
            const doctor = c.NOMBRE_DOCTOR ? ` · ${c.NOMBRE_DOCTOR}` : '';
            return `${lugar}${formatearFecha(c.FECHA)} ${c.HORA}${doctor} · 1 día antes`;
        }
        return '1 día antes';
    }
    return `Cada ${a.FRECUENCIA_HS} hs · próximo: ${formatearDatetime(a.PROXIMO_ENVIO)}`;
}

//abre la ventana para crear una alerta
function abrirModalAlerta(tipo) {
    tipoModalActual = tipo;
    document.getElementById('inpTipoAlerta').value = tipo;
    document.getElementById('inpAlertaId').value = '';

    // título
    document.getElementById('modalAlertaTitulo').textContent =
        tipo === 'consulta' ? 'Nueva alerta de consulta' : 'Nueva alerta de medicación';

    // mostrar campos correspondientes
    document.getElementById('camposConsulta').style.display = tipo === 'consulta' ? '' : 'none';
    document.getElementById('camposMedicacion').style.display = tipo === 'medicacion' ? '' : 'none';

    // valor por defecto para primer envío (ahora + 1 hora)
    if (tipo === 'medicacion') {
        const ahora = new Date(Date.now() + 60 * 60 * 1000);
        document.getElementById('inpPrimerEnvio').value = toLocalDatetimeInput(ahora);
    }

    // limpiar campos
    document.getElementById('inpDescConsulta').value = '';
    document.getElementById('inpNombreMed').value = '';
    document.getElementById('inpDescMed').value = '';
    document.getElementById('inpFrecuencia').value = '8';
    document.getElementById('inpDias').value = '3';

    document.getElementById('modalAlerta').classList.add('abierto');
}

function cerrarModalAlerta() {
    document.getElementById('modalAlerta').classList.remove('abierto');
}
//importante: cuando el usuario presiona Guardar
async function guardarAlerta() {
    const tipo = document.getElementById('inpTipoAlerta').value;
    const dest = emailUsuario;

    if (!dest) {//comprueba que exista un correo
        alert('Primero configurá tu email para recibir alertas.');
        cerrarModalAlerta();
        abrirModalConfigEmail();
        return;
    }

    let body;

    if (tipo === 'consulta') {
        const idConsulta = document.getElementById('inpConsulta').value;
        if (!idConsulta) { alert('Seleccioná una consulta.'); return; }
        const desc = document.getElementById('inpDescConsulta').value.trim();

        body = {
            tipo,
            ID_CONSULTA: Number(idConsulta),
            descripcion: desc || null,
            canal: 'email',
            destinatario: dest,
            frecuencia_hs: 24  // 1 día = 24 hs de anticipación
        };
    } else {
        const nombre = document.getElementById('inpNombreMed').value.trim();
        const desc = document.getElementById('inpDescMed').value.trim();
        const frec = Number(document.getElementById('inpFrecuencia').value);
        const primero = document.getElementById('inpPrimerEnvio').value;
        const dias = Number(document.getElementById('inpDias').value);

        if (!nombre) { alert('Ingresá el nombre del medicamento.'); return; }
        if (!primero) { alert('Elegí la fecha y hora del primer recordatorio.'); return; }
        if (!dias || dias < 1) { alert('Ingresá la duración en días (mínimo 1).'); return; }

        // calcular total de envíos y fecha de fin
        const total_envios = Math.floor((dias * 24) / frec);
        const fecha_fin = new Date(primero);
        fecha_fin.setDate(fecha_fin.getDate() + dias);

        body = {
            tipo,
            ID_CONSULTA: null,
            descripcion: desc ? `${nombre} — ${desc}` : nombre,
            id_medicamento: null,
            canal: 'email',
            destinatario: dest,
            frecuencia_hs: frec,
            proximo_envio: primero,
            total_envios,
            fecha_fin: fecha_fin.toISOString()
        };
    }

    try {
        const res = await fetch(API_ALERTAS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(await res.text());
        cerrarModalAlerta();
        await cargarAlertas();
    } catch (err) {
        console.error('Error guardando alerta:', err);
        alert('No se pudo guardar la alerta. Revisá la consola.');
    }
    cerrarModalAlerta();
    await cargarAlertas();
    alert('Alerta Generada Correctamente')
}

async function toggleAlerta(id, activa) {
    try {
        await fetch(`${API_ALERTAS}/${id}/toggle`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activa: activa ? 1 : 0 })
        });
        await cargarAlertas();
    } catch (err) {
        console.error('Error toggling alerta:', err);
    }
}

//eliminar alerta
async function eliminarAlerta(id) {
    if (!confirm('¿Eliminar esta alerta?')) return;
    try {
        await fetch(`${API_ALERTAS}/${id}`, { method: 'DELETE' });
        await cargarAlertas();
    } catch (err) {
        console.error('Error eliminando alerta:', err);
    }
}

//historial de coreos enviados
async function cargarHistorial() {
    try {
        const res = await fetch(`${API_ALERTAS}/historial`);
        const items = await res.json();
        const ul = document.getElementById('historialEnvios');
        if (!items.length) {
            ul.innerHTML = '<li class="text-xs text-gray-400 text-center py-3">Sin envíos registrados.</li>';
            return;
        }
        ul.innerHTML = items.slice(0, 10).map(h => `
            <li class="historial-item">
                <span class="historial-dot ${h.EXITOSO ? '' : 'error'}"></span>
                <span>${h.DESCRIPCION}</span>
                <span class="ml-auto text-gray-400">${formatearDatetime(h.FECHA_ENVIO)}</span>
            </li>
        `).join('');
    } catch (err) {
        // la tabla historial puede no existir aún
    }
}

//formateo de fechas: 2026-07-01 pasa a 01/07/2026 
function formatearFecha(str) {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
}

function formatearDatetime(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleString('es-PY', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function toLocalDatetimeInput(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}