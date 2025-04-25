/**
 * reports.js
 * Módulo para gestionar la generación de reportes
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { formatCurrency, formatDate, getPeriodName, formatReportTitle, formatClientClass, formatStatusBadge } from '../utils/formatting.js';

// Variable para almacenar el último reporte generado (para exportación)
let currentReportData = null;
let currentReportType = null;

/**
 * Inicializa el módulo de reportes
 */
function initReports() {
    console.log('Inicializando módulo de Reportes...');
}

/**
 * Configura los filtros para reportes
 */
function setupReportFilters() {
    const reportType = document.getElementById('report-type');
    const reportPeriod = document.getElementById('report-period');
    const generateReportBtn = document.getElementById('generate-report-btn');
    
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            const tipo = reportType?.value || 'payment-summary';
            const periodo = reportPeriod?.value || 'current-month';
            generateReport(tipo, periodo);
        });
    }
    
    // Configurar cambio de período según tipo de reporte
    if (reportType && reportPeriod) {
        reportType.addEventListener('change', () => {
            const tipo = reportType.value;
            
            // Mostrar/ocultar selector de períodos según el tipo de reporte
            const periodSelector = document.querySelector('.report-period-selector');
            
            if (tipo === 'client-status' || tipo === 'delay-analysis') {
                periodSelector.style.display = 'none';
            } else {
                periodSelector.style.display = 'flex';
            }
        });
    }
}

/**
 * Genera un reporte según el tipo y período especificados
 * @param {string} tipo - Tipo de reporte
 * @param {string} periodo - Período del reporte
 */
async function generateReport(tipo, periodo) {
    console.log(`Generando reporte "${tipo}" para período "${periodo}"...`);
    
    showLoadingOverlay('Generando reporte...');
    
    try {
        let endpoint;
        let reportData;
        
        // Seleccionar el endpoint correcto según el tipo de reporte
        switch (tipo) {
            case 'payment-summary':
                endpoint = `/reportes/resumen-pagos?periodo=${periodo}`;
                break;
            case 'client-status':
                endpoint = '/reportes/estado-clientes';
                break;
            case 'delay-analysis':
                endpoint = '/reportes/analisis-atrasos';
                break;
            case 'revenue-forecast':
                endpoint = '/reportes/proyeccion-ingresos';
                break;
            case 'profitability-analysis':
                endpoint = `/reportes/analisis-rentabilidad?periodo=${periodo}`;
                break;
            default:
                endpoint = `/reportes/resumen-pagos?periodo=${periodo}`;
        }
        
        // Realizar la petición a la API
        reportData = await apiFetch(endpoint);
        console.log('Respuesta de API:', reportData);
        
        // Guardar datos para exportación
        currentReportData = reportData;
        currentReportType = tipo;
        
        // Mostrar el reporte según el tipo
        displayReport(tipo, reportData);
        
        showToast('Reporte Generado', 'Reporte generado correctamente.', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        showToast('Error', error.data?.message || error.message || 'Error al generar reporte.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Muestra un reporte en la interfaz
 * @param {string} tipo - Tipo de reporte
 * @param {Object} datos - Datos del reporte
 */
function displayReport(tipo, datos) {
    console.log(`Mostrando reporte tipo: ${tipo}`);
    
    // Limpiar el contenedor de reportes
    const reportContent = document.querySelector('.report-content');
    if (!reportContent) {
        console.error('Contenedor de reportes no encontrado.');
        return;
    }
    
    let contenidoHTML = '';
    
    switch (tipo) {
        case 'payment-summary':
            contenidoHTML = generatePaymentSummaryHTML(datos);
            break;
        case 'client-status':
            contenidoHTML = generateClientStatusHTML(datos);
            break;
        case 'delay-analysis':
            contenidoHTML = generateDelayAnalysisHTML(datos);
            break;
        case 'revenue-forecast':
            contenidoHTML = generateRevenueForecastHTML(datos);
            break;
        case 'profitability-analysis':
            contenidoHTML = generateProfitabilityAnalysisHTML(datos);
            break;
        default:
            contenidoHTML = '<p class="error-message">Tipo de reporte no soportado.</p>';
    }
    
    reportContent.innerHTML = contenidoHTML;
    
    // Generar cualquier gráfico que sea necesario
    createReportCharts(tipo, datos);
    
    // Activar botones de exportación
    enableExportButtons();
}

/**
 * Activa los botones de exportación de reportes
 */
function enableExportButtons() {
    const exportBtn = document.getElementById('export-report-btn');
    const printBtn = document.getElementById('print-report-btn');
    
    if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.classList.remove('disabled');
    }
    
    if (printBtn) {
        printBtn.disabled = false;
        printBtn.classList.remove('disabled');
    }
}

/**
 * Crea gráficos para los reportes usando ChartJS
 * @param {string} tipo - Tipo de reporte
 * @param {Object} datos - Datos para generar gráficos
 */
function createReportCharts(tipo, datos) {
    // Intentar cargar la biblioteca Chart.js
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está disponible. Los gráficos no se generarán.');
        
        // Mostrar mensaje en los contenedores de gráficos
        document.querySelectorAll('.chart-canvas').forEach(canvas => {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.font = '16px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('Gráfico no disponible - Chart.js no cargado', canvas.width / 2, canvas.height / 2);
        });
        
        return;
    }

    // Limpiar gráficos anteriores
    Chart.helpers.each(Chart.instances, function(instance) {
        instance.destroy();
    });

    // Crear gráficos según el tipo de reporte
    switch (tipo) {
        case 'payment-summary':
            createPaymentSummaryCharts(datos);
            break;
        case 'client-status':
            createClientStatusCharts(datos);
            break;
        case 'delay-analysis':
            createDelayAnalysisCharts(datos);
            break;
        case 'revenue-forecast':
            createRevenueForecastCharts(datos);
            break;
        case 'profitability-analysis':
            createProfitabilityAnalysisCharts(datos);
            break;
    }
}

/**
 * Crea gráficos para el resumen de pagos
 * @param {Object} datos - Datos del reporte
 */
function createPaymentSummaryCharts(datos) {
    const resumen = datos.resumen || {};
    
    // Gráfico de estado de cobros
    const estadoCanvas = document.getElementById('cobros-estado-chart');
    if (estadoCanvas) {
        const ctx = estadoCanvas.getContext('2d');
        
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Pagados', 'Pendientes', 'Atrasados', 'Anulados'],
                datasets: [{
                    data: [
                        resumen.pagados || 0,
                        resumen.pendientes || 0,
                        resumen.atrasados || 0,
                        resumen.anulados || 0
                    ],
                    backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#9e9e9e'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Gráfico de servicios más rentables
    const serviciosCanvas = document.getElementById('top-servicios-chart');
    if (serviciosCanvas && datos.topServicios && datos.topServicios.length > 0) {
        const ctx = serviciosCanvas.getContext('2d');
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datos.topServicios.map(s => s.nombre),
                datasets: [{
                    label: 'Monto total',
                    data: datos.topServicios.map(s => parseFloat(s.montoTotal)),
                    backgroundColor: '#4a6da7',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'S/ ' + value.toLocaleString('es-PE');
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                return `Monto: S/ ${value.toLocaleString('es-PE')}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Crea gráficos para el estado de clientes
 * @param {Object} datos - Datos del reporte
 */
function createClientStatusCharts(datos) {
    // Gráfico de distribución de clientes
    const clientesCanvas = document.getElementById('clientes-distribucion-chart');
    if (clientesCanvas) {
        const ctx = clientesCanvas.getContext('2d');
        
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Activos sin deuda', 'Con deuda', 'Con atrasos'],
                datasets: [{
                    data: [
                        datos.clientesActivos - datos.clientesConDeuda || 0,
                        datos.clientesConDeuda - datos.clientesConAtrasos || 0,
                        datos.clientesConAtrasos || 0
                    ],
                    backgroundColor: ['#4caf50', '#ff9800', '#f44336'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Gráfico de concentración de deuda
    const deudaCanvas = document.getElementById('concentracion-deuda-chart');
    if (deudaCanvas && datos.concentracionDeuda && datos.concentracionDeuda.length > 0) {
        const ctx = deudaCanvas.getContext('2d');
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datos.concentracionDeuda.map(c => c.nombre),
                datasets: [{
                    label: 'Deuda',
                    data: datos.concentracionDeuda.map(c => parseFloat(c.montoPendiente)),
                    backgroundColor: '#f44336',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'S/ ' + value.toLocaleString('es-PE');
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                return `Deuda: S/ ${value.toLocaleString('es-PE')}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Crea gráficos para el análisis de atrasos
 * @param {Object} datos - Datos del reporte
 */
function createDelayAnalysisCharts(datos) {
    // Gráfico de distribución de atrasos
    const atrasosCanvas = document.getElementById('atrasos-distribucion-chart');
    if (atrasosCanvas) {
        const ctx = atrasosCanvas.getContext('2d');
        
        const distribucion = datos.distribucionAtrasos || {};
        
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['< 15 días', '15-30 días', '30-60 días', '> 60 días'],
                datasets: [{
                    data: [
                        distribucion.menosDe15Dias || 0,
                        distribucion.entre15y30Dias || 0,
                        distribucion.entre30y60Dias || 0,
                        distribucion.masDe60Dias || 0
                    ],
                    backgroundColor: ['#ff9800', '#fb8c00', '#f57c00', '#e65100'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Gráfico de montos por categoría de atraso
    const montosCanvas = document.getElementById('montos-atraso-chart');
    if (montosCanvas && datos.distribucionAtrasos?.montoPorCategoria) {
        const ctx = montosCanvas.getContext('2d');
        const montosPorCategoria = datos.distribucionAtrasos.montoPorCategoria;
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['< 15 días', '15-30 días', '30-60 días', '> 60 días'],
                datasets: [{
                    label: 'Monto Atrasado',
                    data: [
                        parseFloat(montosPorCategoria.menosDe15Dias || 0),
                        parseFloat(montosPorCategoria.entre15y30Dias || 0),
                        parseFloat(montosPorCategoria.entre30y60Dias || 0),
                        parseFloat(montosPorCategoria.masDe60Dias || 0)
                    ],
                    backgroundColor: ['#ff9800', '#fb8c00', '#f57c00', '#e65100'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'S/ ' + value.toLocaleString('es-PE');
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                return `Monto: S/ ${value.toLocaleString('es-PE')}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Crea gráficos para la proyección de ingresos
 * @param {Object} datos - Datos del reporte
 */
function createRevenueForecastCharts(datos) {
    // Gráfico de proyección por período
    const proyeccionCanvas = document.getElementById('proyeccion-ingresos-chart');
    if (proyeccionCanvas && datos.proyeccion) {
        const ctx = proyeccionCanvas.getContext('2d');
        const proyeccion = datos.proyeccion;
        const nombresMeses = datos.nombresMeses || {};
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [
                    nombresMeses.mesActual || 'Mes Actual',
                    nombresMeses.mesSiguiente || 'Mes Siguiente',
                    nombresMeses.mesSubsiguiente || 'Mes Subsiguiente',
                    'Posterior'
                ],
                datasets: [{
                    label: 'Monto Proyectado',
                    data: [
                        parseFloat(proyeccion.mesActual?.monto || 0),
                        parseFloat(proyeccion.mesSiguiente?.monto || 0),
                        parseFloat(proyeccion.mesSubsiguiente?.monto || 0),
                        parseFloat(proyeccion.posterior?.monto || 0)
                    ],
                    backgroundColor: ['#4caf50', '#8bc34a', '#cddc39', '#ffeb3b'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'S/ ' + value.toLocaleString('es-PE');
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                const cantidad = [
                                    proyeccion.mesActual?.cantidad || 0,
                                    proyeccion.mesSiguiente?.cantidad || 0,
                                    proyeccion.mesSubsiguiente?.cantidad || 0,
                                    proyeccion.posterior?.cantidad || 0
                                ][context.dataIndex];
                                
                                return [
                                    `Monto: S/ ${value.toLocaleString('es-PE')}`,
                                    `Cobros: ${cantidad}`
                                ];
                            }
                        }
                    }
                }
            }
        });
    }

    // Gráfico de probabilidad de pago
    const probabilidadCanvas = document.getElementById('probabilidad-pago-chart');
    if (probabilidadCanvas && datos.probabilidadPago) {
        const ctx = probabilidadCanvas.getContext('2d');
        const probabilidad = datos.probabilidadPago;
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Alta (>80%)', 'Media (50-80%)', 'Baja (<50%)'],
                datasets: [{
                    data: [
                        probabilidad.clientesAlta || 0,
                        probabilidad.clientesMedia || 0,
                        probabilidad.clientesBaja || 0
                    ],
                    backgroundColor: ['#4caf50', '#ff9800', '#f44336'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} clientes (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Crea gráficos para el análisis de rentabilidad
 * @param {Object} datos - Datos del reporte
 */
function createProfitabilityAnalysisCharts(datos) {
    // Gráfico de rentabilidad por servicio
    const rentabilidadCanvas = document.getElementById('rentabilidad-servicios-chart');
    if (rentabilidadCanvas && datos.servicios && datos.servicios.length > 0) {
        const ctx = rentabilidadCanvas.getContext('2d');
        // Limitar a los 5 servicios más rentables para mejor visualización
        const topServicios = datos.servicios.slice(0, 5);
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topServicios.map(s => s.nombre),
                datasets: [{
                    label: 'Monto Facturado',
                    data: topServicios.map(s => parseFloat(s.montoFacturado)),
                    backgroundColor: '#4a6da7',
                    borderWidth: 1
                }, {
                    label: 'Monto Cobrado',
                    data: topServicios.map(s => parseFloat(s.montoCobrado)),
                    backgroundColor: '#4caf50',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'S/ ' + value.toLocaleString('es-PE');
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.raw || 0;
                                return `${label}: S/ ${value.toLocaleString('es-PE')}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Gráfico de tasas de conversión
    const conversionCanvas = document.getElementById('conversion-servicios-chart');
    if (conversionCanvas && datos.servicios && datos.servicios.length > 0) {
        const ctx = conversionCanvas.getContext('2d');
        // Limitar a los 5 servicios más rentables para mejor visualización
        const topServicios = datos.servicios.slice(0, 5);
        
        new Chart(ctx, {
            type: 'horizontalBar', // Si no está disponible, usar 'bar'
            data: {
                labels: topServicios.map(s => s.nombre),
                datasets: [{
                    label: 'Tasa de Conversión',
                    data: topServicios.map(s => parseFloat(s.tasaConversion)),
                    backgroundColor: '#ff9800',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Para Chart.js 3.x
                responsive: true,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                return `Tasa de Conversión: ${value}%`;
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Genera HTML para el reporte de resumen de pagos
 * @param {Object} datos - Datos del reporte
 * @returns {string} HTML generado
 */
function generatePaymentSummaryHTML(datos) {
    console.log('Generando HTML para resumen de pagos:', datos);
    
    // Formatear fechas para mejor legibilidad
    const fechaInicio = formatDate(datos.fechaInicio);
    const fechaFin = formatDate(datos.fechaFin);
    
    // Obtener los datos del resumen
    const resumen = datos.resumen || {};
    
    // Calcular porcentajes para el gráfico
    const porcentajePagados = parseFloat(resumen.porcentajePagado || 0);
    const porcentajePendientes = (resumen.pendientes / resumen.totalCobros * 100) || 0;
    const porcentajeAtrasados = (resumen.atrasados / resumen.totalCobros * 100) || 0;
    const porcentajeAnulados = (resumen.anulados / resumen.totalCobros * 100) || 0;
    
    return `
        <div class="report-section payment-summary">
            <h2>Resumen de Pagos</h2>
            <div class="report-period">
                <p>Período: <strong>${getPeriodName(datos.periodo)}</strong> (${fechaInicio} - ${fechaFin})</p>
            </div>
            
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-icon payments-icon">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Total Cobros</h3>
                        <p class="stat-value">${resumen.totalCobros || 0}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon money-icon">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Monto Total</h3>
                        <p class="stat-value">${formatCurrency(resumen.montoTotalEmitido || 0)}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon paid-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Cobros Pagados</h3>
                        <p class="stat-value">${resumen.pagados || 0}</p>
                        <p class="stat-percentage">${porcentajePagados.toFixed(2)}%</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon money-collected-icon">
                        <i class="fas fa-hand-holding-usd"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Monto Cobrado</h3>
                        <p class="stat-value">${formatCurrency(resumen.montoTotalPagado || 0)}</p>
                        <p class="stat-percentage">${parseFloat(resumen.porcentajeMontoPagado || 0).toFixed(2)}%</p>
                    </div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="chart-card">
                    <h3>Estado de Cobros</h3>
                    <canvas id="cobros-estado-chart" width="400" height="300" class="chart-canvas"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Desglose de Montos</h3>
                    <div class="amount-breakdown">
                        <div class="breakdown-item">
                            <div class="breakdown-label">Monto Emitido</div>
                            <div class="breakdown-bar-container">
                                <div class="breakdown-bar" style="width: 100%; background-color: #e0e0e0;">
                                    <span>${formatCurrency(resumen.montoTotalEmitido || 0)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="breakdown-item">
                            <div class="breakdown-label">Monto Cobrado</div>
                            <div class="breakdown-bar-container">
                                <div class="breakdown-bar" style="width: ${parseFloat(resumen.porcentajeMontoPagado || 0)}%; background-color: #4caf50;">
                                    <span>${formatCurrency(resumen.montoTotalPagado || 0)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="breakdown-item">
                            <div class="breakdown-label">Monto Pendiente</div>
                            <div class="breakdown-bar-container">
                                <div class="breakdown-bar" style="width: ${100 - parseFloat(resumen.porcentajeMontoPagado || 0)}%; background-color: #ff9800;">
                                    <span>${formatCurrency((resumen.montoTotalEmitido || 0) - (resumen.montoTotalPagado || 0))}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${datos.topServicios && datos.topServicios.length > 0 ? `
            <div class="chart-card">
                <h3>Servicios más Rentables</h3>
                <canvas id="top-servicios-chart" width="600" height="300" class="chart-canvas"></canvas>
            </div>` : ''}
            
            ${datos.comparativa ? `
            <div class="comparison-section">
                <h3>Comparativa con Periodo Anterior</h3>
                <div class="comparison-container">
                    <div class="comparison-item ${parseFloat(datos.comparativa.variaciones.totalCobros) >= 0 ? 'positive' : 'negative'}">
                        <div class="comparison-label">Cobros</div>
                        <div class="comparison-value">
                            <i class="fas fa-${parseFloat(datos.comparativa.variaciones.totalCobros) >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                            ${Math.abs(parseFloat(datos.comparativa.variaciones.totalCobros)).toFixed(2)}%
                        </div>
                    </div>
                    <div class="comparison-item ${parseFloat(datos.comparativa.variaciones.pagados) >= 0 ? 'positive' : 'negative'}">
                        <div class="comparison-label">Pagados</div>
                        <div class="comparison-value">
                            <i class="fas fa-${parseFloat(datos.comparativa.variaciones.pagados) >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                            ${Math.abs(parseFloat(datos.comparativa.variaciones.pagados)).toFixed(2)}%
                        </div>
                    </div>
                    <div class="comparison-item ${parseFloat(datos.comparativa.variaciones.montoTotalEmitido) >= 0 ? 'positive' : 'negative'}">
                        <div class="comparison-label">Monto Emitido</div>
                        <div class="comparison-value">
                            <i class="fas fa-${parseFloat(datos.comparativa.variaciones.montoTotalEmitido) >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                            ${Math.abs(parseFloat(datos.comparativa.variaciones.montoTotalEmitido)).toFixed(2)}%
                        </div>
                    </div>
                    <div class="comparison-item ${parseFloat(datos.comparativa.variaciones.montoTotalPagado) >= 0 ? 'positive' : 'negative'}">
                        <div class="comparison-label">Monto Cobrado</div>
                        <div class="comparison-value">
                            <i class="fas fa-${parseFloat(datos.comparativa.variaciones.montoTotalPagado) >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                            ${Math.abs(parseFloat(datos.comparativa.variaciones.montoTotalPagado)).toFixed(2)}%
                        </div>
                    </div>
                </div>
                <p class="comparison-period">Periodo anterior: ${formatDate(datos.comparativa.periodoAnterior.fechaInicio)} - ${formatDate(datos.comparativa.periodoAnterior.fechaFin)}</p>
            </div>` : ''}
            
            ${datos.diasPromedioCobro ? `
            <div class="additional-metrics">
                <div class="metric-item">
                    <div class="metric-icon"><i class="fas fa-calendar-day"></i></div>
                    <div class="metric-info">
                        <h4>Días Promedio de Cobro</h4>
                        <div class="metric-value">${datos.diasPromedioCobro}</div>
                    </div>
                </div>
            </div>` : ''}
        </div>
    `;
}

/**
 * Genera HTML para el reporte de estado de clientes
 * @param {Object} datos - Datos del reporte
 * @returns {string} HTML generado
 */
function generateClientStatusHTML(datos) {
    console.log('Generando HTML para estado de clientes:', datos);
    
    const clientes = datos.clientes || [];
    
    // Preparar tabla de clientes
    let filasTabla = '';
    clientes.slice(0, 10).forEach(cliente => {
        const estadoClass = formatClientClass(cliente.estado);
        
        filasTabla += `
            <tr>
                <td>${cliente.nombre}</td>
                <td>${cliente.correo || 'No registrado'}</td>
                <td>${cliente.telefono || 'No registrado'}</td>
                <td><span class="status-badge ${estadoClass}">${cliente.estado}</span></td>
                <td>${cliente.cobrosPendientes}</td>
                <td>${cliente.cobrosAtrasados}</td>
                <td>${formatCurrency(cliente.montoPendiente)}</td>
                <td>${cliente.vencimientoProximo ? '<i class="fas fa-exclamation-triangle warning-icon"></i>' : ''}</td>
            </tr>
        `;
    });
    
    return `
        <div class="report-section client-status">
            <h2>Estado de Clientes</h2>
            
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-icon clients-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Total Clientes</h3>
                        <p class="stat-value">${datos.totalClientes || 0}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon active-icon">
                        <i class="fas fa-user-check"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Clientes Activos</h3>
                        <p class="stat-value">${datos.clientesActivos || 0}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon debt-icon">
                        <i class="fas fa-hand-holding-usd"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Con Deuda</h3>
                        <p class="stat-value">${datos.clientesConDeuda || 0}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon money-icon">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Monto Pendiente</h3>
                        <p class="stat-value">${formatCurrency(datos.montoPendienteTotal || 0)}</p>
                    </div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="chart-card">
                    <h3>Distribución de Clientes</h3>
                    <canvas id="clientes-distribucion-chart" width="400" height="300" class="chart-canvas"></canvas>
                </div>
                
                ${datos.concentracionDeuda && datos.concentracionDeuda.length > 0 ? `
                <div class="chart-card">
                    <h3>Concentración de Deuda</h3>
                    <canvas id="concentracion-deuda-chart" width="400" height="300" class="chart-canvas"></canvas>
                </div>` : ''}
            </div>
            
            <div class="table-container">
                <h3>Detalle de Clientes</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Correo</th>
                            <th>Teléfono</th>
                            <th>Estado</th>
                            <th>Cobros Pendientes</th>
                            <th>Cobros Atrasados</th>
                            <th>Monto Pendiente</th>
                            <th>Vence Pronto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasTabla}
                    </tbody>
                </table>
                ${clientes.length > 10 ? '<p class="table-note">* Mostrando los primeros 10 clientes. Exporte el reporte para ver todos.</p>' : ''}
            </div>
        </div>
    `;
}

/**
 * Genera HTML para el reporte de análisis de atrasos
 * @param {Object} datos - Datos del reporte
 * @returns {string} HTML generado
 */
function generateDelayAnalysisHTML(datos) {
    console.log('Generando HTML para análisis de atrasos:', datos);
    
    const cobros = datos.cobrosAtrasados || [];
    
    // Preparar tabla de cobros atrasados
    let filasTabla = '';
    cobros.slice(0, 10).forEach(cobro => {
        filasTabla += `
            <tr>
                <td>${cobro.clienteNombre}</td>
                <td>${cobro.servicio}</td>
                <td>${formatCurrency(cobro.monto)}</td>
                <td>${formatDate(cobro.fechaVencimiento)}</td>
                <td><span class="delay-days">${cobro.diasAtraso} días</span></td>
                <td>${cobro.clienteContacto}</td>
            </tr>
        `;
    });
    
    return `
        <div class="report-section delay-analysis">
            <h2>Análisis de Atrasos</h2>
            
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-icon overdue-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Cobros Atrasados</h3>
                        <p class="stat-value">${datos.totalCobrosAtrasados || 0}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon money-overdue-icon">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Monto Atrasado</h3>
                        <p class="stat-value">${formatCurrency(datos.montoTotalAtrasado || 0)}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon percentage-icon">
                        <i class="fas fa-percentage"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Índice Morosidad</h3>
                        <p class="stat-value">${datos.indiceMorosidad || 0}%</p>
                    </div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="chart-card">
                    <h3>Distribución por Atraso</h3>
                    <canvas id="atrasos-distribucion-chart" width="400" height="300" class="chart-canvas"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Montos por Categoría</h3>
                    <canvas id="montos-atraso-chart" width="400" height="300" class="chart-canvas"></canvas>
                </div>
            </div>
            
            ${datos.analisisClientes && datos.analisisClientes.length > 0 ? `
            <div class="client-analysis">
                <h3>Clientes con Mayor Deuda Atrasada</h3>
                <div class="analysis-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Cobros Atrasados</th>
                                <th>Monto Total</th>
                                <th>% del Total</th>
                                <th>Cobro Más Antiguo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${datos.analisisClientes.map(cliente => `
                                <tr>
                                    <td>${cliente.nombre}</td>
                                    <td>${cliente.cobrosAtrasados}</td>
                                    <td>${formatCurrency(cliente.montoTotal)}</td>
                                    <td>${cliente.porcentajeDel}</td>
                                    <td>${cliente.cobroMasAntiguo} días</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>` : ''}
            
            <div class="table-container">
                <h3>Detalle de Cobros Atrasados</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Servicio</th>
                            <th>Monto</th>
                            <th>Vencimiento</th>
                            <th>Atraso</th>
                            <th>Contacto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasTabla}
                    </tbody>
                </table>
                ${cobros.length > 10 ? '<p class="table-note">* Mostrando los primeros 10 cobros atrasados. Exporte el reporte para ver todos.</p>' : ''}
            </div>
        </div>
    `;
}

/**
 * Genera HTML para el reporte de proyección de ingresos
 * @param {Object} datos - Datos del reporte
 * @returns {string} HTML generado
 */
function generateRevenueForecastHTML(datos) {
    console.log('Generando HTML para proyección de ingresos:', datos);
    
    // Formatear nombres de meses para mejorar legibilidad
    const nombreMesActual = datos.nombresMeses?.mesActual || 'Mes Actual';
    const nombreMesSiguiente = datos.nombresMeses?.mesSiguiente || 'Mes Siguiente';
    const nombreMesSubsiguiente = datos.nombresMeses?.mesSubsiguiente || 'Mes Subsiguiente';
    
    return `
        <div class="report-section revenue-forecast">
            <h2>Proyección de Ingresos</h2>
            
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-icon forecast-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Total Proyectado</h3>
                        <p class="stat-value">${formatCurrency(datos.totalMontoProyectado || 0)}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon payments-icon">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Cobros Pendientes</h3>
                        <p class="stat-value">${datos.totalCobrosProyectados || 0}</p>
                    </div>
                </div>
                ${datos.indiceRotacion ? `
                <div class="stat-card">
                    <div class="stat-icon rotation-icon">
                        <i class="fas fa-sync-alt"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Índice Rotación</h3>
                        <p class="stat-value">${datos.indiceRotacion}</p>
                    </div>
                </div>` : ''}
            </div>
            
            <div class="charts-container">
                <div class="chart-card">
                    <h3>Proyección por Período</h3>
                    <canvas id="proyeccion-ingresos-chart" width="600" height="300" class="chart-canvas"></canvas>
                </div>
                
                ${datos.probabilidadPago ? `
                <div class="chart-card">
                    <h3>Probabilidad de Pago</h3>
                    <canvas id="probabilidad-pago-chart" width="400" height="300" class="chart-canvas"></canvas>
                </div>` : ''}
            </div>
            
            <div class="forecast-details">
                <div class="forecast-period">
                    <h3>${nombreMesActual}</h3>
                    <div class="forecast-stats">
                        <p><i class="fas fa-file-invoice"></i> Cobros: <strong>${datos.proyeccion?.mesActual?.cantidad || 0}</strong></p>
                        <p><i class="fas fa-money-bill-wave"></i> Monto: <strong>${formatCurrency(datos.proyeccion?.mesActual?.monto || 0)}</strong></p>
                    </div>
                </div>
                <div class="forecast-period">
                    <h3>${nombreMesSiguiente}</h3>
                    <div class="forecast-stats">
                        <p><i class="fas fa-file-invoice"></i> Cobros: <strong>${datos.proyeccion?.mesSiguiente?.cantidad || 0}</strong></p>
                        <p><i class="fas fa-money-bill-wave"></i> Monto: <strong>${formatCurrency(datos.proyeccion?.mesSiguiente?.monto || 0)}</strong></p>
                    </div>
                </div>
                <div class="forecast-period">
                    <h3>${nombreMesSubsiguiente}</h3>
                    <div class="forecast-stats">
                        <p><i class="fas fa-file-invoice"></i> Cobros: <strong>${datos.proyeccion?.mesSubsiguiente?.cantidad || 0}</strong></p>
                        <p><i class="fas fa-money-bill-wave"></i> Monto: <strong>${formatCurrency(datos.proyeccion?.mesSubsiguiente?.monto || 0)}</strong></p>
                    </div>
                </div>
                <div class="forecast-period">
                    <h3>Meses Posteriores</h3>
                    <div class="forecast-stats">
                        <p><i class="fas fa-file-invoice"></i> Cobros: <strong>${datos.proyeccion?.posterior?.cantidad || 0}</strong></p>
                        <p><i class="fas fa-money-bill-wave"></i> Monto: <strong>${formatCurrency(datos.proyeccion?.posterior?.monto || 0)}</strong></p>
                    </div>
                </div>
            </div>
            
            ${datos.probabilidadPago?.detalle && datos.probabilidadPago.detalle.length > 0 ? `
            <div class="probability-details">
                <h3>Detalle de Probabilidad de Pago</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Pagados / Total</th>
                            <th>Probabilidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${datos.probabilidadPago.detalle.map(cliente => `
                            <tr>
                                <td>${cliente.nombreCliente}</td>
                                <td>${cliente.cobrosPagados} / ${cliente.totalCobros}</td>
                                <td>${cliente.probabilidadPago}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>` : ''}
        </div>
    `;
}

/**
 * Genera HTML para el reporte de análisis de rentabilidad
 * @param {Object} datos - Datos del reporte
 * @returns {string} HTML generado
 */
function generateProfitabilityAnalysisHTML(datos) {
    console.log('Generando HTML para análisis de rentabilidad:', datos);
    
    // Formatear fechas para mejor legibilidad
    const fechaInicio = formatDate(datos.fechaInicio);
    const fechaFin = formatDate(datos.fechaFin);
    
    // Preparar tabla de rentabilidad
    let filasTabla = '';
    if (datos.servicios && datos.servicios.length > 0) {
        datos.servicios.forEach(servicio => {
            filasTabla += `
                <tr>
                    <td>${servicio.nombre}</td>
                    <td>${formatCurrency(servicio.precioBase)}</td>
                    <td>${formatCurrency(servicio.precioPromedio)}</td>
                    <td>${servicio.desviacionPrecio}</td>
                    <td>${servicio.cobrosPagados} / ${servicio.totalCobros}</td>
                    <td>${servicio.tasaConversion}</td>
                    <td>${formatCurrency(servicio.montoFacturado)}</td>
                    <td>${formatCurrency(servicio.montoCobrado)}</td>
                </tr>
            `;
        });
    }
    
    return `
        <div class="report-section profitability-analysis">
            <h2>Análisis de Rentabilidad de Servicios</h2>
            <div class="report-period">
                <p>Período: <strong>${getPeriodName(datos.periodo)}</strong> (${fechaInicio} - ${fechaFin})</p>
            </div>
            
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-icon services-icon">
                        <i class="fas fa-cogs"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Total Servicios</h3>
                        <p class="stat-value">${datos.totalServicios || 0}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon money-icon">
                        <i class="fas fa-file-invoice-dollar"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Total Facturado</h3>
                        <p class="stat-value">${formatCurrency(datos.totalFacturado || 0)}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon money-icon">
                        <i class="fas fa-hand-holding-usd"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Total Cobrado</h3>
                        <p class="stat-value">${formatCurrency(datos.totalCobrado || 0)}</p>
                        <p class="stat-percentage">${datos.porcentajeCobrado || '0.00%'}</p>
                    </div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="chart-card">
                    <h3>Rentabilidad por Servicio</h3>
                    <canvas id="rentabilidad-servicios-chart" width="600" height="300" class="chart-canvas"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Tasas de Conversión</h3>
                    <canvas id="conversion-servicios-chart" width="600" height="300" class="chart-canvas"></canvas>
                </div>
            </div>
            
            <div class="table-container">
                <h3>Detalle de Rentabilidad por Servicio</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Servicio</th>
                            <th>Precio Base</th>
                            <th>Precio Promedio</th>
                            <th>Desviación</th>
                            <th>Pagados / Total</th>
                            <th>Tasa Conversión</th>
                            <th>Monto Facturado</th>
                            <th>Monto Cobrado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasTabla}
                    </tbody>
                </table>
            </div>
            
            <div class="analysis-footer">
                <p><strong>Nota:</strong> La tasa de conversión representa el porcentaje de cobros emitidos que han sido pagados. La desviación del precio indica la diferencia porcentual entre el precio promedio y el precio base establecido para el servicio.</p>
            </div>
        </div>
    `;
}

/**
 * Exporta un reporte como archivo HTML
 */
function exportReport() {
    console.log('Exportando reporte actual...');
    
    if (!currentReportData || !currentReportType) {
        showToast('Error', 'No hay contenido para exportar. Genera un reporte primero.', 'error');
        return;
    }
    
    const reportType = currentReportType;
    const reportData = currentReportData;
    
    // Crear un HTML completo para la exportación
    const reportTitle = formatReportTitle(reportType);
    const fecha = formatDate(new Date(), 'medium');
    
    // Obtener el contenido del reporte actual
    let reportContent = '';
    switch (reportType) {
        case 'payment-summary':
            reportContent = generatePaymentSummaryHTML(reportData);
            break;
        case 'client-status':
            reportContent = generateClientStatusHTML(reportData);
            break;
        case 'delay-analysis':
            reportContent = generateDelayAnalysisHTML(reportData);
            break;
        case 'revenue-forecast':
            reportContent = generateRevenueForecastHTML(reportData);
            break;
        case 'profitability-analysis':
            reportContent = generateProfitabilityAnalysisHTML(reportData);
            break;
        default:
            showToast('Error', 'Tipo de reporte no soportado.', 'error');
            return;
    }
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte PEGASUS - ${reportTitle}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #4a6da7; margin-bottom: 5px; }
                .header p { color: #666; margin-top: 0; }
                h2 { color: #4a6da7; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                h3 { color: #555; }
                .stats-container { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px; }
                .stat-card { flex: 1; min-width: 200px; border: 1px solid #ddd; border-radius: 5px; padding: 15px; }
                .stat-details h3 { margin-top: 0; }
                .stat-value { font-size: 24px; font-weight: bold; margin: 10px 0; color: #4a6da7; }
                .stat-percentage { color: #4caf50; font-weight: bold; }
                .table-container { margin-top: 30px; overflow: auto; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f8f8f8; }
                .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
                .chart-placeholder { background-color: #f8f8f8; height: 300px; display: flex; 
                                     justify-content: center; align-items: center; margin: 20px 0; 
                                     border: 1px dashed #ddd; }
                .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                .active { background-color: #4caf50; color: white; }
                .pending { background-color: #ff9800; color: white; }
                .overdue { background-color: #f44336; color: white; }
                .inactive { background-color: #9e9e9e; color: white; }
                .paid { background-color: #4caf50; color: white; }
                .breakdown-bar-container { width: 100%; background-color: #f5f5f5; height: 24px; border-radius: 12px; overflow: hidden; margin: 8px 0; }
                .breakdown-bar { height: 100%; color: white; display: flex; align-items: center; padding: 0 10px; }
                .delay-days { display: inline-block; padding: 2px 6px; background-color: #f44336; color: white; border-radius: 12px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Reporte PEGASUS - ${reportTitle}</h1>
                <p>Generado: ${fecha}</p>
            </div>
            
            ${reportContent.replace(/<canvas[^>]*>/g, '<div class="chart-placeholder">AQUÍ APARECERÍA UN GRÁFICO EN LA VERSIÓN WEB</div>')}
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} PEGASUS S.A.C. - Sistema de Cobros</p>
            </div>
        </body>
        </html>
    `;
    
    // Crear un Blob y generar URL para descarga
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Crear enlace y descargar
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_pegasus_${reportType}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Reporte Exportado', 'El reporte ha sido exportado correctamente.', 'success');
}

export {
    initReports,
    setupReportFilters,
    generateReport,
    displayReport,
    exportReport,
    createReportCharts
}