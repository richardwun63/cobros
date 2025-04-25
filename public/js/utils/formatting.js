/**
 * formatting.js
 * Módulo para formatear datos en la interfaz de usuario
 */

/**
 * Formatea un valor como moneda con el símbolo correspondiente
 * @param {number|string} value - Valor a formatear
 * @param {string} currency - Código de moneda (PEN, USD, etc.)
 * @returns {string} Valor formateado como moneda
 */
function formatCurrency(value, currency = 'PEN') {
    // Asegurar que value sea un número
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
        return '0.00';
    }
    
    // Mapa de símbolos de moneda
    const currencySymbols = {
        'PEN': 'S/',
        'USD': '$',
        'EUR': '€',
        'GBP': '£'
    };
    
    // Obtener símbolo o usar código si no está mapeado
    const symbol = currencySymbols[currency] || currency;
    
    // Formatear el número con 2 decimales
    return `${symbol}${numValue.toFixed(2)}`;
}

/**
 * Formatea una fecha con el formato especificado
 * @param {Date|string} date - Fecha a formatear
 * @param {string} format - Formato deseado ('short', 'medium', 'long', 'full')
 * @returns {string} Fecha formateada
 */
function formatDate(date, format = 'medium') {
    // Asegurar que date sea un objeto Date
    let dateObj;
    if (typeof date === 'string') {
        dateObj = new Date(date);
    } else if (date instanceof Date) {
        dateObj = date;
    } else {
        return 'Fecha inválida';
    }
    
    // Verificar si la fecha es válida
    if (isNaN(dateObj.getTime())) {
        return 'Fecha inválida';
    }
    
    // Opciones según el formato solicitado
    let options;
    switch (format) {
        case 'short':
            options = { day: '2-digit', month: '2-digit', year: 'numeric' };
            break;
        case 'medium':
            options = { day: '2-digit', month: '2-digit', year: 'numeric' };
            break;
        case 'long':
            options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            break;
        case 'full':
            options = { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            break;
        default:
            options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    }
    
    // Formatear fecha según la configuración regional
    return dateObj.toLocaleDateString('es-ES', options);
}

/**
 * Formatea el estado de un cobro para mostrar como badge
 * @param {string} status - Estado del cobro
 * @returns {string} Clase CSS correspondiente al estado
 */
function formatStatusBadge(status) {
    switch (status) {
        case 'Pagado': return 'paid';
        case 'Pendiente': return 'pending';
        case 'Atrasado': return 'overdue';
        case 'Anulado': return 'cancelled';
        default: return 'pending';
    }
}

/**
 * Formatea el estado de un cliente para mostrar como clase CSS
 * @param {string} status - Estado del cliente
 * @returns {string} Clase CSS correspondiente al estado
 */
function formatClientClass(status) {
    switch (status) {
        case 'Activo': return 'active';
        case 'Inactivo': return 'inactive';
        case 'Pendiente': return 'pending';
        case 'Atrasado': return 'overdue';
        default: return 'active';
    }
}

/**
 * Obtiene el nombre legible de un período
 * @param {string} period - Código del período
 * @returns {string} Nombre legible del período
 */
function getPeriodName(period) {
    switch (period) {
        case 'current-month': return 'Mes Actual';
        case 'previous-month': return 'Mes Anterior';
        case 'quarter': return 'Trimestre Actual';
        case 'year': return 'Año Actual';
        case 'last-30-days': return 'Últimos 30 días';
        case 'last-90-days': return 'Últimos 90 días';
        default: return period;
    }
}

/**
 * Formatea un título para reportes
 * @param {string} reportType - Tipo de reporte
 * @returns {string} Título formateado del reporte
 */
function formatReportTitle(reportType) {
    switch (reportType) {
        case 'payment-summary': return 'Resumen de Pagos';
        case 'client-status': return 'Estado de Clientes';
        case 'delay-analysis': return 'Análisis de Atrasos';
        case 'revenue-forecast': return 'Proyección de Ingresos';
        case 'profitability-analysis': return 'Análisis de Rentabilidad';
        default: return 'Reporte';
    }
}

/**
 * Formatea el nombre de un mes con la primera letra mayúscula
 * @param {string} monthName - Nombre del mes
 * @returns {string} Nombre del mes formateado
 */
function formatMonthName(monthName) {
    if (!monthName) return 'Mes Indefinido';
    
    // Asegurar que el primer carácter sea mayúscula
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

/**
 * Calcula los días de atraso de un cobro
 * @param {Date|string} dueDate - Fecha de vencimiento
 * @param {Date|string} [paymentDate=null] - Fecha de pago (opcional)
 * @returns {Object} Objeto con los días de atraso y clase CSS
 */
function calculateDelay(dueDate, paymentDate = null) {
    // Convertir fechas a objetos Date
    const dueDateObj = new Date(dueDate);
    dueDateObj.setHours(0, 0, 0, 0);
    
    // Si hay fecha de pago, usarla como referencia, de lo contrario usar fecha actual
    const referenceDate = paymentDate ? new Date(paymentDate) : new Date();
    referenceDate.setHours(0, 0, 0, 0);
    
    // Calcular diferencia en días
    const diffTime = referenceDate - dueDateObj;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Determinar clase CSS y texto a mostrar
    let delayClass = '';
    let delayText = '';
    
    if (diffDays > 0) {
        // Atrasado
        delayClass = 'delay-days';
        delayText = `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    } else if (diffDays === 0) {
        // Vence hoy
        delayClass = 'due-today';
        delayText = 'Hoy';
    } else {
        // No vencido
        delayClass = '';
        delayText = '-';
    }
    
    return {
        days: diffDays,
        class: delayClass,
        text: delayText
    };
}

export { 
    formatCurrency, 
    formatDate, 
    formatStatusBadge, 
    formatClientClass, 
    getPeriodName,
    formatReportTitle,
    formatMonthName,
    calculateDelay
};