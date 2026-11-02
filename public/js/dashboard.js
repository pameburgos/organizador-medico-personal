// public/js/dashboard.js
// Código del NAVEGADOR — llama a la API con fetch()

const API = '/dashboard';

document.addEventListener('DOMContentLoaded', cargarDashboard);

async function cargarDashboard() {
    try {
        const res = await fetch('/dashboard');

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(
                errorData.error || `Error HTTP ${res.status}`
            );
        }

        const data = await res.json();
        console.log('Datos recibidos del dashboard:', data);

        asignarTexto('cantEspecialidades', data.especialidades ?? data.ESPECIALIDADES ?? 0);
        asignarTexto('cantConsultas', data.consultas ?? data.CONSULTAS ?? 0);
        asignarTexto('cantDocumentos', data.documentos ?? data.DOCUMENTOS ?? 0);
        asignarTexto('cantMedicamentos', data.medicamentos ?? data.MEDICAMENTOS ?? 0);
        asignarTexto('cantAlertas', data.alertas ?? data.ALERTAS ?? 0);

        asignarTexto('cantOtros', data.otros ?? 0);

        renderizarLista(
            'listaProximas',
            data.lista_proximas || [],
            c =>
                `${c.ESPECIALIDAD || c.especialidad}${c.NOMBRE_DOCTOR ? ' · ' + c.NOMBRE_DOCTOR : ''} — ${c.FECHA_DISPLAY || c.fecha_display} ${c.HORA || c.hora}`
        );

        renderizarLista(
            'listaProximasAlertas',
            data.proximas_alertas || [],
            a => {
                let tituloAlerta = '';

                if (a.NOMBRE_MED || a.nombre_med) {
                    tituloAlerta = `Medicamento: ${a.NOMBRE_MED || a.nombre_med}`;
                } else if (a.NOMBRE_ESP || a.nombre_esp) {
                    tituloAlerta = `Cita de ${a.NOMBRE_ESP || a.nombre_esp}`;
                } else {
                    tituloAlerta = a.DESCRIPCION || a.descripcion || a.TIPO || a.tipo || 'Alerta';
                }

                return `${tituloAlerta} — Próximo aviso: ${a.FECHA_DISPLAY || a.fecha_display || 'Programado'}`;
            }
        );

    } catch (error) {
        console.error('Error cargando el dashboard:', error);
    }
}

function asignarTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = valor ?? 0;
    } else {
        console.warn(`No se encontró el elemento HTML con el ID: ${id}`);
    }
}

function renderizarLista(id, items, formatear) {
    const lista = document.getElementById(id);
    if (!lista) return;

    lista.innerHTML = '';

    if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.className = 'text-gray-400 text-xs py-2';
        li.textContent = 'No hay registros próximos.';
        lista.appendChild(li);
        return;
    }

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'border-b border-pink-100 pb-2 last:border-b-0 text-xs text-gray-700';
        li.textContent = formatear(item);
        lista.appendChild(li);
    });
}