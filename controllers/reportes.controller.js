// controllers/reportes.controller.js
const { Cobro, Cliente, Servicio } = require('../models'); // Importa los modelos necesarios
// Importar funciones y operadores de Sequelize para agregaciones y fechas
const { Op, fn, col, literal, where, QueryTypes } = require('sequelize');
const { startOfMonth, endOfMonth, subMonths, subDays, startOfYear, endOfYear, 
        startOfQuarter, endOfQuarter, format, parseISO, addMonths, 
        differenceInDays, isAfter } = require('date-fns');
const { sequelize } = require('../config/database');

console.log(' C Cargando controlador de Reportes...');

// --- Función Auxiliar para Obtener Rango de Fechas ---
const obtenerRangoFechas = (periodo) => {
  const hoy = new Date();
  let fechaInicio, fechaFin;

  switch (periodo) {
    case 'current-month':
      fechaInicio = startOfMonth(hoy);
      fechaFin = endOfMonth(hoy);
      break;
    case 'previous-month':
      const mesAnterior = subMonths(hoy, 1);
      fechaInicio = startOfMonth(mesAnterior);
      fechaFin = endOfMonth(mesAnterior);
      break;
    case 'quarter': // Trimestre actual
      fechaInicio = startOfQuarter(hoy);
      fechaFin = endOfQuarter(hoy);
      break;
    case 'year': // Año actual
      fechaInicio = startOfYear(hoy);
      fechaFin = endOfYear(hoy);
      break;
    case 'last-30-days': // Últimos 30 días
      fechaInicio = subDays(hoy, 30);
      fechaFin = hoy;
      break;
    case 'last-90-days': // Últimos 90 días
      fechaInicio = subDays(hoy, 90);
      fechaFin = hoy;
      break;
    default: // Por defecto, mes actual si no se especifica o es inválido
      console.log(` C Periodo '${periodo}' no reconocido, usando mes actual por defecto.`);
      fechaInicio = startOfMonth(hoy);
      fechaFin = endOfMonth(hoy);
      periodo = 'current-month'; // Corregir el nombre del periodo para la respuesta
  }
   // Ajustar fechaFin para incluir todo el día (hasta las 23:59:59.999)
   fechaFin.setHours(23, 59, 59, 999);

  // Formatear fechas para MySQL YYYY-MM-DD
  const formattedFechaInicio = format(fechaInicio, 'yyyy-MM-dd');
  const formattedFechaFin = format(fechaFin, 'yyyy-MM-dd');

  console.log(` C Calculando rango para periodo '${periodo}': ${formattedFechaInicio} - ${formattedFechaFin}`);
  return { 
    fechaInicio: formattedFechaInicio, 
    fechaFin: formattedFechaFin, 
    nombrePeriodo: periodo 
  };
};

// --- Generar Resumen de Pagos ---
const generarResumenPagos = async (req, res, next) => {
  // Obtener el período de los query parameters
  const periodoQuery = req.query.periodo || 'current-month'; // Mes actual por defecto
  console.log(` C Controlador: Petición GET a /api/reportes/resumen-pagos. Periodo solicitado: ${periodoQuery}`);

  try {
    const { fechaInicio, fechaFin, nombrePeriodo } = obtenerRangoFechas(periodoQuery);

    // Consulta para agregar datos de cobros en el rango de fechas usando SQL directo
    // Optimizado para MySQL 8.0.41
    const resumenQuery = `
      SELECT 
        COUNT(id) as totalCobros,
        SUM(CASE WHEN estado_cobro = 'Pagado' THEN 1 ELSE 0 END) as pagados,
        SUM(CASE WHEN estado_cobro = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado_cobro = 'Atrasado' THEN 1 ELSE 0 END) as atrasados,
        SUM(CASE WHEN estado_cobro = 'Anulado' THEN 1 ELSE 0 END) as anulados,
        SUM(monto) as montoTotalEmitido,
        SUM(CASE WHEN estado_cobro = 'Pagado' THEN monto ELSE 0 END) as montoTotalPagado,
        SUM(CASE WHEN estado_cobro IN ('Pendiente', 'Atrasado') THEN monto ELSE 0 END) as montoPendiente
      FROM cobros
      WHERE fecha_emision BETWEEN ? AND ?
    `;

    // Ejecutar la consulta directa SQL
    const [resumenResultado] = await sequelize.query(resumenQuery, {
      replacements: [fechaInicio, fechaFin],
      type: QueryTypes.SELECT
    });

    // Calcular fecha para el período anterior
    const fechaInicioObj = parseISO(fechaInicio);
    const fechaFinObj = parseISO(fechaFin);
    const diasPeriodo = differenceInDays(fechaFinObj, fechaInicioObj) + 1;
    
    // Calcular el período anterior de la misma duración
    const fechaInicioAnterior = subDays(fechaInicioObj, diasPeriodo);
    const fechaFinAnterior = subDays(fechaFinObj, diasPeriodo);
    
    const periodoAnterior = {
      fechaInicio: format(fechaInicioAnterior, 'yyyy-MM-dd'),
      fechaFin: format(fechaFinAnterior, 'yyyy-MM-dd')
    };
    
    // Consulta para el período anterior
    const resumenAnteriorQuery = `
      SELECT 
        COUNT(id) as totalCobros,
        SUM(CASE WHEN estado_cobro = 'Pagado' THEN 1 ELSE 0 END) as pagados,
        SUM(monto) as montoTotalEmitido,
        SUM(CASE WHEN estado_cobro = 'Pagado' THEN monto ELSE 0 END) as montoTotalPagado
      FROM cobros
      WHERE fecha_emision BETWEEN ? AND ?
    `;

    const [resumenAnteriorResultado] = await sequelize.query(resumenAnteriorQuery, {
      replacements: [periodoAnterior.fechaInicio, periodoAnterior.fechaFin],
      type: QueryTypes.SELECT
    });

    // Procesar los datos del resumen
    const datosResumen = resumenResultado || {
      totalCobros: 0,
      pagados: 0,
      pendientes: 0,
      atrasados: 0,
      anulados: 0,
      montoTotalEmitido: 0,
      montoTotalPagado: 0,
      montoPendiente: 0
    };
    
    const datosAnterior = resumenAnteriorResultado || {
      totalCobros: 0,
      pagados: 0,
      montoTotalEmitido: 0,
      montoTotalPagado: 0
    };

    // Convertir a números y manejar nulls
    for (const key in datosResumen) {
        datosResumen[key] = parseFloat(datosResumen[key] || 0);
    }
    
    for (const key in datosAnterior) {
        datosAnterior[key] = parseFloat(datosAnterior[key] || 0);
    }

    // Calcular estadísticas adicionales
    datosResumen.porcentajePagado = datosResumen.totalCobros > 0 
      ? (datosResumen.pagados / datosResumen.totalCobros * 100).toFixed(2)
      : 0;
    
    datosResumen.porcentajeMontoPagado = datosResumen.montoTotalEmitido > 0
      ? (datosResumen.montoTotalPagado / datosResumen.montoTotalEmitido * 100).toFixed(2)
      : 0;
      
    // Calcular variaciones respecto al período anterior
    const variaciones = {
      totalCobros: calcularVariacion(datosResumen.totalCobros, datosAnterior.totalCobros),
      pagados: calcularVariacion(datosResumen.pagados, datosAnterior.pagados),
      montoTotalEmitido: calcularVariacion(datosResumen.montoTotalEmitido, datosAnterior.montoTotalEmitido),
      montoTotalPagado: calcularVariacion(datosResumen.montoTotalPagado, datosAnterior.montoTotalPagado)
    };

    // Obtener el Top 5 de servicios más rentables - Optimizado para MySQL 8.0.41
    const topServiciosQuery = `
      SELECT 
        c.servicio_id,
        s.nombre_servicio as nombre_servicio,
        SUM(c.monto) as montoTotal,
        COUNT(c.id) as totalCobros
      FROM cobros c
      JOIN servicios s ON c.servicio_id = s.id
      WHERE c.fecha_emision BETWEEN ? AND ? AND c.servicio_id IS NOT NULL
      GROUP BY c.servicio_id, s.nombre_servicio
      ORDER BY SUM(c.monto) DESC
      LIMIT 5
    `;

    const topServicios = await sequelize.query(topServiciosQuery, {
      replacements: [fechaInicio, fechaFin],
      type: QueryTypes.SELECT
    });

    // Calcular días promedio de cobro
    const diasPromedioCobro = await calcularDiasPromedioCobro(fechaInicio, fechaFin);

    console.log(` C Resumen de pagos generado para el periodo ${nombrePeriodo}:`, datosResumen);

    res.status(200).json({
      periodo: nombrePeriodo,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      resumen: datosResumen,
      comparativa: {
        periodoAnterior: {
          fechaInicio: periodoAnterior.fechaInicio,
          fechaFin: periodoAnterior.fechaFin
        },
        variaciones
      },
      diasPromedioCobro,
      topServicios: topServicios.map(servicio => ({
        id: servicio.servicio_id,
        nombre: servicio.nombre_servicio,
        montoTotal: parseFloat(servicio.montoTotal).toFixed(2),
        totalCobros: parseInt(servicio.totalCobros)
      }))
    });

  } catch (error) {
    console.error(' C Error al generar resumen de pagos:', error);
    next(error);
  }
};

// Función auxiliar para calcular variación porcentual
const calcularVariacion = (actual, anterior) => {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return ((actual - anterior) / anterior * 100).toFixed(2);
};

// Función para calcular días promedio de cobro - Optimizado para MySQL 8.0.41
const calcularDiasPromedioCobro = async (fechaInicio, fechaFin) => {
  try {
    // Obtener cobros pagados en el período usando SQL directo
    const query = `
      SELECT 
        DATEDIFF(fecha_pago, fecha_emision) as dias_pago
      FROM cobros
      WHERE estado_cobro = 'Pagado' 
        AND fecha_pago BETWEEN ? AND ?
        AND fecha_pago IS NOT NULL 
        AND fecha_emision IS NOT NULL
    `;
    
    const resultado = await sequelize.query(query, {
      replacements: [fechaInicio, fechaFin],
      type: QueryTypes.SELECT
    });
    
    if (resultado.length === 0) return 0;
    
    // Calcular promedio
    const totalDias = resultado.reduce((sum, item) => sum + parseInt(item.dias_pago || 0), 0);
    return (totalDias / resultado.length).toFixed(1);
  } catch (error) {
    console.error('Error al calcular días promedio de cobro:', error);
    return 0;
  }
};

// --- Generar Estado de Clientes ---
const generarEstadoClientes = async (req, res, next) => {
  console.log(` C Controlador: Petición GET a /api/reportes/estado-clientes recibida.`);
  
  try {
    // Consultar todos los clientes con sus cobros pendientes/atrasados
    // Usamos una consulta SQL directa para mejor rendimiento en MySQL 8.0.41
    const clientesQuery = `
      SELECT 
        c.id, 
        c.nombre_cliente, 
        c.estado_cliente,
        c.telefono, 
        c.correo_electronico,
        c.direccion,
        c.fecha_registro
      FROM clientes c
      ORDER BY c.nombre_cliente ASC
    `;
    
    const clientes = await sequelize.query(clientesQuery, {
      type: QueryTypes.SELECT
    });
    
    // Para cada cliente, obtener sus cobros
    const clientesCompletos = await Promise.all(clientes.map(async (cliente) => {
      // Obtener cobros de este cliente
      const cobrosQuery = `
        SELECT 
          id, monto, estado_cobro, fecha_vencimiento, fecha_emision, fecha_pago
        FROM cobros
        WHERE cliente_id = ?
      `;
      
      const cobros = await sequelize.query(cobrosQuery, {
        replacements: [cliente.id],
        type: QueryTypes.SELECT
      });
      
      // Añadir cobros al cliente
      return {
        ...cliente,
        cobros
      };
    }));
    
    // Procesar los datos para el informe
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a inicio del día
    
    const informeClientes = clientesCompletos.map(cliente => {
      // Contar cobros por estado
      const pendientes = cliente.cobros.filter(c => c.estado_cobro === 'Pendiente').length;
      const atrasados = cliente.cobros.filter(c => c.estado_cobro === 'Atrasado').length;
      const pagados = cliente.cobros.filter(c => c.estado_cobro === 'Pagado').length;
      
      // Sumar montos por estado
      const montoPendiente = cliente.cobros
        .filter(c => c.estado_cobro === 'Pendiente' || c.estado_cobro === 'Atrasado')
        .reduce((sum, c) => sum + parseFloat(c.monto || 0), 0);
        
      const montoPagado = cliente.cobros
        .filter(c => c.estado_cobro === 'Pagado')
        .reduce((sum, c) => sum + parseFloat(c.monto || 0), 0);
      
      // Determinar si hay cobros por vencer pronto (en los próximos 5 días)
      const proximoVencimiento = cliente.cobros
        .filter(c => c.estado_cobro === 'Pendiente')
        .filter(c => {
          // Asegurar que la fecha_vencimiento sea un objeto Date
          let fechaVenc;
          try {
            fechaVenc = new Date(c.fecha_vencimiento);
          } catch (e) {
            return false;
          }
          
          const diffTime = fechaVenc - hoy;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 5; // Próximos a vencer en 5 días o menos
        })
        .length;
      
      // Calcular el promedio de días para pagar
      let diasPromedioPago = 0;
      const pagosConcretados = cliente.cobros.filter(c => 
        c.estado_cobro === 'Pagado' && c.fecha_pago && c.fecha_emision
      );
      
      if (pagosConcretados.length > 0) {
        let totalDias = 0;
        pagosConcretados.forEach(c => {
          const fechaEmision = new Date(c.fecha_emision);
          const fechaPago = new Date(c.fecha_pago);
          totalDias += differenceInDays(fechaPago, fechaEmision);
        });
        diasPromedioPago = totalDias / pagosConcretados.length;
      }
      
      return {
        id: cliente.id,
        nombre: cliente.nombre_cliente,
        estado: cliente.estado_cliente,
        telefono: cliente.telefono || 'No registrado',
        correo: cliente.correo_electronico || 'No registrado',
        fechaRegistro: cliente.fecha_registro,
        cobrosPendientes: pendientes,
        cobrosAtrasados: atrasados,
        cobrosPagados: pagados,
        montoPendiente: montoPendiente.toFixed(2),
        montoPagado: montoPagado.toFixed(2),
        diasPromedioPago: diasPromedioPago.toFixed(1),
        vencimientoProximo: proximoVencimiento > 0,
        indicadores: {
          puntualidad: calcularPuntualidadCliente(pagosConcretados),
          salud: calcularSaludCliente(pendientes, atrasados, pagados, montoPendiente),
          antiguedad: calcularAntiguedadCliente(cliente.fecha_registro)
        }
      };
    });
    
    // Calcular estadísticas globales
    const clientesConDeuda = informeClientes.filter(c => parseFloat(c.montoPendiente) > 0);
    const clientesConAtrasos = informeClientes.filter(c => c.cobrosAtrasados > 0);
    const montoPendienteTotal = clientesConDeuda.reduce((sum, c) => sum + parseFloat(c.montoPendiente), 0);
    
    // Calcular concentración de deuda
    let concentracionDeuda = [];
    if (clientesConDeuda.length > 0) {
      // Ordenar por monto pendiente descendente
      concentracionDeuda = clientesConDeuda
        .sort((a, b) => parseFloat(b.montoPendiente) - parseFloat(a.montoPendiente))
        .slice(0, 5) // Top 5
        .map(c => ({
          id: c.id,
          nombre: c.nombre,
          montoPendiente: c.montoPendiente,
          porcentaje: ((parseFloat(c.montoPendiente) / montoPendienteTotal) * 100).toFixed(2) + '%'
        }));
    }
    
    console.log(` C Informe de estado de clientes generado con ${informeClientes.length} clientes.`);
    
    res.status(200).json({
      totalClientes: informeClientes.length,
      clientesActivos: informeClientes.filter(c => c.estado === 'Activo').length,
      clientesConDeuda: clientesConDeuda.length,
      clientesConAtrasos: clientesConAtrasos.length,
      montoPendienteTotal: montoPendienteTotal.toFixed(2),
      concentracionDeuda,
      clientes: informeClientes
    });
    
  } catch (error) {
    console.error(' C Error al generar estado de clientes:', error);
    next(error);
  }
};

// Funciones auxiliares para métricas de clientes
const calcularPuntualidadCliente = (pagosConcretados) => {
  if (pagosConcretados.length === 0) return 'Sin historial';
  
  const pagosATiempo = pagosConcretados.filter(c => {
    const fechaVencimiento = new Date(c.fecha_vencimiento);
    const fechaPago = new Date(c.fecha_pago);
    return !isAfter(fechaPago, fechaVencimiento);
  }).length;
  
  const porcentajePuntualidad = (pagosATiempo / pagosConcretados.length) * 100;
  
  if (porcentajePuntualidad >= 90) return 'Excelente';
  if (porcentajePuntualidad >= 75) return 'Buena';
  if (porcentajePuntualidad >= 50) return 'Regular';
  return 'Deficiente';
};

const calcularSaludCliente = (pendientes, atrasados, pagados, montoPendiente) => {
  if (pagados === 0 && pendientes === 0 && atrasados === 0) return 'Sin actividad';
  
  const totalCobros = pendientes + atrasados + pagados;
  const porcentajeAtrasos = (atrasados / totalCobros) * 100;
  
  if (atrasados === 0) return 'Óptima';
  if (porcentajeAtrasos < 10) return 'Buena';
  if (porcentajeAtrasos < 30) return 'Regular';
  return 'En riesgo';
};

const calcularAntiguedadCliente = (fechaRegistro) => {
  if (!fechaRegistro) return 'Desconocida';
  
  const fechaInicio = new Date(fechaRegistro);
  const hoy = new Date();
  const mesesAntiguedad = differenceInDays(hoy, fechaInicio) / 30;
  
  if (mesesAntiguedad < 3) return 'Nuevo';
  if (mesesAntiguedad < 12) return 'Reciente';
  if (mesesAntiguedad < 24) return 'Establecido';
  return 'Antiguo';
};

// --- Generar Análisis de Atrasos ---
const generarAnalisisAtrasos = async (req, res, next) => {
  console.log(` C Controlador: Petición GET a /api/reportes/analisis-atrasos recibida.`);
  
  try {
    // Consultar cobros atrasados - Optimizado para MySQL 8.0.41
    const cobrosAtrasadosQuery = `
      SELECT 
        co.id, co.monto, co.fecha_vencimiento, co.descripcion_servicio_personalizado,
        cl.id as cliente_id, cl.nombre_cliente, cl.telefono, cl.correo_electronico,
        s.id as servicio_id, s.nombre_servicio
      FROM cobros co
      LEFT JOIN clientes cl ON co.cliente_id = cl.id
      LEFT JOIN servicios s ON co.servicio_id = s.id
      WHERE co.estado_cobro = 'Atrasado'
      ORDER BY co.fecha_vencimiento ASC
    `;
    
    const cobrosAtrasados = await sequelize.query(cobrosAtrasadosQuery, {
      type: QueryTypes.SELECT
    });
    
    // Procesar datos para el informe
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const datosAtrasos = cobrosAtrasados.map(cobro => {
      // Asegurar que la fecha_vencimiento sea un objeto Date válido
      let fechaVenc;
      try {
        fechaVenc = new Date(cobro.fecha_vencimiento);
      } catch (e) {
        fechaVenc = new Date(); // Valor por defecto si hay error
      }
      
      const diffTime = Math.abs(hoy - fechaVenc);
      const diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Calcular categoría de riesgo
      let categoriaRiesgo;
      if (diasAtraso <= 15) {
        categoriaRiesgo = 'Bajo';
      } else if (diasAtraso <= 30) {
        categoriaRiesgo = 'Medio';
      } else if (diasAtraso <= 60) {
        categoriaRiesgo = 'Alto';
      } else {
        categoriaRiesgo = 'Crítico';
      }
      
      return {
        cobroId: cobro.id,
        clienteId: cobro.cliente_id,
        clienteNombre: cobro.nombre_cliente || 'Cliente desconocido',
        clienteContacto: cobro.telefono || cobro.correo_electronico || 'No disponible',
        servicio: cobro.nombre_servicio || cobro.descripcion_servicio_personalizado || 'Servicio no especificado',
        monto: parseFloat(cobro.monto || 0).toFixed(2),
        fechaVencimiento: cobro.fecha_vencimiento,
        diasAtraso: diasAtraso,
        categoriaRiesgo
      };
    });
    
    // Análisis adicional (categorización por días de atraso)
    const menosDe15Dias = datosAtrasos.filter(item => item.diasAtraso < 15).length;
    const entre15y30Dias = datosAtrasos.filter(item => item.diasAtraso >= 15 && item.diasAtraso <= 30).length;
    const entre30y60Dias = datosAtrasos.filter(item => item.diasAtraso > 30 && item.diasAtraso <= 60).length;
    const masDe60Dias = datosAtrasos.filter(item => item.diasAtraso > 60).length;
    
    // Calcular monto total atrasado y por categoría
    const montoTotalAtrasado = datosAtrasos.reduce((total, item) => total + parseFloat(item.monto), 0);
    
    const montoMenosDe15Dias = datosAtrasos
      .filter(item => item.diasAtraso < 15)
      .reduce((total, item) => total + parseFloat(item.monto), 0);
      
    const montoEntre15y30Dias = datosAtrasos
      .filter(item => item.diasAtraso >= 15 && item.diasAtraso <= 30)
      .reduce((total, item) => total + parseFloat(item.monto), 0);
      
    const montoEntre30y60Dias = datosAtrasos
      .filter(item => item.diasAtraso > 30 && item.diasAtraso <= 60)
      .reduce((total, item) => total + parseFloat(item.monto), 0);
      
    const montoMasDe60Dias = datosAtrasos
      .filter(item => item.diasAtraso > 60)
      .reduce((total, item) => total + parseFloat(item.monto), 0);
    
    // Análisis por cliente
    const clientesAgrupados = {};
    datosAtrasos.forEach(item => {
      if (!clientesAgrupados[item.clienteId]) {
        clientesAgrupados[item.clienteId] = {
          id: item.clienteId,
          nombre: item.clienteNombre,
          contacto: item.clienteContacto,
          cobrosAtrasados: 0,
          montoTotal: 0,
          cobroMasAntiguo: 0
        };
      }
      
      clientesAgrupados[item.clienteId].cobrosAtrasados++;
      clientesAgrupados[item.clienteId].montoTotal += parseFloat(item.monto);
      
      if (item.diasAtraso > clientesAgrupados[item.clienteId].cobroMasAntiguo) {
        clientesAgrupados[item.clienteId].cobroMasAntiguo = item.diasAtraso;
      }
    });
    
    // Convertir a array y ordenar por monto total
    const analisisClientes = Object.values(clientesAgrupados)
      .map(cliente => ({
        ...cliente,
        montoTotal: cliente.montoTotal.toFixed(2),
        porcentajeDel: montoTotalAtrasado > 0 ? ((cliente.montoTotal / montoTotalAtrasado) * 100).toFixed(2) + '%' : '0%'
      }))
      .sort((a, b) => parseFloat(b.montoTotal) - parseFloat(a.montoTotal));
    
    console.log(` C Análisis de atrasos generado. Total cobros atrasados: ${datosAtrasos.length}`);
    
    // Calcular índice de morosidad usando SQL directo - Optimizado para MySQL 8.0.41
    const totalCobrosQuery = 'SELECT COUNT(*) as total FROM cobros';
    const [totalCobrosResult] = await sequelize.query(totalCobrosQuery, {
      type: QueryTypes.SELECT
    });
    
    const totalCobros = parseInt(totalCobrosResult.total || 0);
    const indiceMorosidad = totalCobros > 0 ? ((datosAtrasos.length / totalCobros) * 100).toFixed(2) : 0;
    
    res.status(200).json({
      indiceMorosidad,
      totalCobrosAtrasados: datosAtrasos.length,
      montoTotalAtrasado: montoTotalAtrasado.toFixed(2),
      distribucionAtrasos: {
        menosDe15Dias,
        entre15y30Dias,
        entre30y60Dias,
        masDe60Dias,
        montoPorCategoria: {
          menosDe15Dias: montoMenosDe15Dias.toFixed(2),
          entre15y30Dias: montoEntre15y30Dias.toFixed(2),
          entre30y60Dias: montoEntre30y60Dias.toFixed(2),
          masDe60Dias: montoMasDe60Dias.toFixed(2)
        }
      },
      analisisClientes: analisisClientes.slice(0, 10), // Top 10 clientes con más atrasos
      cobrosAtrasados: datosAtrasos
    });
    
  } catch (error) {
    console.error(' C Error al generar análisis de atrasos:', error);
    next(error);
  }
};

// --- Generar Proyección de Ingresos ---
const generarProyeccionIngresos = async (req, res, next) => {
  console.log(` C Controlador: Petición GET a /api/reportes/proyeccion-ingresos recibida.`);
  
  try {
    const hoy = new Date();
    
    // Obtener fechas para los próximos 3 meses
    const inicioMesActual = startOfMonth(hoy);
    const finMesActual = endOfMonth(hoy);
    
    const inicioMesSiguiente = startOfMonth(addMonths(hoy, 1));
    const finMesSiguiente = endOfMonth(addMonths(hoy, 1));
    
    const inicioMesSubsiguiente = startOfMonth(addMonths(hoy, 2));
    const finMesSubsiguiente = endOfMonth(addMonths(hoy, 2));
    
    // Formatear fechas para consultas SQL
    const formatearFecha = fecha => format(fecha, 'yyyy-MM-dd');
    
    // Consultar cobros pendientes o por vencer - Optimizado para MySQL 8.0.41
    const cobrosPendientesQuery = `
      SELECT 
        co.id, co.cliente_id, co.servicio_id, co.monto, co.fecha_vencimiento,
        co.descripcion_servicio_personalizado,
        cl.nombre_cliente, cl.estado_cliente
      FROM cobros co
      LEFT JOIN clientes cl ON co.cliente_id = cl.id
      WHERE co.estado_cobro = 'Pendiente'
        AND co.fecha_vencimiento >= ?
      ORDER BY co.fecha_vencimiento ASC
    `;
    
    const cobrosPendientes = await sequelize.query(cobrosPendientesQuery, {
      replacements: [formatearFecha(hoy)],
      type: QueryTypes.SELECT
    });
    
    // Agrupar por mes
    const proyeccionMesActual = { cantidad: 0, monto: 0, detalle: [] };
    const proyeccionMesSiguiente = { cantidad: 0, monto: 0, detalle: [] };
    const proyeccionMesSubsiguiente = { cantidad: 0, monto: 0, detalle: [] };
    const proyeccionPosterior = { cantidad: 0, monto: 0, detalle: [] };
    
    cobrosPendientes.forEach(cobro => {
      const fechaVenc = new Date(cobro.fecha_vencimiento);
      
      const detalle = {
        cobroId: cobro.id,
        clienteId: cobro.cliente_id,
        clienteNombre: cobro.nombre_cliente || 'Cliente desconocido',
        clienteEstado: cobro.estado_cliente || 'Desconocido',
        monto: parseFloat(cobro.monto || 0).toFixed(2),
        fechaVencimiento: cobro.fecha_vencimiento
      };
      
      // Determinar a qué mes pertenece el cobro
      if (fechaVenc >= inicioMesActual && fechaVenc <= finMesActual) {
        proyeccionMesActual.cantidad++;
        proyeccionMesActual.monto += parseFloat(cobro.monto || 0);
        proyeccionMesActual.detalle.push(detalle);
      } else if (fechaVenc >= inicioMesSiguiente && fechaVenc <= finMesSiguiente) {
        proyeccionMesSiguiente.cantidad++;
        proyeccionMesSiguiente.monto += parseFloat(cobro.monto || 0);
        proyeccionMesSiguiente.detalle.push(detalle);
      } else if (fechaVenc >= inicioMesSubsiguiente && fechaVenc <= finMesSubsiguiente) {
        proyeccionMesSubsiguiente.cantidad++;
        proyeccionMesSubsiguiente.monto += parseFloat(cobro.monto || 0);
        proyeccionMesSubsiguiente.detalle.push(detalle);
      } else {
        proyeccionPosterior.cantidad++;
        proyeccionPosterior.monto += parseFloat(cobro.monto || 0);
        proyeccionPosterior.detalle.push(detalle);
      }
    });
    
    // Redondear montos para mejor presentación
    proyeccionMesActual.monto = proyeccionMesActual.monto.toFixed(2);
    proyeccionMesSiguiente.monto = proyeccionMesSiguiente.monto.toFixed(2);
    proyeccionMesSubsiguiente.monto = proyeccionMesSubsiguiente.monto.toFixed(2);
    proyeccionPosterior.monto = proyeccionPosterior.monto.toFixed(2);
    
    // Calcular total proyectado
    const totalProyectado = cobrosPendientes.reduce((total, cobro) => 
      total + parseFloat(cobro.monto || 0), 0).toFixed(2);
    
    // Calcular el índice de rotación de cuentas por cobrar
    const indiceRotacion = await calcularIndiceRotacion();
    
    // Calcular probabilidad de pago basada en el historial
    const probabilidadPago = await calcularProbabilidadPago();
    
    console.log(` C Proyección de ingresos generada. Total cobros: ${cobrosPendientes.length}`);
    
    // Nombres formateados de los meses (español)
    const options = { month: 'long', year: 'numeric' };
    const nombresMeses = {
      mesActual: inicioMesActual.toLocaleDateString('es-ES', options),
      mesSiguiente: inicioMesSiguiente.toLocaleDateString('es-ES', options),
      mesSubsiguiente: inicioMesSubsiguiente.toLocaleDateString('es-ES', options)
    };
    
    res.status(200).json({
      totalCobrosProyectados: cobrosPendientes.length,
      totalMontoProyectado: totalProyectado,
      nombresMeses: nombresMeses,
      indiceRotacion: indiceRotacion.toFixed(2),
      proyeccion: {
        mesActual: proyeccionMesActual,
        mesSiguiente: proyeccionMesSiguiente,
        mesSubsiguiente: proyeccionMesSubsiguiente,
        posterior: proyeccionPosterior
      },
      probabilidadPago
    });
    
  } catch (error) {
    console.error(' C Error al generar proyección de ingresos:', error);
    next(error);
  }
};

// Función auxiliar para calcular el índice de rotación de cuentas por cobrar
// (Ventas netas a crédito / Promedio de cuentas por cobrar)
const calcularIndiceRotacion = async () => {
  try {
    const hoy = new Date();
    const inicioAnio = startOfYear(hoy);
    const formatearFecha = fecha => format(fecha, 'yyyy-MM-dd');
    
    // Obtener cobros pagados en el año actual (ventas netas a crédito) - Optimizado para MySQL 8.0.41
    const ventasCreditoQuery = `
      SELECT SUM(monto) as total FROM cobros 
      WHERE estado_cobro = 'Pagado' AND fecha_pago >= ?
    `;
    
    const [ventasCreditoResult] = await sequelize.query(ventasCreditoQuery, {
      replacements: [formatearFecha(inicioAnio)],
      type: QueryTypes.SELECT
    });
    
    const ventasCredito = parseFloat(ventasCreditoResult.total || 0);
    
    // Obtener el promedio de cuentas por cobrar (pendientes y atrasadas) - Optimizado para MySQL 8.0.41
    const cuentasPorCobrarQuery = `
      SELECT SUM(monto) as total FROM cobros 
      WHERE estado_cobro IN ('Pendiente', 'Atrasado')
    `;
    
    const [cuentasPorCobrarResult] = await sequelize.query(cuentasPorCobrarQuery, {
      type: QueryTypes.SELECT
    });
    
    const cuentasPorCobrar = parseFloat(cuentasPorCobrarResult.total || 0);
    
    // Si no hay cuentas por cobrar, evitar división por cero
    if (cuentasPorCobrar === 0) return 0;
    
    // Calcular el índice de rotación
    return ventasCredito / cuentasPorCobrar;
  } catch (error) {
    console.error('Error al calcular índice de rotación:', error);
    return 0;
  }
};

// Función auxiliar para calcular la probabilidad de pago basada en historial
const calcularProbabilidadPago = async () => {
  try {
    // Obtener datos de cobros históricos usando SQL directo - Optimizado para MySQL 8.0.41
    const historialCobrosQuery = `
      SELECT 
        cliente_id, 
        estado_cobro, 
        COUNT(id) as totalCobros
      FROM cobros
      GROUP BY cliente_id, estado_cobro
    `;
    
    const historialCobros = await sequelize.query(historialCobrosQuery, {
      type: QueryTypes.SELECT
    });
    
    // Agrupar por cliente
    const clientesProbabilidad = {};
    historialCobros.forEach(dato => {
      const clienteId = dato.cliente_id;
      if (!clientesProbabilidad[clienteId]) {
        clientesProbabilidad[clienteId] = {
          clienteId,
          totalCobros: 0,
          cobrosPagados: 0,
          probabilidadPago: 0
        };
      }
      
      if (dato.estado_cobro === 'Pagado') {
        clientesProbabilidad[clienteId].cobrosPagados = parseInt(dato.totalCobros);
      }
      
      clientesProbabilidad[clienteId].totalCobros += parseInt(dato.totalCobros);
    });
    
    // Calcular probabilidad para cada cliente
    Object.values(clientesProbabilidad).forEach(cliente => {
      if (cliente.totalCobros > 0) {
        cliente.probabilidadPago = (cliente.cobrosPagados / cliente.totalCobros) * 100;
      }
    });
    
    // Obtener la información de los clientes para añadir nombres - Optimizado para MySQL 8.0.41
    const clientesQuery = `
      SELECT id, nombre_cliente FROM clientes
    `;
    
    const clientes = await sequelize.query(clientesQuery, {
      type: QueryTypes.SELECT
    });
    
    // Crear un mapa de ID a nombre para facilitar la búsqueda
    const clientesMap = {};
    clientes.forEach(cliente => {
      clientesMap[cliente.id] = cliente.nombre_cliente;
    });
    
    // Formatear y ordenar por probabilidad descendente
    const probabilidadOrdenada = Object.values(clientesProbabilidad)
      .filter(c => c.totalCobros >= 3) // Solo clientes con suficiente historial
      .map(c => ({
        clienteId: c.clienteId,
        nombreCliente: clientesMap[c.clienteId] || `Cliente ${c.clienteId}`,
        cobrosPagados: c.cobrosPagados,
        totalCobros: c.totalCobros,
        probabilidadPago: c.probabilidadPago.toFixed(2)
      }))
      .sort((a, b) => parseFloat(b.probabilidadPago) - parseFloat(a.probabilidadPago));
    
    return {
      clientesConHistorial: probabilidadOrdenada.length,
      clientesAlta: probabilidadOrdenada.filter(c => parseFloat(c.probabilidadPago) >= 80).length,
      clientesMedia: probabilidadOrdenada.filter(c => parseFloat(c.probabilidadPago) >= 50 && parseFloat(c.probabilidadPago) < 80).length,
      clientesBaja: probabilidadOrdenada.filter(c => parseFloat(c.probabilidadPago) < 50).length,
      detalle: probabilidadOrdenada.slice(0, 10) // Top 10
    };
  } catch (error) {
    console.error('Error al calcular probabilidad de pago:', error);
    return {
      clientesConHistorial: 0,
      clientesAlta: 0,
      clientesMedia: 0,
      clientesBaja: 0,
      detalle: []
    };
  }
};

// --- Generar Análisis de Rentabilidad por Servicio ---
const generarAnalisisRentabilidad = async (req, res, next) => {
  console.log(` C Controlador: Petición GET a /api/reportes/analisis-rentabilidad recibida.`);
  const periodoQuery = req.query.periodo || 'year'; // Año actual por defecto
  
  try {
    const { fechaInicio, fechaFin, nombrePeriodo } = obtenerRangoFechas(periodoQuery);
    
    // Consultar servicios con SQL directo - Optimizado para MySQL 8.0.41
    const serviciosQuery = `
      SELECT 
        id, 
        nombre_servicio, 
        precio_base,
        descripcion
      FROM servicios
      ORDER BY nombre_servicio ASC
    `;
    
    const servicios = await sequelize.query(serviciosQuery, {
      type: QueryTypes.SELECT
    });
    
    // Para cada servicio, obtener sus cobros
    const serviciosCompletos = await Promise.all(servicios.map(async (servicio) => {
      // Obtener cobros de este servicio en el período
      const cobrosQuery = `
        SELECT 
          id, monto, estado_cobro, fecha_emision, fecha_pago
        FROM cobros
        WHERE servicio_id = ? AND fecha_emision BETWEEN ? AND ?
      `;
      
      const cobros = await sequelize.query(cobrosQuery, {
        replacements: [servicio.id, fechaInicio, fechaFin],
        type: QueryTypes.SELECT
      });
      
      // Añadir cobros al servicio
      return {
        ...servicio,
        cobros
      };
    }));
    
    // Procesar datos de rentabilidad
    const rentabilidadServicios = serviciosCompletos.map(servicio => {
      // Contar cobros por estado
      const cobrosRealizados = servicio.cobros || [];
      const cobrosPagados = cobrosRealizados.filter(c => c.estado_cobro === 'Pagado');
      const cobrosPendientes = cobrosRealizados.filter(c => c.estado_cobro === 'Pendiente');
      const cobrosAtrasados = cobrosRealizados.filter(c => c.estado_cobro === 'Atrasado');
      
      // Calcular montos
      const montoFacturado = cobrosRealizados.reduce((sum, c) => sum + parseFloat(c.monto || 0), 0);
      const montoCobrado = cobrosPagados.reduce((sum, c) => sum + parseFloat(c.monto || 0), 0);
      const montoPendiente = [...cobrosPendientes, ...cobrosAtrasados].reduce((sum, c) => sum + parseFloat(c.monto || 0), 0);
      
      // Calcular precio promedio
      const precioPromedio = cobrosRealizados.length > 0 ? montoFacturado / cobrosRealizados.length : 0;
      
      // Calcular desviación del precio base
      const precioBase = parseFloat(servicio.precio_base || 0);
      const desviacionPrecio = precioBase > 0 
        ? ((precioPromedio - precioBase) / precioBase) * 100 
        : 0;
      
      // Calcular tiempo promedio de pago
      let tiempoPromedioPago = 0;
      if (cobrosPagados.length > 0) {
        const totalDias = cobrosPagados.reduce((total, c) => {
          const emision = new Date(c.fecha_emision);
          const pago = new Date(c.fecha_pago);
          return total + differenceInDays(pago, emision);
        }, 0);
        tiempoPromedioPago = totalDias / cobrosPagados.length;
      }
      
      return {
        id: servicio.id,
        nombre: servicio.nombre_servicio,
        descripcion: servicio.descripcion,
        precioBase: parseFloat(servicio.precio_base || 0).toFixed(2),
        precioPromedio: precioPromedio.toFixed(2),
        desviacionPrecio: desviacionPrecio.toFixed(2) + '%',
        totalCobros: cobrosRealizados.length,
        cobrosPagados: cobrosPagados.length,
        cobrosPendientes: cobrosPendientes.length,
        cobrosAtrasados: cobrosAtrasados.length,
        montoFacturado: montoFacturado.toFixed(2),
        montoCobrado: montoCobrado.toFixed(2),
        montoPendiente: montoPendiente.toFixed(2),
        tiempoPromedioPago: tiempoPromedioPago.toFixed(1),
        tasaConversion: cobrosRealizados.length > 0 
          ? ((cobrosPagados.length / cobrosRealizados.length) * 100).toFixed(2) + '%' 
          : '0.00%'
      };
    });
    
    // Ordenar por monto facturado descendente
    rentabilidadServicios.sort((a, b) => parseFloat(b.montoFacturado) - parseFloat(a.montoFacturado));
    
    // Calcular totales generales
    const totalFacturado = rentabilidadServicios.reduce((sum, s) => sum + parseFloat(s.montoFacturado), 0);
    const totalCobrado = rentabilidadServicios.reduce((sum, s) => sum + parseFloat(s.montoCobrado), 0);
    const totalPendiente = rentabilidadServicios.reduce((sum, s) => sum + parseFloat(s.montoPendiente), 0);
    
    console.log(` C Análisis de rentabilidad generado para ${servicios.length} servicios.`);
    
    res.status(200).json({
      periodo: nombrePeriodo,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      totalServicios: servicios.length,
      totalFacturado: totalFacturado.toFixed(2),
      totalCobrado: totalCobrado.toFixed(2),
      totalPendiente: totalPendiente.toFixed(2),
      porcentajeCobrado: totalFacturado > 0 ? ((totalCobrado / totalFacturado) * 100).toFixed(2) + '%' : '0.00%',
      servicios: rentabilidadServicios
    });
    
  } catch (error) {
    console.error(' C Error al generar análisis de rentabilidad:', error);
    next(error);
  }
};

// --- Generar Dashboard General ---
const generarDashboardGeneral = async (req, res, next) => {
  console.log(` C Controlador: Petición GET a /api/reportes/dashboard recibida.`);
  
  try {
    // Fecha actual y rangos de tiempo
    const hoy = new Date();
    const inicioMes = startOfMonth(hoy);
    const finMes = endOfMonth(hoy);
    const mesAnterior = subMonths(hoy, 1);
    const inicioMesAnterior = startOfMonth(mesAnterior);
    const finMesAnterior = endOfMonth(mesAnterior);
    
    // Formatear fechas para consultas SQL
    const formatearFecha = fecha => format(fecha, 'yyyy-MM-dd');
    
    // Consultas para estadísticas generales usando SQL directo - Optimizado para MySQL 8.0.41
    const queryEstadisticas = `
      SELECT 
        (SELECT COUNT(*) FROM clientes) as totalClientes,
        (SELECT COUNT(*) FROM clientes WHERE estado_cliente = 'Activo') as clientesActivos,
        (SELECT COUNT(*) FROM cobros) as totalCobros,
        (SELECT COUNT(*) FROM cobros WHERE estado_cobro = 'Pendiente') as cobrosPendientes,
        (SELECT COUNT(*) FROM cobros WHERE estado_cobro = 'Atrasado') as cobrosAtrasados,
        (SELECT COUNT(*) FROM cobros WHERE estado_cobro = 'Pagado') as cobrosPagados,
        (SELECT COUNT(*) FROM servicios) as totalServicios
    `;
    
    const [estadisticasResult] = await sequelize.query(queryEstadisticas, {
      type: QueryTypes.SELECT
    });
    
    // Consultas para montos totales - Optimizado para MySQL 8.0.41
    const queryMontos = `
      SELECT 
        (SELECT COALESCE(SUM(monto), 0) FROM cobros) as montoTotalFacturado,
        (SELECT COALESCE(SUM(monto), 0) FROM cobros WHERE estado_cobro = 'Pagado') as montoTotalCobrado,
        (SELECT COALESCE(SUM(monto), 0) FROM cobros WHERE estado_cobro = 'Pagado' AND fecha_pago BETWEEN ? AND ?) as montoMesActual,
        (SELECT COALESCE(SUM(monto), 0) FROM cobros WHERE estado_cobro = 'Pagado' AND fecha_pago BETWEEN ? AND ?) as montoMesAnterior
    `;
    
    const [montosResult] = await sequelize.query(queryMontos, {
      replacements: [
        formatearFecha(inicioMes), formatearFecha(finMes),
        formatearFecha(inicioMesAnterior), formatearFecha(finMesAnterior)
      ],
      type: QueryTypes.SELECT
    });
    
    // Extraer valores y convertir a números
    const totalClientes = parseInt(estadisticasResult.totalClientes || 0);
    const clientesActivos = parseInt(estadisticasResult.clientesActivos || 0);
    const totalCobros = parseInt(estadisticasResult.totalCobros || 0);
    const cobrosPendientes = parseInt(estadisticasResult.cobrosPendientes || 0);
    const cobrosAtrasados = parseInt(estadisticasResult.cobrosAtrasados || 0);
    const cobrosPagados = parseInt(estadisticasResult.cobrosPagados || 0);
    const totalServicios = parseInt(estadisticasResult.totalServicios || 0);
    
    const montoTotalFacturado = parseFloat(montosResult.montoTotalFacturado || 0);
    const montoTotalCobrado = parseFloat(montosResult.montoTotalCobrado || 0);
    const montoMesActual = parseFloat(montosResult.montoMesActual || 0);
    const montoMesAnterior = parseFloat(montosResult.montoMesAnterior || 0);
    
    // Calcular índice de morosidad
    const indiceMorosidad = totalCobros > 0 ? (cobrosAtrasados / totalCobros) * 100 : 0;
    
    // Calcular variación respecto al mes anterior
    const variacionMensual = montoMesAnterior > 0 
      ? ((montoMesActual - montoMesAnterior) / montoMesAnterior) * 100 
      : (montoMesActual > 0 ? 100 : 0);
    
    // Obtener top clientes con mayor deuda - Optimizado para MySQL 8.0.41
    const clientesDeudaQuery = `
      SELECT 
        cl.id, 
        cl.nombre_cliente,
        SUM(co.monto) as deudaTotal
      FROM clientes cl
      JOIN cobros co ON cl.id = co.cliente_id
      WHERE co.estado_cobro IN ('Pendiente', 'Atrasado')
      GROUP BY cl.id, cl.nombre_cliente
      ORDER BY deudaTotal DESC
      LIMIT 5
    `;
    
    const clientesDeuda = await sequelize.query(clientesDeudaQuery, {
      type: QueryTypes.SELECT
    });
    
    // Obtener flujo de caja reciente (últimos 30 días) - Optimizado para MySQL 8.0.41
    const fechaInicio30Dias = subDays(hoy, 30);
    
    const flujoCajaQuery = `
      SELECT 
        fecha_pago,
        SUM(monto) as montoTotal
      FROM cobros
      WHERE estado_cobro = 'Pagado' AND fecha_pago BETWEEN ? AND ?
      GROUP BY fecha_pago
      ORDER BY fecha_pago ASC
    `;
    
    const flujoCaja = await sequelize.query(flujoCajaQuery, {
      replacements: [formatearFecha(fechaInicio30Dias), formatearFecha(hoy)],
      type: QueryTypes.SELECT
    });
    
    console.log(` C Dashboard general generado.`);
    
    res.status(200).json({
      estadisticas: {
        clientes: {
          total: totalClientes,
          activos: clientesActivos,
          porcentajeActivos: totalClientes > 0 ? ((clientesActivos / totalClientes) * 100).toFixed(2) : 0
        },
        cobros: {
          total: totalCobros,
          pendientes: cobrosPendientes,
          atrasados: cobrosAtrasados,
          pagados: cobrosPagados,
          indiceMorosidad: indiceMorosidad.toFixed(2)
        },
        servicios: {
          total: totalServicios
        },
        finanzas: {
          montoTotalFacturado: montoTotalFacturado.toFixed(2),
          montoTotalCobrado: montoTotalCobrado.toFixed(2),
          porcentajeCobrado: montoTotalFacturado > 0 ? ((montoTotalCobrado / montoTotalFacturado) * 100).toFixed(2) : 0,
          ingresosMesActual: montoMesActual.toFixed(2),
          variacionMensual: variacionMensual.toFixed(2)
        }
      },
      topClientesDeuda: clientesDeuda.map(cliente => ({
        id: cliente.id,
        nombre: cliente.nombre_cliente,
        deudaTotal: parseFloat(cliente.deudaTotal).toFixed(2)
      })),
      flujoCaja: flujoCaja.map(item => ({
        fecha: item.fecha_pago,
        monto: parseFloat(item.montoTotal).toFixed(2)
      }))
    });
    
  } catch (error) {
    console.error(' C Error al generar dashboard general:', error);
    next(error);
  }
};

// Exportar las funciones
module.exports = {
  generarResumenPagos,
  generarEstadoClientes,
  generarAnalisisAtrasos,
  generarProyeccionIngresos,
  generarAnalisisRentabilidad,
  generarDashboardGeneral
};

console.log(' C Controlador de Reportes cargado.');