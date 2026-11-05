// public/js/consultas.js
// Código del NAVEGADOR — llama a la API con fetch()

const API           = '/consultas';
const API_ESP        = '/especialidades';

let todasLasConsultas = [];   // caché local
let especialidadesCache = []; // para el <select> y mostrar el doctor
let editandoId        = null; // null = nueva, número = editar
let filtroActual       = 'todas';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['L','M','M','J','V','S','D'];

// ─── Al cargar la página ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await cargarEspecialidadesParaSelect();
    await cargarConsultas();
});

// ─── ESPECIALIDADES (para el select del modal) ──────────────────
async function cargarEspecialidadesParaSelect() {
    try {
        const res  = await fetch(API_ESP);
        const data = await res.json();
        especialidadesCache = data;

        const select = document.getElementById('inpEspecialidad');
        select.innerHTML = '<option value="">Seleccioná una especialidad…</option>' +
            data.map(e => `<option value="${e.ID_ESPECIALIDAD}">${e.NOMBRE}</option>`).join('');
    } catch (err) {
        console.error('Error al cargar especialidades:', err);
    }
}

function mostrarDoctorDeEspecialidad() {
    const id  = document.getElementById('inpEspecialidad').value;
    const esp = especialidadesCache.find(e => String(e.ID_ESPECIALIDAD) === String(id));
    document.getElementById('inpDoctor').value = esp ? (esp.NOMBRE_DOCTOR || '—') : '';
}

// ─── LEER ─────────────────────────────────────────────────────--
async function cargarConsultas() {
    try {
        const res  = await fetch(API);
        const data = await res.json();
        todasLasConsultas = data;
        renderTabla();
        renderCalendarios();
    } catch (err) {
        console.error('Error al cargar consultas:', err);
    }
}

// ─── TABLA + FILTROS ──────────────────────────────────────────--
function filtrarLista(tipo) {
    filtroActual = tipo;
    ['todas', 'futura', 'realizada'].forEach(t => {
        document.getElementById(`f-${t}`).classList.toggle('active', t === tipo);
    });
    renderTabla();
}

// REQUERIMIENTO: Cuando pasa la fecha que se registró como próxima, pasa a Realizada
function normalizarEstado(c) {
    if (c.ESTADO === 'Programada' && c.FECHA && c.HORA) {
        const fechaHoraTurno = new Date(`${c.FECHA}T${c.HORA}:00`);
        if (fechaHoraTurno < new Date()) {
            return 'Realizada';
        }
    }
    return c.ESTADO;
}

// mapea los botones de la UI (futura/realizada) a los valores reales de ESTADO
function estadoCoincideConFiltro(estado, filtro) {
    if (filtro === 'todas') return true;
    if (filtro === 'futura') return estado === 'Programada';
    if (filtro === 'realizada') return estado === 'Realizada';
    return true;
}

function infoEstado(estado) {
    if (estado === 'Programada') return { clase: 'futura',     etiqueta: 'Próxima'   };
    if (estado === 'Realizada')  return { clase: 'realizada',  etiqueta: 'Realizada' };
    return                            { clase: 'cancelada',  etiqueta: 'Cancelada' };
}

// REQUERIMIENTO: Clasificar los historiales de consulta por mes
function renderTabla() {
    const tbody = document.getElementById('tablaConsultas');
    const sinResultados = document.getElementById('sinResultados');
    const tituloLista = document.getElementById('tituloLista');

    // Auto-actualizar visualmente consultas vencidas
    todasLasConsultas.forEach(c => {
        c.ESTADO = normalizarEstado(c);
    });

    const lista = todasLasConsultas.filter(c => estadoCoincideConFiltro(c.ESTADO, filtroActual));

    const etiquetasTitulo = { todas: 'TODAS', futura: 'PRÓXIMAS', realizada: 'REALIZADAS' };
    tituloLista.textContent = etiquetasTitulo[filtroActual] || 'TODAS';

    if (lista.length === 0) {
        tbody.innerHTML = '';
        sinResultados.classList.remove('hidden');
        return;
    }
    sinResultados.classList.add('hidden');

    // Agrupar consultas por Mes y Año (Clasificación mensual)
    const porMes = {};
    lista.forEach(c => {
        const [anio, mesStr] = (c.FECHA || '').split('-');
        if (!anio || !mesStr) return;
        const mesIndex = Number(mesStr) - 1;
        const clave = `${anio}-${mesStr}`;
        const nombreMes = `${MESES[mesIndex] || mesStr} ${anio}`;

        if (!porMes[clave]) {
            porMes[clave] = { nombre: nombreMes, items: [] };
        }
        porMes[clave].items.push(c);
    });

    //--historial
    // Ordenar de mes más reciente a más antiguo
    const clavesOrdenadas = Object.keys(porMes).sort().reverse();

    let html = '';
    clavesOrdenadas.forEach(clave => {
        const grupo = porMes[clave];
        html += `
            <tr class="bg-pink-100/70 border-y border-pink-200">
                <td colspan="7" class="py-2.5 px-4 font-semibold text-pink-900 text-base tracking-wide">
                    <span class="inline-flex items-center gap-2">
                        <i class="ti ti-calendar-event text-pink-600"></i>
                        <span>${grupo.nombre}</span>
                        <span class="bg-white/80 text-gray-700 text-[10px] px-2 py-0.5 rounded-full border border-pink-200 font-bold">
                            ${grupo.items.length} ${grupo.items.length === 1 ? 'consulta' : 'consultas'}
                        </span>
                    </span>
                </td>
            </tr>
        `;

        grupo.items.forEach(c => {
            const { clase, etiqueta } = infoEstado(c.ESTADO);
            html += `
                <tr class="border-b border-pink-50 hover:bg-pink-50/50 transition">
                    <td class="py-3 px-4 font-medium text-gray-800">${c.NOMBRE_ESPECIALIDAD}</td>
                    <td class="py-3 px-4 text-gray-600">${c.NOMBRE_DOCTOR || '—'}</td>
                    <td class="py-3 px-4 text-gray-500">${c.LUGAR || '—'}</td>
                    <td class="py-3 px-4 font-mono text-xs text-gray-700">${c.FECHA}</td>
                    <td class="py-3 px-4 font-mono text-xs text-gray-700">${c.HORA}</td>
                    <td class="py-3 px-4">
                        <span class="badge-estado badge-${clase}">${etiqueta}</span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <button class="btn-accion" onclick="abrirModalEditar(${c.ID_CONSULTA})" title="Editar">
                            <i class="ti ti-pencil"></i>
                        </button>
                        <button class="btn-accion eliminar" onclick="eliminar(${c.ID_CONSULTA})" title="Eliminar">
                            <i class="ti ti-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });
    });

    tbody.innerHTML = html;
}

//---CALENDARIOS (mes pasado, mes actual y mes siguiente)---
function renderCalendarios() {
    const grid = document.getElementById('calendariosGrid');
    const hoy  = new Date();

    const porFecha = {};
    todasLasConsultas.forEach(c => {
        c.ESTADO = normalizarEstado(c);
        if (!porFecha[c.FECHA]) porFecha[c.FECHA] = { futura: 0, realizada: 0, cancelada: 0 };
        const { clase } = infoEstado(c.ESTADO);
        porFecha[c.FECHA][clase]++;
    });

    const meses = [-1, 0, 1].map(offset => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
        return { anio: d.getFullYear(), mes: d.getMonth() };
    });

    grid.innerHTML = meses.map(({ anio, mes }) => construirCalendarioMes(anio, mes, porFecha, hoy)).join('');
}

function construirCalendarioMes(anio, mes, porFecha, hoy) {
    const primerDia   = new Date(anio, mes, 1);
    const diasEnMes    = new Date(anio, mes + 1, 0).getDate();
    const offsetInicio = (primerDia.getDay() + 6) % 7;

    let celdas = '';
    for (let i = 0; i < offsetInicio; i++) {
        celdas += `<div class="cal-dia cal-vacio"></div>`;
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const info = porFecha[fechaStr];
        const esHoy = anio === hoy.getFullYear() && mes === hoy.getMonth() && dia === hoy.getDate();

        let clases = ['cal-dia'];
        let dataCount = '';
        if (info && info.futura && info.realizada) {
            clases.push('mixta');
            dataCount = info.futura + info.realizada;
        } else if (info && info.futura) {
            clases.push('futura');
            dataCount = info.futura;
        } else if (info && info.realizada) {
            clases.push('realizada');
            dataCount = info.realizada;
        } else if (info && info.cancelada) {
            clases.push('cancelada');
        }
        if (esHoy) clases.push('hoy');

        celdas += `<div class="${clases.join(' ')}" ${dataCount ? `data-count="${dataCount}"` : ''} onclick="abrirModal('${fechaStr}')" style="cursor: pointer;">${dia}</div>`;
    }

    return `
        <div class="cal-box">
            <div class="cal-mes-titulo">${MESES[mes]} ${anio}</div>
            <div class="cal-semana">${DIAS_SEMANA.map(d => `<span>${d}</span>`).join('')}</div>
            <div class="cal-dias">${celdas}</div>
        </div>`;
}

// ─── MODAL ──────────────────────────────────────────────────────
function abrirModal(fecha = null) {
    editandoId = null;
    document.getElementById('modalTitulo').textContent = 'Nueva Consulta';
    limpiarCampos();

    if (fecha) {
        document.getElementById('inpFecha').value = fecha;
    }
    document.getElementById('modal').style.display = 'flex';
}

async function abrirModalEditar(id) {
    editandoId = id;
    document.getElementById('modalTitulo').textContent = 'Editar Consulta';
    try {
        const res  = await fetch(`${API}/${id}`);
        const c    = await res.json();

        document.getElementById('inpEspecialidad').value = c.ID_ESPECIALIDAD;
        mostrarDoctorDeEspecialidad();
        document.getElementById('inpLugar').value      = c.LUGAR || '';
        document.getElementById('inpFecha').value      = c.FECHA;
        document.getElementById('inpHora').value       = c.HORA;
        document.getElementById('inpMotivo').value     = c.MOTIVO || '';
        document.getElementById('inpEstado').value     = c.ESTADO;
    } catch (err) {
        console.error('Error al cargar la consulta:', err);
    }
    document.getElementById('modal').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal').style.display = 'none';
    limpiarCampos();
}

function limpiarCampos() {
    document.getElementById('inpEspecialidad').value = '';
    document.getElementById('inpDoctor').value        = '';
    document.getElementById('inpFecha').value         = '';
    document.getElementById('inpHora').value           = '';
    document.getElementById('inpLugar').value          = '';
    document.getElementById('inpMotivo').value         = '';
    document.getElementById('inpEstado').value         = 'Programada';
}

// ─── GUARDAR (crear o editar) ────────────────────────────────────
async function guardarConsulta() {
    const id_especialidad = document.getElementById('inpEspecialidad').value;
    const fecha            = document.getElementById('inpFecha').value;
    const hora              = document.getElementById('inpHora').value;
    const lugar              = document.getElementById('inpLugar').value.trim();
    const motivo            = document.getElementById('inpMotivo').value.trim();
    const estado            = document.getElementById('inpEstado').value;

    if (!id_especialidad || !fecha || !hora) {
        alert('La especialidad, la fecha y la hora son obligatorias.');
        return;
    }

    const body = { id_especialidad, fecha, hora, lugar, motivo, estado };

    try {
        const url    = editandoId ? `${API}/${editandoId}` : API;
        const method = editandoId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            alert('Error: ' + err.error);
            return;
        }

        cerrarModal();
        cargarConsultas();
    } catch (err) {
        console.error('Error al guardar:', err);
        alert('No se pudo guardar. Revisá la consola.');
    }
}

// ─── ELIMINAR ───────────────────────────────────────────────────
async function eliminar(id) {
    if (!confirm('¿Eliminar esta consulta?')) return;
    try {
        const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            alert('Error: ' + err.error);
            return;
        }
        cargarConsultas();
    } catch (err) {
        console.error('Error al eliminar:', err);
    }
}
