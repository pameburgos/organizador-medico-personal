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

        asignarTexto('cantEspecialidades', data.especialidades);
        asignarTexto('cantConsultas', data.consultas);
        asignarTexto('cantDocumentos', data.documentos);
        asignarTexto('cantMedicamentos', data.medicamentos);
        asignarTexto('cantAlertas', data.alertas);

        // Solo si posteriormente creamos la tabla/sección "otros"
        asignarTexto('cantOtros', data.otros);

        renderizarLista(
            'listaProximas',
            data.lista_proximas,
            c =>
                `${c.ESPECIALIDAD}${c.NOMBRE_DOCTOR ? ' · ' + c.NOMBRE_DOCTOR : ''} — ${c.FECHA_DISPLAY} ${c.HORA}`
        );

        renderizarLista(
            'listaProximasAlertas',
            data.proximas_alertas,
            a => {
                let tituloAlerta = '';

                if (a.NOMBRE_MED) {
                    tituloAlerta = `Medicamento: ${a.NOMBRE_MED}`;
                } else if (a.NOMBRE_ESP) {
                    tituloAlerta = `Cita de ${a.NOMBRE_ESP}`;
                } else {
                    tituloAlerta = a.DESCRIPCION || a.TIPO;
                }

                return `${tituloAlerta} — Próximo envío: ${a.FECHA_DISPLAY}`;
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