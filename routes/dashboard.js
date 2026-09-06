const express = require("express");
const router = express.Router();
const getConnection = require("../db");
const oracledb = require("oracledb");

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const resContadores = await conn.execute(
      `
    SELECT
        (SELECT COUNT(*)
         FROM especialidades
         WHERE activa = 1) AS especialidades,

        (SELECT COUNT(*)
         FROM consultas) AS consultas,

        (SELECT COUNT(*)
         FROM documentos) AS documentos,

        (SELECT COUNT(*)
         FROM medicamentos
         WHERE activo = 1) AS medicamentos,

        (SELECT COUNT(*)
         FROM alertas
         WHERE activa = 1) AS alertas
    FROM dual
    `,
      [],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
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
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    //proximos recordatorios por correo
    const resAlertasLista = await conn.execute(
      `SELECT a.tipo,
            a.descripcion,
            m.nombre AS nombre_med, -- Trae el nombre directo de medicamentos
            e.nombre AS nombre_esp, -- Trae la especialidad si es alerta de consulta
            TO_CHAR(a.proximo_envio, 'DD Mon HH24:MI', 'NLS_DATE_LANGUAGE=SPANISH') AS fecha_display
            FROM alertas a

            LEFT JOIN medicamentos m
            ON m.id_medicamento = a.id_referencia
            AND a.tipo = 'Medicamento'

            LEFT JOIN consultas c
            ON c.id_consulta = a.id_referencia
            AND a.tipo = 'Consulta'

            LEFT JOIN especialidades e
            ON e.id_especialidad = c.id_especialidad
            
            WHERE a.activa = 1
            AND a.proximo_envio >= SYSDATE
            ORDER BY a.proximo_envio ASC
            FETCH FIRST 3 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    //el servidor empaqueta todos los datos recolectados y los envia de vuelta al navegador
    //mediante un unico json con todo dentro
    res.json({
      especialidades: resContadores.rows[0].ESPECIALIDADES,
      consultas: resContadores.rows[0].CONSULTAS,
      documentos: resContadores.rows[0].DOCUMENTOS,
      medicamentos: resContadores.rows[0].MEDICAMENTOS,
      alertas: resContadores.rows[0].ALERTAS,

      lista_proximas: resLista.rows,
      proximas_alertas: resAlertasLista.rows,
    });
  } catch (err) {
    console.error("GET /dashboard:", err);
    res.status(500).json({ error: err.message });
  } finally {
    //limpieza obligatoria que hace node.js para no dejar conexion colgada o abierta
    if (conn) await conn.close();
  }
});

module.exports = router;
