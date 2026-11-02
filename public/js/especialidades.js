let especialidades = [];
let editandoId = null; //guarda el id cuando se esta editando
let historialActual = null; //guarda los datos del historial cargado

document.addEventListener('DOMContentLoaded', () => {
    obtenerEspecialidades();
});

//leer datos desde el backend
async function obtenerEspecialidades(){
    try{
        const respuesta = await fetch('/especialidades');
        especialidades = await respuesta.json();
        renderizarTarjetas(especialidades);
    }catch(error){
        console.error('Error al cargar especialidades: ', error);
    }
}

// Diccionario estricto para asociar cada especialidad a su color exacto
const mapaColores = {
    'neumologia':        { bg: '#E1EDF7', border: '#BAD6EE', titulo: '#1F5380' },
    'neumología':        { bg: '#E1EDF7', border: '#BAD6EE', titulo: '#1F5380' },

    'dermatologia':      { bg: '#f9d7edcd', border: '#F7C6C1', titulo: '#A82A20' },
    'dermatología':      { bg: '#f9d7edcd', border: '#F7C6C1', titulo: '#A82A20' },

    'neurologia':        { bg: '#ECE4F7', border: '#D7C4F0', titulo: '#5B3294' },
    'neurología':        { bg: '#ECE4F7', border: '#D7C4F0', titulo: '#5B3294' },

    'gastroenterologia': { bg: '#E2F3E8', border: '#C2E7CE', titulo: '#1E5E3A' },
    'gastroenterología': { bg: '#E2F3E8', border: '#C2E7CE', titulo: '#1E5E3A' },

    'cardiologia':       { bg: '#FCE8E6', border: '#F7C6C1', titulo: '#A82A20' },
    'cardiología':       { bg: '#FCE8E6', border: '#F7C6C1', titulo: '#A82A20' },

    'traumatologia':     { bg: '#fdecd8ca', border: '#FAD1AB', titulo: '#A35200' },
    'traumatología':     { bg: '#fdecd8ca', border: '#FAD1AB', titulo: '#A35200' },

    'oftalmologia':      { bg: '#fdecd8ca', border: '#F9E79F', titulo: '#B7950B' },
    'oftalmología':      { bg: '#fdecd8ca', border: '#F9E79F', titulo: '#B7950B' }
};

const coloresRespaldo = [
  { bg: '#FCECDD', border: '#FAD1AB', titulo: '#A35200' },
  { bg: '#FCE4EC', border: '#F8BBD0', titulo: '#880E4F' }
];

function obtenerColorTarjeta(nombre) {
    if (!nombre) return coloresRespaldo[0];
    const nombreClave = nombre.trim().toLowerCase();
    if (mapaColores[nombreClave]) {
        return mapaColores[nombreClave];
    }
    let hash = 0;
    for (let i = 0; i < nombreClave.length; i++) {
        hash = nombreClave.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % coloresRespaldo.length;
    return coloresRespaldo[index];
}

//dibujar tarjetas interactivas (Clic para ver historial médico)
function renderizarTarjetas(lista){
    const grilla = document.getElementById('grilla');
    const emptyState = document.getElementById('empty-state');
    const contador = document.getElementById('contador');

    contador.innerText = lista.length;
    grilla.innerHTML = '';

    if (lista.length === 0){
        grilla.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    grilla.classList.remove('hidden');
    emptyState.classList.add('hidden');

    lista.forEach(esp => {
        let colorEstado = "bg-green-50 text-green-700 border-green-200";
        let textoEstado = "Activa";
        
        if (esp.ESTADO === "pendiente") {
            colorEstado = "bg-amber-50 text-amber-700 border-amber-200";
            textoEstado = "Pendiente turno";
        } else if (esp.ESTADO === "inactiva") {
            colorEstado = "bg-gray-50 text-gray-600 border-gray-200";
            textoEstado = "Inactiva";
        }

        const color = obtenerColorTarjeta(esp.NOMBRE);

        grilla.innerHTML += `
            <div style="background-color: ${color.bg}; border-color: ${color.border};" 
                 onclick="abrirHistorialEspecialidad(${esp.ID_ESPECIALIDAD})"
                 class="p-5 rounded-2xl border-2 shadow-sm flex flex-col justify-between gap-4 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all group">
                <div>
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-base group-hover:underline" style="color: ${color.titulo};">${esp.NOMBRE}</h4>
                        <span class="px-2 py-0.5 text-[10px] font-medium rounded-full border ${colorEstado}">${textoEstado}</span>
                    </div>
                    <p class="text-sm text-gray-700 font-medium mt-2 flex items-center gap-1.5">
                        <i class="ti ti-user-doctor" style="color: ${color.titulo};"></i> Dr/a: ${esp.NOMBRE_DOCTOR}
                    </p>
                    <p class="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
                        <i class="ti ti-building-hospital" style="color: ${color.titulo}; opacity: 0.7;"></i> Centro: ${esp.CENTRO_MEDICO || 'No especificado'}
                    </p>
                    ${esp.TELEFONO_DOCTOR ? `
                    <p class="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <i class="ti ti-phone text-gray-400"></i> Tel: ${esp.TELEFONO_DOCTOR}
                    </p>` : ''}
                    ${esp.NOTAS ? `<p class="text-xs text-gray-600 mt-2.5 italic p-2 rounded border-l-2 bg-white/60" style="border-color: ${color.border};">${esp.NOTAS}</p>` : ''}
                    
                    <div class="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-pink-700 bg-white/80 px-2.5 py-1 rounded-lg border border-pink-200/80">
                        <i class="ti ti-folder-medical text-sm"></i> Ver historial médico completo
                    </div>
                </div>
                
                <div class="flex justify-end gap-2 pt-3 border-t" style="border-color: ${color.border};" onclick="event.stopPropagation()">
                    <button onclick="event.stopPropagation(); prepararEditar(${JSON.stringify(esp).replace(/"/g, '&quot;')})" class="text-gray-500 hover:text-purple-700 text-xs flex items-center gap-1 p-1 font-medium">
                        <i class="ti ti-edit"></i> Editar
                    </button>
                    <button onclick="event.stopPropagation(); archivarEspecialidad(${esp.ID_ESPECIALIDAD})" class="text-gray-500 hover:text-red-600 text-xs flex items-center gap-1 p-1 font-medium">
                        <i class="ti ti-archive"></i> Archivar
                    </button>
                </div>
            </div>
        `;
    });
}

// =========================================================================
// REQUERIMIENTO: VER HISTORIAL MÉDICO ORDENADO Y CLASIFICADO POR ESPECIALIDAD
// =========================================================================
async function abrirHistorialEspecialidad(id) {
    const modal = document.getElementById('modal-historial-overlay');
    if (!modal) return;

    modal.style.display = 'flex';

    // Estados de carga inicial
    document.getElementById('historial-especialidad').textContent = 'Cargando historial médico...';
    document.getElementById('historial-doctor').textContent = 'Por favor esperá...';
    document.getElementById('listaHistorialConsultas').innerHTML = '<li class="text-gray-400 text-center py-6">Consultando citas...</li>';
    document.getElementById('listaHistorialDocumentos').innerHTML = '<li class="text-gray-400 text-center py-6">Consultando estudios...</li>';
    document.getElementById('listaHistorialMedicamentos').innerHTML = '<li class="text-gray-400 text-center py-6">Consultando recetas...</li>';

    try {
        const res = await fetch(`/especialidades/${id}/historial`);
        if (!res.ok) throw new Error('No se pudo obtener el historial');
        const data = await res.json();
        historialActual = data;

        // Renderizar Encabezado
        const esp = data.especialidad;
        document.getElementById('historial-especialidad').textContent = esp.NOMBRE;
        document.getElementById('historial-doctor').textContent = `Dr/a: ${esp.NOMBRE_DOCTOR || 'Especialista'}`;
        document.getElementById('historial-centro').innerHTML = `<i class="ti ti-building-hospital text-pink-500"></i> ${esp.CENTRO_MEDICO || 'Centro no especificado'}`;
        document.getElementById('historial-tel').innerHTML = `<i class="ti ti-phone text-pink-500"></i> ${esp.TELEFONO_DOCTOR || 'Sin teléfono'}`;

        // Contadores en pestañas
        document.getElementById('countHistConsultas').textContent = data.consultas ? data.consultas.length : 0;
        document.getElementById('countHistDocumentos').textContent = data.documentos ? data.documentos.length : 0;
        document.getElementById('countHistMedicamentos').textContent = data.medicamentos ? data.medicamentos.length : 0;

        // Renderizar Secciones Clasificadas
        renderHistorialConsultas(data.consultas || []);
        renderHistorialDocumentos(data.documentos || []);
        renderHistorialMedicamentos(data.medicamentos || []);

        cambiarTabHistorial('consultas');

    } catch (e) {
        console.error(e);
        document.getElementById('listaHistorialConsultas').innerHTML = `<li class="text-red-500 text-center py-4">Error al cargar: ${e.message}</li>`;
    }
}

function cambiarTabHistorial(tab) {
    const tabs = ['consultas', 'documentos', 'medicamentos'];
    tabs.forEach(t => {
        const seccion = document.getElementById(`tabHistorial${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const esActivo = t === tab;

        if (seccion) seccion.classList.toggle('hidden', !esActivo);
        if (btn) {
            btn.classList.toggle('border-pink-600', esActivo);
            btn.classList.toggle('text-pink-800', esActivo);
            btn.classList.toggle('text-gray-500', !esActivo);
            btn.classList.toggle('border-transparent', !esActivo);
        }
    });
}

function renderHistorialConsultas(lista) {
    const ul = document.getElementById('listaHistorialConsultas');
    if (lista.length === 0) {
        ul.innerHTML = '<li class="text-gray-400 text-center py-6">No hay consultas registradas con este especialista.</li>';
        return;
    }

    ul.innerHTML = lista.map(c => {
        const esRealizada = c.ESTADO === 'Realizada' || new Date(`${c.FECHA}T${c.HORA}:00`) < new Date();
        const badgeColor = esRealizada ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800';
        const badgeTexto = esRealizada ? 'Realizada' : 'Próxima';

        return `
            <li class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 space-y-1.5">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-gray-800 flex items-center gap-1.5">
                        <i class="ti ti-calendar text-pink-600"></i> ${c.FECHA} a las ${c.HORA}
                    </span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeColor}">
                        ${badgeTexto}
                    </span>
                </div>
                <p class="text-gray-600"><strong class="text-gray-700">Motivo:</strong> ${c.MOTIVO || 'Control de rutina'}</p>
                ${c.LUGAR ? `<p class="text-gray-500 text-[11px]"><i class="ti ti-map-pin"></i> ${c.LUGAR}</p>` : ''}
                ${c.NOTAS_POST ? `
                <div class="p-2 mt-1 rounded bg-white border border-gray-200 text-[11px] text-gray-700 italic">
                    <strong>Indicaciones del doctor:</strong> ${c.NOTAS_POST}
                </div>` : ''}
            </li>
        `;
    }).join('');
}

function renderHistorialDocumentos(lista) {
    const ul = document.getElementById('listaHistorialDocumentos');
    if (lista.length === 0) {
        ul.innerHTML = '<li class="text-gray-400 text-center py-6">No hay estudios ni recetas archivadas para esta especialidad.</li>';
        return;
    }

    ul.innerHTML = lista.map(d => `
        <li class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 flex items-start justify-between gap-3">
            <div class="space-y-1">
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 uppercase">
                        ${d.TIPO}
                    </span>
                    <h5 class="font-bold text-gray-800">${d.TITULO}</h5>
                </div>
                ${d.DESCRIPCION ? `<p class="text-gray-600">${d.DESCRIPCION}</p>` : ''}
                <span class="text-[11px] text-gray-400 block font-mono">Fecha del estudio: ${d.FECHA_DOCUMENTO || '—'}</span>
            </div>
            ${d.RUTA_ARCHIVO ? `
            <a href="/uploads/${d.RUTA_ARCHIVO}" target="_blank" class="px-3 py-1.5 rounded-lg bg-pink-100 hover:bg-pink-200 text-pink-800 font-semibold text-xs shrink-0 flex items-center gap-1 transition">
                <i class="ti ti-download"></i> Ver Archivo
            </a>` : ''}
        </li>
    `).join('');
}

function renderHistorialMedicamentos(lista) {
    const ul = document.getElementById('listaHistorialMedicamentos');
    if (lista.length === 0) {
        ul.innerHTML = '<li class="text-gray-400 text-center py-6">No hay medicamentos vinculados a este tratamiento.</li>';
        return;
    }

    ul.innerHTML = lista.map(m => `
        <li class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 space-y-1.5">
            <div class="flex items-center justify-between">
                <span class="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    <i class="ti ti-pill text-purple-600"></i> ${m.NOMBRE}
                </span>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${m.ACTIVO ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}">
                    ${m.ACTIVO ? 'En curso' : 'Finalizado'}
                </span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                <span><strong>Dosis:</strong> ${m.DOSIS || 'Según indicación'}</span>
                <span><strong>Frecuencia:</strong> ${m.FRECUENCIA || '—'}</span>
                <span><strong>Vía:</strong> ${m.VIA || 'Oral'}</span>
                <span><strong>Indicación:</strong> ${m.INDICACION || 'Tratamiento'}</span>
            </div>
            ${m.NOTAS ? `<p class="p-1.5 bg-white rounded border border-gray-200 text-[11px] text-gray-600 italic">${m.NOTAS}</p>` : ''}
        </li>
    `).join('');
}

function cerrarHistorialModal() {
    const modal = document.getElementById('modal-historial-overlay');
    if (modal) modal.style.display = 'none';
}

function cerrarHistorialFuera(e) {
    if (e.target.id === 'modal-historial-overlay') {
        cerrarHistorialModal();
    }
}

//buscador en tiempo real
function filtrar() {
    const buscar = document.getElementById('buscador').value.toLowerCase();
    const filtrados = especialidades.filter(esp => 
        esp.NOMBRE.toLowerCase().includes(buscar) || 
        esp.NOMBRE_DOCTOR.toLowerCase().includes(buscar) ||
        (esp.CENTRO_MEDICO && esp.CENTRO_MEDICO.toLowerCase().includes(buscar))
    );
    renderizarTarjetas(filtrados);
}

//control del modal nueva especialidad
function abrirModal(){
    editandoId = null;
    document.getElementById('modal-titulo').innerText = "Nueva especialidad";
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('error-msg').classList.add('hidden');
    
    document.getElementById('campo-especialidad').value = '';
    document.getElementById('campo-medico').value = '';
    document.getElementById('campo-centro').value = '';
    document.getElementById('campo-tel').value = '';
    document.getElementById('campo-estado').value = 'activa';
    document.getElementById('campo-notas').value = '';
}

function prepararEditar(esp) {
    editandoId = esp.ID_ESPECIALIDAD;
    document.getElementById('modal-titulo').innerText = "Editar especialidad";
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('error-msg').classList.add('hidden');

    document.getElementById('campo-especialidad').value = esp.NOMBRE || '';
    document.getElementById('campo-medico').value = esp.NOMBRE_DOCTOR || '';
    document.getElementById('campo-centro').value = esp.CENTRO_MEDICO || '';
    document.getElementById('campo-tel').value = esp.TELEFONO_DOCTOR || '';
    document.getElementById('campo-estado').value = esp.ESTADO || 'activa';
    document.getElementById('campo-notas').value = esp.NOTAS || '';
}

function cerrarModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function cerrarModalFuera(e) {
    if (e.target.id === 'modal-overlay') cerrarModal();
}

async function guardar() {
    const nombre = document.getElementById('campo-especialidad').value.trim();
    const nombre_doctor = document.getElementById('campo-medico').value.trim();
    const centro_medico = document.getElementById('campo-centro').value.trim();
    const telefono_doctor = document.getElementById('campo-tel').value.trim();
    const estado = document.getElementById('campo-estado').value;
    const notas = document.getElementById('campo-notas').value.trim();

    if (!nombre || !nombre_doctor) {
        document.getElementById('error-msg').classList.remove('hidden');
        return;
    }

    const payload = { nombre, nombre_doctor, telefono_doctor, centro_medico, estado, notas };

    try {
        let url = '/especialidades';
        let metodo = 'POST';

        if (editandoId) {
            url = `/especialidades/${editandoId}`;
            metodo = 'PUT';
        }

        const respuesta = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (respuesta.ok) {
            cerrarModal();
            obtenerEspecialidades();
        }
    } catch (error) {
        console.error('Error al guardar:', error);
    }
}

async function archivarEspecialidad(id) {
    if (!confirm('¿Segura que deseas archivar este tratamiento?')) return;
    try {
        const respuesta = await fetch(`/especialidades/${id}`, { method: 'DELETE' });
        if (respuesta.ok) {
            obtenerEspecialidades();
        }
    } catch (error) {
        console.error('Error al archivar:', error);
    }
}
