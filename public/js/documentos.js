// public/js/documentos.js
// Código del NAVEGADOR — llama a la API con fetch()

const API     = '/documentos';
const API_ESP = '/especialidades';

let todosLosDocumentos   = [];
let especialidadesCache  = [];
let editandoId           = null;  // null = nuevo, número = editar
let tipoFiltroActual     = 'todos';
let archivoElegido       = null;

const ICONO_TIPO = {
    Receta:      { icono: 'ti-prescription',    clase: 'tipo-receta'     },
    Indicacion:  { icono: 'ti-clipboard-text',  clase: 'tipo-indicacion' },
    Estudio:     { icono: 'ti-microscope',      clase: 'tipo-estudio'    },
    Otro:        { icono: 'ti-file',            clase: 'tipo-otro'       }
};

const ETIQUETA_TIPO = {
    Receta:     'Receta',
    Indicacion: 'Indicación',
    Estudio:    'Estudio',
    Otro:       'Otro'
};

// ─── Al cargar la página ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await cargarEspecialidadesParaSelects();
    await cargarDocumentos();
    configurarDropzone();
});

// ─── ESPECIALIDADES (para los selects de filtro y de carga) ──────
async function cargarEspecialidadesParaSelects() {
    try {
        const res  = await fetch(API_ESP);
        const data = await res.json();
        especialidadesCache = data;

        const opciones = data.map(e => `<option value="${e.ID_ESPECIALIDAD}">${e.NOMBRE}</option>`).join('');

        document.getElementById('filtroEspecialidad').innerHTML =
            '<option value="">Todas las especialidades</option>' + opciones;

        document.getElementById('inpEspecialidad').innerHTML =
            '<option value="">General / sin especialidad</option>' + opciones;
    } catch (err) {
        console.error('Error al cargar especialidades:', err);
    }
}

// ─── LEER ──────────────────────────────────────────────────────--
async function cargarDocumentos() {
    try {
        const res  = await fetch(API);
        const data = await res.json();
        todosLosDocumentos = data;
        renderizar();
    } catch (err) {
        console.error('Error al cargar documentos:', err);
    }
}

// ─── FILTROS (tipo, especialidad, búsqueda) ───────────────────────
function filtrarTipo(tipo) {
    tipoFiltroActual = tipo;
    ['todos', 'Receta', 'Indicacion', 'Estudio', 'Otro'].forEach(t => {
        document.getElementById(`f-${t}`).classList.toggle('active', t === tipo);
    });
    renderizar();
}

function aplicarFiltros() {
    renderizar();
}

function obtenerListaFiltrada() {
    const texto         = document.getElementById('buscador').value.trim().toLowerCase();
    const idEspFiltro    = document.getElementById('filtroEspecialidad').value;

    return todosLosDocumentos.filter(d => {
        const coincideTipo = tipoFiltroActual === 'todos' || d.TIPO === tipoFiltroActual;
        const coincideEsp  = !idEspFiltro || String(d.ID_ESPECIALIDAD) === String(idEspFiltro);
        const coincideTexto = !texto ||
            (d.TITULO && d.TITULO.toLowerCase().includes(texto)) ||
            (d.DESCRIPCION && d.DESCRIPCION.toLowerCase().includes(texto));
        return coincideTipo && coincideEsp && coincideTexto;
    });
}

// ─── RENDER DE TARJETAS ────────────────────────────────────────--
function renderizar() {
    const lista     = obtenerListaFiltrada();
    const grilla    = document.getElementById('grilla');
    const vacio     = document.getElementById('empty-state');
    const contador  = document.getElementById('contador');

    contador.innerText = lista.length;

    if (lista.length === 0) {
        grilla.innerHTML = '';
        grilla.classList.add('hidden');
        vacio.classList.remove('hidden');
        return;
    }
    grilla.classList.remove('hidden');
    vacio.classList.add('hidden');

    grilla.innerHTML = lista.map(d => {
        const info       = ICONO_TIPO[d.TIPO] || ICONO_TIPO.Otro;
        const etiqueta   = ETIQUETA_TIPO[d.TIPO] || 'Otro';
        const especialidad = d.NOMBRE_ESPECIALIDAD || 'General';
        const fecha      = d.FECHA_DOCUMENTO || d.FECHA_CARGA || '';

        return `
            <div class="doc-card">
                <div class="flex items-start gap-3">
                    <div class="doc-icono ${info.clase}">
                        <i class="ti ${info.icono}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2">
                            <h4 class="font-semibold text-sm text-gray-700 truncate">${escapeHtml(d.TITULO)}</h4>
                        </div>
                        <span class="badge-tipo ${info.clase} mt-1 inline-block">${etiqueta}</span>
                    </div>
                </div>

                <p class="text-xs text-gray-500 flex items-center gap-1.5">
                    <i class="ti ti-stethoscope text-gray-400"></i> ${escapeHtml(especialidad)}
                </p>
                <p class="text-xs text-gray-500 flex items-center gap-1.5">
                    <i class="ti ti-calendar text-gray-400"></i> ${fecha || '—'}
                </p>
                ${d.DESCRIPCION ? `<p class="text-xs text-gray-500 italic line-clamp-2">${escapeHtml(d.DESCRIPCION)}</p>` : ''}

                <div class="flex items-center justify-between pt-2 border-t border-teal-50 mt-auto">
                    <a href="/uploads/${encodeURIComponent(d.RUTA_ARCHIVO)}" target="_blank"
                       class="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1">
                        <i class="ti ti-eye"></i> Ver / descargar
                    </a>
                    <div class="flex gap-1">
                        <button class="btn-accion" onclick="abrirModalEditar(${d.ID_DOCUMENTO})" title="Editar datos">
                            <i class="ti ti-pencil"></i>
                        </button>
                        <button class="btn-accion eliminar" onclick="eliminarDocumento(${d.ID_DOCUMENTO})" title="Eliminar">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function escapeHtml(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// ─── DROPZONE / SELECCIÓN DE ARCHIVO ──────────────────────────────
function configurarDropzone() {
    const zona = document.getElementById('dropzone');

    zona.addEventListener('dragover', (e) => {
        e.preventDefault();
        zona.classList.add('arrastrando');
    });
    zona.addEventListener('dragleave', () => zona.classList.remove('arrastrando'));
    zona.addEventListener('drop', (e) => {
        e.preventDefault();
        zona.classList.remove('arrastrando');
        if (e.dataTransfer.files.length) {
            document.getElementById('inpArchivo').files = e.dataTransfer.files;
            archivoSeleccionado();
        }
    });
}

function archivoSeleccionado() {
    const input = document.getElementById('inpArchivo');
    if (!input.files.length) return;

    archivoElegido = input.files[0];
    document.getElementById('archivoNombre').textContent = archivoElegido.name;
    document.getElementById('archivoPreview').classList.add('activo');
    document.getElementById('dropzone').classList.add('hidden');
}

function quitarArchivo() {
    archivoElegido = null;
    document.getElementById('inpArchivo').value = '';
    document.getElementById('archivoPreview').classList.remove('activo');
    document.getElementById('dropzone').classList.remove('hidden');
}

// ─── MODAL ────────────────────────────────────────────────────--
function abrirModal() {
    editandoId = null;
    document.getElementById('modalTitulo').textContent = 'Subir documento';
    document.getElementById('grupoArchivo').classList.remove('hidden');
    document.getElementById('btnGuardar').innerHTML = '<i class="ti ti-device-floppy mr-1"></i> Guardar';
    limpiarCampos();
    document.getElementById('modal').style.display = 'flex';
}

async function abrirModalEditar(id) {
    editandoId = id;
    document.getElementById('modalTitulo').textContent = 'Editar documento';
    // al editar no se reemplaza el archivo, solo los datos
    document.getElementById('grupoArchivo').classList.add('hidden');
    document.getElementById('btnGuardar').innerHTML = '<i class="ti ti-device-floppy mr-1"></i> Guardar cambios';

    try {
        const res = await fetch(`${API}/${id}`);
        const d   = await res.json();

        document.getElementById('inpTipo').value         = d.TIPO || 'Otro';
        document.getElementById('inpEspecialidad').value = d.ID_ESPECIALIDAD || '';
        document.getElementById('inpTitulo').value        = d.TITULO || '';
        document.getElementById('inpFecha').value          = d.FECHA_DOCUMENTO || '';
        document.getElementById('inpDescripcion').value    = d.DESCRIPCION || '';
    } catch (err) {
        console.error('Error al cargar el documento:', err);
    }

    document.getElementById('modal').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal').style.display = 'none';
    limpiarCampos();
}

function limpiarCampos() {
    document.getElementById('inpTipo').value          = 'Receta';
    document.getElementById('inpEspecialidad').value  = '';
    document.getElementById('inpTitulo').value          = '';
    document.getElementById('inpFecha').value            = '';
    document.getElementById('inpDescripcion').value      = '';
    document.getElementById('errorMsg').classList.add('hidden');
    quitarArchivo();
    document.getElementById('dropzone').classList.remove('hidden');
}

function mostrarError(mensaje) {
    const el = document.getElementById('errorMsg');
    el.textContent = mensaje;
    el.classList.remove('hidden');
}

// ─── GUARDAR (crear con archivo, o editar solo datos) ─────────────
async function guardarDocumento() {
    const tipo            = document.getElementById('inpTipo').value;
    const id_especialidad  = document.getElementById('inpEspecialidad').value;
    const titulo            = document.getElementById('inpTitulo').value.trim();
    const fecha_documento   = document.getElementById('inpFecha').value;
    const descripcion       = document.getElementById('inpDescripcion').value.trim();

    if (!titulo) {
        mostrarError('El título es obligatorio.');
        return;
    }
    if (!editandoId && !archivoElegido) {
        mostrarError('Tenés que elegir un archivo para subir.');
        return;
    }

    const btn = document.getElementById('btnGuardar');
    btn.disabled = true;

    try {
        let res;
        if (editandoId) {
            // edición de metadatos: JSON normal, no toca el archivo
            res = await fetch(`${API}/${editandoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_especialidad, tipo, titulo, descripcion, fecha_documento })
            });
        } else {
            // creación: multipart/form-data porque incluye el archivo
            const formData = new FormData();
            formData.append('archivo', archivoElegido);
            formData.append('tipo', tipo);
            formData.append('id_especialidad', id_especialidad);
            formData.append('titulo', titulo);
            formData.append('descripcion', descripcion);
            formData.append('fecha_documento', fecha_documento);

            res = await fetch(API, { method: 'POST', body: formData });
        }

        if (!res.ok) {
            const err = await res.json();
            mostrarError(err.error || 'No se pudo guardar el documento.');
            return;
        }

        cerrarModal();
        cargarDocumentos();
    } catch (err) {
        console.error('Error al guardar:', err);
        mostrarError('No se pudo guardar. Revisá la consola.');
    } finally {
        btn.disabled = false;
    }
}

// ─── ELIMINAR ──────────────────────────────────────────────────--
async function eliminarDocumento(id) {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
    try {
        const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            alert('Error: ' + err.error);
            return;
        }
        cargarDocumentos();
    } catch (err) {
        console.error('Error al eliminar:', err);
    }
}
