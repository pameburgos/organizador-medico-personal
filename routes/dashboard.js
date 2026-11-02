const express = require('express');
const router = express.Router();
const getConnection = require('../db');
const oracledb = require('oracledb');

router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    // 1. Contadores principales con fallback seguro
    const resContadores = await conn.execute(
      `SELECT
        (SELECT COUNT(*) FROM especialidades WHERE activa = 1) AS especialidades,
        (SELECT COUNT(*) FROM consultas)                      AS consultas,
        (SELECT COUNT(*) FROM documentos)                     AS documentos,
        (SELECT COUNT(*) FROM medicamentos WHERE activo = 1)   AS medicamentos,
        (SELECT COUNT(*) FROM alertas WHERE activa = 1)        AS alertas
       FROM dual`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const fila = resContadores.rows[0] || {};
    const conteo = {
      especialidades: Number(fila.ESPECIALIDADES ?? fila.especialidades ?? 0),
      consultas:      Number(fila.CONSULTAS ?? fila.consultas ?? 0),
      documentos:     Number(fila.DOCUMENTOS ?? fila.documentos ?? 0),
      medicamentos:   Number(fila.MEDICAMENTOS ?? fila.medicamentos ?? 0),
      alertas:        Number(fila.ALERTAS ?? fila.alertas ?? 0)
    };

    // 2. Próximas consultas programadas
    const resLista = await conn.execute(
      `SELECT e.nombre AS especialidad,
              e.nombre_doctor,
              TO_CHAR(c.fecha_hora, 'DD Mon', 'NLS_DATE_LANGUAGE=SPANISH') AS fecha_display,
              TO_CHAR(c.fecha_hora, 'HH24:MI')                             AS hora
       FROM consultas c
       JOIN especialidades e ON e.id_especialidad = c.id_especialidad
       WHERE c.estado = 'Programada'
         AND c.fecha_hora >= SYSDATE - INTERVAL '1' HOUR
       ORDER BY c.fecha_hora ASC
       FETCH FIRST 4 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 3. Próximas alertas programadas (consultas y medicamentos)
    const resAlertasLista = await conn.execute(
      `SELECT a.id_alerta,
              LOWER(a.tipo) AS tipo,
              a.descripcion,
              NVL(a.nombre_med, m.nombre) AS nombre_med,
              e.nombre AS nombre_esp,
              TO_CHAR(a.proximo_envio, 'DD Mon HH24:MI', 'NLS_DATE_LANGUAGE=SPANISH') AS fecha_display,
              a.canal
       FROM alertas a

       LEFT JOIN medicamentos m
         ON (m.id_medicamento = a.id_medicamento OR m.id_medicamento = a.id_referencia)
        AND LOWER(a.tipo) IN ('medicacion', 'medicamento')

       LEFT JOIN consultas c
         ON (c.id_consulta = a.id_consulta OR c.id_consulta = a.id_referencia)
        AND LOWER(a.tipo) = 'consulta'

       LEFT JOIN especialidades e
         ON e.id_especialidad = c.id_especialidad

       WHERE a.activa = 1
         AND (a.proximo_envio IS NOT NULL AND a.proximo_envio >= SYSDATE - INTERVAL '30' MINUTE)
       ORDER BY a.proximo_envio ASC
       FETCH FIRST 5 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      ...conteo,
      lista_proximas: resLista.rows || [],
      proximas_alertas: resAlertasLista.rows || []
    });

  } catch (err) {
    console.error('GET /dashboard:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
