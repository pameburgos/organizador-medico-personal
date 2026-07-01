const express       = require('express');
const router        = express.Router();
const getConnection = require('../db');
const oracledb      = require('oracledb');
const nodemailer    = require('nodemailer');//libreria para enviar correos desde node.js
const cron          = require('node-cron');//permite programar tareas automaticas

//configuracion del gmail
const transporter = nodemailer.createTransport({//config la conexion segura con los servidores de gmail
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
    }
});

//funcion enviar gmail
async function enviarEmail(destinatario, asunto, cuerpo) {
    await transporter.sendMail({
        from:    `"Organizador Médico" <${process.env.EMAIL_USER}>`,
        to:      destinatario,
        subject: asunto,
        html:    cuerpo
    });
}

//funcion registrar en el historial
async function registrarHistorial(conn, id_alerta, descripcion, exitoso) {
    await conn.execute(
        `INSERT INTO historial_alertas (id_alerta, descripcion, exitoso)
        VALUES (:id_alerta, :descripcion, :exitoso)`,
        { id_alerta, descripcion, exitoso: exitoso ? 1 : 0 },
        { autoCommit: true }
    );
}

// cron: enviar alertas cada hora
// Busca alertas activas cuyo proximo_envio ya llegó y las envía
cron.schedule('0 * * * *', async () => {
    console.log('[Alertas] Revisando alertas pendientes…');
    let conn;
    try {
        conn = await getConnection();

        // alertas de MEDICACION con proximo_envio vencido
        const resMed = await conn.execute(
            `SELECT a.id_alerta, a.destinatario, a.descripcion, a.nombre_med,
                    a.frecuencia_hs, a.proximo_envio
            FROM alertas a
            WHERE a.tipo   = 'medicacion'
                AND a.activa = 1
                AND a.proximo_envio <= SYSTIMESTAMP`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        for (const a of resMed.rows) {
            try {
                const nombre = a.NOMBRE_MED || 'tu medicamento';
                const desc   = a.DESCRIPCION ? `<p>${a.DESCRIPCION}</p>` : '';
                await enviarEmail(
                    a.DESTINATARIO,
                    `💊 Recordatorio: ${nombre}`,
                    `<h2 style="color:#7c3aed">Recordatorio de medicación</h2>
                    <p>Es hora de tomar <strong>${nombre}</strong>.</p>
                    ${desc}
                    <p style="color:#6b7280;font-size:12px">
                    Organizador Médico Personal de Pamela Burgos
                    </p>`
                );

                // calcular próximo envío
                const next = new Date(a.PROXIMO_ENVIO);
                next.setHours(next.getHours() + a.FRECUENCIA_HS);

                await conn.execute(
                    `UPDATE alertas SET proximo_envio = :next WHERE id_alerta = :id`,
                    { next, id: a.ID_ALERTA },
                    { autoCommit: true }
                );

                await registrarHistorial(conn, a.ID_ALERTA,
                    `Email enviado a ${a.DESTINATARIO}: ${nombre}`, true);

            } catch (mailErr) {
                console.error(`[Alertas] Error enviando email alerta ${a.ID_ALERTA}:`, mailErr);
                await registrarHistorial(conn, a.ID_ALERTA,
                    `Error al enviar: ${mailErr.message}`, false);
            }
        }

        // alertas de CONSULTA: buscar consultas que sean mañana
        const resConsulta = await conn.execute(
            `SELECT a.id_alerta, a.destinatario, a.descripcion, a.id_referencia,
                    c.fecha_hora, e.nombre AS especialidad, e.nombre_doctor,
                    c.motivo
            FROM alertas a
            JOIN consultas c    ON c.id_consulta     = a.id_referencia
            JOIN especialidades e ON e.id_especialidad = c.id_especialidad
            WHERE a.tipo     = 'consulta'
                AND a.activa   = 1
                AND c.estado   = 'Programada'
                AND TRUNC(c.fecha_hora) = TRUNC(SYSDATE) + 1`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        for (const a of resConsulta.rows) {
            try {
                const fecha = new Date(a.FECHA_HORA).toLocaleDateString('es-PY', {
                    weekday: 'long', day: 'numeric', month: 'long'
                });
                const hora  = new Date(a.FECHA_HORA).toLocaleTimeString('es-PY', {
                    hour: '2-digit', minute: '2-digit'
                });
                const motivo = a.MOTIVO ? `<p>Motivo: ${a.MOTIVO}</p>` : '';

                await enviarEmail(
                    a.DESTINATARIO,
                    `📅 Recordatorio: consulta mañana con ${a.ESPECIALIDAD}`,
                    `<h2 style="color:#db2777">Recordatorio de consulta</h2>
                    <p>Mañana tenés turno con <strong>${a.ESPECIALIDAD}</strong>.</p>
                    <ul>
                    <li><strong>Doctor/a:</strong> ${a.NOMBRE_DOCTOR || '—'}</li>
                    <li><strong>Fecha:</strong> ${fecha}</li>
                    <li><strong>Hora:</strong> ${hora}</li>
                    </ul>
                    ${motivo}
                    <p style="color:#6b7280;font-size:12px">
                    Organizador Médico Personal de Pamela Burgos
                    </p>`
                );

                await registrarHistorial(conn, a.ID_ALERTA,
                    `Recordatorio consulta ${a.ESPECIALIDAD} enviado a ${a.DESTINATARIO}`, true);

            } catch (mailErr) {
                console.error(`[Alertas] Error email consulta ${a.ID_ALERTA}:`, mailErr);
                await registrarHistorial(conn, a.ID_ALERTA,
                    `Error al enviar: ${mailErr.message}`, false);
            }
        }

        console.log(`[Alertas] Procesadas ${resMed.rows.length} medicación + ${resConsulta.rows.length} consultas`);

    } catch (err) {
        console.error('[Alertas] Error en cron:', err);
    } finally {
        if (conn) await conn.close();
    }
});

//listar alertas: trae todas las alertas creadas
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_alerta, tipo, id_referencia, nombre_med, descripcion,
                    canal, destinatario, frecuencia_hs,
                    TO_CHAR(proximo_envio, 'YYYY-MM-DD"T"HH24:MI') AS proximo_envio,
                    activa
            FROM alertas
            ORDER BY fecha_creacion DESC`,
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

//ver historial de envios
router.get('/historial', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT h.id_historial, h.id_alerta, h.descripcion, h.exitoso,
                    TO_CHAR(h.fecha_envio, 'YYYY-MM-DD"T"HH24:MI') AS fecha_envio
            FROM historial_alertas h
            ORDER BY h.fecha_envio DESC
            FETCH FIRST 20 ROWS ONLY`,
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

//crea una alerta
router.post('/', async (req, res) => {
    const { tipo, id_referencia, nombre_med, descripcion,
            canal, destinatario, frecuencia_hs, proximo_envio } = req.body;
    //validacion inicial
    if (!tipo || !destinatario)
        return res.status(400).json({ error: 'tipo y destinatario son obligatorios' });

    // Para consultas: el proximo_envio lo calculamos en el cron (compara con mañana).
    // Para medicacion: lo recibimos del frontend.
    const proximoTs = proximo_envio ? new Date(proximo_envio) : null;

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `INSERT INTO alertas
            (tipo, id_referencia, nombre_med, descripcion, canal,
                destinatario, frecuencia_hs, proximo_envio)
            VALUES
            (:tipo, :id_referencia, :nombre_med, :descripcion, :canal,
                :destinatario, :frecuencia_hs, :proximo_envio)
            RETURNING id_alerta INTO :id`,
            {
                tipo,
                id_referencia: id_referencia || null,
                nombre_med:    nombre_med    || null,
                descripcion:   descripcion   || null,
                canal:         canal         || 'email',
                destinatario,
                frecuencia_hs: frecuencia_hs || 24,
                proximo_envio: proximoTs,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true }
        );
        res.status(201).json({
            id_alerta: result.outBinds.id[0],
            message: 'Alerta creada'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//activar o desactivar alerta
router.patch('/:id/toggle', async (req, res) => {//path: porque no se va a reemplazar toda la alerta
    const { activa } = req.body;//sino que será una modificacion parcial
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

//eliminar alerta
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `DELETE FROM alertas WHERE id_alerta = :id`,
            [Number(req.params.id)],
            { autoCommit: true }
        );
        res.json({ message: 'Alerta eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

// GET /alertas/test-email — solo para debug
/*router.get('/test-email', async (req, res) => {
    try {
        await enviarEmail(
            process.env.EMAIL_USER,
            '✅ Test de email',
            '<p>El sistema de alertas está funcionando.</p>'
        );
        res.json({ ok: true, mensaje: 'Email enviado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});*/
module.exports = router;

