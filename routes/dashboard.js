const express = require('express');
const router = express.Router();
const getConnection = require('../db');
const oracledb = require('oracledb');

router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        //ejecuta 5 consultas consecutivas usando count(*)
        const resEsp = await conn.execute(
            `SELECT COUNT(*) AS total FROM especialidades WHERE activa = 1`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const resCon = await conn.execute(
            `SELECT COUNT(*) AS total FROM consultas`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const resMed = await conn.execute(
            `SELECT COUNT(*) AS total FROM medicamentos WHERE activo = 1`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const resDoc = await conn.execute(
            `SELECT COUNT(*) AS total FROM documentos`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        //contar alertas enviadas
        const resAle = await conn.execute(
            `SELECT COUNT(*) AS total FROM alertas WHERE activa = 1`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        //proxima consulta medica: busca en la agenda los turnos mas proximos
        const resLista = await conn.execute(
            `SELECT e.nombre                                          AS especialidad,
                    e.nombre_doctor,
                    TO_CHAR(c.fecha_hora, 'DD Mon', 'NLS_DATE_LANGUAGE=SPANISH') AS fecha_display,
                    TO_CHAR(c.fecha_hora, 'HH24:MI')                             AS hora
            FROM consultas c
            JOIN especialidades e ON e.id_especialidad = c.id_especialidad
            WHERE c.estado = 'Programada'
                AND c.fecha_hora >= SYSDATE
            ORDER BY c.fecha_hora ASC
            FETCH FIRST 3 ROWS ONLY`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        //proximos recordatorios por correo
        const resAlertasLista = await conn.execute(
            `SELECT a.tipo,
            a.descripcion,
            m.nombre AS nombre_med, -- Trae el nombre directo de medicamentos
            e.nombre AS nombre_esp, -- Trae la especialidad si es alerta de consulta
            TO_CHAR(a.proximo_envio, 'DD Mon HH24:MI', 'NLS_DATE_LANGUAGE=SPANISH') AS fecha_display
     FROM alertas a
     LEFT JOIN medicamentos m ON m.id_medicamento = a.id_medicamento
     LEFT JOIN consultas c    ON c.id_consulta    = a.id_consulta
     LEFT JOIN especialidades e ON e.id_especialidad = c.id_especialidad
     WHERE a.activa = 1
       AND a.proximo_envio >= SYSDATE
     ORDER BY a.proximo_envio ASC
     FETCH FIRST 3 ROWS ONLY`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        //el servidor empaqueta todos los datos recolectados y los envia de vuelta al navegador
        //mediante un unico json con todo dentro
        res.json({
            especialidades: resEsp.rows[0].TOTAL,
            consultas: resCon.rows[0].TOTAL,
            medicamentos: resMed.rows[0].TOTAL,
            alertas: resAle.rows[0].TOTAL,
            lista_proximas: resLista.rows,
            proximas_alertas: resAlertasLista.rows,
            documentos: resDoc.rows[0].TOTAL
        });
    } catch (err) {
        console.error('GET /dashboard:', err);
        res.status(500).json({ error: err.message });
    } finally {//limpieza obligatoria que hace node.js para no dejar conexion colgada o abierta
        if (conn) await conn.close();
    }
});

module.exports = router;
