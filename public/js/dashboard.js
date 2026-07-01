// public/js/dashboard.js
// Código del NAVEGADOR — llama a la API con fetch()

const API = '/dashboard';

document.addEventListener('DOMContentLoaded', cargarDashboard);

async function cargarDashboard() {
    try {
        const res  = await fetch(API);
        const data = await res.json();

        document.getElementById('cantEspecialidades').textContent = data.especialidades ?? 0;
        document.getElementById('cantConsultas').textContent      = data.consultas      ?? 0;
        document.getElementById('cantMedicamentos').textContent   = data.medicamentos   ?? 0;
        document.getElementById('cantAlertas').textContent        = data.alertas        ?? 0;
        document.getElementById('cantDocumentos').textContent     = data.documentos     ?? 0;

        renderizarLista('listaProximas', data.lista_proximas, c =>
            `${c.ESPECIALIDAD}${c.NOMBRE_DOCTOR ? ' · ' + c.NOMBRE_DOCTOR : ''} — ${c.FECHA_DISPLAY} ${c.HORA}`
        );

        renderizarLista('listaAlertas', data.lista_alertas, a =>
            `${a.NOMBRE_MED || a.DESCRIPCION || a.TIPO} — ${a.FECHA_DISPLAY}`
        );
    } catch (err) {
        console.error('Error al cargar el dashboard:', err);
    }
}

function renderizarLista(idLista, items, formatear) {
    const ul = document.getElementById(idLista);
    if (!ul) return;

    if (!items || items.length === 0) {
        ul.innerHTML = '<li class="text-gray-400">Sin datos por ahora.</li>';
        return;
    }
    ul.innerHTML = items.map(item => `<li>${formatear(item)}</li>`).join('');
}
