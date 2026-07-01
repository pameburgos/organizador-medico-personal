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

//en el caso de querer proyecctar el historico
/*router.get('/historico', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM ESPECIALIDADES ORDER BY FECHA_CREACION DESC`,
            [],
            { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) await connection.close();
    }
});*/

//esta linea siempre al final
module.exports = router;



