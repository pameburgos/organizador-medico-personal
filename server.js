//usamos el framework Express para gestionar las rutas de la app y levantar el servidor

//permite ocultar datos sensibles 
require('dotenv').config({ path: './alerta.env' });

//inicializacion de Express
const express = require('express');
const app = express();

//config de lectura y archivos estaticos
app.use(express.json());//permite que el servidor entienda y procese datos en formato json
app.use(express.static('public'));//sirve archivos estaticos desde la carpeta public
app.use('/uploads', express.static('uploads'));//expone la carpeta (uploads) de manera publica. Si alguien ingresa a http://localhost:3000/uploads/archivo.pdf podrá ver el documento subido

//esto conecta con mi archivo de rutas 
app.use('/dashboard', require('./routes/dashboard'));
app.use('/especialidades', require('./routes/especialidades'));
app.use('/consultas', require('./routes/consultas'));
app.use('/documentos', require('./routes/documentos'));
app.use('/alertas', require('./routes/alertas'));
app.use('/medicamentos', require('./routes/medicamentos'));

//encendido del servidor
app.listen(3000, () => {
    console.log('Servidor ejecutándose en puerto 3000');
});


/*Importante: no subir el .env a Git
Así la contraseña nunca se sube al repositorio. El .env queda solo en mi máquina.*/
