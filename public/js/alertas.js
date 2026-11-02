// public/js/alertas.js - Corregido y Optimizado

const API_ALERTAS = '/alertas';
const API_CONSULTAS = '/consultas';
const API_MEDICAMENTOS = '/medicamentos';

let alertasCache = [];
let consultasCache = [];
let medicamentosCache = [];
let emailUsuario = localStorage.getItem('alertas_email') || '';
let canalPreferencia = localStorage.getItem('alertas_canal') || 'ambos'; // 'email', 'push', 'ambos'

document.addEventListener('DOMContentLoaded', async () => {
    mostrarBannerEmail();
    iniciarSondeoPush();
    await Promise.all([
        cargarConsultas(),
        cargarMedicamentosParaSelect(),
        cargarAlertas(),
        cargarHistorial()
    ]);
});

// =========================================================================
// GESTIÓN DE NOTIFICACIONES PUSH DEL NAVEGADOR
// =========================================================================
async function solicitarPermisoNotificacionesPush() {
    if (!('Notification' in window)) {
        alert('Este navegador no soporta notificaciones push.');
        return false;
    }
    const permiso = await Notification.requestPermission();
    actualizarEstadoBotonPush(permiso);
    if (permiso === 'granted') {
        new Notification('🔔 Notificaciones Activadas', {
            body: 'Recibirás avisos de medicamentos y citas médicas en este dispositivo.',
            icon: '/favicon.ico'
        });
    }
    return permiso === 'granted';
}

function actualizarEstadoBotonPush(permiso = (typeof Notification !== 'undefined' ? Notification.permission : 'default')) {
    const btn = document.getElementById('btnPermisoPush');
    const badge = document.getElementById('badgeEstadoPush');
    if (!btn) return;

    if (permiso === 'granted') {
        btn.innerHTML = '<i class="ti ti-bell-ringing"></i> Notificaciones push activas';
        btn.className = 'btn-config bg-emerald-100 text-emerald-800 border-emerald-300';
        if (badge) badge.textContent = 'Push Activo';
    } else if (permiso === 'denied') {
        btn.innerHTML = '<i class="ti ti-bell-off"></i> Notificaciones bloqueadas';
        btn.className = 'btn-config bg-red-100 text-red-700 border-red-300';
        if (badge) badge.textContent = 'Bloqueado';
    } else {
        btn.innerHTML = '<i class="ti ti-bell"></i> Activar Notificaciones Push';
    }
}

// Sondeo periódico para mostrar Notificaciones Push generadas por el Cron
function iniciarSondeoPush() {
    actualizarEstadoBotonPush();
    setInterval(async () => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        try {
            const res = await fetch(`${API_ALERTAS}/pull-push`);
            if (!res.ok) return;
            const notifs = await res.json();
            notifs.forEach(n => {
                new Notification(n.titulo, {
                    body: n.mensaje,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico'
                });
            });
            if (notifs.length > 0) {
                await cargarHistorial();
                await cargarAlertas();
            }
        } catch (e) {
            // Silencioso en sondeo
        }
    }, 15000); // Consulta cada 15 segundos
}

// =========================================================================
// BANNER Y CONFIGURACIÓN DE CORREO
// =========================================================================
function mostrarBannerEmail() {
    const banner = document.getElementById('bannerEmail');
    const aviso = document.getElementById('avisoSinEmail');
    if (emailUsuario) {
        if (banner) banner.style.display = 'flex';
        if (aviso) aviso.style.display = 'none';
        const txt = document.getElementById('emailMostrado');
        if (txt) txt.textContent = emailUsuario;
    } else {
        if (banner) banner.style.display = 'none';
        if (aviso) aviso.style.display = 'flex';
    }
}

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

// =========================================================================
// CARGA DE DATOS PARA SELECTS
// =========================================================================
async function cargarConsultas() {
    try {
        const res = await fetch(API_CONSULTAS);
        const data = await res.json();
        consultasCache = data.filter(c => c.ESTADO === 'Programada');

        const select = document.getElementById('inpConsulta');
        if (!select) return;

        if (consultasCache.length === 0) {
            select.innerHTML = '<option value="">No hay consultas programadas</option>';
        } else {
            select.innerHTML = '<option value="">Seleccioná una consulta…</option>' +
                consultasCache.map(c =>
                    `<option value="${c.ID_CONSULTA}">${c.NOMBRE_ESPECIALIDAD} — ${formatearFecha(c.FECHA)} ${c.HORA} (${c.NOMBRE_DOCTOR || 'Dr/a'})</option>`
                ).join('');
        }
    } catch (err) {
        console.error('Error cargando consultas:', err);
    }
}

async function cargarMedicamentosParaSelect() {
    try {
        const res = await fetch(API_MEDICAMENTOS + '?activo=1');
        medicamentosCache = await res.json();

        const select = document.getElementById('inpSelectMed');
        if (!select) return;

        if (medicamentosCache.length === 0) {
            select.innerHTML = '<option value="">No hay medicamentos activos</option>';
        } else {
            select.innerHTML = '<option value="">Seleccioná un medicamento activo…</option>' +
                medicamentosCache.map(m =>
                    `<option value="${m.ID_MEDICAMENTO}" data-nombre="${m.NOMBRE}" data-frec="${m.FRECUENCIA || ''}">${m.NOMBRE} (${m.DOSIS || 'Sin dosis'})` +
                    `</option>`
                ).join('') + '<option value="otro">+ Escribir otro medicamento...</option>';
        }
    } catch (err) {
        console.error('Error cargando medicamentos:', err);
    }
}

function alSeleccionarMedicamento() {
    const select = document.getElementById('inpSelectMed');
    const inputManual = document.getElementById('inpNombreMed');
    if (!select || !inputManual) return;

    if (select.value === 'otro') {
        inputManual.classList.remove('hidden');
        inputManual.value = '';
        inputManual.focus();
    } else if (select.value) {
        const opt = select.selectedOptions[0];
        inputManual.classList.add('hidden');
        inputManual.value = opt.getAttribute('data-nombre') || '';
    }
}

// =========================================================================
// CARGA Y RENDERIZADO DE ALERTAS
// =========================================================================
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

function renderAlertas() {
    const porConsulta = alertasCache.filter(a => a.TIPO === 'consulta');
    const porMedicacion = alertasCache.filter(a => a.TIPO === 'medicacion' || a.TIPO === 'medicamento');

    renderListaAlertas('listaAlertasConsulta', porConsulta, 'consulta');
    renderListaAlertas('listaAlertasMedicacion', porMedicacion, 'medicacion');
    renderPendientes();
}

function renderPendientes() {
    const pendConsulta = alertasCache.filter(a => a.TIPO === 'consulta' && a.ACTIVA);
    const pendMedicacion = alertasCache.filter(a => (a.TIPO === 'medicacion' || a.TIPO === 'medicamento') && a.ACTIVA);

    renderListaAlertas('listaPendientesConsulta', pendConsulta, 'consulta');
    renderListaAlertas('listaPendientesMedicacion', pendMedicacion, 'medicacion');
}

function renderListaAlertas(idLista, items, tipo) {
    const ul = document.getElementById(idLista);
    if (!ul) return;

    if (items.length === 0) {
        ul.innerHTML = `<li class="text-xs text-gray-400 text-center py-4">
            Sin alertas configuradas. Hacé clic en "Agregar" para crear una.
        </li>`;
        return;
    }

    ul.innerHTML = items.map(a => `
        <li class="alerta-item">
            <div class="alerta-item-info">
                <div class="alerta-item-titulo">${tituloAlerta(a, tipo)}</div>
                <div class="alerta-item-sub">${subtituloAlerta(a, tipo)}</div>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Canal: ${(a.CANAL || 'email').toUpperCase()}
                    </span>
                    ${a.TOTAL_ENVIOS > 0 ? `<span class="text-[10px] text-gray-500">Toma ${a.ENVIOS_REALIZADOS || 0}/${a.TOTAL_ENVIOS}</span>` : ''}
                </div>
            </div>
            <span class="${a.ACTIVA ? 'badge-activa' : 'badge-inactiva'}">
                ${a.ACTIVA ? 'Activa' : 'Pausada'}
            </span>
            <label class="toggle-switch" title="${a.ACTIVA ? 'Pausar' : 'Activar'}">
                <input type="checkbox" ${a.ACTIVA ? 'checked' : ''}
                    onchange="toggleAlerta(${a.ID_ALERTA}, this.checked)">
                <span class="toggle-slider"></span>
            </label>
            <button class="btn-eliminar-item" onclick="eliminarAlerta(${a.ID_ALERTA})" title="Eliminar alerta">
                <i class="ti ti-trash"></i>
            </button>
        </li>
    `).join('');
}

function tituloAlerta(a, tipo) {
    if (tipo === 'consulta') {
        const c = consultasCache.find(c => c.ID_CONSULTA == (a.ID_CONSULTA || a.ID_REFERENCIA));
        return c ? `Turno: ${c.NOMBRE_ESPECIALIDAD}` : (a.DESCRIPCION || `Consulta #${a.ID_CONSULTA || ''}`);
    }
    return a.NOMBRE_MED || a.DESCRIPCION || 'Medicamento';
}

function subtituloAlerta(a, tipo) {
    if (tipo === 'consulta') {
        const c = consultasCache.find(c => c.ID_CONSULTA == (a.ID_CONSULTA || a.ID_REFERENCIA));
        if (c) {
            const lugar = c.LUGAR ? `${c.LUGAR} · ` : '';
            return `${lugar}${formatearFecha(c.FECHA)} a las ${c.HORA} · Alerta: 24h antes`;
        }
        return a.PROXIMO_ENVIO ? `Próximo aviso: ${formatearDatetime(a.PROXIMO_ENVIO)}` : '1 día antes';
    }
    return `Cada ${a.FRECUENCIA_HS} hs · Próxima toma: ${formatearDatetime(a.PROXIMO_ENVIO)}`;
}

// =========================================================================
// MODAL Y GUARDADO DE ALERTAS
// =========================================================================
function abrirModalAlerta(tipo) {
    document.getElementById('inpTipoAlerta').value = tipo;
    document.getElementById('modalAlertaTitulo').textContent =
        tipo === 'consulta' ? 'Nueva Alerta de Consulta' : 'Nueva Alerta de Medicación';

    document.getElementById('camposConsulta').style.display = tipo === 'consulta' ? '' : 'none';
    document.getElementById('camposMedicacion').style.display = tipo === 'medicacion' ? '' : 'none';

    if (tipo === 'medicacion') {
        const ahora = new Date(Date.now() + 60 * 60 * 1000);
        document.getElementById('inpPrimerEnvio').value = toLocalDatetimeInput(ahora);
        cargarMedicamentosParaSelect();
    } else {
        cargarConsultas();
    }

    document.getElementById('modalAlerta').classList.add('abierto');
}

function cerrarModalAlerta() {
    document.getElementById('modalAlerta').classList.remove('abierto');
}

async function guardarAlerta() {
    const tipo = document.getElementById('inpTipoAlerta').value;
    const dest = emailUsuario;
    const canal = document.getElementById('inpCanalNotificacion')?.value || 'ambos';

    if (!dest && canal !== 'push') {
        alert('Por favor configurá tu email para recordatorios o seleccioná canal Push.');
        cerrarModalAlerta();
        abrirModalConfigEmail();
        return;
    }

    let body = null;

    if (tipo === 'consulta') {
        const idConsulta = document.getElementById('inpConsulta').value;
        if (!idConsulta) { alert('Seleccioná una consulta agendada.'); return; }
        const c = consultasCache.find(item => item.ID_CONSULTA == idConsulta);
        if (!c) { alert('La consulta seleccionada no es válida.'); return; }

        const desc = document.getElementById('inpDescConsulta').value.trim();

        // CÁLCULO PRECISO: 24 horas antes del turno
        const fechaHoraTurno = new Date(`${c.FECHA}T${c.HORA}:00`);
        const fechaEnvio = new Date(fechaHoraTurno.getTime() - 24 * 60 * 60 * 1000);
        const ahora = new Date();
        const proximo = fechaEnvio > ahora ? fechaEnvio : new Date(ahora.getTime() + 5 * 60 * 1000);

        const alertaRepetida = alertasCache.find(a => 
            a.TIPO === 'consulta' &&
            a.ACTIVA &&
            (a.ID_CONSULTA == idConsulta || a.ID_REFERENCIA == idConsulta)
        );
        if (alertaRepetida) {
            const reemplazar = confirm('Ya existe una alerta activa para este turno.\n\n¿Deseás reemplazarla para evitar recordatorios duplicados?');
            if (!reemplazar) return;
            await fetch(`${API_ALERTAS}/${alertaRepetida.ID_ALERTA}`, { method: 'DELETE' });
        }

        body = {
            tipo: 'consulta',
            ID_CONSULTA: Number(idConsulta),
            id_referencia: Number(idConsulta),
            descripcion: desc || `Recordatorio cita con ${c.NOMBRE_ESPECIALIDAD} (${c.NOMBRE_DOCTOR || 'Especialista'})`,
            canal,
            destinatario: dest || 'push-device',
            frecuencia_hs: 24,
            proximo_envio: proximo.toISOString()
        };

    } else {
        // MEDICACIÓN
        const selectMed = document.getElementById('inpSelectMed');
        const inputNombre = document.getElementById('inpNombreMed');
        let nombre = '';
        let idMedicamento = null;

        if (selectMed && selectMed.value && selectMed.value !== 'otro') {
            idMedicamento = Number(selectMed.value);
            const med = medicamentosCache.find(m => m.ID_MEDICAMENTO == idMedicamento);
            nombre = med ? med.NOMBRE : selectMed.options[selectMed.selectedIndex].text;
        } else {
            nombre = inputNombre.value.trim();
        }

        if (!nombre) { alert('Indicá el nombre del medicamento.'); return; }

        const desc = document.getElementById('inpDescMed').value.trim();
        const frec = Number(document.getElementById('inpFrecuencia').value) || 8;
        const primeroStr = document.getElementById('inpPrimerEnvio').value;
        const dias = Number(document.getElementById('inpDias').value) || 3;

        if (!primeroStr) { alert('Elegí fecha y hora para la primera toma.'); return; }

        const total_envios = Math.floor((dias * 24) / frec);
        const fecha_fin = new Date(primeroStr);
        fecha_fin.setDate(fecha_fin.getDate() + dias);

        const alertaRepetida = alertasCache.find(a => 
            (a.TIPO === 'medicacion' || a.TIPO === 'medicamento') &&
            a.ACTIVA &&
            ((a.NOMBRE_MED && a.NOMBRE_MED.trim().toLowerCase() === nombre.trim().toLowerCase()) ||
             (idMedicamento && a.ID_MEDICAMENTO == idMedicamento))
        );
        if (alertaRepetida) {
            const reemplazar = confirm(`Ya tenés una alerta activa para "${nombre}".\n\n¿Deseás reemplazarla para asegurar que se envíe únicamente cada ${frec} horas y evitar repeticiones?`);
            if (!reemplazar) return;
            await fetch(`${API_ALERTAS}/${alertaRepetida.ID_ALERTA}`, { method: 'DELETE' });
        }

        body = {
            tipo: 'medicacion',
            ID_MEDICAMENTO: idMedicamento,
            id_referencia: idMedicamento,
            nombre_med: nombre,
            descripcion: desc ? `${nombre} — ${desc}` : nombre,
            canal,
            destinatario: dest || 'push-device',
            frecuencia_hs: frec,
            proximo_envio: new Date(primeroStr).toISOString(),
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

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `Error HTTP ${res.status}`);
        }

        cerrarModalAlerta();
        await cargarAlertas();
        await cargarHistorial();

        // Notificación de confirmación en el navegador si push está activo
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('✅ Alerta Programada', {
                body: `Recordatorio de ${tipo === 'consulta' ? 'consulta' : 'medicamento'} creado con éxito.`,
                icon: '/favicon.ico'
            });
        }
        alert('¡Alerta generada y programada correctamente!');

    } catch (err) {
        console.error('Error al guardar alerta:', err);
        alert('Error al guardar la alerta: ' + err.message);
    }
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
        console.error('Error alternando alerta:', err);
    }
}

async function eliminarAlerta(id) {
    if (!confirm('¿Eliminar esta alerta programada?')) return;
    try {
        await fetch(`${API_ALERTAS}/${id}`, { method: 'DELETE' });
        await cargarAlertas();
    } catch (err) {
        console.error('Error eliminando alerta:', err);
    }
}

async function cargarHistorial() {
    try {
        const res = await fetch(`${API_ALERTAS}/historial`);
        const items = await res.json();
        const ul = document.getElementById('historialEnvios');
        if (!ul) return;

        if (!items.length) {
            ul.innerHTML = '<li class="text-xs text-gray-400 text-center py-3">Sin envíos registrados todavía.</li>';
            return;
        }

        ul.innerHTML = items.slice(0, 15).map(h => `
            <li class="historial-item">
                <span class="historial-dot ${h.EXITOSO ? '' : 'error'}"></span>
                <span class="text-xs font-medium text-gray-700">${h.DESCRIPCION}</span>
                <span class="ml-auto text-[11px] text-gray-400">${formatearDatetime(h.FECHA_ENVIO)}</span>
            </li>
        `).join('');
    } catch (err) {
        console.warn('Historial no disponible:', err);
    }
}

// =========================================================================
// UTILIDADES DE FORMATO
// =========================================================================
function cambiarTabAlertas(tab) {
    const esPendientes = tab === 'pendientes';
    document.getElementById('tabPendientes').classList.toggle('hidden', !esPendientes);
    document.getElementById('tabEnviadas').classList.toggle('hidden', esPendientes);
    document.getElementById('tabBtnPendientes').classList.toggle('tab-activo', esPendientes);
    document.getElementById('tabBtnEnviadas').classList.toggle('tab-activo', !esPendientes);
}

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