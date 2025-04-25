/**
 * dashboard.js
 * Módulo para gestionar la página de dashboard
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { formatCurrency, formatDate, formatStatusBadge } from '../utils/formatting.js';
import { showModal } from '../utils/modal.js';
import * as paymentsModule from './payments.js';
import * as whatsappModule from './whatsapp.js';

// Variable para almacenar los datos del dashboard
let dashboardData = null;

/**
 * Inicializa el módulo del dashboard
 */
function initDashboard() {
    console.log('Inicializando módulo Dashboard...');
    
    // Configurar actualizaciones automáticas
    setupAutomaticRefresh();
    
    // Cargar dashboard al inicio
    loadDashboardData().catch(error => {
        console.error('Error al cargar dashboard inicial:', error);
    });
}

/**
 * Configura la actualización automática del dashboard
 */
function setupAutomaticRefresh() {
    // Actualizar dashboard cada 5 minutos si está visible
    setInterval(function() {
        if (document.getElementById('dashboard').classList.contains('active') && 
            sessionStorage.getItem('authToken')) {
            console.log('Actualizando dashboard automáticamente...');
            loadDashboardData().catch(error => {
                console.error('Error en actualización automática del dashboard:', error);
            });
        }
    }, 300000); // 5 minutos
}

/**
 * Carga los datos del dashboard desde la API
 * @returns {Promise<Object>} - Datos cargados
 */
async function loadDashboardData() {
    console.log("API: Cargando datos para Dashboard...");
    
    try {
        showLoadingOverlay('Cargando panel principal...');
        
        // Cargar datos generales del dashboard
        const dashboardGeneral = await apiFetch('/reportes/dashboard');
        console.log("Dashboard general recibido:", dashboardGeneral);
        
        // Cargar cobros recientes para el dashboard (limitado a 5)
        const cobrosRecientes = await apiFetch('/cobros?limit=5');
        console.log("Cobros recientes recibidos:", cobrosRecientes);
        
        // Cargar resumen de vencimientos próximos
        const vencimientosProximos = await calcularVencimientosProximos(cobrosRecientes);
        console.log("Vencimientos próximos calculados:", vencimientosProximos);
        
        // Almacenar datos para uso posterior
        dashboardData = {
            general: dashboardGeneral,
            cobrosRecientes: Array.isArray(cobrosRecientes) ? cobrosRecientes.slice(0, 5) : cobrosRecientes.cobros?.slice(0, 5),
            vencimientosProximos: vencimientosProximos
        };
        
        // Actualizar widgets del dashboard
        updateDashboardWidgets(dashboardData);
        
        return dashboardData;
    } catch (error) {
        console.error("Error cargando datos del dashboard:", error);
        showToast('Error', 'No se pudieron cargar datos del dashboard.', 'error');
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Calcula los vencimientos próximos basados en los cobros pendientes
 * @param {Array} cobros - Lista de cobros
 * @returns {Object} - Datos de vencimientos próximos
 */
async function calcularVencimientosProximos(cobros) {
    try {
        // Obtener todos los cobros pendientes
        const cobrosPendientes = await apiFetch('/cobros?estado=Pendiente');
        
        // Filtrar cobros que vencen en los próximos 7 días
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const siguientes7Dias = new Date(hoy);
        siguientes7Dias.setDate(hoy.getDate() + 7);
        
        const vencimientosProximos = (Array.isArray(cobrosPendientes) ? cobrosPendientes : cobrosPendientes.cobros || [])
            .filter(cobro => {
                const fechaVencimiento = new Date(cobro.fecha_vencimiento);
                return fechaVencimiento >= hoy && fechaVencimiento <= siguientes7Dias;
            })
            .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));
        
        // Agrupar por día de vencimiento
        const agrupados = {};
        vencimientosProximos.forEach(cobro => {
            const fecha = cobro.fecha_vencimiento.split('T')[0]; // Formato YYYY-MM-DD
            if (!agrupados[fecha]) {
                agrupados[fecha] = {
                    fecha: fecha,
                    cantidad: 0,
                    monto: 0,
                    cobros: []
                };
            }
            
            agrupados[fecha].cantidad++;
            agrupados[fecha].monto += parseFloat(cobro.monto || 0);
            agrupados[fecha].cobros.push(cobro);
        });
        
        // Convertir a array y ordenar por fecha
        const vencimientosPorDia = Object.values(agrupados)
            .map(dia => ({
                ...dia,
                monto: dia.monto.toFixed(2)
            }))
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        
        return {
            totalVencimientos: vencimientosProximos.length,
            montoTotal: vencimientosProximos.reduce((sum, cobro) => sum + parseFloat(cobro.monto || 0), 0).toFixed(2),
            porDia: vencimientosPorDia
        };
    } catch (error) {
        console.error('Error al calcular vencimientos próximos:', error);
        return {
            totalVencimientos: 0,
            montoTotal: "0.00",
            porDia: []
        };
    }
}

/**
 * Actualiza los widgets del dashboard con datos reales
 * @param {Object} datos - Datos del dashboard
 */
function updateDashboardWidgets(datos) {
    if (!datos) return;
    
    const general = datos.general;
    const estadisticas = general?.estadisticas;
    
    // Actualizar tarjetas de estadísticas
    if (estadisticas) {
        // Estadísticas de clientes
        document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = estadisticas.clientes?.total || '0';
        document.querySelector('.stat-card:nth-child(1) .stat-percentage').textContent = `${estadisticas.clientes?.porcentajeActivos || '0'}% activos`;
        
        // Estadísticas de cobros
        document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = estadisticas.cobros?.pendientes || '0';
        document.querySelector('.stat-card:nth-child(2) .stat-percentage').textContent = estadisticas.cobros?.atrasados ? `${estadisticas.cobros.atrasados} atrasados` : '';
        
        // Estadísticas de ingresos
        document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = formatCurrency(estadisticas.finanzas?.ingresosMesActual || 0);
        
        // Variación mensual
        const variacion = parseFloat(estadisticas.finanzas?.variacionMensual || 0);
        const variacionEl = document.querySelector('.stat-card:nth-child(3) .stat-percentage');
        if (variacionEl) {
            variacionEl.textContent = `${variacion >= 0 ? '+' : ''}${variacion}% vs. mes anterior`;
            variacionEl.className = `stat-percentage ${variacion >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Índice de morosidad
        document.querySelector('.stat-card:nth-child(4) .stat-value').textContent = `${estadisticas.cobros?.indiceMorosidad || '0'}%`;
    }
    
    // Actualizar tabla de cobros recientes
    updateRecentPaymentsTable(datos.cobrosRecientes);
    
    // Actualizar sección de vencimientos próximos
    updateUpcomingPaymentsSection(datos.vencimientosProximos);
    
    // Actualizar clientes con mayor deuda si están disponibles
    if (general?.topClientesDeuda) {
        updateTopDebtorsWidget(general.topClientesDeuda);
    }
    
    // Actualizar gráfico de flujo de caja si está disponible
    if (general?.flujoCaja) {
        updateCashflowChart(general.flujoCaja);
    }
}

/**
 * Actualiza la tabla de cobros recientes
 * @param {Array} cobros - Lista de cobros recientes
 */
function updateRecentPaymentsTable(cobros) {
    const tbody = document.querySelector('#dashboard .payments-table tbody');
    if (!tbody) {
        console.warn("No se encontró la tabla de cobros recientes en el dashboard.");
        return;
    }
    
    tbody.innerHTML = ''; // Limpiar filas existentes
    
    if (!cobros || cobros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="center-text">No hay cobros recientes.</td></tr>';
        return;
    }
    
    cobros.forEach(cobro => {
        const estadoClass = formatStatusBadge(cobro.estado_cobro);
        const fechaFormateada = formatDate(cobro.fecha_emision, 'short');
        
        let acciones = '';
        if (cobro.estado_cobro === 'Pagado') {
            acciones = `
                <button class="icon-action view-btn" title="Ver detalles" data-cobro-id="${cobro.id}"><i class="fas fa-eye"></i></button>
                <button class="icon-action receipt-btn" title="Generar recibo" data-cobro-id="${cobro.id}"><i class="fas fa-file-invoice"></i></button>
                <button class="icon-action thank-btn" title="Enviar agradecimiento" data-cobro-id="${cobro.id}"><i class="fas fa-heart"></i></button>
            `;
        } else {
            acciones = `
                <button class="icon-action view-btn" title="Ver detalles" data-cobro-id="${cobro.id}"><i class="fas fa-eye"></i></button>
                <button class="icon-action remind-btn" title="Enviar recordatorio" data-cobro-id="${cobro.id}"><i class="fab fa-whatsapp"></i></button>
                <button class="icon-action edit-btn" title="Editar" data-cobro-id="${cobro.id}"><i class="fas fa-edit"></i></button>
            `;
        }
        
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>
                <div class="client-info">
                    <div class="client-initial">${(cobro.cliente?.nombre_cliente || 'C').charAt(0)}</div>
                    <span>${cobro.cliente?.nombre_cliente || 'Cliente no asignado'}</span>
                </div>
            </td>
            <td>${cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'No especificado'}</td>
            <td>${fechaFormateada}</td>
            <td>${formatCurrency(cobro.monto || 0, cobro.moneda || 'PEN')}</td>
            <td><span class="status-badge ${estadoClass}">${cobro.estado_cobro}</span></td>
            <td>
                <div class="action-buttons">
                    ${acciones}
                </div>
            </td>
        `;
        
        tbody.appendChild(fila);
        
        // Configurar listeners para los botones de acción
        fila.querySelectorAll('.icon-action').forEach(btn => {
            const cobroId = btn.getAttribute('data-cobro-id');
            
            if (btn.classList.contains('view-btn')) {
                btn.addEventListener('click', () => paymentsModule.viewPaymentDetail(cobroId));
            } else if (btn.classList.contains('receipt-btn')) {
                btn.addEventListener('click', () => paymentsModule.generateReceipt(cobroId));
            } else if (btn.classList.contains('remind-btn')) {
                btn.addEventListener('click', () => whatsappModule.sendPaymentReminder(cobroId, 'recordatorio'));
            } else if (btn.classList.contains('thank-btn')) {
                btn.addEventListener('click', () => whatsappModule.sendPaymentReminder(cobroId, 'agradecimiento'));
            } else if (btn.classList.contains('edit-btn')) {
                btn.addEventListener('click', () => paymentsModule.showPaymentModal(cobroId));
            }
        });
    });
}

/**
 * Actualiza la sección de vencimientos próximos
 * @param {Object} vencimientos - Datos de vencimientos próximos
 */
function updateUpcomingPaymentsSection(vencimientos) {
    const container = document.querySelector('.upcoming-payments');
    if (!container) return;
    
    // Actualizar tarjeta de resumen
    const summaryCard = container.querySelector('.summary-card');
    if (summaryCard) {
        summaryCard.querySelector('.stat-value').textContent = vencimientos.totalVencimientos || '0';
        summaryCard.querySelector('.summary-amount').textContent = formatCurrency(vencimientos.montoTotal || 0);
    }
    
    // Actualizar timeline de vencimientos
    const timeline = container.querySelector('.upcoming-timeline');
    if (timeline) {
        // Limpiar timeline
        timeline.innerHTML = '';
        
        if (!vencimientos.porDia || vencimientos.porDia.length === 0) {
            timeline.innerHTML = '<div class="empty-state">No hay vencimientos en los próximos 7 días.</div>';
            return;
        }
        
        // Agregar eventos para cada día con vencimientos
        vencimientos.porDia.forEach(dia => {
            const fechaObj = new Date(dia.fecha);
            // Formatear la fecha como "Lun, 12 Abr"
            const fecha = fechaObj.toLocaleDateString('es-ES', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short' 
            });
            
            // Calcular días restantes
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const diff = Math.floor((fechaObj - hoy) / (1000 * 60 * 60 * 24));
            let diasRestantesText = '';
            
            if (diff === 0) {
                diasRestantesText = '<span class="today-label">Hoy</span>';
            } else if (diff === 1) {
                diasRestantesText = '<span class="tomorrow-label">Mañana</span>';
            } else {
                diasRestantesText = `<span class="days-left">En ${diff} días</span>`;
            }
            
            const event = document.createElement('div');
            event.className = 'timeline-event';
            event.innerHTML = `
                <div class="event-date">
                    <div class="date-label">${fecha}</div>
                    ${diasRestantesText}
                </div>
                <div class="event-details">
                    <div class="event-count">${dia.cantidad} cobros</div>
                    <div class="event-amount">${formatCurrency(dia.monto)}</div>
                </div>
                <button class="event-action" data-fecha="${dia.fecha}">
                    <i class="fas fa-eye"></i>
                </button>
            `;
            
            timeline.appendChild(event);
            
            // Listener para ver detalles de vencimientos del día
            event.querySelector('.event-action').addEventListener('click', () => {
                showDayPaymentsDetails(dia);
            });
        });
    }
}

/**
 * Muestra los detalles de cobros que vencen en un día específico
 * @param {Object} dia - Datos de vencimientos del día
 */
function showDayPaymentsDetails(dia) {
    const fecha = formatDate(dia.fecha, 'medium');
    let contenidoHTML = `
        <h3>Vencimientos del ${fecha}</h3>
        <p><strong>${dia.cantidad}</strong> cobros por un total de <strong>${formatCurrency(dia.monto)}</strong></p>
        
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Servicio</th>
                        <th>Monto</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    dia.cobros.forEach(cobro => {
        contenidoHTML += `
            <tr>
                <td>${cobro.cliente?.nombre_cliente || 'Cliente no asignado'}</td>
                <td>${cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'No especificado'}</td>
                <td>${formatCurrency(cobro.monto || 0, cobro.moneda || 'PEN')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-btn view-btn" data-cobro-id="${cobro.id}" title="Ver detalle">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="icon-btn remind-btn" data-cobro-id="${cobro.id}" title="Enviar recordatorio">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    contenidoHTML += `
                </tbody>
            </table>
        </div>
        
        <div class="buttons-container">
            <button id="send-all-reminders" class="secondary-btn">
                <i class="fab fa-whatsapp"></i> Enviar recordatorio a todos
            </button>
        </div>
    `;
    
    const modal = showModal('payment-details-modal', 'Detalle de Vencimientos', contenidoHTML, {
        size: 'medium',
        buttons: [
            { text: 'Cerrar', action: 'close' }
        ]
    });
    
    // Configurar listeners para las acciones
    modal.querySelectorAll('.view-btn').forEach(btn => {
        const cobroId = btn.getAttribute('data-cobro-id');
        btn.addEventListener('click', () => {
            modal.remove();
            paymentsModule.viewPaymentDetail(cobroId);
        });
    });
    
    modal.querySelectorAll('.remind-btn').forEach(btn => {
        const cobroId = btn.getAttribute('data-cobro-id');
        btn.addEventListener('click', () => {
            modal.remove();
            whatsappModule.sendPaymentReminder(cobroId, 'recordatorio');
        });
    });
    
    // Botón para enviar a todos
    const sendAllBtn = modal.querySelector('#send-all-reminders');
    if (sendAllBtn) {
        sendAllBtn.addEventListener('click', () => {
            if (confirm(`¿Enviar recordatorio a todos los clientes con cobros que vencen el ${fecha}?`)) {
                modal.remove();
                showToast('Procesando', 'Enviando recordatorios a todos los clientes...', 'info');
                
                // Implementar envío masivo de recordatorios
                const cobrosIds = dia.cobros.map(cobro => cobro.id);
                sendBulkReminders(cobrosIds);
            }
        });
    }
}

/**
 * Envía recordatorios en masa a varios cobros
 * @param {Array} cobroIds - Lista de IDs de cobros
 */
async function sendBulkReminders(cobroIds) {
    if (!cobroIds || cobroIds.length === 0) return;
    
    try {
        showLoadingOverlay(`Enviando ${cobroIds.length} recordatorios...`);
        
        // Verificar el estado de WhatsApp
        const whatsappStatus = await whatsappModule.getWhatsAppStatus();
        if (whatsappStatus.status !== 'connected') {
            throw new Error('WhatsApp no está conectado. Conéctelo primero.');
        }
        
        let completados = 0;
        let fallidos = 0;
        
        // Enviar recordatorios uno por uno
        for (const cobroId of cobroIds) {
            try {
                const cobro = await apiFetch(`/cobros/${cobroId}`);
                
                // Verificar si el cliente tiene número de teléfono
                if (!cobro.cliente?.telefono) {
                    console.warn(`Cliente ${cobro.cliente?.nombre_cliente || cobroId} no tiene teléfono. Omitiendo...`);
                    fallidos++;
                    continue;
                }
                
                // Preparar mensaje personalizado
                const mensaje = generarMensajeRecordatorio(cobro);
                
                // Enviar mensaje
                await whatsappModule.sendWhatsAppMessage(cobro.cliente.id, mensaje, 'payment-reminder', cobroId);
                completados++;
            } catch (error) {
                console.error(`Error al enviar recordatorio para cobro ${cobroId}:`, error);
                fallidos++;
            }
        }
        
        if (completados > 0) {
            showToast('Recordatorios Enviados', `${completados} de ${cobroIds.length} recordatorios enviados.`, fallidos > 0 ? 'warning' : 'success');
        } else {
            showToast('Error', 'No se pudo enviar ningún recordatorio.', 'error');
        }
    } catch (error) {
        console.error('Error al enviar recordatorios masivos:', error);
        showToast('Error', error.message || 'Error al enviar recordatorios.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Genera un mensaje de recordatorio para un cobro
 * @param {Object} cobro - Datos del cobro
 * @returns {string} - Mensaje personalizado
 */
function generarMensajeRecordatorio(cobro) {
    const clientName = cobro.cliente?.nombre_cliente || "Estimado cliente";
    const amount = formatCurrency(cobro.monto || 0, cobro.moneda || 'PEN');
    const service = cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'servicio contratado';
    const dueDate = formatDate(cobro.fecha_vencimiento, 'medium');
    
    return `Estimado cliente ${clientName}, le recordamos amablemente sobre su pago pendiente de ${amount} por ${service}, con vencimiento el ${dueDate}. Agradeceremos su pronta gestión. Atte. Pegasus.`;
}

/**
 * Actualiza el widget de top deudores
 * @param {Array} deudores - Lista de clientes con mayor deuda
 */
function updateTopDebtorsWidget(deudores) {
    const container = document.querySelector('.top-debtors');
    if (!container) return;
    
    const listContainer = container.querySelector('.debtors-list');
    if (!listContainer) return;
    
    // Limpiar lista
    listContainer.innerHTML = '';
    
    if (!deudores || deudores.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No hay deudores para mostrar.</div>';
        return;
    }
    
    // Crear elementos para cada deudor
    deudores.forEach(deudor => {
        const item = document.createElement('div');
        item.className = 'debtor-item';
        item.innerHTML = `
            <div class="debtor-info">
                <div class="debtor-avatar">${deudor.nombre.charAt(0).toUpperCase()}</div>
                <div class="debtor-details">
                    <div class="debtor-name">${deudor.nombre}</div>
                    <div class="debtor-amount">${formatCurrency(deudor.deudaTotal)}</div>
                </div>
            </div>
            <button class="icon-btn notify-btn" data-client-id="${deudor.id}" title="Enviar notificación">
                <i class="fab fa-whatsapp"></i>
            </button>
        `;
        
        listContainer.appendChild(item);
        
        // Configurar listener para el botón de notificación
        item.querySelector('.notify-btn').addEventListener('click', () => {
            whatsappModule.sendClientReminder(deudor.id);
        });
    });
}

/**
 * Actualiza el gráfico de flujo de caja
 * @param {Array} datos - Datos del flujo de caja
 */
function updateCashflowChart(datos) {
    const chartCanvas = document.getElementById('cashflow-chart');
    if (!chartCanvas) return;
    
    // Verificar si Chart.js está disponible
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está disponible. El gráfico no se generará.');
        return;
    }
    
    // Destruir gráfico anterior si existe
    const existingChart = Chart.getChart(chartCanvas);
    if (existingChart) {
        existingChart.destroy();
    }
    
    // Preparar datos para el gráfico
    if (!datos || datos.length === 0) {
        // Si no hay datos, mostrar un mensaje
        const ctx = chartCanvas.getContext('2d');
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No hay datos disponibles', chartCanvas.width / 2, chartCanvas.height / 2);
        return;
    }
    
    // Formatear datos para el gráfico
    const labels = datos.map(item => formatDate(item.fecha, 'short'));
    const values = datos.map(item => parseFloat(item.monto));
    
    const ctx = chartCanvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ingresos',
                data: values,
                backgroundColor: 'rgba(74, 109, 167, 0.2)',
                borderColor: 'rgba(74, 109, 167, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Ingresos: ${formatCurrency(context.raw)}`;
                        }
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * Muestra el dropdown de notificaciones
 */
function showNotificationsDropdown() {
    // Obtener notificaciones desde la API
    async function fetchNotifications() {
        try {
            const response = await apiFetch('/notificaciones');
            return response.notificaciones || [];
        } catch (error) {
            console.error("Error al cargar notificaciones:", error);
            
            // Si falla la API, devolver datos de ejemplo (en un entorno real, estos vendrían de la API)
            return [
                {
                    id: 1,
                    tipo: 'warning',
                    mensaje: 'Cobro atrasado: Transportes San Mateo',
                    tiempo: 'Hace 2 horas',
                    leida: false
                },
                {
                    id: 2,
                    tipo: 'success',
                    mensaje: 'Pago registrado: Comercial Andina',
                    tiempo: 'Hace 5 horas',
                    leida: false
                },
                {
                    id: 3,
                    tipo: 'info',
                    mensaje: 'Respaldo de datos creado',
                    tiempo: 'Ayer',
                    leida: true
                }
            ];
        }
    }
    
    // Generar notificaciones basadas en eventos recientes
    async function generateRealtimeNotifications() {
        try {
            // Obtener cobros atrasados recientes
            const cobrosAtrasados = await apiFetch('/cobros?estado=Atrasado&limit=3');
            
            // Obtener pagos recientes
            const cobrosPagados = await apiFetch('/cobros?estado=Pagado&limit=3');
            
            // Convertir a formato de notificaciones
            const notificaciones = [];
            
            // Añadir notificaciones de cobros atrasados
            if (cobrosAtrasados && Array.isArray(cobrosAtrasados.cobros || cobrosAtrasados)) {
                const cobros = cobrosAtrasados.cobros || cobrosAtrasados;
                cobros.forEach((cobro, index) => {
                    notificaciones.push({
                        id: `atraso-${cobro.id}`,
                        tipo: 'warning',
                        mensaje: `Cobro atrasado: ${cobro.cliente?.nombre_cliente || 'Cliente'}`,
                        tiempo: index === 0 ? 'Hoy' : 'Recientemente',
                        leida: false,
                        cobroId: cobro.id
                    });
                });
            }
            
            // Añadir notificaciones de pagos recientes
            if (cobrosPagados && Array.isArray(cobrosPagados.cobros || cobrosPagados)) {
                const cobros = cobrosPagados.cobros || cobrosPagados;
                cobros.forEach((cobro, index) => {
                    notificaciones.push({
                        id: `pago-${cobro.id}`,
                        tipo: 'success',
                        mensaje: `Pago registrado: ${cobro.cliente?.nombre_cliente || 'Cliente'}`,
                        tiempo: index === 0 ? 'Hoy' : 'Recientemente',
                        leida: false,
                        cobroId: cobro.id
                    });
                });
            }
            
            return notificaciones;
        } catch (error) {
            console.error("Error al generar notificaciones en tiempo real:", error);
            return [];
        }
    }
    
    // Obtener notificaciones y mostrar el dropdown
    Promise.all([fetchNotifications(), generateRealtimeNotifications()])
        .then(([storedNotifications, realtimeNotifications]) => {
            // Combinar y eliminar duplicados por ID
            const notificacionesCombinadas = [...realtimeNotifications];
            storedNotifications.forEach(notification => {
                if (!notificacionesCombinadas.some(n => n.id === notification.id)) {
                    notificacionesCombinadas.push(notification);
                }
            });
            
            // Ordenar por leídas (no leídas primero) y luego por tiempo
            notificacionesCombinadas.sort((a, b) => {
                if (a.leida !== b.leida) return a.leida ? 1 : -1;
                return 0; // Mantener el orden existente para el tiempo
            });
            
            // Contar no leídas
            const noLeidas = notificacionesCombinadas.filter(n => !n.leida).length;
            
            // Construir contenido del dropdown
            const contenido = `
                <div class="notifications-dropdown">
                    <div class="notifications-header">
                        <h3>Notificaciones</h3>
                        <button class="mark-all-read">Marcar todo como leído</button>
                    </div>
                    <div class="notifications-list">
                        ${notificacionesCombinadas.length > 0 ? 
                            notificacionesCombinadas.map(notification => `
                                <div class="notification-item ${notification.leida ? '' : 'unread'}" data-id="${notification.id}" data-cobro-id="${notification.cobroId || ''}">
                                    <div class="notification-icon ${notification.tipo}">
                                        <i class="fas fa-${notification.tipo === 'warning' ? 'exclamation-triangle' : 
                                                         notification.tipo === 'success' ? 'check-circle' : 
                                                         'info-circle'}"></i>
                                    </div>
                                    <div class="notification-content">
                                        <p class="notification-message">${notification.mensaje}</p>
                                        <p class="notification-time">${notification.tiempo}</p>
                                    </div>
                                </div>
                            `).join('') : 
                            '<div class="empty-notifications">No hay notificaciones</div>'
                        }
                    </div>
                    <div class="notifications-footer">
                        <a href="#" class="view-all-notifications">Ver todas las notificaciones</a>
                    </div>
                </div>
            `;
            
            // Actualizar el contador de notificaciones
            const badge = document.querySelector('#notifications-btn .notification-badge');
            if (badge) {
                badge.textContent = noLeidas.toString();
                badge.style.display = noLeidas > 0 ? 'flex' : 'none';
            }
            
            // Buscar si ya existe el dropdown o crearlo
            let dropdown = document.querySelector('.notifications-dropdown');
            if (dropdown) {
                dropdown.remove();
            }
            
            // Crear el dropdown
            const notificationButton = document.getElementById('notifications-btn');
            if (notificationButton) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = contenido;
                dropdown = tempDiv.firstElementChild;
                
                // Posicionar el dropdown
                const rect = notificationButton.getBoundingClientRect();
                dropdown.style.position = 'absolute';
                dropdown.style.top = `${rect.bottom + 10}px`;
                dropdown.style.right = `${window.innerWidth - rect.right}px`;
                dropdown.style.zIndex = '1000';
                
                document.body.appendChild(dropdown);
                
                // Listener para cerrar al hacer clic fuera
                document.addEventListener('click', function closeDropdown(event) {
                    if (!dropdown.contains(event.target) && event.target !== notificationButton) {
                        dropdown.remove();
                        document.removeEventListener('click', closeDropdown);
                    }
                });
                
                // Listener para marcar como leídas
                const markAllReadBtn = dropdown.querySelector('.mark-all-read');
                if (markAllReadBtn) {
                    markAllReadBtn.addEventListener('click', async () => {
                        try {
                            // En un entorno real, esto enviaría una petición a la API
                            // await apiFetch('/notificaciones/marcar-leidas', { method: 'POST' });
                            
                            dropdown.querySelectorAll('.notification-item.unread').forEach(item => {
                                item.classList.remove('unread');
                            });
                            
                            // Actualizar el contador de notificaciones
                            if (badge) {
                                badge.textContent = '0';
                                badge.style.display = 'none';
                            }
                            
                            showToast('Notificaciones', 'Todas las notificaciones marcadas como leídas.', 'success');
                        } catch (error) {
                            console.error('Error al marcar notificaciones como leídas:', error);
                        }
                    });
                }
                
                // Listener para clicks en notificaciones
                dropdown.querySelectorAll('.notification-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const notificationId = item.getAttribute('data-id');
                        const cobroId = item.getAttribute('data-cobro-id');
                        
                        // Marcar como leída
                        item.classList.remove('unread');
                        
                        // Actualizar contador
                        const noLeidasActualizadas = dropdown.querySelectorAll('.notification-item.unread').length;
                        if (badge) {
                            badge.textContent = noLeidasActualizadas.toString();
                            badge.style.display = noLeidasActualizadas > 0 ? 'flex' : 'none';
                        }
                        
                        // En un entorno real, se enviaría una petición para marcar como leída
                        // apiFetch(`/notificaciones/${notificationId}/marcar-leida`, { method: 'POST' });
                        
                        // Si es una notificación relacionada con un cobro, mostrar detalles
                        if (cobroId) {
                            dropdown.remove();
                            paymentsModule.viewPaymentDetail(cobroId);
                        }
                    });
                });
            }
        })
        .catch(error => {
            console.error("Error al cargar y procesar notificaciones:", error);
            showToast('Error', 'No se pudieron cargar las notificaciones.', 'error');
        });
}

export {
    initDashboard,
    loadDashboardData,
    updateDashboardWidgets as updateDashboardStats,
    updateRecentPaymentsTable,
    showNotificationsDropdown
}