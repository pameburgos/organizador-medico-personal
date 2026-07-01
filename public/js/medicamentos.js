// public/js/medicamentos.js
// Código del NAVEGADOR — llama a la API con fetch()

const API = '/medicamentos';

let todosLosMedicamentos = [];
let editandoId            = null; // null = nuevo, número = editar
let filtroEstadoActual    = 'todos';

// ─── Al cargar la página ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await cargarMedicamentos();
    await cargarHistorial();
});

// ─── LEER medicamentos ───────────────────────────────────────────
async function cargarMedicamentos() {
    try {
        const res  = await fetch(API);
        const data = await res.json();
        todosLosMedicamentos = data;
        renderizarTarjetas(data);
        llenarSelectFiltroHistorial(data);
    } catch (err) {
        console.error('Error al cargar medicamentos:', err);
    }
}

// ─── Estado derivado (en curso / finalizado) ─────────────────────
function estadoDeMedicamento(med) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (med.FECHA_FIN && med.FECHA_FIN < hoy) {
        return { clase: 'finalizado', etiqueta: 'Finalizado' };
    }
    return { clase: 'encurso', etiqueta: 'En curso' };
}

// ─── Render de tarjetas ───────────────────────────────────────────
function renderizarTarjetas(lista) {
    const grilla      = document.getElementById('grilla');
    const emptyState  = document.getElementById('empty-state');
    const contador     = document.getElementById('contador');

    contador.innerText = lista.length;

    if (todosLosMedicamentos.length === 0) {
        grilla.classList.add('hidden');
        emptyState.classList.remove('hidden');
        grilla.innerHTML = '';
        return;
    }
    grilla.classList.remove('hidden');
    emptyState.classList.add('hidden');

    if (lista.length === 0) {
        grilla.innerHTML = `<p class="text-sm text-gray-400 col-span-full text-center py-8">
            No se encontraron medicamentos con ese criterio.
        </p>`;
        return;
    }

    grilla.innerHTML = lista.map(med => {
        const { clase, etiqueta } = estadoDeMedicamento(med);
        const badgeClase = clase === 'encurso' ? 'badge-encurso' : 'badge-finalizado';

        return `
            <div class="med-card ${clase}">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-start gap-3">
                        <span class="med-icono"><i class="ti ti-pill"></i></span>
                        <div>
                            <h4 class="font-semibold text-sm text-[#6F5390]">${escapeHtml(med.NOMBRE)}</h4>
                            ${med.DOSIS ? `<p class="text-xs text-gray-500">${escapeHtml(med.DOSIS)}</p>` : ''}
                        </div>
                    </div>
                    <span class="badge ${badgeClase}">${etiqueta}</span>
                </div>

                ${med.FRECUENCIA ? `
                <p class="text-xs text-gray-500 flex items-center gap-1.5">
                    <i class="ti ti-clock text-[#CDAEE3]"></i> ${escapeHtml(med.FRECUENCIA)}
                </p>` : ''}

                ${med.INDICACION ? `
                <p class="text-xs text-gray-500 flex items-center gap-1.5">
                    <i class="ti ti-notes text-[#CDAEE3]"></i> ${escapeHtml(med.INDICACION)}
                </p>` : ''}

                ${(med.FECHA_INICIO || med.FECHA_FIN) ? `
                <p class="text-xs text-gray-400 flex items-center gap-1.5">
                    <i class="ti ti-calendar text-[#CDAEE3]"></i>
                    ${med.FECHA_INICIO ? formatearFecha(med.FECHA_INICIO) : '—'}
                    ${med.FECHA_FIN ? ' → ' + formatearFecha(med.FECHA_FIN) : ''}
                </p>` : ''}

                ${med.NOTAS ? `<p class="text-xs text-gray-500 italic bg-[#FAF6FD] rounded p-2 mt-1">${escapeHtml(med.NOTAS)}</p>` : ''}

                <button class="btn-tomar mt-1" onclick="abrirModalToma(${med.ID_MEDICAMENTO}, '${escapeHtml(med.NOMBRE).replace(/'/g, "\\'")}')">
                    <i class="ti ti-pill"></i> Registrar toma
                </button>

                <div class="flex justify-end gap-1 pt-2 border-t border-[#F1E7FA]">
                    <button class="btn-accion" onclick='prepararEditar(${JSON.stringify(med)})'>
                        <i class="ti ti-edit"></i> Editar
                    </button>
                    <button class="btn-accion eliminar" onclick="archivarMedicamento(${med.ID_MEDICAMENTO})">
                        <i class="ti ti-archive"></i> Archivar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatearFecha(fechaIso) {
    const [a, m, d] = fechaIso.split('-');
    return `${d}/${m}/${a}`;
}

// ─── Filtros (buscador + estado) ─────────────────────────────────
function filtrarEstado(estado) {
    filtroEstadoActual = estado;
    ['todos', 'encurso', 'finalizado'].forEach(e => {
        document.getElementById(`f-${e}`).classList.toggle('active', e === estado);
    });
    filtrarTarjetas();
}

function filtrarTarjetas() {
    const texto = document.getElementById('buscador').value.toLowerCase();

    const filtrados = todosLosMedicamentos.filter(med => {
        const coincideTexto = med.NOMBRE.toLowerCase().includes(texto) ||
            (med.INDICACION && med.INDICACION.toLowerCase().includes(texto));

        if (!coincideTexto) return false;

        if (filtroEstadoActual === 'todos') return true;
        const { clase } = estadoDeMedicamento(med);
        return clase === filtroEstadoActual;
    });

    renderizarTarjetas(filtrados);
}

// ─── MODAL: nuevo / editar medicamento ───────────────────────────
function abrirModal() {
    editandoId = null;
    document.getElementById('modalTitulo').textContent = 'Nuevo medicamento';
    limpiarCamposMedicamento();
    document.getElementById('errorMsg').classList.add('hidden');
    document.getElementById('modal').style.display = 'flex';
}

function prepararEditar(med) {
    editandoId = med.ID_MEDICAMENTO;
    document.getElementById('modalTitulo').textContent = 'Editar medicamento';
    document.getElementById('errorMsg').classList.add('hidden');

    document.getElementById('inpNombre').value       = med.NOMBRE || '';
    document.getElementById('inpDosis').value        = med.DOSIS || '';
    document.getElementById('inpVia').value          = med.VIA || 'Oral';
    document.getElementById('inpFrecuencia').value   = med.FRECUENCIA || '';
    document.getElementById('inpIndicacion').value   = med.INDICACION || '';
    document.getElementById('inpFechaInicio').value  = med.FECHA_INICIO || '';
    document.getElementById('inpFechaFin').value     = med.FECHA_FIN || '';
    document.getElementById('inpNotas').value        = med.NOTAS || '';

    document.getElementById('modal').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal').style.display = 'none';
}

function limpiarCamposMedicamento() {
    document.getElementById('inpNombre').value      = '';
    document.getElementById('inpDosis').value       = '';
    document.getElementById('inpVia').value         = 'Oral';
    document.getElementById('inpFrecuencia').value  = '';
    document.getElementById('inpIndicacion').value  = '';
    document.getElementById('inpFechaInicio').value = '';
    document.getElementById('inpFechaFin').value    = '';
    document.getElementById('inpNotas').value       = '';
}

// ─── GUARDAR medicamento (crear o editar) ────────────────────────
async function guardarMedicamento() {
    const nombre        = document.getElementById('inpNombre').value.trim();
    const dosis          = document.getElementById('inpDosis').value.trim();
    const via             = document.getElementById('inpVia').value;
    const frecuencia      = document.getElementById('inpFrecuencia').value.trim();
    const indicacion      = document.getElementById('inpIndicacion').value.trim();
    const fecha_inicio    = document.getElementById('inpFechaInicio').value;
    const fecha_fin       = document.getElementById('inpFechaFin').value;
    const notas           = document.getElementById('inpNotas').value.trim();

    if (!nombre) {
        document.getElementById('errorMsg').classList.remove('hidden');
        return;
    }
    document.getElementById('errorMsg').classList.add('hidden');

    const body = { nombre, dosis, via, frecuencia, indicacion, fecha_inicio, fecha_fin, notas };

    try {
        const url    = editandoId ? `${API}/${editandoId}` : API;
        const metodo = editandoId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            alert('Error: ' + err.error);
            return;
        }

        cerrarModal();
        await cargarMedicamentos();
        filtrarTarjetas();
    } catch (err) {
        console.error('Error al guardar medicamento:', err);
        alert('No se pudo guardar. Revisá la consola.');
    }
}

// ─── ARCHIVAR medicamento ─────────────────────────────────────────
async function archivarMedicamento(id) {
    if (!confirm('¿Archivar este medicamento? El historial de tomas se conserva.')) return;
    try {
        const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            alert('Error: ' + err.error);
            return;
        }
        await cargarMedicamentos();
        filtrarTarjetas();
    } catch (err) {
        console.error('Error al archivar medicamento:', err);
    }
}

// ─── MODAL: registrar toma ────────────────────────────────────────
function abrirModalToma(idMedicamento, nombreMedicamento) {
    document.getElementById('tomaIdMedicamento').value = idMedicamento;
    document.getElementById('tomaMedNombre').textContent = nombreMedicamento;
    document.getElementById('inpTomaFechaHora').value = fechaHoraLocalAhora();
    document.getElementById('inpTomaNotas').value = '';
    document.getElementById('modalToma').style.display = 'flex';
}

function cerrarModalToma() {
    document.getElementById('modalToma').style.display = 'none';
}

// devuelve la fecha/hora actual en formato compatible con <input type="datetime-local">
function fechaHoraLocalAhora() {
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    return ahora.toISOString().slice(0, 16);
}

async function guardarToma() {
    const idMedicamento = document.getElementById('tomaIdMedicamento').value;
    const fecha_hora      = document.getElementById('inpTomaFechaHora').value;
    const notas            = document.getElementById('inpTomaNotas').value.trim();

    if (!fecha_hora) {
        alert('Indicá la fecha y hora de la toma.');
        return;
    }

    try {
        const res = await fetch(`${API}/${idMedicamento}/tomas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha_hora, notas })
        });

        if (!res.ok) {
            const err = await res.json();
            alert('Error: ' + err.error);
            return;
        }

        cerrarModalToma();
        await cargarHistorial();
    } catch (err) {
        console.error('Error al registrar toma:', err);
        alert('No se pudo registrar la toma. Revisá la consola.');
    }
}

// ─── HISTORIAL de tomas ───────────────────────────────────────────
function llenarSelectFiltroHistorial(medicamentos) {
    const select = document.getElementById('filtroHistorial');
    const valorActual = select.value;
    select.innerHTML = '<option value="">Todos los medicamentos</option>' +
        medicamentos.map(m => `<option value="${m.ID_MEDICAMENTO}">${escapeHtml(m.NOMBRE)}</option>`).join('');
    select.value = valorActual;
}

async function cargarHistorial() {
    const idMedicamento = document.getElementById('filtroHistorial').value;
    const tbody          = document.getElementById('tablaHistorial');
    const sinHistorial    = document.getElementById('sinHistorial');

    try {
        let url = `${API}/historial?limite=30`;
        if (idMedicamento) url += `&id_medicamento=${idMedicamento}`;

        const res  = await fetch(url);
        const data = await res.json();

        if (data.length === 0) {
            tbody.innerHTML = '';
            sinHistorial.classList.remove('hidden');
            return;
        }
        sinHistorial.classList.add('hidden');

        tbody.innerHTML = data.map(t => {
            const [fecha, hora] = t.FECHA_HORA_TOMA.split('T');
            return `
                <tr>
                    <td class="py-2">${escapeHtml(t.NOMBRE_MEDICAMENTO)}</td>
                    <td class="py-2">${formatearFecha(fecha)}</td>
                    <td class="py-2">${hora}</td>
                    <td class="py-2">${t.NOTAS ? escapeHtml(t.NOTAS) : '—'}</td>
                    <td class="py-2 text-right">
                        <button class="btn-accion eliminar" onclick="eliminarToma(${t.ID_TOMA})" title="Eliminar registro">
                            <i class="ti ti-trash"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    } catch (err) {
        console.error('Error al cargar historial:', err);
    }
}

async function eliminarToma(idToma) {
    if (!confirm('¿Eliminar este registro de toma?')) return;
    try {
        const res = await fetch(`${API}/tomas/${idToma}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            alert('Error: ' + err.error);
            return;
        }
        await cargarHistorial();
    } catch (err) {
        console.error('Error al eliminar toma:', err);
    }
}
