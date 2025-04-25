-- Crear usuario con privilegios
CREATE USER 'pegasus_user'@'localhost' IDENTIFIED BY 'pegasus_password';
GRANT ALL PRIVILEGES ON pegasus_cobros.* TO 'pegasus_user'@'localhost';
FLUSH PRIVILEGES;

-- Crear la base de datos
CREATE DATABASE pegasus_cobros CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;
USE pegasus_cobros;

-- Tabla de roles
CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
) ENGINE=InnoDB COMMENT='Almacena los roles de los usuarios del sistema';

-- Tabla de usuarios 
CREATE TABLE usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre_usuario VARCHAR(100) NOT NULL UNIQUE,
    correo_electronico VARCHAR(255) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL COMMENT 'Guardar siempre hash de la contraseña, NUNCA texto plano',
    nombre_completo VARCHAR(200),
    rol_id INT UNSIGNED NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'TRUE si el usuario está activo, FALSE si está desactivado',
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultima_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB COMMENT='Almacena la información de los usuarios del sistema';

-- Tabla de clientes
CREATE TABLE clientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre_cliente VARCHAR(255) NOT NULL,
    ruc_dni VARCHAR(20) UNIQUE COMMENT 'RUC o DNI del cliente',
    telefono VARCHAR(50),
    correo_electronico VARCHAR(255),
    direccion TEXT,
    estado_cliente ENUM('Activo', 'Inactivo', 'Pendiente', 'Atrasado') NOT NULL DEFAULT 'Activo' 
        COMMENT 'Estado general del cliente, podría derivarse de sus pagos',
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultima_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Almacena la información de los clientes';

-- Tabla de servicios
CREATE TABLE servicios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre_servicio VARCHAR(150) NOT NULL UNIQUE,
    descripcion TEXT,
    precio_base DECIMAL(10, 2) COMMENT 'Precio estándar del servicio si aplica'
) ENGINE=InnoDB COMMENT='Catálogo de servicios ofrecidos';

-- Tabla de cobros
CREATE TABLE cobros (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT UNSIGNED NOT NULL,
    servicio_id INT UNSIGNED,
    descripcion_servicio_personalizado VARCHAR(255) COMMENT 'Para el caso de servicio Otro o descripción específica',
    monto DECIMAL(10, 2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN' COMMENT 'Código ISO de la moneda (Ej: PEN, USD)',
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado_cobro ENUM('Pagado', 'Pendiente', 'Atrasado', 'Anulado') NOT NULL DEFAULT 'Pendiente',
    fecha_pago DATE COMMENT 'Fecha en que se registró el pago',
    metodo_pago VARCHAR(100) COMMENT 'Ej: Transferencia, Efectivo, Yape, Plin',
    numero_referencia VARCHAR(100) COMMENT 'Número de operación, ID de transacción, etc.',
    notas TEXT,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultima_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Registros de cobros emitidos a los clientes';

-- Tabla de configuraciones
CREATE TABLE configuraciones (
    clave VARCHAR(100) PRIMARY KEY,
    valor TEXT,
    descripcion VARCHAR(255),
    ultima_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Almacena configuraciones generales del sistema';

-- Insertar roles básicos
INSERT INTO roles (nombre_rol, descripcion) VALUES 
('Administrador', 'Control total del sistema'),
('Usuario', 'Acceso limitado al sistema');

-- Insertar usuarios con contraseñas correctamente hasheadas
INSERT INTO usuarios (nombre_usuario, correo_electronico, contrasena_hash, nombre_completo, rol_id, activo) VALUES 
('admin', 'admin@pegasus.com', '$2a$10$dsuJdEc5i24HdXLuyaW6KuEs6n9OlonhTJOdVC4VA.zMByWffpt86', 'Administrador Sistema', 1, TRUE),
('usuario', 'usuario@pegasus.com', '$2a$10$k8llLzfEfpe7bCQ2Qz6hC.ewoJJKCWKkRbcKENev3HkKX56o.AsY.', 'Usuario Estándar', 2, TRUE);

-- Insertar servicios
INSERT INTO servicios (nombre_servicio, descripcion, precio_base) VALUES 
('Monitoreo GPS', 'Servicio de monitoreo GPS para vehículos y flotas', 800.00),
('Mantenimiento', 'Servicio de mantenimiento técnico preventivo y correctivo', 1200.00),
('Consultoría', 'Servicio de asesoría y consultoría empresarial', 2000.00),
('Soporte Técnico', 'Asistencia técnica y resolución de problemas', 500.00),
('Desarrollo Web', 'Desarrollo de sitios web y aplicaciones personalizadas', 3500.00);

-- Insertar clientes
INSERT INTO clientes (nombre_cliente, ruc_dni, telefono, correo_electronico, direccion, estado_cliente) VALUES 
('Transportes San Mateo', '20123456789', '+51 949205558', 'info@transportesanmateo.com', 'Av. La Marina 123, Lima', 'Activo'),
('Comercial Andina', '20555666777', '+51 945678123', 'ventas@comercialandina.com', 'Jr. Huallaga 456, Lima', 'Activo'),
('Logística Express', '20444333222', '+51 987654321', 'contacto@logisticaexpress.pe', 'Av. Argentina 789, Callao', 'Pendiente'),
('Distribuidora Central', '10998877665', '+51 912345678', 'admin@distribuidoracentral.com', 'Av. Colonial 1020, Lima', 'Activo'),
('Constructora Pacífico', '20111222333', '+51 923456789', 'proyectos@constructorapacifico.com', 'Av. Javier Prado 550, Lima', 'Inactivo');

-- Insertar cobros
INSERT INTO cobros (cliente_id, servicio_id, monto, moneda, fecha_emision, fecha_vencimiento, estado_cobro, notas) VALUES 
(1, 1, 1600.00, 'PEN', '2025-04-01', '2025-04-20', 'Atrasado', 'Servicio de monitoreo GPS para 20 unidades'),
(2, 1, 800.00, 'PEN', '2025-04-05', '2025-04-25', 'Pagado', 'Servicio de monitoreo GPS para 10 unidades'),
(2, 2, 1200.00, 'PEN', '2025-04-05', '2025-04-25', 'Pendiente', 'Mantenimiento programado trimestral'),
(3, 2, 1200.00, 'PEN', '2025-04-02', '2025-04-22', 'Atrasado', 'Mantenimiento de equipos'),
(4, 3, 2000.00, 'PEN', '2025-04-01', '2025-04-15', 'Pagado', 'Servicio de consultoría empresarial'),
(5, 1, 500.00, 'PEN', '2025-04-10', '2025-04-30', 'Pendiente', 'Soporte técnico mensual');

-- Insertar configuraciones básicas
INSERT INTO configuraciones (clave, valor, descripcion) VALUES
('empresa_nombre', 'PEGASUS S.A.C.', 'Nombre de la empresa'),
('empresa_direccion', 'Av. Principal 123, Lima', 'Dirección de la empresa'),
('empresa_telefono', '+51 123456789', 'Teléfono de contacto'),
('empresa_correo', 'info@pegasus.com', 'Correo electrónico de contacto'),
('moneda_defecto', 'PEN', 'Moneda por defecto'),
('dias_alerta_vencimiento', '5', 'Días antes para alertar vencimiento'),
('recordatorio_whatsapp', 'true', 'Enviar recordatorios por WhatsApp'),
('logo_url', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNDY1IDEwMjQiPjxzdHlsZT4uc3QwLC5zdDF7ZmlsbDojNGE2ZGE3fTwvc3R5bGU+PHBhdGggY2xhc3M9InN0MCIgZD0iTTY0MyAyMDhoNTIzdjY0SDY0M3oiLz48cGF0aCBjbGFzcz0ic3QwIiBkPSJNNjQzIDI0MGgzNTJWMzA0SDY0M3pNNjQzIDMwNGgzNTJWMzY4SDY0M3pNOTk1IDQzMmgxNzF2NjRIOTk1ek03MTUgNDMyaDE3MXY2NEg3MTV6TTY0MyA0OTZoMzUyVjU2MEg2NDN6TTY0MyA1NjBoNTIzdjY0SDY0M3pNNzE1IDYyNGgyNzl2NjRINzE1eiIvPjxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0zMTEgNjA2czE1OC0xMzQgMjkwIDE4YzE1MyA0Ni04MSAxMTgtODEgMTE4cy0xNTQgNzYtMjM5LTUyYy0zNi02OCAxOS0xMTEgMzAtODR6Ii8+PHBhdGggY2xhc3M9InN0MCIgZD0iTTQ4MiA1MDYgMzExIDYwNnMxMDAtNDIgMTcxLTEwMHoiLz48cGF0aCBjbGFzcz0ic3QxIiBkPSJNNjg1IDU3OXMxNTgtMTM0IDI5MCAxOGMxNTMgNDYtODEgMTE4LTgxIDExOHMtMTU0IDc2LTIzOS01MmMtMzYtNjggMTktMTExIDMwLTg0eiIvPjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04NTYgNDc5IDY4NSA1Nzlz MTAwLTQyIDE3MS0xMDB6Ii8+PHBhdGggY2xhc3M9InN0MSIgZD0iTTQ5OCA3OTBzMTU4LTEzNCAyOTAgMThjMTUzIDQ2LTgxIDExOC04MSAxMThzLTE1NCA3Ni0yMzktNTJjLTM2LTY4IDE5LTExMSAzMC04NHoiLz48cGF0aCBjbGFzcz0ic3QwIiBkPSJNNjY5IDY5MCA0OTggNzkwczEwMC00MiAxNzEtMTAweiIvPjwvc3ZnPg==', 'Logo de la empresa en base64'),
('color_primario', '#4a6da7', 'Color primario del sistema'),
('color_secundario', '#f8f9fa', 'Color secundario del sistema');