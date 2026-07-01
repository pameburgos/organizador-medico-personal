let especialidades = [];
let editandoId = null; //guarda el id cuando se esta editando

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
    'neumologia':        { bg: '#E1EDF7', border: '#BAD6EE', titulo: '#1F5380' }, // Azul clarito
    'neumología':        { bg: '#E1EDF7', border: '#BAD6EE', titulo: '#1F5380' },

    'dermatologia':      { bg: '#f9d7edcd', border: '#F7C6C1', titulo: '#A82A20' }, // Rojo clarito
    'dermatología':      { bg: '#f9d7edcd', border: '#F7C6C1', titulo: '#A82A20' },

    'neurologia':        { bg: '#ECE4F7', border: '#D7C4F0', titulo: '#5B3294' }, // Lila clarito
    'neurología':        { bg: '#ECE4F7', border: '#D7C4F0', titulo: '#5B3294' },

    'gastroenterologia': { bg: '#E2F3E8', border: '#C2E7CE', titulo: '#1E5E3A' }, // Verde clarito
    'gastroenterología': { bg: '#E2F3E8', border: '#C2E7CE', titulo: '#1E5E3A' },

    'cardiologia':       { bg: '#FCE8E6', border: '#F7C6C1', titulo: '#A82A20' }, // Verde menta
    'cardiología':       { bg: '#FCE8E6', border: '#F7C6C1', titulo: '#A82A20' },

    'oftalmologia':      { bg: '#fdecd8ca', border: '#F9E79F', titulo: '#B7950B' }, // Amarillo-Ocre
    'oftalmología':      { bg: '#fdecd8ca', border: '#F9E79F', titulo: '#B7950B' }
};

// Paleta de respaldo por si añaden una especialidad nueva que no esté listada arriba
const coloresRespaldo = [
  { bg: '#FCECDD', border: '#FAD1AB', titulo: '#A35200' }, // Durazno clarito
  { bg: '#FCE4EC', border: '#F8BBD0', titulo: '#880E4F' }  // Rosa
];

// Asigna siempre el mismo color al mismo nombre mediante mapeo directo
function obtenerColorTarjeta(nombre) {
    if (!nombre) return coloresRespaldo[0];
    
    const nombreClave = nombre.trim().toLowerCase();
    
    // Si la especialidad está en nuestro diccionario, retorna su color fijo
    if (mapaColores[nombreClave]) {
        return mapaColores[nombreClave];
    }
    
    // Si es una especialidad nueva de la BD, usa un algoritmo matemático de respaldo
    let hash = 0;
    for (let i = 0; i < nombreClave.length; i++) {
        hash = nombreClave.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % coloresRespaldo.length;
    return coloresRespaldo[index];
}

//dibujar tarjetas automaticas
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
        // Colores de estado
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
            <div style="background-color: ${color.bg}; border-color: ${color.border};" class="p-5 rounded-xl border-2 shadow-sm flex flex-col justify-between gap-4">
                <div>
                    <div class="flex justify-between items-start">
                        <h4 class="font-semibold text-base" style="color: ${color.titulo};">${esp.NOMBRE}</h4>
                        <span class="px-2 py-0.5 text-[10px] font-medium rounded-full border ${colorEstado}">${textoEstado}</span>
                    </div>
                    <p class="text-sm text-gray-600 mt-2 flex items-center gap-1.5">
                        <i class="ti ti-user-doctor" style="color: ${color.titulo}; opacity: 0.6;"></i> Dr/a: ${esp.NOMBRE_DOCTOR}
                    </p>
                    <p class="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <i class="ti ti-building-hospital" style="color: ${color.titulo}; opacity: 0.5;"></i> Centro: ${esp.CENTRO_MEDICO || 'No especificado'}
                    </p>
                    ${esp.TELEFONO_DOCTOR ? `
                    <p class="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <i class="ti ti-phone text-gray-400"></i> Tel: ${esp.TELEFONO_DOCTOR}
                    </p>` : ''}
                    ${esp.NOTAS ? `<p class="text-xs text-gray-500 mt-3 italic p-2 rounded border-l-2" style="background-color: rgba(255,255,255,0.5); border-color: ${color.border};">${esp.NOTAS}</p>` : ''}
                </div>
                
                <div class="flex justify-end gap-2 pt-3 border-t" style="border-color: ${color.border};">
                    <button onclick="prepararEditar(${JSON.stringify(esp).replace(/"/g, '&quot;')})" class="text-gray-400 hover:text-purple-600 text-xs flex items-center gap-1 p-1">
                        <i class="ti ti-edit"></i> Editar
                    </button>
                    <button onclick="archivarEspecialidad(${esp.ID_ESPECIALIDAD})" class="text-gray-400 hover:text-red-500 text-xs flex items-center gap-1 p-1">
                        <i class="ti ti-archive"></i> Archivar
                    </button>
                </div>
            </div>
        `;
    });
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

//control del modal
function abrirModal(){
    editandoId = null;
    document.getElementById('modal-titulo').innerText = "Nueva especialidad";
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('error-msg').classList.add('hidden');
    
    // Limpiar campos
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

    // Cargar los datos actuales en los campos correspondientes
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

//guardar (soporta post y put)
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

        // Si estamos editando, cambiamos la URL y el método HTTP
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

//archivar tratamiento (borrar para el usuario)
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


