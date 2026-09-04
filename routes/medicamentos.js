//importaciones
const express       = require('express');
const router        = express.Router();
const getConnection = require('../db');
const oracledb      = require('oracledb');

//trae la lista de todos los medicamentos de la bd
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const { activo } = req.query;

        let sql = `
            SELECT id_medicamento,
                nombre,
                dosis,
                frecuencia,
                via,
                indicacion,
                TO_CHAR(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                TO_CHAR(fecha_fin,    'YYYY-MM-DD') AS fecha_fin,                  notas,
                activo
            FROM medicamentos`;
        const params = {};

        if (activo !== undefined) {
            sql += ` WHERE activo = :activo`;
            params.activo = Number(activo);
        }
        sql += ` ORDER BY activo DESC, nombre ASC`;

        const result = await conn.execute(sql, params, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });
        res.json(result.rows);
    } catch (err) {
        console.error('GET /medicamentos:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//filtros adicionales enviados desde el navegador
router.get('/historial', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const { id_medicamento, limite } = req.query;
        //cruce entre tomas_medicamentos y medicamentos: asocia cada registro de toma con el nombre del medicamento y su dosis
        let sql = `
            SELECT t.id_toma,
                t.id_medicamento,
                m.nombre AS nombre_medicamento,
                m.dosis,
                TO_CHAR(t.fecha_hora_toma, 'YYYY-MM-DD"T"HH24:MI') AS fecha_hora_toma,
                t.notas
            FROM tomas_medicamentos t
            JOIN medicamentos m ON m.id_medicamento = t.id_medicamento`;
        const params = {};

        if (id_medicamento) {
            sql += ` WHERE t.id_medicamento = :id_medicamento`;
            params.id_medicamento = Number(id_medicamento);
        }

        sql += ` ORDER BY t.fecha_hora_toma DESC FETCH FIRST :limite ROWS ONLY`;
        params.limite = limite ? Number(limite) : 30;

        const result = await conn.execute(sql, params, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });
        res.json(result.rows);
    } catch (err) {
        console.error('GET /medicamentos/historial:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//busca un medicamento especifico usando id
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_medicamento,
                    nombre,
                    dosis,
                    frecuencia,
                    via,
                    indicacion,
                    TO_CHAR(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                    TO_CHAR(fecha_fin,    'YYYY-MM-DD') AS fecha_fin,
                    notas,
                    activo
            FROM medicamentos
            WHERE id_medicamento = :id`,
            [Number(req.params.id)],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Medicamento no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('GET /medicamentos/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//recibe datos del form e inserta un nuevo registro en tabla medicamento (crea un nuevo medicamento)
router.post('/', async (req, res) => {
    const { nombre, dosis, frecuencia, via, indicacion,
            fecha_inicio, fecha_fin, notas } = req.body;

    if (!nombre)
        return res.status(400).json({ error: 'El nombre del medicamento es obligatorio' });

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `INSERT INTO medicamentos
                (nombre, dosis, frecuencia, via, indicacion,
                fecha_inicio, fecha_fin, notas, activo)
            VALUES
                (:nombre, :dosis, :frecuencia, :via, :indicacion,
                ${fecha_inicio ? `TO_DATE(:fecha_inicio, 'YYYY-MM-DD')` : 'NULL'},
                ${fecha_fin    ? `TO_DATE(:fecha_fin, 'YYYY-MM-DD')`    : 'NULL'},
                :notas, 1)
            RETURNING id_medicamento INTO :id`,
            {
                nombre,
                dosis:        dosis        || null,
                frecuencia:   frecuencia   || null,
                via:          via          || 'Oral',
                indicacion:   indicacion   || null,
                ...(fecha_inicio ? { fecha_inicio } : {}),
                ...(fecha_fin    ? { fecha_fin }    : {}),
                notas:        notas        || null,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true }
        );
        res.status(201).json({
            id_medicamento: result.outBinds.id[0],
            message: 'Medicamento creado'
        });
    } catch (err) {
        console.error('POST /medicamentos:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//editar un medicamento existente (actualiza la info de un medicamento usando su id)
router.put('/:id', async (req, res) => {
    const { nombre, dosis, frecuencia, via, indicacion,
            fecha_inicio, fecha_fin, notas, activo } = req.body;

    if (!nombre)
        return res.status(400).json({ error: 'El nombre del medicamento es obligatorio' });

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `UPDATE medicamentos
                SET nombre        = :nombre,
                    dosis         = :dosis,
                    frecuencia    = :frecuencia,
                    via           = :via,
                    indicacion    = :indicacion,
                    fecha_inicio  = ${fecha_inicio ? `TO_DATE(:fecha_inicio, 'YYYY-MM-DD')` : 'NULL'},
                    fecha_fin     = ${fecha_fin    ? `TO_DATE(:fecha_fin, 'YYYY-MM-DD')`    : 'NULL'},
                    notas         = :notas,
                    activo        = :activo
            WHERE id_medicamento = :id`,
            {
                nombre,
                dosis:        dosis        || null,
                frecuencia:   frecuencia   || null,
                via:          via          || 'Oral',
                indicacion:   indicacion   || null,
                ...(fecha_inicio ? { fecha_inicio } : {}),
                ...(fecha_fin    ? { fecha_fin }    : {}),
                notas:        notas        || null,
                activo:       activo !== undefined ? Number(activo) : 1,
                id:           Number(req.params.id)
            },
            { autoCommit: true }
        );
        if (result.rowsAffected === 0)
            return res.status(404).json({ error: 'Medicamento no encontrado' });
        res.json({ message: 'Medicamento actualizado' });
    } catch (err) {
        console.error('PUT /medicamentos/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//archiva el medicamento en vez de eliminarlo, asi el usuario ya no lo ve en el sistema
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `UPDATE medicamentos SET activo = 0 WHERE id_medicamento = :id`,
            [Number(req.params.id)],
            { autoCommit: true }
        );
        if (result.rowsAffected === 0)
            return res.status(404).json({ error: 'Medicamento no encontrado' });
        res.json({ message: 'Medicamento archivado' });
    } catch (err) {
        console.error('DELETE /medicamentos/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//registra una toma de medicamento
router.post('/:id/tomas', async (req, res) => {
    const { fecha_hora, notas } = req.body;

    if (!fecha_hora)
        return res.status(400).json({ error: 'La fecha y hora de la toma son obligatorias' });
    //formateo de fecha de html a oracle
    const fechaHoraStr = fecha_hora.replace('T', ' ');

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `INSERT INTO tomas_medicamentos (id_medicamento, fecha_hora_toma, notas)
            VALUES (:id_medicamento,
                    TO_DATE(:fecha_hora, 'YYYY-MM-DD HH24:MI'),
                    :notas)
            RETURNING id_toma INTO :id`,
            {
                id_medicamento: Number(req.params.id),
                fecha_hora:     fechaHoraStr,
                notas:          notas || null,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true }
        );
        res.status(201).json({
            id_toma: result.outBinds.id[0],
            message: 'Toma registrada'
        });
    } catch (err) {
        console.error('POST /medicamentos/:id/tomas:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//elimina un registro de toma
router.delete('/tomas/:idToma', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `DELETE FROM tomas_medicamentos WHERE id_toma = :id`,
            [Number(req.params.idToma)],
            { autoCommit: true }
        );
        if (result.rowsAffected === 0)
            return res.status(404).json({ error: 'Registro no encontrado' });
        res.json({ message: 'Registro de toma eliminado' });
    } catch (err) {
        console.error('DELETE /medicamentos/tomas/:idToma:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
