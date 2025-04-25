// controllers/servicios.controller.js
const { Servicio, Cobro, Cliente } = require('../models'); // Importa modelos necesarios
const { Op } = require('sequelize'); // Para filtros más complejos

console.log(' C Cargando controlador de Servicios...');

// --- Listar todos los Servicios ---
const listarServicios = async (req, res, next) => {
  console.log(' C Controlador: Petición GET a /api/servicios recibida.');
  try {
    // Configurar opciones de búsqueda
    const options = {
      order: [['nombre_servicio', 'ASC']] // Ordenar alfabéticamente
    };
    
    // Procesar parámetros de filtro de la consulta
    const whereClause = {};
    
    // Filtro por nombre
    if (req.query.nombre) {
      whereClause.nombre_servicio = {
        [Op.like]: `%${req.query.nombre}%`
      };
      console.log(` C Filtrando servicios por nombre: ${req.query.nombre}`);
    }
    
    // Filtro por precio mínimo
    if (req.query.precioMin && !isNaN(parseFloat(req.query.precioMin))) {
      whereClause.precio_base = {
        ...whereClause.precio_base,
        [Op.gte]: parseFloat(req.query.precioMin)
      };
      console.log(` C Filtrando servicios por precio mínimo: ${req.query.precioMin}`);
    }
    
    // Filtro por precio máximo
    if (req.query.precioMax && !isNaN(parseFloat(req.query.precioMax))) {
      whereClause.precio_base = {
        ...whereClause.precio_base,
        [Op.lte]: parseFloat(req.query.precioMax)
      };
      console.log(` C Filtrando servicios por precio máximo: ${req.query.precioMax}`);
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
    
    const servicios = await Servicio.findAll(options);
    
    // Si se solicita la página 1 o ninguna, también devolver el conteo total
    let totalCount = null;
    if (!req.query.page || req.query.page === '1') {
      totalCount = await Servicio.count({
        where: options.where // Aplicar mismos filtros al conteo
      });
    }
    
    console.log(' C Servicios encontrados:', servicios.length);
    
    // Respuesta con metadatos para paginación
    const response = {
      servicios,
      meta: totalCount !== null ? {
        totalCount,
        filteredCount: servicios.length
      } : undefined
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error(' C Error al listar servicios:', error);
    next(error);
  }
};

// --- Obtener un Servicio por ID ---
const obtenerServicio = async (req, res, next) => {
  const servicioId = req.params.id;
  console.log(` C Controlador: Petición GET a /api/servicios/${servicioId} recibida.`);
  try {
    // Buscar servicio con información sobre cobros relacionados
    const servicio = await Servicio.findByPk(servicioId, {
      include: [{
        model: Cobro,
        as: 'cobros_asociados',
        limit: 5, // Limitar para no sobrecargar la respuesta
        order: [['fecha_emision', 'DESC']], // Más recientes primero
        include: [{
          model: Cliente,
          as: 'cliente',
          attributes: ['id', 'nombre_cliente']
        }]
      }]
    });
    
    if (!servicio) {
      console.log(` C Servicio con ID ${servicioId} no encontrado.`);
      return res.status(404).json({ message: 'Servicio no encontrado.' });
    }
    
    console.log(' C Servicio encontrado:', servicio.nombre_servicio);
    
    // Contar cuántos clientes han contratado este servicio
    const clientesCount = await Cobro.count({
      where: { servicio_id: servicioId },
      distinct: true,
      col: 'cliente_id'
    });
    
    // Contar cobros activos (pendientes o atrasados)
    const cobrosActivosCount = await Cobro.count({
      where: { 
        servicio_id: servicioId,
        estado_cobro: {
          [Op.in]: ['Pendiente', 'Atrasado']
        } 
      }
    });
    
    // Añadir estadísticas al objeto de respuesta
    const respuesta = servicio.toJSON();
    respuesta.estadisticas = {
      clientesCount,
      cobrosActivosCount,
      totalCobros: await Cobro.count({ where: { servicio_id: servicioId } })
    };
    
    res.status(200).json(respuesta);
  } catch (error) {
    console.error(` C Error al obtener servicio ${servicioId}:`, error);
    next(error);
  }
};

// --- Crear un nuevo Servicio ---
const crearServicio = async (req, res, next) => {
  const datosServicio = req.body;
  console.log(' C Controlador: Petición POST a /api/servicios recibida. Datos:', datosServicio);
  try {
    // Validación básica
    if (!datosServicio.nombre_servicio) {
      console.log(' C Error: Falta nombre_servicio para crear.');
      return res.status(400).json({ message: 'El nombre del servicio es requerido.' });
    }

    // Validar precio base si está presente
    if (datosServicio.precio_base !== undefined) {
      const precio = parseFloat(datosServicio.precio_base);
      if (isNaN(precio) || precio < 0) {
        return res.status(400).json({ 
          message: 'El precio base debe ser un número positivo.', 
          field: 'precio_base'
        });
      }
      // Asegurar que sea un número en la BD
      datosServicio.precio_base = precio;
    }

    // Verificar si ya existe un servicio con el mismo nombre
    const servicioExistente = await Servicio.findOne({
      where: { nombre_servicio: datosServicio.nombre_servicio }
    });
    
    if (servicioExistente) {
      console.log(` C Error: Servicio con nombre '${datosServicio.nombre_servicio}' ya existe.`);
      return res.status(409).json({ 
        message: 'Error al crear servicio: El nombre del servicio ya existe.',
        field: 'nombre_servicio'
      });
    }

    const nuevoServicio = await Servicio.create(datosServicio);
    console.log(' C Nuevo servicio creado con ID:', nuevoServicio.id);
    
    res.status(201).json(nuevoServicio);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
       console.error(' C Error de restricción única al crear servicio:', error.errors[0].message);
       return res.status(409).json({ 
         message: 'Error al crear servicio: El nombre del servicio ya existe.',
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
    
    console.error(' C Error al crear servicio:', error);
    next(error);
  }
};

// --- Actualizar un Servicio existente ---
const actualizarServicio = async (req, res, next) => {
  const servicioId = req.params.id;
  const datosActualizar = req.body;
  console.log(` C Controlador: Petición PUT a /api/servicios/${servicioId} recibida. Datos:`, datosActualizar);
  try {
    const servicio = await Servicio.findByPk(servicioId);
    if (!servicio) {
      console.log(` C Servicio con ID ${servicioId} no encontrado para actualizar.`);
      return res.status(404).json({ message: 'Servicio no encontrado.' });
    }

    // Validar precio base si está presente
    if (datosActualizar.precio_base !== undefined) {
      const precio = parseFloat(datosActualizar.precio_base);
      if (isNaN(precio) || precio < 0) {
        return res.status(400).json({ 
          message: 'El precio base debe ser un número positivo.', 
          field: 'precio_base'
        });
      }
      // Asegurar que sea un número en la BD
      datosActualizar.precio_base = precio;
    }

    // No permitir cambiar el nombre si ya existe otro servicio con ese nombre
    if (datosActualizar.nombre_servicio && datosActualizar.nombre_servicio !== servicio.nombre_servicio) {
      const existeOtro = await Servicio.findOne({ 
        where: { 
          nombre_servicio: datosActualizar.nombre_servicio,
          id: { [Op.ne]: servicioId } // No contar el servicio actual
        }
      });
      
      if (existeOtro) {
        console.log(` C Error: Ya existe otro servicio con el nombre '${datosActualizar.nombre_servicio}'.`);
        return res.status(409).json({ 
          message: 'Error al actualizar: Ya existe otro servicio con ese nombre.',
          field: 'nombre_servicio'
        });
      }
    }

    await servicio.update(datosActualizar);
    console.log(` C Servicio con ID ${servicioId} actualizado.`);
    
    // Cargar el servicio actualizado con sus relaciones
    const servicioActualizado = await Servicio.findByPk(servicioId, {
      include: [{
        model: Cobro,
        as: 'cobros_asociados',
        limit: 5,
        order: [['fecha_emision', 'DESC']]
      }]
    });
    
    res.status(200).json(servicioActualizado);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error(' C Error de restricción única al actualizar servicio:', error.errors[0].message);
      return res.status(409).json({ 
        message: 'Error al actualizar: Violación de restricción única.', 
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
    
    console.error(` C Error al actualizar servicio ${servicioId}:`, error);
    next(error);
  }
};

// --- Eliminar un Servicio ---
const eliminarServicio = async (req, res, next) => {
  const servicioId = req.params.id;
  console.log(` C Controlador: Petición DELETE a /api/servicios/${servicioId} recibida.`);
  try {
    const servicio = await Servicio.findByPk(servicioId);
    if (!servicio) {
      console.log(` C Servicio con ID ${servicioId} no encontrado para eliminar.`);
      return res.status(404).json({ message: 'Servicio no encontrado.' });
    }

    // Verificar si hay cobros asociados antes de eliminar
    const cobrosAsociados = await Cobro.count({ where: { servicio_id: servicioId } });
    if (cobrosAsociados > 0) {
      console.log(` C No se puede eliminar servicio ${servicioId} porque tiene ${cobrosAsociados} cobros asociados.`);
      return res.status(409).json({ 
        message: `No se puede eliminar el servicio porque está asociado a ${cobrosAsociados} cobro(s).`,
        cobrosAsociados
      });
    }

    await servicio.destroy();
    console.log(` C Servicio con ID ${servicioId} eliminado.`);
    res.status(204).send();
  } catch (error) {
    // Manejar errores
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      console.error(' C Error de restricción de clave foránea al eliminar servicio:', error.message);
      return res.status(409).json({ 
        message: 'No se puede eliminar el servicio porque tiene registros asociados.'
      });
    }
    
    console.error(` C Error al eliminar servicio ${servicioId}:`, error);
    next(error);
  }
};

// --- Obtener estadísticas del servicio ---
const obtenerEstadisticasServicio = async (req, res, next) => {
  const servicioId = req.params.id;
  console.log(` C Controlador: Petición GET a /api/servicios/${servicioId}/estadisticas recibida.`);
  
  try {
    // Verificar si existe el servicio
    const servicio = await Servicio.findByPk(servicioId);
    if (!servicio) {
      console.log(` C Servicio con ID ${servicioId} no encontrado.`);
      return res.status(404).json({ message: 'Servicio no encontrado.' });
    }
    
    // Contar cobros por estado
    const [totalCobros, cobrosPagados, cobrosPendientes, cobrosAtrasados] = await Promise.all([
      Cobro.count({ where: { servicio_id: servicioId } }),
      Cobro.count({ where: { servicio_id: servicioId, estado_cobro: 'Pagado' } }),
      Cobro.count({ where: { servicio_id: servicioId, estado_cobro: 'Pendiente' } }),
      Cobro.count({ where: { servicio_id: servicioId, estado_cobro: 'Atrasado' } })
    ]);
    
    // Contar clientes únicos que han contratado este servicio
    const clientesUnicos = await Cobro.count({
      where: { servicio_id: servicioId },
      distinct: true,
      col: 'cliente_id'
    });
    
    // Calcular monto total facturado y cobrado
    const montoTotal = await Cobro.sum('monto', {
      where: { servicio_id: servicioId }
    }) || 0;
    
    const montoCobrado = await Cobro.sum('monto', {
      where: { 
        servicio_id: servicioId,
        estado_cobro: 'Pagado'
      }
    }) || 0;
    
    // Preparar respuesta
    const estadisticas = {
      totalCobros,
      cobrosPagados,
      cobrosPendientes,
      cobrosAtrasados,
      clientesUnicos,
      montoTotal: parseFloat(montoTotal).toFixed(2),
      montoCobrado: parseFloat(montoCobrado).toFixed(2),
      montoPendiente: parseFloat(montoTotal - montoCobrado).toFixed(2),
      porcentajeCobrado: totalCobros > 0 ? (cobrosPagados / totalCobros * 100).toFixed(2) : "0.00"
    };
    
    console.log(` C Estadísticas generadas para servicio ${servicioId}`);
    res.status(200).json(estadisticas);
    
  } catch (error) {
    console.error(` C Error al obtener estadísticas del servicio ${servicioId}:`, error);
    next(error);
  }
};

// Exportar las funciones
module.exports = {
  listarServicios,
  obtenerServicio,
  crearServicio,
  actualizarServicio,
  eliminarServicio,
  obtenerEstadisticasServicio
};

console.log(' C Controlador de Servicios cargado.');