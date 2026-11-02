-- Script de Corrección y Actualización para Oracle Database XE
-- Ejecutar en SQL Developer o SQL*Plus conectado al usuario de base de datos

-- 1. Agregar columnas faltantes en la tabla ALERTAS
ALTER TABLE alertas ADD (
    id_medicamento    NUMBER REFERENCES medicamentos(id_medicamento),
    id_consulta       NUMBER REFERENCES consultas(id_consulta),
    nombre_med        VARCHAR2(200),
    canal             VARCHAR2(20) DEFAULT 'ambos',
    fecha_fin         TIMESTAMP,
    total_envios      NUMBER DEFAULT 0,
    envios_realizados NUMBER DEFAULT 0
);

-- 2. Migrar id_referencia a id_consulta o id_medicamento si ya existían registros
UPDATE alertas
SET id_consulta = id_referencia
WHERE id_consulta IS NULL AND LOWER(tipo) = 'consulta';

UPDATE alertas
SET id_medicamento = id_referencia
WHERE id_medicamento IS NULL AND LOWER(tipo) IN ('medicacion', 'medicamento');

COMMIT;

-- 3. Crear índices para acelerar las consultas del Cron Job cada 5 minutos
CREATE INDEX idx_alertas_cron ON alertas (activa, proximo_envio, tipo);
CREATE INDEX idx_historial_alerta ON historial_alertas (id_alerta, fecha_envio);

-- 4. Verificar estructura actualizada
SELECT column_name, data_type, data_length, nullable
FROM user_tab_cols
WHERE table_name = 'ALERTAS'
ORDER BY column_id;




-- nuevo--------------------correccion------------------
-- Script de Corrección y Actualización para Oracle Database XE
-- Ejecutar en SQL Developer o SQL*Plus conectado al usuario de base de datos

-- 1. Agregar columnas faltantes en la tabla ALERTAS
ALTER TABLE alertas ADD (
    id_medicamento    NUMBER REFERENCES medicamentos(id_medicamento),
    id_consulta       NUMBER REFERENCES consultas(id_consulta),
    nombre_med        VARCHAR2(200),
    canal             VARCHAR2(20) DEFAULT 'ambos',
    fecha_fin         TIMESTAMP,
    total_envios      NUMBER DEFAULT 0,
    envios_realizados NUMBER DEFAULT 0
);

-- 2. Migrar id_referencia a id_consulta o id_medicamento si ya existían registros
UPDATE alertas
SET id_consulta = id_referencia
WHERE id_consulta IS NULL AND LOWER(tipo) = 'consulta';

UPDATE alertas
SET id_medicamento = id_referencia
WHERE id_medicamento IS NULL AND LOWER(tipo) IN ('medicacion', 'medicamento');

COMMIT;

-- 3. Crear índices para acelerar las consultas del Cron Job cada 5 minutos
CREATE INDEX idx_alertas_cron ON alertas (activa, proximo_envio, tipo);
CREATE INDEX idx_historial_alerta ON historial_alertas (id_alerta, fecha_envio);

-- 4. Verificar estructura actualizada
SELECT column_name, data_type, data_length, nullable
FROM user_tab_cols
WHERE table_name = 'ALERTAS'
ORDER BY column_id;

-- datos de prueba
-- =========================================================================
-- DATOS DE PRUEBA: HISTORIAL MÉDICO COMPLETO (4 ESPECIALIDADES Y PACIENTE)
-- Ejecutar en Oracle SQL Developer o SQL*Plus
-- =========================================================================

-- Limpiar datos previos si se desea reiniciar (opcional):
-- DELETE FROM historial_alertas;
-- DELETE FROM alertas;
-- DELETE FROM tomas_medicamentos;
-- DELETE FROM documentos;
-- DELETE FROM consultas;
-- DELETE FROM medicamentos;
-- DELETE FROM especialidades;

-- -------------------------------------------------------------------------
-- 1. ESPECIALIDADES MÉDICAS (4 Especialistas)
-- -------------------------------------------------------------------------
INSERT INTO especialidades (nombre, nombre_doctor, telefono_doctor, centro_medico, estado, notas, activa, fecha_creacion)
VALUES ('Cardiología', 'Dra. Valeria Gómez', '0981-234567', 'Instituto Cardiovascular', 'activa', 'Control de hipertensión arterial leve y arritmia sinusal.', 1, SYSDATE - 60);

INSERT INTO especialidades (nombre, nombre_doctor, telefono_doctor, centro_medico, estado, notas, activa, fecha_creacion)
VALUES ('Gastroenterología', 'Dr. Fernando Ruiz', '0971-890123', 'Centro Médico Bautista', 'activa', 'Tratamiento de reflujo gastroesofágico y gastritis crónica.', 1, SYSDATE - 45);

INSERT INTO especialidades (nombre, nombre_doctor, telefono_doctor, centro_medico, estado, notas, activa, fecha_creacion)
VALUES ('Dermatología', 'Dra. Carolina Benítez', '0983-456789', 'Clínica Dermatológica Integral', 'activa', 'Seguimiento de acné moderado y control preventivo de lunares.', 1, SYSDATE - 90);

INSERT INTO especialidades (nombre, nombre_doctor, telefono_doctor, centro_medico, estado, notas, activa, fecha_creacion)
VALUES ('Traumatología', 'Dr. Marcelo Benítez', '0985-678901', 'Hospital Universitario', 'activa', 'Rehabilitación por tendinitis del manguito rotador derecho.', 1, SYSDATE - 30);

COMMIT;

-- -------------------------------------------------------------------------
-- 2. MEDICAMENTOS Y TRATAMIENTOS
-- -------------------------------------------------------------------------
INSERT INTO medicamentos (nombre, dosis, frecuencia, via, indicacion, fecha_inicio, fecha_fin, notas, activo)
VALUES ('Losartán 50mg', '1 comprimido', 'Cada 12 horas', 'Oral', 'Hipertensión arterial', SYSDATE - 60, SYSDATE + 120, 'Tomar con el desayuno y la cena. Indicado por Dra. Valeria Gómez.', 1);

INSERT INTO medicamentos (nombre, dosis, frecuencia, via, indicacion, fecha_inicio, fecha_fin, notas, activo)
VALUES ('Omeprazol 20mg', '1 cápsula', 'Cada 24 horas', 'Oral', 'Protector gástrico para reflujo', SYSDATE - 40, SYSDATE + 20, 'Tomar 30 minutos antes del desayuno. Indicado por Dr. Fernando Ruiz.', 1);

INSERT INTO medicamentos (nombre, dosis, frecuencia, via, indicacion, fecha_inicio, fecha_fin, notas, activo)
VALUES ('Zmol 500mg', '1 comprimido', 'Cada 8 horas', 'Oral', 'Dolor e inflamación estomacal', SYSDATE - 3, SYSDATE + 4, 'Tomar solo si hay molestia o dolor abdominal.', 1);

INSERT INTO medicamentos (nombre, dosis, frecuencia, via, indicacion, fecha_inicio, fecha_fin, notas, activo)
VALUES ('Ibuprofeno 400mg', '1 tableta', 'Cada 8 horas', 'Oral', 'Dolor por tendinitis en hombro', SYSDATE - 25, SYSDATE - 10, 'Tratamiento completado de 15 días con las comidas.', 0);

COMMIT;

-- -------------------------------------------------------------------------
-- 3. REGISTRO DE TOMAS DE MEDICAMENTOS (Historial de tomas)
-- -------------------------------------------------------------------------
-- Tomas para Losartán (asumiendo id_medicamento = 1)
INSERT INTO tomas_medicamentos (id_medicamento, fecha_hora_toma, notas)
VALUES ((SELECT id_medicamento FROM medicamentos WHERE nombre LIKE 'Losartán%' AND ROWNUM = 1), SYSDATE - 1, 'Toma mañana con desayuno');

INSERT INTO tomas_medicamentos (id_medicamento, fecha_hora_toma, notas)
VALUES ((SELECT id_medicamento FROM medicamentos WHERE nombre LIKE 'Losartán%' AND ROWNUM = 1), SYSDATE - 0.5, 'Toma noche con cena');

-- Tomas para Omeprazol
INSERT INTO tomas_medicamentos (id_medicamento, fecha_hora_toma, notas)
VALUES ((SELECT id_medicamento FROM medicamentos WHERE nombre LIKE 'Omeprazol%' AND ROWNUM = 1), SYSDATE - 1, 'En ayunas a las 07:30');

INSERT INTO tomas_medicamentos (id_medicamento, fecha_hora_toma, notas)
VALUES ((SELECT id_medicamento FROM medicamentos WHERE nombre LIKE 'Omeprazol%' AND ROWNUM = 1), SYSDATE, 'En ayunas a las 07:35');

COMMIT;

-- -------------------------------------------------------------------------
-- 4. CONSULTAS MÉDICAS (Pasadas/Realizadas y Próximas por Mes)
-- -------------------------------------------------------------------------

-- Consulta 1: Cardiología (Pasada en Septiembre -> Realizada)
INSERT INTO consultas (id_especialidad, fecha_hora, lugar, motivo, notas_post, estado, fecha_creacion)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Cardiología' AND ROWNUM = 1),
    TO_TIMESTAMP(TO_CHAR(ADD_MONTHS(SYSDATE, -2), 'YYYY-MM') || '-15 09:30', 'YYYY-MM-DD HH24:MI'),
    'Consultorio 204 - Instituto Cardiovascular',
    'Chequeo cardiológico anual y palpitaciones',
    'ECG en reposo normal. Se constata presión 140/90. Se inicia tratamiento con Losartán 50mg cada 12h y se solicita ecocardiograma.',
    'Realizada',
    SYSDATE - 60
);

-- Consulta 2: Cardiología (Pasada en Octubre -> Realizada)
INSERT INTO consultas (id_especialidad, fecha_hora, lugar, motivo, notas_post, estado, fecha_creacion)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Cardiología' AND ROWNUM = 1),
    TO_TIMESTAMP(TO_CHAR(ADD_MONTHS(SYSDATE, -1), 'YYYY-MM') || '-20 10:00', 'YYYY-MM-DD HH24:MI'),
    'Consultorio 204 - Instituto Cardiovascular',
    'Control de presión arterial bajo medicación',
    'Excelente respuesta al Losartán. Presión 120/80 mmHg. Continuar misma dosis.',
    'Realizada',
    SYSDATE - 30
);

-- Consulta 3: Gastroenterología (Pasada -> Realizada)
INSERT INTO consultas (id_especialidad, fecha_hora, lugar, motivo, notas_post, estado, fecha_creacion)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Gastroenterología' AND ROWNUM = 1),
    TO_TIMESTAMP(TO_CHAR(ADD_MONTHS(SYSDATE, -1), 'YYYY-MM') || '-10 16:00', 'YYYY-MM-DD HH24:MI'),
    'Centro Médico Bautista - Piso 3',
    'Dolor epigástrico recurrente y acidez nocturna',
    'Diagnóstico clínico de reflujo gastroesofágico y gastritis. Se indica Omeprazol 20mg en ayunas y se pide endoscopía alta.',
    'Realizada',
    SYSDATE - 40
);

-- Consulta 4: Dermatología (Pasada -> Realizada)
INSERT INTO consultas (id_especialidad, fecha_hora, lugar, motivo, notas_post, estado, fecha_creacion)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Dermatología' AND ROWNUM = 1),
    TO_TIMESTAMP(TO_CHAR(ADD_MONTHS(SYSDATE, -2), 'YYYY-MM') || '-28 17:00', 'YYYY-MM-DD HH24:MI'),
    'Clínica Dermatológica Integral',
    'Acné facial y revisión de lunares en espalda',
    'Se prescribe Adapaleno gel por la noche y fotoprotector toque seco FPS 50+. Lunares sin signos de atipia.',
    'Realizada',
    SYSDATE - 70
);

-- Consulta 5: Traumatología (Pasada -> Realizada)
INSERT INTO consultas (id_especialidad, fecha_hora, lugar, motivo, notas_post, estado, fecha_creacion)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Traumatología' AND ROWNUM = 1),
    TO_TIMESTAMP(TO_CHAR(ADD_MONTHS(SYSDATE, -1), 'YYYY-MM') || '-25 11:30', 'YYYY-MM-DD HH24:MI'),
    'Hospital Universitario - Traumatología',
    'Dolor agudo en hombro derecho post entrenamiento',
    'Tendinitis del supraespinoso. Se indican 10 sesiones de fisioterapia y kinesiología motora.',
    'Realizada',
    SYSDATE - 35
);

-- Consulta 6: Gastroenterología (Próxima en el mes actual)
INSERT INTO consultas (id_especialidad, fecha_hora, lugar, motivo, notas_post, estado, fecha_creacion)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Gastroenterología' AND ROWNUM = 1),
    TO_TIMESTAMP(TO_CHAR(SYSDATE + 7, 'YYYY-MM-DD') || ' 15:30', 'YYYY-MM-DD HH24:MI'),
    'Centro Médico Bautista - Piso 3',
    'Entrega y revisión de informe de endoscopía digestiva',
    NULL,
    'Programada',
    SYSDATE - 5
);

-- Consulta 7: Cardiología (Próxima el mes que viene)
INSERT INTO consultas (id_especialidad, fecha_hora, lugar, motivo, notas_post, estado, fecha_creacion)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Cardiología' AND ROWNUM = 1),
    TO_TIMESTAMP(TO_CHAR(ADD_MONTHS(SYSDATE, 1), 'YYYY-MM-DD') || ' 11:00', 'YYYY-MM-DD HH24:MI'),
    'Instituto Cardiovascular',
    'Ecocardiograma doppler y ergometría de control',
    NULL,
    'Programada',
    SYSDATE
);

COMMIT;

-- -------------------------------------------------------------------------
-- 5. DOCUMENTOS Y ESTUDIOS MÉDICOS
-- -------------------------------------------------------------------------
INSERT INTO documentos (id_especialidad, id_consulta, tipo, titulo, descripcion, nombre_archivo, ruta_archivo, fecha_documento, fecha_carga)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Cardiología' AND ROWNUM = 1),
    NULL,
    'Estudio',
    'Electrocardiograma de Reposo',
    'Ritmo sinusal normal, frecuencia cardíaca 72 lpm. Sin signos de isquemia.',
    'ecg_reposo_sept2026.pdf',
    'doc-ecg-sept2026.pdf',
    TRUNC(ADD_MONTHS(SYSDATE, -2)),
    SYSDATE - 55
);

INSERT INTO documentos (id_especialidad, id_consulta, tipo, titulo, descripcion, nombre_archivo, ruta_archivo, fecha_documento, fecha_carga)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Cardiología' AND ROWNUM = 1),
    NULL,
    'Receta',
    'Receta Médica - Losartán 50mg',
    'Tomar 1 comprimido cada 12 horas por 6 meses.',
    'receta_losartan_dra_gomez.pdf',
    'doc-receta-losartan.pdf',
    TRUNC(ADD_MONTHS(SYSDATE, -2)),
    SYSDATE - 55
);

INSERT INTO documentos (id_especialidad, id_consulta, tipo, titulo, descripcion, nombre_archivo, ruta_archivo, fecha_documento, fecha_carga)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Gastroenterología' AND ROWNUM = 1),
    NULL,
    'Estudio',
    'Informe de Video Endoscopía Digestiva Alta',
    'Mucosa gástrica con eritema moderado en antro. Esófago y duodeno sin lesiones.',
    'endoscopia_digestiva_alta.pdf',
    'doc-endoscopia-oct2026.pdf',
    TRUNC(ADD_MONTHS(SYSDATE, -1)),
    SYSDATE - 20
);

INSERT INTO documentos (id_especialidad, id_consulta, tipo, titulo, descripcion, nombre_archivo, ruta_archivo, fecha_documento, fecha_carga)
VALUES (
    (SELECT id_especialidad FROM especialidades WHERE nombre = 'Traumatología' AND ROWNUM = 1),
    NULL,
    'Indicación',
    'Plan de Rehabilitación Kinésica',
    '10 sesiones de magnetoterapia, ultrasonido y ejercicios de fortalecimiento escapular.',
    'orden_kinesiologia_hombro.pdf',
    'doc-orden-kinesio.pdf',
    TRUNC(ADD_MONTHS(SYSDATE, -1)),
    SYSDATE - 24
);

COMMIT;

-- -------------------------------------------------------------------------
-- 6. ALERTAS PROGRAMADAS (Sin spam, espaciadas correctamente)
-- -------------------------------------------------------------------------
INSERT INTO alertas (tipo, id_referencia, id_consulta, id_medicamento, nombre_med, descripcion, canal, destinatario, frecuencia_hs, proximo_envio, total_envios, fecha_fin, envios_realizados, activa)
VALUES (
    'medicacion',
    (SELECT id_medicamento FROM medicamentos WHERE nombre LIKE 'Losartán%' AND ROWNUM = 1),
    NULL,
    (SELECT id_medicamento FROM medicamentos WHERE nombre LIKE 'Losartán%' AND ROWNUM = 1),
    'Losartán 50mg',
    'Tomar 1 comprimido (con desayuno y cena)',
    'ambos',
    'pmburgos005@gmail.com',
    12,
    SYSTIMESTAMP + NUMTODSINTERVAL(12, 'HOUR'),
    240,
    SYSTIMESTAMP + NUMTODSINTERVAL(120, 'DAY'),
    2,
    1
);

INSERT INTO alertas (tipo, id_referencia, id_consulta, id_medicamento, nombre_med, descripcion, canal, destinatario, frecuencia_hs, proximo_envio, total_envios, fecha_fin, envios_realizados, activa)
VALUES (
    'medicacion',
    (SELECT id_medicamento FROM medicamentos WHERE nombre LIKE 'Omeprazol%' AND ROWNUM = 1),
    NULL,
    (SELECT id_medicamento FROM medicamentos WHERE nombre LIKE 'Omeprazol%' AND ROWNUM = 1),
    'Omeprazol 20mg',
    'Tomar 1 cápsula en ayunas',
    'ambos',
    'pmburgos005@gmail.com',
    24,
    SYSTIMESTAMP + NUMTODSINTERVAL(20, 'HOUR'),
    30,
    SYSTIMESTAMP + NUMTODSINTERVAL(20, 'DAY'),
    10,
    1
);

INSERT INTO alertas (tipo, id_referencia, id_consulta, id_medicamento, nombre_med, descripcion, canal, destinatario, frecuencia_hs, proximo_envio, total_envios, fecha_fin, envios_realizados, activa)
VALUES (
    'consulta',
    (SELECT id_consulta FROM consultas WHERE estado = 'Programada' AND ROWNUM = 1),
    (SELECT id_consulta FROM consultas WHERE estado = 'Programada' AND ROWNUM = 1),
    NULL,
    NULL,
    'Turno de Gastroenterología para entrega de endoscopía',
    'ambos',
    'pmburgos005@gmail.com',
    24,
    SYSTIMESTAMP + NUMTODSINTERVAL(6, 'DAY'),
    1,
    NULL,
    0,
    1
);

COMMIT;

-- =========================================================================
-- VERIFICACIÓN FINAL DE DATOS CARGADOS
-- =========================================================================
SELECT 'Especialidades activas: ' || COUNT(*) FROM especialidades WHERE activa = 1;
SELECT 'Consultas totales: ' || COUNT(*) FROM consultas;
SELECT 'Documentos cargados: ' || COUNT(*) FROM documentos;
SELECT 'Medicamentos activos: ' || COUNT(*) FROM medicamentos WHERE activo = 1;
SELECT 'Alertas programadas: ' || COUNT(*) FROM alertas WHERE activa = 1;

