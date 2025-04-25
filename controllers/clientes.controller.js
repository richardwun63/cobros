// controllers/clientes.controller.js
const { Cliente, Cobro, Servicio } = require('../models'); // Importar modelos necesarios
const { Op } = require('sequelize'); // Importar operadores de Sequelize

console.log(' C Cargando controlador de Clientes...');

// --- Listar todos los Clientes ---
const listarClientes = async (req, res, next) => {
  console.log(' C Controlador: Petición GET a /api/clientes recibida.');
  try {
    // Configurar opciones de búsqueda iniciales
    const options = {
      order: [['nombre_cliente', 'ASC']] // Ordenar alfabéticamente por nombre
    };
    
    // Procesar parámetros de filtro de la consulta
    const whereClause = {};
    
    // Filtro por nombre
    if (req.query.nombre) {
      whereClause.nombre_cliente = {
        [Op.like]: `%${req.query.nombre}%`
      };
      console.log(` C Filtrando clientes por nombre: ${req.query.nombre}`);
    }
    
    // Filtro por estado
    if (req.query.estado && req.query.estado !== 'all') {
      whereClause.estado_cliente = req.query.estado;
      console.log(` C Filtrando clientes por estado: ${req.query.estado}`);
    }
    
    // Filtro por RUC/DNI
    if (req.query.ruc_dni) {
      whereClause.ruc_dni = {
        [Op.like]: `%${req.query.ruc_dni}%`
      };
      console.log(` C Filtrando clientes por RUC/DNI: ${req.query.ruc_dni}`);
    }
    
    // Aplicar filtros si existen
    if (Object.keys(whereClause).length > 0) {
      options.where = whereClause;
    }
    
    // Implementar paginación
    if (req.query.page && !isNaN(parseInt(req.query.page))) {
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit) || 10; // Límite por defecto: 10
      
      // No usar marcadores de posición para LIMIT/OFFSET en MySQL 8.x
      options.limit = limit;
      options.offset = (page - 1) * limit;
      
      console.log(` C Aplicando paginación: página ${page}, límite ${limit}`);
    }
    
    const clientes = await Cliente.findAll(options);
    
    // Si se solicita la página 1 o ninguna, también devolver el conteo total
    let totalCount = null;
    if (!req.query.page || req.query.page === '1') {
      totalCount = await Cliente.count({
        where: options.where // Aplicar mismos filtros al conteo
      });
    }
    
    console.log(' C Clientes encontrados:', clientes.length);
    
    // Respuesta con metadatos para paginación
    const response = {
      clientes,
      meta: totalCount !== null ? {
        totalCount,
        filteredCount: clientes.length
      } : undefined
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error(' C Error al listar clientes:', error);
    next(error); // Pasar error al manejador central
  }
};

// --- Obtener un Cliente por ID ---
const obtenerCliente = async (req, res, next) => {
  const clienteId = req.params.id;
  console.log(` C Controlador: Petición GET a /api/clientes/${clienteId} recibida.`);
  try {
    // Buscar cliente con sus cobros asociados
    const cliente = await Cliente.findByPk(clienteId, {
      include: [{
        model: Cobro,
        as: 'cobros',
        include: [{
          model: Servicio,
          as: 'servicio',
          required: false
        }]
      }]
    });
    
    if (!cliente) {
      console.log(` C Cliente con ID ${clienteId} no encontrado.`);
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    
    console.log(' C Cliente encontrado:', cliente.nombre_cliente);
    res.status(200).json(cliente);
  } catch (error) {
    console.error(` C Error al obtener cliente ${clienteId}:`, error);
    next(error);
  }
};

// --- Crear un nuevo Cliente ---
const crearCliente = async (req, res, next) => {
  const datosCliente = req.body;
  console.log(' C Controlador: Petición POST a /api/clientes recibida. Datos:', datosCliente);
  try {
    // Validación básica
    if (!datosCliente.nombre_cliente) {
      console.log(' C Error: Falta nombre_cliente para crear.');
      return res.status(400).json({ message: 'El nombre del cliente es requerido.' });
    }

    // Asegurarse de que el campo estado_cliente tiene un valor válido
    if (!datosCliente.estado_cliente) {
      datosCliente.estado_cliente = 'Activo'; // Valor por defecto si no se proporciona
    }

    // Validar si el RUC/DNI ya existe (si se proporciona)
    if (datosCliente.ruc_dni) {
      const clienteExistente = await Cliente.findOne({
        where: { ruc_dni: datosCliente.ruc_dni }
      });
      
      if (clienteExistente) {
        console.log(` C Error: RUC/DNI '${datosCliente.ruc_dni}' ya existe.`);
        return res.status(409).json({ 
          message: 'Error al crear cliente: El RUC/DNI ya existe.',
          field: 'ruc_dni'
        });
      }
    }

    const nuevoCliente = await Cliente.create(datosCliente);
    console.log(' C Nuevo cliente creado con ID:', nuevoCliente.id);
    
    // 201 Created: Indica que se creó un recurso
    res.status(201).json(nuevoCliente);
  } catch (error) {
    // Manejo de errores específicos
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error(' C Error de restricción única al crear cliente:', error.errors[0].message);
      return res.status(409).json({ 
        message: 'Error al crear cliente: El RUC/DNI ya existe o hay otro campo duplicado.',
        field: error.errors[0].path
      });
    }
    
    if (error.name === 'SequelizeValidationError') {
      console.error(' C Error de validación:', error.errors.map(e => e.message));
      return res.status(400).json({ 
        message: 'Datos inválidos.', 
        errors: error.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    
    console.error(' C Error al crear cliente:', error);
    next(error);
  }
};

// --- Actualizar un Cliente existente ---
const actualizarCliente = async (req, res, next) => {
  const clienteId = req.params.id;
  const datosActualizar = req.body;
  console.log(` C Controlador: Petición PUT a /api/clientes/${clienteId} recibida. Datos:`, datosActualizar);
  try {
    const cliente = await Cliente.findByPk(clienteId);
    if (!cliente) {
      console.log(` C Cliente con ID ${clienteId} no encontrado para actualizar.`);
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }

    // Verificar si se intenta actualizar RUC/DNI a uno que ya existe
    if (datosActualizar.ruc_dni && datosActualizar.ruc_dni !== cliente.ruc_dni) {
      const clienteExistente = await Cliente.findOne({
        where: { 
          ruc_dni: datosActualizar.ruc_dni,
          id: { [Op.ne]: clienteId } // Asegurarse de no contar al propio cliente
        }
      });
      
      if (clienteExistente) {
        console.log(` C Error: RUC/DNI '${datosActualizar.ruc_dni}' ya existe para otro cliente.`);
        return res.status(409).json({ 
          message: 'Error al actualizar cliente: El RUC/DNI ya existe para otro cliente.',
          field: 'ruc_dni'
        });
      }
    }

    // Actualizar los campos del cliente con los datos recibidos
    await cliente.update(datosActualizar);

    console.log(` C Cliente con ID ${clienteId} actualizado.`);
    
    // Obtener el cliente actualizado con sus relaciones
    const clienteActualizado = await Cliente.findByPk(clienteId, {
      include: [{
        model: Cobro,
        as: 'cobros',
        include: [{
          model: Servicio,
          as: 'servicio',
          required: false
        }]
      }]
    });
    
    res.status(200).json(clienteActualizado);
  } catch (error) {
    // Manejo de errores específicos
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error(' C Error de restricción única al actualizar cliente:', error.errors[0].message);
      return res.status(409).json({ 
        message: 'Error al actualizar cliente: El RUC/DNI ya existe para otro cliente.',
        field: error.errors[0].path
      });
    }
    
    if (error.name === 'SequelizeValidationError') {
      console.error(' C Error de validación:', error.errors.map(e => e.message));
      return res.status(400).json({ 
        message: 'Datos inválidos.', 
        errors: error.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    
    console.error(` C Error al actualizar cliente ${clienteId}:`, error);
    next(error);
  }
};

// --- Eliminar un Cliente ---
const eliminarCliente = async (req, res, next) => {
  const clienteId = req.params.id;
  console.log(` C Controlador: Petición DELETE a /api/clientes/${clienteId} recibida.`);
  try {
    // Verificar si existe el cliente
    const cliente = await Cliente.findByPk(clienteId);
    if (!cliente) {
      console.log(` C Cliente con ID ${clienteId} no encontrado para eliminar.`);
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }

    // Verificar si tiene cobros asociados
    const cobroCount = await Cobro.count({
      where: { cliente_id: clienteId }
    });
    
    if (cobroCount > 0) {
      console.error(` C Error: Cliente ${clienteId} tiene ${cobroCount} cobros asociados.`);
      return res.status(409).json({ 
        message: `No se puede eliminar el cliente porque tiene ${cobroCount} cobros asociados.`,
        cobroCount
      });
    }

    // Eliminar el cliente
    await cliente.destroy();
    console.log(` C Cliente con ID ${clienteId} eliminado.`);
    
    // 204 No Content: Indica éxito sin cuerpo de respuesta
    res.status(204).send();
  } catch (error) {
    // Manejo de errores de restricción
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      console.error(' C Error de restricción de clave foránea al eliminar cliente:', error.message);
      return res.status(409).json({ 
        message: 'No se puede eliminar el cliente porque tiene cobros asociados.' 
      });
    }
    
    console.error(` C Error al eliminar cliente ${clienteId}:`, error);
    next(error);
  }
};

// --- Obtener Servicios de un Cliente ---
const obtenerServiciosCliente = async (req, res, next) => {
  const clienteId = req.params.id;
  console.log(` C Controlador: Petición GET a /api/clientes/${clienteId}/servicios recibida.`);
  
  try {
    // Verificar si existe el cliente
    const cliente = await Cliente.findByPk(clienteId);
    if (!cliente) {
      console.log(` C Cliente con ID ${clienteId} no encontrado.`);
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    
    // Buscar cobros del cliente para extraer los servicios
    const cobros = await Cobro.findAll({
      where: { cliente_id: clienteId },
      include: [{
        model: Servicio,
        as: 'servicio',
        required: false
      }]
    });
    
    // Extraer servicios únicos del cliente
    const serviciosMap = new Map();
    
    cobros.forEach(cobro => {
      // Agregar servicio regular si existe
      if (cobro.servicio) {
        serviciosMap.set(cobro.servicio.id, cobro.servicio);
      }
      
      // Agregar servicio personalizado si existe
      if (cobro.descripcion_servicio_personalizado && !cobro.servicio_id) {
        const servicioPersonalizado = {
          id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          nombre_servicio: cobro.descripcion_servicio_personalizado,
          esPersonalizado: true
        };
        serviciosMap.set(servicioPersonalizado.id, servicioPersonalizado);
      }
    });
    
    // Convertir Map a Array
    const servicios = Array.from(serviciosMap.values());
    
    console.log(` C Se encontraron ${servicios.length} servicios para el cliente ${clienteId}`);
    res.status(200).json(servicios);
    
  } catch (error) {
    console.error(` C Error al obtener servicios del cliente ${clienteId}:`, error);
    next(error);
  }
};

// Exportar todas las funciones del controlador
module.exports = {
  listarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  obtenerServiciosCliente
};

console.log(' C Controlador de Clientes cargado.');