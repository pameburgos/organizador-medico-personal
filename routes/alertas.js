const express = require('express');
const router = express.Router();
const getConnection = require('../db');
const oracledb = require('oracledb');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const path = require('path');

// Cargar variables de entorno soportando tanto .env como alerta.env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../alerta.env') });

let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

// Cola en memoria de notificaciones push para navegadores clientes
const notificacionesPushCola = [];

async function enviarEmail(destinatario, asunto, cuerpo) {
    if (!transporter) {
        console.warn('[Alertas] Nodemailer no configurado (EMAIL_USER / EMAIL_PASS faltante).');
        return;
    }
    await transporter.sendMail({
        from: `"Organizador Médico" <${process.env.EMAIL_USER}>`,
        to: destinatario,
        subject: asunto,
        html: cuerpo
    });
}

async function registrarHistorial(conn, id_alerta, descripcion, exitoso) {
    try {
        await conn.execute(
            `INSERT INTO historial_alertas (id_alerta, descripcion, exitoso, fecha_envio)
             VALUES (:id_alerta, :descripcion, :exitoso, SYSTIMESTAMP)`,
            { id_alerta, descripcion, exitoso: exitoso ? 1 : 0 },
            { autoCommit: true }
        );
    } catch (e) {
        console.error('[Alertas] Error al registrar historial:', e.message);
    }
}

// =========================================================================
// CRON: Ejecutar cada 5 minutos
// =========================================================================
cron.schedule('*/5 * * * *', async () => {
    console.log('[Alertas] Cron revisando alertas pendientes...');
    let conn;
    try {
        conn = await getConnection();

        // 1. Alertas de Medicación pendientes (con protección anti-duplicados y enfriamiento mínimo)
        const resMed = await conn.execute(
            `SELECT a.id_alerta, a.destinatario, a.descripcion, a.nombre_med,
                    NVL(a.frecuencia_hs, 8)     AS frecuencia_hs, 
                    a.proximo_envio, a.canal,
                    NVL(a.envios_realizados, 0) AS envios_realizados,
                    NVL(a.total_envios, 0)      AS total_envios,
                    a.fecha_fin
             FROM alertas a
             WHERE LOWER(a.tipo) IN ('medicacion', 'medicamento')
               AND a.activa = 1
               AND a.proximo_envio <= SYSTIMESTAMP
               AND NOT EXISTS (
                   SELECT 1 FROM historial_alertas h
                   WHERE h.id_alerta = a.id_alerta
                     AND h.fecha_envio > SYSTIMESTAMP - INTERVAL '1' HOUR
               )`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        for (const a of resMed.rows) {
            try {
                const nombre = a.NOMBRE_MED || a.DESCRIPCION || 'tu medicamento';
                const canal = (a.CANAL || 'email').toLowerCase();
                const frec = Math.max(1, Number(a.FRECUENCIA_HS) || 8);

                if (canal === 'email' || canal === 'ambos') {
                    await enviarEmail(
                        a.DESTINATARIO,
                        `💊 Recordatorio: ${nombre}`,
                        `<div style="font-family:sans-serif;padding:16px;background:#FAF6FD;border-radius:12px">
                            <h2 style="color:#7c3aed;margin-top:0">Recordatorio de medicación</h2>
                            <p style="font-size:16px">Es hora de tomar: <strong>${nombre}</strong>.</p>
                            <p style="color:#4b5563;font-size:13px">Frecuencia indicada: cada ${frec} horas.</p>
                            <p style="color:#6b7280;font-size:12px;margin-top:20px">
                                Organizador Médico Personal de Pamela Burgos
                            </p>
                        </div>`
                    );
                }

                if (canal === 'push' || canal === 'ambos') {
                    notificacionesPushCola.push({
                        id_alerta: a.ID_ALERTA,
                        tipo: 'medicacion',
                        titulo: `💊 Hora de tomar: ${nombre}`,
                        mensaje: a.DESCRIPCION || `Recordatorio programado cada ${frec} horas.`,
                        timestamp: Date.now()
                    });
                }

                const nuevosEnvios = Number(a.ENVIOS_REALIZADOS) + 1;
                const finTratamiento = (a.TOTAL_ENVIOS > 0 && nuevosEnvios >= Number(a.TOTAL_ENVIOS));

                if (finTratamiento) {
                    await conn.execute(
                        `UPDATE alertas 
                         SET activa = 0, 
                             envios_realizados = :envios,
                             proximo_envio = SYSTIMESTAMP + NUMTODSINTERVAL(:frec, 'HOUR')
                         WHERE id_alerta = :id`,
                        { envios: nuevosEnvios, frec, id: a.ID_ALERTA },
                        { autoCommit: true }
                    );
                    await registrarHistorial(conn, a.ID_ALERTA,
                        `Tratamiento completado para ${nombre} (${nuevosEnvios} tomas realizadas)`, true);
                } else {
                    // Actualización garantizada con reloj atómico de Oracle (+ frec horas en el futuro)
                    await conn.execute(
                        `UPDATE alertas 
                         SET proximo_envio = SYSTIMESTAMP + NUMTODSINTERVAL(:frec, 'HOUR'),
                             envios_realizados = :envios 
                         WHERE id_alerta = :id`,
                        { frec, envios: nuevosEnvios, id: a.ID_ALERTA },
                        { autoCommit: true }
                    );
                    await registrarHistorial(conn, a.ID_ALERTA,
                        `Recordatorio medicación enviado (${canal}): ${nombre} (próxima toma en ${frec} hs)`, true);
                }

            } catch (errMed) {
                console.error(`[Alertas] Error en alerta medicación ${a.ID_ALERTA}:`, errMed);
                await registrarHistorial(conn, a.ID_ALERTA, `Error al enviar: ${errMed.message}`, false);
            }
        }

        // 2. Alertas de Consulta pendientes
        const resConsulta = await conn.execute(
            `SELECT a.id_alerta, a.destinatario, a.descripcion, a.canal,
                    a.id_consulta AS id_consulta_real,
                    c.fecha_hora, c.lugar, e.nombre AS especialidad, e.nombre_doctor,
                    c.motivo
             FROM alertas a
             JOIN consultas c ON c.id_consulta = a.id_consulta
             JOIN especialidades e ON e.id_especialidad = c.id_especialidad
             WHERE LOWER(a.tipo) = 'consulta'
               AND a.activa = 1
               AND c.estado = 'Programada'
               AND a.proximo_envio <= SYSTIMESTAMP`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        for (const a of resConsulta.rows) {
            try {
                const canal = (a.CANAL || 'email').toLowerCase();
                const fechaTurno = new Date(a.FECHA_HORA);
                const fechaStr = fechaTurno.toLocaleDateString('es-PY', {
                    weekday: 'long', day: 'numeric', month: 'long'
                });
                const horaStr = fechaTurno.toLocaleTimeString('es-PY', {
                    hour: '2-digit', minute: '2-digit'
                });

                if (canal === 'email' || canal === 'ambos') {
                    await enviarEmail(
                        a.DESTINATARIO,
                        `📅 Recordatorio de Turno: ${a.ESPECIALIDAD}`,
                        `<div style="font-family:sans-serif;padding:16px;background:#FDF2F8;border-radius:12px">
                            <h2 style="color:#db2777;margin-top:0">Recordatorio de Consulta Médica</h2>
                            <p>Tenés una consulta programada con <strong>${a.ESPECIALIDAD}</strong>.</p>
                            <ul>
                                <li><strong>Doctor/a:</strong> ${a.NOMBRE_DOCTOR || '—'}</li>
                                <li><strong>Fecha y Hora:</strong> ${fechaStr} a las ${horaStr}</li>
                                <li><strong>Lugar:</strong> ${a.LUGAR || 'Consultorio'}</li>
                                ${a.MOTIVO ? `<li><strong>Motivo:</strong> ${a.MOTIVO}</li>` : ''}
                            </ul>
                            <p style="color:#6b7280;font-size:12px;margin-top:20px">
                                Organizador Médico Personal de Pamela Burgos
                            </p>
                        </div>`
                    );
                }

                if (canal === 'push' || canal === 'ambos') {
                    notificacionesPushCola.push({
                        id_alerta: a.ID_ALERTA,
                        tipo: 'consulta',
                        titulo: `📅 Consulta Mañana: ${a.ESPECIALIDAD}`,
                        mensaje: `Turno a las ${horaStr} con ${a.NOMBRE_DOCTOR || 'Especialista'} en ${a.LUGAR || 'Consultorio'}.`,
                        timestamp: Date.now()
                    });
                }

                await conn.execute(
                    `UPDATE alertas SET activa = 0, envios_realizados = 1 WHERE id_alerta = :id`,
                    { id: a.ID_ALERTA },
                    { autoCommit: true }
                );

                await registrarHistorial(conn, a.ID_ALERTA,
                    `Recordatorio consulta ${a.ESPECIALIDAD} enviado (${canal}) a ${a.DESTINATARIO}`, true);

            } catch (errCon) {
                console.error(`[Alertas] Error en alerta consulta ${a.ID_ALERTA}:`, errCon);
                await registrarHistorial(conn, a.ID_ALERTA, `Error al enviar: ${errCon.message}`, false);
            }
        }

    } catch (err) {
        console.error('[Alertas] Error en cron:', err.message);
    } finally {
        if (conn) await conn.close();
    }
});

// =========================================================================
// RUTAS API
// =========================================================================
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT a.id_alerta, 
                    LOWER(a.tipo) AS tipo,
                    a.id_consulta,
                    a.nombre_med,
                    a.descripcion, 
                    a.canal, 
                    a.destinatario, 
                    a.frecuencia_hs,
                    TO_CHAR(a.proximo_envio, 'YYYY-MM-DD"T"HH24:MI') AS proximo_envio,
                    TO_CHAR(a.fecha_fin,     'YYYY-MM-DD"T"HH24:MI') AS fecha_fin,
                    a.total_envios,
                    a.envios_realizados,
                    a.activa
             FROM alertas a
             ORDER BY a.fecha_creacion DESC`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

router.get('/pull-push', (req, res) => {
    const pendientes = [...notificacionesPushCola];
    notificacionesPushCola.length = 0;
    res.json(pendientes);
});

router.get('/historial', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT h.id_historial, h.id_alerta, h.descripcion, h.exitoso,
                    TO_CHAR(h.fecha_envio, 'YYYY-MM-DD"T"HH24:MI') AS fecha_envio
             FROM historial_alertas h
             ORDER BY h.fecha_envio DESC
             FETCH FIRST 30 ROWS ONLY`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

router.post('/', async (req, res) => {
    const {
        tipo, ID_CONSULTA,
        nombre_med, descripcion, canal, destinatario,
        frecuencia_hs, proximo_envio, total_envios, fecha_fin
    } = req.body;

    if (!tipo || !destinatario) {
        return res.status(400).json({ error: 'tipo y destinatario son obligatorios' });
    }

    const proximoTs = proximo_envio ? new Date(proximo_envio) : new Date();
    const finTs = fecha_fin ? new Date(fecha_fin) : null;

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `INSERT INTO alertas
             (tipo, id_consulta, nombre_med,
              descripcion, canal, destinatario, frecuencia_hs,
              proximo_envio, total_envios, fecha_fin, envios_realizados, activa)
             VALUES
             (:tipo, :id_consulta, :nombre_med,
              :descripcion, :canal, :destinatario, :frecuencia_hs,
              :proximo_envio, :total_envios, :fecha_fin, 0, 1)
             RETURNING id_alerta INTO :id`,
            {
                tipo: tipo.toLowerCase(),
                id_consulta: ID_CONSULTA ? Number(ID_CONSULTA) : null,
                nombre_med: nombre_med || null,
                descripcion: descripcion || null,
                canal: canal || 'ambos',
                destinatario,
                frecuencia_hs: frecuencia_hs ? Number(frecuencia_hs) : 24,
                proximo_envio: proximoTs,
                total_envios: total_envios ? Number(total_envios) : 0,
                fecha_fin: finTs,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true }
        );
        res.status(201).json({
            id_alerta: result.outBinds.id[0],
            message: 'Alerta creada y programada'
        });
    } catch (err) {
        console.error('[Alertas] Error insertando alerta:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

router.patch('/:id/toggle', async (req, res) => {
    const { activa } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `UPDATE alertas SET activa = :activa WHERE id_alerta = :id`,
            { activa: activa ? 1 : 0, id: Number(req.params.id) },
            { autoCommit: true }
        );
        res.json({ message: 'Alerta actualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(`DELETE FROM historial_alertas WHERE id_alerta = :id`, [Number(req.params.id)], { autoCommit: true });
        await conn.execute(`DELETE FROM alertas WHERE id_alerta = :id`, [Number(req.params.id)], { autoCommit: true });
        res.json({ message: 'Alerta eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;