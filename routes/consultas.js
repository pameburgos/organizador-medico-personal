const express       = require('express');
const router        = express.Router();
const getConnection = require('../db');
const oracledb      = require('oracledb');

// Lista todas las consultas con o sin filtro de año/mes
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();

        // REQUERIMIENTO: Cuando pasa la fecha registrada como próxima, pasa automáticamente a 'Realizada'
        try {
            await conn.execute(
                `UPDATE consultas
                 SET estado = 'Realizada'
                 WHERE estado = 'Programada'
                   AND fecha_hora < SYSTIMESTAMP`,
                [],
                { autoCommit: true }
            );
        } catch (updateErr) {
            console.warn('[Consultas] Advertencia en auto-actualización de estado:', updateErr.message);
        }

        const { anio, mes } = req.query;
        let sql, params;

        if (anio && mes !== undefined) {
            sql = `
                SELECT c.id_consulta,
                        c.id_especialidad,
                        e.nombre              AS nombre_especialidad,
                        e.nombre_doctor,
                        c.lugar,
                        TO_CHAR(c.fecha_hora, 'YYYY-MM-DD')    AS fecha,
                        TO_CHAR(c.fecha_hora, 'HH24:MI')       AS hora,
                        c.motivo,
                        c.notas_post,
                        c.estado
                    FROM consultas c
                    JOIN especialidades e ON e.id_especialidad = c.id_especialidad
                    WHERE EXTRACT(YEAR  FROM c.fecha_hora) = :anio
                    AND EXTRACT(MONTH FROM c.fecha_hora) = :mes
                    ORDER BY c.fecha_hora DESC`;
            params = { anio: Number(anio), mes: Number(mes) };
        } else {
            sql = `
                SELECT c.id_consulta,
                    c.id_especialidad,
                    e.nombre              AS nombre_especialidad,
                    e.nombre_doctor,
                    c.lugar,
                    TO_CHAR(c.fecha_hora, 'YYYY-MM-DD')    AS fecha,
                    TO_CHAR(c.fecha_hora, 'HH24:MI')       AS hora,
                    c.motivo,
                    c.notas_post,
                    c.estado
                FROM consultas c
                JOIN especialidades e ON e.id_especialidad = c.id_especialidad
                ORDER BY c.fecha_hora DESC`;
            params = [];
        }

        const result = await conn.execute(sql, params, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });
        res.json(result.rows);
    } catch (err) {
        console.error('GET /consultas:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

// Obtiene una sola consulta
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT c.id_consulta,
                    c.id_especialidad,
                    e.nombre              AS nombre_especialidad,
                    e.nombre_doctor,
                    c.lugar,
                    TO_CHAR(c.fecha_hora, 'YYYY-MM-DD')    AS fecha,
                    TO_CHAR(c.fecha_hora, 'HH24:MI')       AS hora,
                    c.motivo,
                    c.notas_post,
                    c.estado
            FROM consultas c
            JOIN especialidades e ON e.id_especialidad = c.id_especialidad
            WHERE c.id_consulta = :id`,
            [Number(req.params.id)],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'No encontrada' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('GET /consultas/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

// Crear una nueva consulta
router.post('/', async (req, res) => {
    const { id_especialidad, fecha, hora, lugar, motivo, notas_post, estado } = req.body;

    if (!id_especialidad || !fecha || !hora)
        return res.status(400).json({ error: 'La especialidad, fecha y hora son obligatorias' });

    const fechaHoraStr = `${fecha} ${hora}`;

    // Determinar estado inicial: si la fecha ya pasó, guardar como 'Realizada'
    const fechaHoraParsed = new Date(`${fecha}T${hora}:00`);
    const estadoFinal = estado || (fechaHoraParsed < new Date() ? 'Realizada' : 'Programada');

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `INSERT INTO consultas (id_especialidad, fecha_hora, lugar, motivo, notas_post, estado)
            VALUES (:id_especialidad,
                    TO_TIMESTAMP(:fecha_hora, 'YYYY-MM-DD HH24:MI'),
                    :lugar, :motivo, :notas_post, :estado)
            RETURNING id_consulta INTO :id`,
            {
                id_especialidad: Number(id_especialidad),
                fecha_hora:      fechaHoraStr,
                lugar:           lugar      || null,
                motivo:          motivo     || null,
                notas_post:      notas_post || null,
                estado:          estadoFinal,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true }
        );
        res.status(201).json({
            id_consulta: result.outBinds.id[0],
            message: 'Consulta creada'
        });
    } catch (err) {
        console.error('POST /consultas:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

// Actualiza una consulta existente
router.put('/:id', async (req, res) => {
    const { id_especialidad, fecha, hora, lugar, motivo, notas_post, estado } = req.body;

    if (!id_especialidad || !fecha || !hora)
        return res.status(400).json({ error: 'La especialidad, fecha y hora son obligatorias' });

    const fechaHoraStr = `${fecha} ${hora}`;
    const fechaHoraParsed = new Date(`${fecha}T${hora}:00`);
    const estadoFinal = estado || (fechaHoraParsed < new Date() ? 'Realizada' : 'Programada');

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `UPDATE consultas
                SET id_especialidad = :id_especialidad,
                    fecha_hora      = TO_TIMESTAMP(:fecha_hora, 'YYYY-MM-DD HH24:MI'),
                    lugar           = :lugar,
                    motivo          = :motivo,
                    notas_post      = :notas_post,
                    estado          = :estado
            WHERE id_consulta     = :id`,
            {
                id_especialidad: Number(id_especialidad),
                fecha_hora:      fechaHoraStr,
                lugar:           lugar      || null,
                motivo:          motivo     || null,
                notas_post:      notas_post || null,
                estado:          estadoFinal,
                id:              Number(req.params.id)
            },
            { autoCommit: true }
        );
        if (result.rowsAffected === 0)
            return res.status(404).json({ error: 'No encontrada' });
        res.json({ message: 'Consulta actualizada' });
    } catch (err) {
        console.error('PUT /consultas/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

// Eliminar consulta
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `DELETE FROM consultas WHERE id_consulta = :id`,
            [Number(req.params.id)],
            { autoCommit: true }
        );
        if (result.rowsAffected === 0)
            return res.status(404).json({ error: 'No encontrada' });
        res.json({ message: 'Consulta eliminada' });
    } catch (err) {
        console.error('DELETE /consultas/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
