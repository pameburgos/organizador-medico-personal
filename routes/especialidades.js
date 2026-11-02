//para verificar si la api responde rapido entrar a http://localhost:3000/especialidades/test
//para verificar
// si la base de datos oracle esta conectado y devolviendo datos entrar a http://localhost:3000/especialidades/testdb

const express = require('express');
const router = express.Router();
const getConnection = require('../db');

//rutas de prueba
router.get('/test', async (req, res) => {
    res.json({
        mensaje: 'Ruta funcionando'
    });
});

//base de datos
router.get('/testdb', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(`
            SELECT COUNT(*) TOTAL
            FROM ESPECIALIDADES
        `);
        res.json(result.rows);
    }catch(error){
        console.error(error);
        res.status(500).json(error.message);
    }finally{
        if(connection){
            await connection.close();
        }
    }
});

//CRUD de especialidades medicas

//ver todas las especialidades (read)
router.get('/', async (req, res) => {
    let connection;
    try{
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT ID_ESPECIALIDAD, NOMBRE, NOMBRE_DOCTOR, TELEFONO_DOCTOR, CENTRO_MEDICO, ESTADO, NOTAS, ACTIVA, FECHA_CREACION 
            FROM ESPECIALIDADES 
            WHERE ACTIVA = 1
            ORDER BY NOMBRE`,
            [],
            {outFormat: require('oracledb').OUT_FORMAT_OBJECT}
        );
        res.json(result.rows);
    }catch(error){
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener las especialidades'
        });
    }finally{
        if(connection) await connection.close();
    }
});

//crear una nueva especialidad (create)
router.post('/', async (req, res) => {
    //recibimos los datos exactos que pide tu tabla "especialidades"
    const {nombre, nombre_doctor, telefono_doctor, centro_medico, estado, notas} = req.body;
    let connection;
    try{
        connection = await getConnection();
        await connection.execute(
            `INSERT INTO ESPECIALIDADES (NOMBRE, NOMBRE_DOCTOR, TELEFONO_DOCTOR, CENTRO_MEDICO, ESTADO, NOTAS, ACTIVA, FECHA_CREACION)
            VALUES (:nombre, :nombre_doctor, :telefono_doctor, :centro_medico, :estado, :notas, 1, sysdate)`,
            {nombre, nombre_doctor, telefono_doctor, centro_medico, estado,  notas},
            {autoCommit: true}
        );
        res.status(201).json({
            mensaje: 'Especialidad creada con éxito'
        });
    }catch(error){
        console.error(error);
        res.status(500).json({
            error: 'Error al crear la especialidad'
        });
    }finally {
        if(connection) await connection.close();
    }
});
//editar una especialidad (update)
router.put('/:id', async(req, res)=>{
    const{id} = req.params; //este id mapeará a id_especialidad
    const{nombre, nombre_doctor, telefono_doctor, centro_medico, estado, notas, activa = 1} = req.body;
    let connection;
    try{
        connection = await getConnection();
        const result = await connection.execute(
            `UPDATE ESPECIALIDADES 
            SET NOMBRE = :nombre, 
                NOMBRE_DOCTOR = :nombre_doctor, 
                TELEFONO_DOCTOR = :telefono_doctor, 
                CENTRO_MEDICO = :centro_medico,
                ESTADO = :estado,
                NOTAS = :notas,
                ACTIVA = :activa
            WHERE ID_ESPECIALIDAD = :id`,
            {nombre, nombre_doctor, telefono_doctor, centro_medico, estado, notas, activa, id},
            {autoCommit: true}
        );
        if(result.rowsAffected === 0){
            return res.status(404).json({error: 'Especialidad no encontrada'});
        }
        res.json({mensaje: 'Especialidad actualizada con éxito'});
    }catch(error){
        console.error(error);
        res.status(500).json({error: 'Error al actualizar la especialidad'});
    }finally{
        if(connection) await connection.close();
    }
});

//desactivar una especialidad (baja logica / fin de tratamiento)
router.delete('/:id', async (req, res)=> {
    const {id} = req.params;
    let connection;
    try{
        connection = await getConnection();
        //hacemos un UPDATE en vez de un DELETE para no perder el historico
        const result = await connection.execute(
            `UPDATE ESPECIALIDADES 
            SET ACTIVA = 0 
            WHERE ID_ESPECIALIDAD = :id`,
            {id},
            {autoCommit: true}
        );
        if(result.rowsAffected === 0){
            return res.status(404).json({
                error: 'Especialidad no encontrada'
            });
        }
        res.json({
            mensaje: 'Especialidad archivada con éxito'
        });
    }catch(error){
        console.error(error);
        res.status(500).json({
            error: 'Error al archivar la especialidad'
        });
    }finally{
        if(connection) await connection.close();
    }
});

// Obtener historial médico completo ordenado y clasificado con este especialista
router.get('/:id/historial', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await getConnection();
        const oracledb = require('oracledb');

        // 1. Datos de la especialidad y doctor
        const resEsp = await conn.execute(
            `SELECT ID_ESPECIALIDAD, NOMBRE, NOMBRE_DOCTOR, TELEFONO_DOCTOR, CENTRO_MEDICO, ESTADO, NOTAS
             FROM ESPECIALIDADES
             WHERE ID_ESPECIALIDAD = :id`,
            [Number(id)],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (!resEsp.rows || resEsp.rows.length === 0) {
            return res.status(404).json({ error: 'Especialidad no encontrada' });
        }
        const especialidad = resEsp.rows[0];

        // 2. Consultas con este especialista
        const resConsultas = await conn.execute(
            `SELECT c.id_consulta,
                    TO_CHAR(c.fecha_hora, 'YYYY-MM-DD') AS fecha,
                    TO_CHAR(c.fecha_hora, 'HH24:MI')    AS hora,
                    c.lugar, c.motivo, c.notas_post, c.estado
             FROM consultas c
             WHERE c.id_especialidad = :id
             ORDER BY c.fecha_hora DESC`,
            [Number(id)],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // 3. Documentos y estudios médicos de esta especialidad
        const resDocs = await conn.execute(
            `SELECT d.id_documento, d.tipo, d.titulo, d.descripcion, d.nombre_archivo, d.ruta_archivo,
                    TO_CHAR(d.fecha_documento, 'YYYY-MM-DD') AS fecha_documento
             FROM documentos d
             WHERE d.id_especialidad = :id
             ORDER BY d.fecha_documento DESC NULLS LAST`,
            [Number(id)],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // 4. Medicamentos o tratamientos indicados
        const docNombre = especialidad.NOMBRE_DOCTOR ? especialidad.NOMBRE_DOCTOR.toLowerCase() : '';
        const espNombre = especialidad.NOMBRE ? especialidad.NOMBRE.toLowerCase() : '';

        const resMeds = await conn.execute(
            `SELECT id_medicamento, nombre, dosis, frecuencia, via, indicacion,
                    TO_CHAR(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                    TO_CHAR(fecha_fin,    'YYYY-MM-DD') AS fecha_fin,
                    notas, activo
             FROM medicamentos
             ORDER BY activo DESC, nombre ASC`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const medsAsociados = resMeds.rows.filter(m => {
            const txt = `${m.NOTAS || ''} ${m.INDICACION || ''}`.toLowerCase();
            return (docNombre && txt.includes(docNombre)) || (espNombre && txt.includes(espNombre));
        });

        res.json({
            especialidad,
            consultas: resConsultas.rows || [],
            documentos: resDocs.rows || [],
            medicamentos: medsAsociados.length > 0 ? medsAsociados : resMeds.rows.filter(m => m.ACTIVO === 1)
        });

    } catch (error) {
        console.error('Error al obtener historial de especialidad:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;



