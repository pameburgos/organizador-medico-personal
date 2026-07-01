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

function renderTabla() {
    const tbody = document.getElementById('tablaConsultas');
    const sinResultados = document.getElementById('sinResultados');
    const tituloLista = document.getElementById('tituloLista');

    const lista = todasLasConsultas.filter(c => estadoCoincideConFiltro(c.ESTADO, filtroActual));

    const etiquetasTitulo = { todas: 'todas', futura: 'próximas', realizada: 'realizadas' };
    tituloLista.textContent = etiquetasTitulo[filtroActual] || 'todas';

    if (lista.length === 0) {
        tbody.innerHTML = '';
        sinResultados.classList.remove('hidden');
        return;
    }
    sinResultados.classList.add('hidden');

    tbody.innerHTML = lista.map(c => {
        const { clase, etiqueta } = infoEstado(c.ESTADO);
        return `
            <tr class="border-b border-pink-50">
                <td class="py-2">${c.NOMBRE_ESPECIALIDAD}</td>
                <td class="py-2">${c.NOMBRE_DOCTOR || '—'}</td>
                <td class="py-2">${c.FECHA}</td>
                <td class="py-2">${c.HORA}</td>
                <td class="py-2">
                    <span class="badge-estado badge-${clase}">${etiqueta}</span>
                </td>
                <td class="py-2 text-right">
                    <button class="btn-accion" onclick="abrirModalEditar(${c.ID_CONSULTA})" title="Editar">
                        <i class="ti ti-pencil"></i>
                    </button>
                    <button class="btn-accion eliminar" onclick="eliminar(${c.ID_CONSULTA})" title="Eliminar">
                        <i class="ti ti-trash"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');
}

// ─── CALENDARIOS (mes anterior, actual y siguiente) ──────────────
function renderCalendarios() {
    const grid = document.getElementById('calendariosGrid');
    const hoy  = new Date();

    // mapa fecha (YYYY-MM-DD) -> { futura, realizada, cancelada }
    const porFecha = {};
    todasLasConsultas.forEach(c => {
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
    // getDay(): 0=domingo..6=sabado → lo paso a semana que arranca en lunes
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

        celdas += `<div class="${clases.join(' ')}" ${dataCount ? `data-count="${dataCount}"` : ''}>${dia}</div>`;
    }

    return `
        <div class="cal-box">
            <div class="cal-mes-titulo">${MESES[mes]} ${anio}</div>
            <div class="cal-semana">${DIAS_SEMANA.map(d => `<span>${d}</span>`).join('')}</div>
            <div class="cal-dias">${celdas}</div>
        </div>`;
}

// ─── MODAL ──────────────────────────────────────────────────────
function abrirModal() {
    editandoId = null;
    document.getElementById('modalTitulo').textContent = 'Nueva Consulta';
    limpiarCampos();
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
        document.getElementById('inpFecha').value      = c.FECHA;
        document.getElementById('inpHora').value       = c.HORA;
        document.getElementById('inpMotivo').value     = c.MOTIVO || '';
        document.getElementById('inpNotasPost').value  = c.NOTAS_POST || '';
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
    document.getElementById('inpMotivo').value         = '';
    document.getElementById('inpNotasPost').value      = '';
    document.getElementById('inpEstado').value         = 'Programada';
}

// ─── GUARDAR (crear o editar) ────────────────────────────────────
async function guardarConsulta() {
    const id_especialidad = document.getElementById('inpEspecialidad').value;
    const fecha            = document.getElementById('inpFecha').value;
    const hora              = document.getElementById('inpHora').value;
    const motivo            = document.getElementById('inpMotivo').value.trim();
    const notas_post        = document.getElementById('inpNotasPost').value.trim();
    const estado            = document.getElementById('inpEstado').value;

    if (!id_especialidad || !fecha || !hora) {
        alert('La especialidad, la fecha y la hora son obligatorias.');
        return;
    }

    const body = { id_especialidad, fecha, hora, motivo, notas_post, estado };

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


