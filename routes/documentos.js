const express       = require('express');
const router        = express.Router();
const getConnection = require('../db');
const oracledb      = require('oracledb');
const multer        = require('multer');
const path          = require('path');
const fs            = require('fs');

//inicializacion y creacion de carpetas
const CARPETA_UPLOADS = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(CARPETA_UPLOADS)) {
    fs.mkdirSync(CARPETA_UPLOADS, { recursive: true });
}
//config del nombre de los archivos: le dice a multer donde guardar los archivos y como renombrarlos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, CARPETA_UPLOADS),
    filename: (req, file, cb) => {
        const sufijo = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext    = path.extname(file.originalname);
        cb(null, `doc-${sufijo}${ext}`);
    }
});
//filtros de seguridad y limite de peso: 15 MB
const TIPOS_PERMITIDOS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        TIPOS_PERMITIDOS.includes(ext)
            ? cb(null, true)
            : cb(new Error('Tipo de archivo no permitido. Usá PDF, JPG, PNG, WEBP o HEIC.'));
    }
});

//listado con filtros y cruce de datos
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const { id_especialidad, tipo } = req.query;

        let sql = `
            SELECT d.id_documento,
                d.id_especialidad,
                d.id_consulta,
                e.nombre                                       AS nombre_especialidad,
                d.tipo,
                d.titulo,
                d.descripcion,
                d.nombre_archivo,
                d.ruta_archivo,
                TO_CHAR(d.fecha_documento, 'YYYY-MM-DD')      AS fecha_documento,
                TO_CHAR(d.fecha_carga,     'YYYY-MM-DD')      AS fecha_carga
            FROM documentos d
            LEFT JOIN especialidades e ON e.id_especialidad = d.id_especialidad
            WHERE 1 = 1`;

        const params = {};

        if (id_especialidad) {
            sql += ` AND d.id_especialidad = :id_especialidad`;
            params.id_especialidad = Number(id_especialidad);
        }
        if (tipo) {
            sql += ` AND d.tipo = :tipo`;
            params.tipo = tipo;
        }

        sql += ` ORDER BY d.fecha_documento DESC NULLS LAST, d.fecha_carga DESC`;

        const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json(result.rows);
    } catch (err) {
        console.error('GET /documentos:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//buscar un documento especifico (por id)
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT d.id_documento,
                    d.id_especialidad,
                    d.id_consulta,
                    e.nombre                                       AS nombre_especialidad,
                    d.tipo,
                    d.titulo,
                    d.descripcion,
                    d.nombre_archivo,
                    d.ruta_archivo,
                    TO_CHAR(d.fecha_documento, 'YYYY-MM-DD')      AS fecha_documento,
                    TO_CHAR(d.fecha_carga,     'YYYY-MM-DD')      AS fecha_carga
            FROM documentos d
            LEFT JOIN especialidades e ON e.id_especialidad = d.id_especialidad
            WHERE d.id_documento = :id`,
            [Number(req.params.id)],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('GET /documentos/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//punto final principal de subida, el middleware guarda el archivo en el disco, luego la funcion insert se ejecuta en oracle
router.post('/', upload.single('archivo'), async (req, res) => {
    const { id_especialidad, tipo, titulo, descripcion, fecha_documento } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: 'El archivo es obligatorio' });
    }
    if (!titulo || !tipo) {
        //limpieza automatica de errores
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'El título y el tipo son obligatorios' });
        /*En la columna nombre_archivo guarda el nombre original (ej: analisis_sangre.pdf) para que sea amigable al usuario, 
        y en ruta_archivo guarda el nombre único codificado (ej: doc-123456.pdf) para poder localizarlo en la carpeta del servidor*/
    }

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `INSERT INTO documentos
                (id_especialidad, id_consulta, tipo, titulo, descripcion,
                nombre_archivo, ruta_archivo, fecha_documento, fecha_carga)
            VALUES
                (:id_especialidad, NULL, :tipo, :titulo, :descripcion,
                :nombre_archivo, :ruta_archivo,
                TO_DATE(:fecha_documento, 'YYYY-MM-DD'),
                SYSDATE)
            RETURNING id_documento INTO :id`,
            {
                id_especialidad: id_especialidad ? Number(id_especialidad) : null,
                tipo,
                titulo,
                descripcion:    descripcion || null,
                nombre_archivo: req.file.originalname,
                ruta_archivo:   req.file.filename,
                fecha_documento: fecha_documento || null,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true }
        );
        res.status(201).json({
            id_documento: result.outBinds.id[0],
            message: 'Documento subido con éxito'
        });
    } catch (err) {
        console.error('POST /documentos:', err);
        fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//actualiza metadatos del documento
router.put('/:id', async (req, res) => {
    const { id_especialidad, tipo, titulo, descripcion, fecha_documento } = req.body;

    if (!titulo || !tipo) {
        return res.status(400).json({ error: 'El título y el tipo son obligatorios' });
    }

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `UPDATE documentos
                SET id_especialidad  = :id_especialidad,
                    tipo             = :tipo,
                    titulo           = :titulo,
                    descripcion      = :descripcion,
                    fecha_documento  = CASE
                                        WHEN :fecha_documento IS NOT NULL
                                        THEN TO_DATE(:fecha_documento, 'YYYY-MM-DD')
                                        ELSE fecha_documento
                                    END
                WHERE id_documento     = :id`,
            {
                id_especialidad: id_especialidad ? Number(id_especialidad) : null,
                tipo,
                titulo,
                descripcion:     descripcion || null,
                fecha_documento: fecha_documento || null,
                id:              Number(req.params.id)
            },
            { autoCommit: true }
        );
        if (result.rowsAffected === 0)
            return res.status(404).json({ error: 'No encontrado' });
        res.json({ message: 'Documento actualizado' });
    } catch (err) {
        console.error('PUT /documentos/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

//borrado fisico completo: base de datos y disco duro
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();

        const previo = await conn.execute(
            `SELECT ruta_archivo FROM documentos WHERE id_documento = :id`,
            [Number(req.params.id)],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (previo.rows.length === 0)
            return res.status(404).json({ error: 'No encontrado' });

        await conn.execute(
            `DELETE FROM documentos WHERE id_documento = :id`,
            [Number(req.params.id)],
            { autoCommit: true }
        );

        const rutaCompleta = path.join(CARPETA_UPLOADS, previo.rows[0].RUTA_ARCHIVO);
        fs.unlink(rutaCompleta, (err) => {
            if (err) console.warn('No se pudo borrar el archivo físico:', err.message);
        });

        res.json({ message: 'Documento eliminado' });
    } catch (err) {
        console.error('DELETE /documentos/:id:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;