//importa la libreria oficial de oracle para node.js
const oracledb = require('oracledb');

async function getConnection() {
    return await oracledb.getConnection({
        user:          process.env.DB_USER,
        password:      process.env.DB_PASS,
        connectString: process.env.DB_STRING
    });
}
//expone la funcion para que pueda ser usada en otros archivos (podré importar esta conexion cada vez que necesite hacer una consulta)
module.exports = getConnection;