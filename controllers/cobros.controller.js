// controllers/cobros.controller.js
const { Cobro, Cliente, Servicio } = require('../models'); // Importa los modelos necesarios
const { Op } = require('sequelize'); // Para filtros más complejos

console.log(' C Cargando controlador de Cobros...');

// --- Listar todos los Cobros (con filtros opcionales) ---
const listarCobros = async (req, res, next) => {
  console.log(' C Controlador: Petición GET a /api/cobros recibida.');
  try {
    // Opcional: Aquí podrías añadir lógica para filtros basados en query params
    // ej: /api/cobros?estado=Pendiente&clienteId=5
    const whereClause = {};
    if (req.query.estado) {
        whereClause.estado_cobro = req.query.estado;
        console.log(` C Filtrando cobros por estado: ${req.query.estado}`);
    }
    if (req.query.clienteId) {
        whereClause.cliente_id = req.query.clienteId;
        console.log(` C Filtrando cobros por cliente ID: ${req.query.clienteId}`);
    }
    // Añadir más filtros si es necesario (fechas, etc.)

    const cobros = await Cobro.findAll({
      where: whereClause, // Aplicar filtros si existen
      include: [ // Incluir datos de las tablas relacionadas
        {
          model: Cliente,
          as: 'cliente', // Alias definido en models/index.js
          attributes: ['id', 'nombre_cliente'] // Solo traer ID y nombre del cliente
        },
        {
          model: Servicio,
          as: 'servicio', // Alias definido en models/index.js
          attributes: ['id', 'nombre_servicio'], // Solo traer ID y nombre del servicio
          required: false // Hacerlo opcional por si servicio_id es null
        }
      ],
      order: [['fecha_vencimiento', 'DESC']] // Ordenar por fecha de vencimiento descendente (opcional)
    });
    console.log(' C Cobros encontrados:', cobros.length);
    res.status(200).json(cobros);
  } catch (error) {
    console.error(' C Error al listar cobros:', error);
    next(error);
  }
};

// --- Obtener un Cobro por ID ---
const obtenerCobro = async (req, res, next) => {
  const cobroId = req.params.id;
  console.log(` C Controlador: Petición GET a /api/cobros/${cobroId} recibida.`);
  try {
    const cobro = await Cobro.findByPk(cobroId, {
      include: [ // Incluir también datos relacionados al ver uno específico
        { model: Cliente, as: 'cliente' }, // Traer todos los datos del cliente
        { model: Servicio, as: 'servicio', required: false } // Traer todos los datos del servicio (opcional)
      ]
    });
    if (!cobro) {
      console.log(` C Cobro con ID ${cobroId} no encontrado.`);
      return res.status(404).json({ message: 'Cobro no encontrado.' });
    }
    console.log(' C Cobro encontrado:', cobro.id);
    res.status(200).json(cobro);
  } catch (error) {
    console.error(` C Error al obtener cobro ${cobroId}:`, error);
    next(error);
  }
};

// --- Crear un nuevo Cobro ---
const crearCobro = async (req, res, next) => {
  const datosCobro = req.body;
  console.log(' C Controlador: Petición POST a /api/cobros recibida. Datos:', datosCobro);
  try {
    // Validaciones básicas (añadir más según necesidad)
    if (!datosCobro.cliente_id || !datosCobro.monto || !datosCobro.fecha_emision || !datosCobro.fecha_vencimiento) {
      console.log(' C Error: Faltan datos requeridos para crear cobro.');
      return res.status(400).json({ message: 'Faltan datos requeridos (cliente, monto, fechas).' });
    }
    // Podrías verificar si el cliente_id existe antes de crear

    const nuevoCobro = await Cobro.create(datosCobro);
    console.log(' C Nuevo cobro creado con ID:', nuevoCobro.id);
    // Devolver el cobro creado, quizás con la info relacionada incluida
     const cobroCreadoConInfo = await Cobro.findByPk(nuevoCobro.id, {
         include: [
             { model: Cliente, as: 'cliente', attributes: ['id', 'nombre_cliente'] },
             { model: Servicio, as: 'servicio', attributes: ['id', 'nombre_servicio'], required: false }
         ]
     });
    res.status(201).json(cobroCreadoConInfo);
  } catch (error) {
     // Manejar errores (ej: cliente_id inválido si hay FK constraint)
     if (error.name === 'SequelizeForeignKeyConstraintError') {
        console.error(' C Error de clave foránea al crear cobro:', error.message);
         return res.status(400).json({ message: 'Error al crear cobro: El cliente o servicio especificado no existe.' });
     }
     if (error.name === 'SequelizeValidationError') {
         console.error(' C Error de validación de Sequelize:', error.errors.map(e => e.message));
         return res.status(400).json({ message: 'Datos inválidos.', errors: error.errors.map(e => e.message) });
     }
    console.error(' C Error al crear cobro:', error);
    next(error);
  }
};

// --- Actualizar un Cobro existente ---
const actualizarCobro = async (req, res, next) => {
  const cobroId = req.params.id;
  const datosActualizar = req.body;
  console.log(` C Controlador: Petición PUT a /api/cobros/${cobroId} recibida. Datos:`, datosActualizar);
  try {
    const cobro = await Cobro.findByPk(cobroId);
    if (!cobro) {
      console.log(` C Cobro con ID ${cobroId} no encontrado para actualizar.`);
      return res.status(404).json({ message: 'Cobro no encontrado.' });
    }

    // Lógica especial: Si se actualiza el estado a 'Pagado', registrar fecha_pago si no viene
    if (datosActualizar.estado_cobro === 'Pagado' && !datosActualizar.fecha_pago) {
        console.log(` C Marcando cobro ${cobroId} como pagado. Estableciendo fecha_pago a hoy.`);
        datosActualizar.fecha_pago = new Date(); // Pone la fecha actual
    } else if (datosActualizar.estado_cobro !== 'Pagado' && datosActualizar.fecha_pago === undefined) {
        // Si se cambia a otro estado y no se especifica fecha_pago, limpiarla (opcional)
        // datosActualizar.fecha_pago = null;
    }


    await cobro.update(datosActualizar);
    console.log(` C Cobro con ID ${cobroId} actualizado.`);

    // Devolver el cobro actualizado con info relacionada
    const cobroActualizadoConInfo = await Cobro.findByPk(cobroId, {
         include: [
             { model: Cliente, as: 'cliente', attributes: ['id', 'nombre_cliente'] },
             { model: Servicio, as: 'servicio', attributes: ['id', 'nombre_servicio'], required: false }
         ]
     });

    res.status(200).json(cobroActualizadoConInfo);
  } catch (error) {
     if (error.name === 'SequelizeForeignKeyConstraintError') {
        console.error(' C Error de clave foránea al actualizar cobro:', error.message);
         return res.status(400).json({ message: 'Error al actualizar cobro: El cliente o servicio especificado no existe.' });
     }
      if (error.name === 'SequelizeValidationError') {
         console.error(' C Error de validación de Sequelize:', error.errors.map(e => e.message));
         return res.status(400).json({ message: 'Datos inválidos.', errors: error.errors.map(e => e.message) });
     }
    console.error(` C Error al actualizar cobro ${cobroId}:`, error);
    next(error);
  }
};

// --- Eliminar un Cobro ---
const eliminarCobro = async (req, res, next) => {
  const cobroId = req.params.id;
  console.log(` C Controlador: Petición DELETE a /api/cobros/${cobroId} recibida.`);
  try {
    const cobro = await Cobro.findByPk(cobroId);
    if (!cobro) {
      console.log(` C Cobro con ID ${cobroId} no encontrado para eliminar.`);
      return res.status(404).json({ message: 'Cobro no encontrado.' });
    }

    await cobro.destroy();
    console.log(` C Cobro con ID ${cobroId} eliminado.`);
    res.status(204).send(); // Éxito sin contenido
  } catch (error) {
    console.error(` C Error al eliminar cobro ${cobroId}:`, error);
    next(error);
  }
};

// Exportar las funciones
module.exports = {
  listarCobros,
  obtenerCobro,
  crearCobro,
  actualizarCobro,
  eliminarCobro
};

console.log(' C Controlador de Cobros cargado.');