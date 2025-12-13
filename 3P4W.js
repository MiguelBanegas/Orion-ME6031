
        const { jsPDF } = window.jspdf;

        // Variables globales
        let datos = [];
        let charts = {};
        const loadingDelay = 500; // 0.5 segundos

        // Event listener para el archivo CSV
        
            document.getElementById('csvFile').addEventListener('change', function(e) {
                console.log('Archivo seleccionado'); // Debug
                const file = e.target.files[0];
                if (!file) {
                    return;
                }

                // --- Validación del nombre de archivo ---
                const fileName = file.name;
                const isValidExtension = fileName.endsWith('.csv');
                const isValidSuffix = fileName.includes('3P4W.csv');
                if (!isValidExtension || !isValidSuffix) {
                    alert('Por favor, selecciona un archivo que contenga "3P4W" en su nombre y termine en .csv.');
                    return;
                }

                console.log('Iniciando procesamiento con Web Worker');
                document.getElementById('loadingMessage').style.display = 'block';

                // --- Ocultar contenido mientras se procesa ---
                const contenidoDinamico = document.getElementById('contenidoDinamico');
                const graficosContainer = document.getElementById('graficosContainer');
                const tablaContainer = document.getElementById('tablaContainer');
                if (contenidoDinamico) contenidoDinamico.style.display = 'none';
                if (graficosContainer) graficosContainer.style.display = 'none';
                if (tablaContainer) tablaContainer.style.display = 'none';
                document.querySelectorAll('.grafico-container').forEach(container => {
                    container.style.display = 'none';
                });
                
                // --- Lógica del Web Worker ---
                const worker = new Worker('csv-worker.js');

                worker.onmessage = function(event) {
                    const { type, payload } = event.data;

                    if (type === 'complete') {
                        console.log('Worker completado. Recibidos', payload.datos.length, 'registros.');
                        // Asignar los datos recibidos a las variables globales
                        datos = payload.datos;
                        datosActivos = datos; // Inicializar el conjunto de datos activo
                        
                        // Actualizar UI con los datos del worker
                        actualizarUIMostrarResultados(payload.serialNumber, payload.datos);
                        
                        // Terminar el worker para liberar recursos
                        worker.terminate();

                    } else if (type === 'error') {
                        console.error('Error desde el worker:', payload);
                        alert('Error al procesar el archivo: ' + payload);
                        document.getElementById('loadingMessage').style.display = 'none';
                        worker.terminate();
                    }
                };

                worker.onerror = function(error) {
                    console.error('Error en el worker:', error);
                    alert('Ocurrió un error en el worker de procesamiento.');
                    document.getElementById('loadingMessage').style.display = 'none';
                    worker.terminate();
                };

                // Enviar el archivo al worker para que comience el procesamiento
                worker.postMessage(file);
            });

        // Nueva función para actualizar la UI una vez que el worker ha terminado
        function actualizarUIMostrarResultados(serialNumber, datosProcesados) {
            try {
                document.getElementById('serialNumber').textContent = serialNumber;

                // Configurar las fechas solo si hay datos válidos
                if (datosActivos.length > 0) {
                    // Ordenar por fecha para encontrar los registros de inicio y fin reales
                    const sortedDatos = [...datosActivos].sort((a, b) => {
                        const dateA = new Date(formatearFechaHora(a.Date, a.Time));
                        const dateB = new Date(formatearFechaHora(b.Date, b.Time));
                        return dateA - dateB;
                    });

                    const primerRegistro = sortedDatos[0];
                    const ultimoRegistro = sortedDatos[sortedDatos.length - 1];
                    
                    const fechaInicio = formatearFechaHora(primerRegistro.Date, primerRegistro.Time);
                    const fechaFin = formatearFechaHora(ultimoRegistro.Date, ultimoRegistro.Time);

                    if (fechaInicio && fechaFin) {
                        document.getElementById('fechaInicio').value = fechaInicio;
                        document.getElementById('fechaFin').value = fechaFin;
                    }
                }

                // Mostrar contenedores ahora que los datos están listos
                setTimeout(() => {
                    const contenidoDinamico = document.getElementById('contenidoDinamico');
                    const myGrid = document.getElementById('myGrid');
                    const graficosContainer = document.getElementById('graficosContainer');

                    if (contenidoDinamico) contenidoDinamico.style.display = 'block';
                    if (myGrid) myGrid.style.display = 'block';
                    if (graficosContainer) graficosContainer.style.display = 'block';
                    
                    document.getElementById('loadingMessage').style.display = 'none';
                    
                    inicializarGrid();
                    crearGraficos(datosActivos);
                }, loadingDelay);

            } catch (error) {
                console.error('Error al actualizar la UI con los resultados:', error);
                alert('Error al mostrar los resultados: ' + error.message);
                document.getElementById('loadingMessage').style.display = 'none';
            }
        }

        // --- Lógica de AG-Grid ---
        let gridOptions = null; // Guardará la configuración del grid
        let gridApi = null;     // Guardará la API del grid

        function inicializarGrid() {
            console.log('Inicializando AG-Grid.');
            const gridDiv = document.querySelector('#myGrid');
            if (!gridDiv) {
                console.error('No se encontró el div #myGrid');
                return;
            }

            // Si una instancia anterior del grid existe, destruirla.
            if (gridApi) {
                gridApi.destroy();
            }

            if (!datosActivos || datosActivos.length === 0) {
                console.warn('No hay datos activos para mostrar en el grid.');
                return;
            }

            // Generar definiciones de columna dinámicamente
            const columnDefs = Object.keys(datosActivos[0]).map(key => {
                return {
                    field: key,
                    sortable: true,
                    filter: true,
                    resizable: true
                };
            });

            gridOptions = {
                columnDefs: columnDefs,
                rowData: datosActivos,
                theme: 'legacy', // Usar el sistema de temas heredado (CSS)
                defaultColDef: {
                    // Configuraciones por defecto para todas las las columnas
                    filter: 'agTextColumnFilter',
                    floatingFilter: true, // Añade filtros debajo de los encabezados
                },
                animateRows: true,
                pagination: true,
                paginationPageSize: 20
            };

            // Crear el grid y capturar su API
            gridApi = agGrid.createGrid(gridDiv, gridOptions);
            // console.log('Grid API inicializada:', gridApi);
        }


        // Función para formatear fecha y hora
        function formatearFechaHora(fecha, hora) {
            try {
                if (!fecha || !hora) {
                    console.warn('Fecha u hora faltante:', {fecha, hora});
                    return '';
                }

                let año, mes, dia;
                
                // Detectar el formato de la fecha
                if (fecha.includes('-')) {
                    [año, mes, dia] = fecha.split('-');
                } else if (fecha.includes('/')) {
                    [dia, mes, año] = fecha.split('/');
                } else {
                    console.warn('Formato de fecha no reconocido:', fecha);
                    return '';
                }

                // Asegurarse de que los componentes tengan dos dígitos
                const mesFormateado = mes.toString().padStart(2, '0');
                const diaFormateado = dia.toString().padStart(2, '0');
                const horaFormateada = hora.split('.')[0]; // Eliminar decimales si existen

                return `${año}-${mesFormateado}-${diaFormateado}T${horaFormateada}`;
            } catch (error) {
                console.error('Error al formatear fecha:', error);
                return '';
            }
        }

        // Event listeners para los botones
        // Se elimina el wrapper DOMContentLoaded ya que el script se carga al final del body,
        // garantizando que el DOM está listo. Esto evita posibles problemas de scope/timing.
        
        console.log('Configurando event listeners para botones');

        // Event listener para el botón de filtro
        const aplicarFiltro = document.getElementById('aplicarFiltro');
        if (aplicarFiltro) {
            aplicarFiltro.addEventListener('click', function() {
                const fechaInicio = document.getElementById('fechaInicio').value;
                const fechaFin = document.getElementById('fechaFin').value;
                if (!fechaInicio || !fechaFin) {
                    alert('Por favor, seleccione fechas válidas');
                    return;
                }

                // console.log('gridApi antes de filtrar:', gridApi);
                if (!gridApi) {
                    alert('El grid no está inicializado. Cargue datos primero.');
                    return;
                }
                
                document.getElementById('loadingMessage').style.display = 'block';

                setTimeout(() => {
                    try {
                        const startDate = new Date(fechaInicio);
                        const endDate = new Date(fechaFin);

                        datosActivos = datos.filter(row => {
                            const fechaRegistro = new Date(formatearFechaHora(row.Date, row.Time));
                            return fechaRegistro >= startDate && fechaRegistro <= endDate;
                        });
                        
                        gridApi.setGridOption('rowData', datosActivos);
                        crearGraficos(datosActivos);
                        
                        if(datosActivos.length === 0){
                            alert('No se encontraron datos en el rango seleccionado');
                        }
                    } catch (error) {
                        console.error('Error al aplicar filtro:', error);
                        alert('Error al aplicar el filtro: ' + error.message);
                    } finally {
                        document.getElementById('loadingMessage').style.display = 'none';
                    }
                }, loadingDelay);
            });
        }

                    // Event listener para el botón de reset
                    const resetFiltro = document.getElementById('resetFiltro');
                    if (resetFiltro) {
                        resetFiltro.addEventListener('click', function(e) {
                            if (datos.length > 0) {
                                // Ordenar por fecha para encontrar los registros de inicio y fin reales
                                const sortedDatos = [...datos].sort((a, b) => {
                                    const dateA = new Date(formatearFechaHora(a.Date, a.Time));
                                    const dateB = new Date(formatearFechaHora(b.Date, b.Time));
                                    return dateA - dateB;
                                });
                                const primerRegistro = sortedDatos[0];
                                const ultimoRegistro = sortedDatos[sortedDatos.length - 1];
                                
                                const fechaInicio = formatearFechaHora(primerRegistro.Date, primerRegistro.Time);
                                const fechaFin = formatearFechaHora(ultimoRegistro.Date, ultimoRegistro.Time);
        
                                if (fechaInicio && fechaFin) {
                                    document.getElementById('fechaInicio').value = fechaInicio;
                                    document.getElementById('fechaFin').value = fechaFin;
                                }
                            }
        
                            if (!gridApi) {
                                return;
                            }
        
                            document.getElementById('loadingMessage').style.display = 'block';
        
                            setTimeout(() => {
                                try {
                                    datosActivos = datos;
                                    // Actualizar datos en el grid existente
                                    gridApi.setGridOption('rowData', datosActivos);
                                    crearGraficos(datosActivos);
                                } catch (error) {
                                    console.error('Error al resetear:', error);
                                    alert('Error al resetear: ' + error.message);
                                } finally {
                                    document.getElementById('loadingMessage').style.display = 'none';
                                }
                            }, loadingDelay);
                        });
                    }
        // Función para crear gráficos
        // Agrega esta función utilitaria antes de crearGraficos
function downsampleArray(arr, maxPoints) {
    if (arr.length <= maxPoints) return arr;
    const step = Math.ceil(arr.length / maxPoints);
    return arr.filter((_, idx) => idx % step === 0);
}

// Modifica la función crearGraficos para usar downsampling en labels y datasets
function crearGraficos(datos) {
    console.log('Iniciando creación de gráficos'); // Debug

    // Destruir gráficos existentes
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null;
        }
    });

    // Downsampling: máximo 200 puntos por gráfico
    const MAX_POINTS = 200;
    const labels = downsampleArray(datos.map(row => row.Time.substring(0, 5)), MAX_POINTS);

    // Definir los colores estándar para todos los gráficos
    const COLORS = {
        A: 'rgb(205, 133, 63)',
        B: 'rgb(0, 0, 0)',
        C: 'rgb(255, 0, 0)',
        Sum: 'rgb(128, 128, 128)',
        FP_A: 'rgb(0, 123, 255)',
        FP_B: 'rgb(40, 167, 69)',
        FP_C: 'rgb(255, 193, 7)',
        CosPhi_A: 'rgb(255, 0, 0)',
        CosPhi_B: 'rgb(153, 102, 255)',
        CosPhi_C: 'rgb(255, 127, 80)'
    };

    // Función para crear datasets con downsampling
    function createDatasets(data, prefix) {
        return [
            {
                label: `${prefix}A`,
                data: downsampleArray(data.map(row => row[`${prefix}A`]), MAX_POINTS),
                borderColor: COLORS.A,
                tension: 0.1,
                hidden: false
            },
            {
                label: `${prefix}B`,
                data: downsampleArray(data.map(row => row[`${prefix}B`]), MAX_POINTS),
                borderColor: COLORS.B,
                tension: 0.1,
                hidden: false
            },
            {
                label: `${prefix}C`,
                data: downsampleArray(data.map(row => row[`${prefix}C`]), MAX_POINTS),
                borderColor: COLORS.C,
                tension: 0.1,
                hidden: false
            },
            // Promedio si existe
            ...(data.some(row => row[`${prefix}Avg`] !== undefined) ? [{
                label: `${prefix}Avg`,
                data: downsampleArray(data.map(row => row[`${prefix}Avg`]), MAX_POINTS),
                borderColor: COLORS.Sum,
                tension: 0.1,
                hidden: false
            }] : []),
            // Suma si existe
            ...(data.some(row => row[`${prefix}Sum`] !== undefined) ? [{
                label: `${prefix}Sum`,
                data: downsampleArray(data.map(row => row[`${prefix}Sum`]), MAX_POINTS),
                borderColor: COLORS.Sum,
                tension: 0.1,
                hidden: false
            }] : [])
        ];
    }

    // Mostrar contenedores de gráficos
    document.querySelectorAll('.grafico-container').forEach(container => {
        container.style.display = 'block';
    });

    // Gráfico de Voltaje
    const ctxVoltaje = document.getElementById('graficaVoltaje');
    if (ctxVoltaje) {
        const voltageDatasets = createDatasets(datos, 'U');
        const voltageRange = getYAxisRange(voltageDatasets.map(ds => ds.data));
        charts.voltaje = new Chart(ctxVoltaje, {
            type: 'line',
            data: {
                labels: labels,
                datasets: voltageDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Tensión L-N' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: voltageRange.min,
                        max: voltageRange.max,
                        ticks: { stepSize: Math.ceil((voltageRange.max - voltageRange.min) / 10) }
                    }
                }
            }
        });
    }

    // Gráfico de UTHD
    const ctxUTHD = document.getElementById('graficaUTHD');
    if (ctxUTHD) {
        const uthdDatasets = [
            {
                label: 'Fase A',
                data: downsampleArray(datos.map(row => row.UTHA), MAX_POINTS),
                backgroundColor: COLORS.A,
                borderColor: COLORS.A,
                borderWidth: 1,
                hidden: false
            },
            {
                label: 'Fase B',
                data: downsampleArray(datos.map(row => row.UTHB), MAX_POINTS),
                backgroundColor: COLORS.B,
                borderColor: COLORS.B,
                borderWidth: 1,
                hidden: false
            },
            {
                label: 'Fase C',
                data: downsampleArray(datos.map(row => row.UTHC), MAX_POINTS),
                backgroundColor: COLORS.C,
                borderColor: COLORS.C,
                borderWidth: 1,
                hidden: false
            }
        ];
        const uthdRange = getYAxisRange(uthdDatasets.map(ds => ds.data));
        charts.uthd = new Chart(ctxUTHD, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: uthdDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'THD Total Tensión (%)' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        beginAtZero: true,
                        min: uthdRange.min,
                        max: uthdRange.max,
                        ticks: { callback: value => value.toFixed(1) + '%' }
                    }
                }
            }
        });
    }

    // Gráfico de Corriente
    const ctxCorriente = document.getElementById('graficaCorriente');
    if (ctxCorriente) {
        const currentDatasets = createDatasets(datos, 'I');
        const currentRange = getYAxisRange(currentDatasets.map(ds => ds.data));
        charts.corriente = new Chart(ctxCorriente, {
            type: 'line',
            data: {
                labels: labels,
                datasets: currentDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Corrientes' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: currentRange.min,
                        max: currentRange.max,
                        ticks: { stepSize: Math.ceil((currentRange.max - currentRange.min) / 10) }
                    }
                }
            }
        });
    }

    // Gráfico de ITH
    const ctxITH = document.getElementById('graficaITH');
    if (ctxITH) {
        const ithDatasets = [
            {
                label: 'Fase A',
                data: downsampleArray(datos.map(row => row.ITHA), MAX_POINTS),
                backgroundColor: COLORS.A,
                borderColor: COLORS.A,
                borderWidth: 1,
                hidden: false
            },
            {
                label: 'Fase B',
                data: downsampleArray(datos.map(row => row.ITHB), MAX_POINTS),
                backgroundColor: COLORS.B,
                borderColor: COLORS.B,
                borderWidth: 1,
                hidden: false
            },
            {
                label: 'Fase C',
                data: downsampleArray(datos.map(row => row.ITHC), MAX_POINTS),
                backgroundColor: COLORS.C,
                borderColor: COLORS.C,
                borderWidth: 1,
                hidden: false
            },
            {
                label: 'Prom',
                data: downsampleArray(datos.map(row => row.ITHAvg), MAX_POINTS),
                backgroundColor: COLORS.CosPhi_B,
                borderColor: COLORS.CosPhi_B,
                borderWidth: 1,
                hidden: false
            }
        ];
        const ithRange = getYAxisRange(ithDatasets.map(ds => ds.data));
        charts.ith = new Chart(ctxITH, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: ithDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'THD Corriente Total (%)' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        beginAtZero: true,
                        min: ithRange.min,
                        max: ithRange.max,
                        ticks: { callback: value => value.toFixed(1) + '%' }
                    }
                }
            }
        });
    }

    // Gráfico de Factor de Potencia
    const ctxPF = document.getElementById('graficaPF');
    if (ctxPF) {
        const pfDatasets = createDatasets(datos, 'PF');
        const pfRange = getYAxisRange(pfDatasets.map(ds => ds.data));
        charts.pf = new Chart(ctxPF, {
            type: 'line',
            data: {
                labels: labels,
                datasets: pfDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Factor de Potencia' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: pfRange.min,
                        max: pfRange.max,
                        ticks: {
                            stepSize: (pfRange.max - pfRange.min) / 10,
                            callback: value => value.toFixed(3)
                        }
                    }
                }
            }
        });
    }

    // Gráfico de Cos Phi
    const ctxCosPhi = document.getElementById('graficaCosPhi2');
    if (ctxCosPhi) {
        const cosPhiDatasets = [
            {
                label: 'Cos Phi A',
                data: downsampleArray(datos.map(row => {
                    const P = row.PA, Q = row.QA;
                    const S = Math.sqrt(P * P + Q * Q);
                    return S !== 0 ? Number((P / S).toFixed(3)) : 0;
                }), MAX_POINTS),
                borderColor: COLORS.A,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'Cos Phi B',
                data: downsampleArray(datos.map(row => {
                    const P = row.PB, Q = row.QB;
                    const S = Math.sqrt(P * P + Q * Q);
                    return S !== 0 ? Number((P / S).toFixed(3)) : 0;
                }), MAX_POINTS),
                borderColor: COLORS.B,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'Cos Phi C',
                data: downsampleArray(datos.map(row => {
                    const P = row.PC, Q = row.QC;
                    const S = Math.sqrt(P * P + Q * Q);
                    return S !== 0 ? Number((P / S).toFixed(3)) : 0;
                }), MAX_POINTS),
                borderColor: COLORS.C,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'Cos Phi Avg',
                data: downsampleArray(datos.map(row => {
                    const P = row.PSum, Q = row.QSum;
                    const S = Math.sqrt(P * P + Q * Q);
                    return S !== 0 ? Number((P / S).toFixed(3)) : 0;
                }), MAX_POINTS),
                borderColor: COLORS.Sum,
                tension: 0.1,
                hidden: false
            }
        ];
        const cosPhiRange = getYAxisRange(cosPhiDatasets.map(ds => ds.data));
        charts.cosPhi = new Chart(ctxCosPhi, {
            type: 'line',
            data: {
                labels: labels,
                datasets: cosPhiDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Cos Phi' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: cosPhiRange.min,
                        max: cosPhiRange.max,
                        ticks: {
                            stepSize: (cosPhiRange.max - cosPhiRange.min) / 10,
                            callback: value => value.toFixed(3)
                        }
                    }
                }
            }
        });
    }

    // Gráfico de Potencia Activa
    const ctxPA = document.getElementById('graficaPotenciaActiva');
    if (ctxPA) {
        const paDatasets = [
            {
                label: 'PA',
                data: downsampleArray(datos.map(row => row.PA), MAX_POINTS),
                borderColor: COLORS.A,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'PB',
                data: downsampleArray(datos.map(row => row.PB), MAX_POINTS),
                borderColor: COLORS.B,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'PC',
                data: downsampleArray(datos.map(row => row.PC), MAX_POINTS),
                borderColor: COLORS.C,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'PSum',
                data: downsampleArray(datos.map(row => row.PSum), MAX_POINTS),
                borderColor: COLORS.Sum,
                tension: 0.1,
                hidden: false
            }
        ];
        const paRange = getPowerEnergyRange(paDatasets.map(ds => ds.data));
        charts.potenciaActiva = new Chart(ctxPA, {
            type: 'line',
            data: {
                labels: labels,
                datasets: paDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Potencia Activa' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: paRange.min,
                        max: paRange.max,
                        ticks: { stepSize: paRange.stepSize }
                    }
                }
            }
        });
    }

    // Gráfico de Potencia Reactiva
    const ctxPR = document.getElementById('graficaPotenciaReactiva');
    if (ctxPR) {
        const prDatasets = [
            {
                label: 'QA',
                data: downsampleArray(datos.map(row => row.QA), MAX_POINTS),
                borderColor: COLORS.A,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'QB',
                data: downsampleArray(datos.map(row => row.QB), MAX_POINTS),
                borderColor: COLORS.B,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'QC',
                data: downsampleArray(datos.map(row => row.QC), MAX_POINTS),
                borderColor: COLORS.C,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'QSum',
                data: downsampleArray(datos.map(row => row.QSum), MAX_POINTS),
                borderColor: COLORS.Sum,
                tension: 0.1,
                hidden: false
            }
        ];
        const prRange = getPowerEnergyRange(prDatasets.map(ds => ds.data));
        charts.potenciaReactiva = new Chart(ctxPR, {
            type: 'line',
            data: {
                labels: labels,
                datasets: prDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Potencia Reactiva' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: prRange.min,
                        max: prRange.max,
                        ticks: { stepSize: prRange.stepSize }
                    }
                }
            }
        });
    }

    // Gráfico de Potencia Aparente
    const ctxPS = document.getElementById('graficaPotenciaAparente');
    if (ctxPS) {
        const psDatasets = createDatasets(datos, 'S');
        const psRange = getPowerAxisRange(psDatasets.map(ds => ds.data));
        const psStepSize = (psRange.max - psRange.min) / 10;
        charts.potenciaAparente = new Chart(ctxPS, {
            type: 'line',
            data: {
                labels: labels,
                datasets: psDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Potencia Aparente' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: psRange.min,
                        max: psRange.max,
                        ticks: {
                            stepSize: roundToNiceNumber(psStepSize),
                            callback: value => value.toLocaleString('es-ES')
                        }
                    }
                }
            }
        });
    }

    // Gráfico de Energía Activa
    const ctxEP = document.getElementById('graficaEnergiaActiva');
    if (ctxEP) {
        const epDatasets = [
            {
                label: 'EPA',
                data: downsampleArray(datos.map(row => row.EPA), MAX_POINTS),
                borderColor: COLORS.A,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'EPB',
                data: downsampleArray(datos.map(row => row.EPB), MAX_POINTS),
                borderColor: COLORS.B,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'EPC',
                data: downsampleArray(datos.map(row => row.EPC), MAX_POINTS),
                borderColor: COLORS.C,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'EPSum',
                data: downsampleArray(datos.map(row => row.EPSum), MAX_POINTS),
                borderColor: COLORS.Sum,
                tension: 0.1,
                hidden: false
            }
        ];
        const epRange = getPowerEnergyRange(epDatasets.map(ds => ds.data));
        charts.energiaActiva = new Chart(ctxEP, {
            type: 'line',
            data: {
                labels: labels,
                datasets: epDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Energía Activa' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: epRange.min,
                        max: epRange.max,
                        ticks: { stepSize: epRange.stepSize }
                    }
                }
            }
        });
    }

    // Gráfico de Energía Reactiva
    const ctxEQ = document.getElementById('graficaEnergiaReactiva');
    if (ctxEQ) {
        const eqDatasets = [
            {
                label: 'EQA',
                data: downsampleArray(datos.map(row => row.EQA), MAX_POINTS),
                borderColor: COLORS.A,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'EQB',
                data: downsampleArray(datos.map(row => row.EQB), MAX_POINTS),
                borderColor: COLORS.B,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'EQC',
                data: downsampleArray(datos.map(row => row.EQC), MAX_POINTS),
                borderColor: COLORS.C,
                tension: 0.1,
                hidden: false
            },
            {
                label: 'EQSum',
                data: downsampleArray(datos.map(row => row.EQSum), MAX_POINTS),
                borderColor: COLORS.Sum,
                tension: 0.1,
                hidden: false
            }
        ];
        const eqRange = getPowerEnergyRange(eqDatasets.map(ds => ds.data));
        charts.energiaReactiva = new Chart(ctxEQ, {
            type: 'line',
            data: {
                labels: labels,
                datasets: eqDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Energía Reactiva' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: {
                        min: eqRange.min,
                        max: eqRange.max,
                        ticks: { stepSize: eqRange.stepSize }
                    }
                }
            }
        });
    }

    console.log('Gráficos creados exitosamente');
}

        // Agregar estas funciones de utilidad
        function roundToNiceNumber(value, roundUp = false) {
            const absValue = Math.abs(value);
            const magnitude = Math.pow(10, Math.floor(Math.log10(absValue)));
            const normalized = absValue / magnitude;
            
            let niceNumber;
            if (roundUp) {
                if (normalized <= 1) niceNumber = 1;
                else if (normalized <= 2) niceNumber = 2;
                else if (normalized <= 5) niceNumber = 5;
                else niceNumber = 10;
            } else {
                if (normalized >= 7.5) niceNumber = 5;
                else if (normalized >= 3.5) niceNumber = 2;
                else if (normalized >= 1.5) niceNumber = 1;
                else niceNumber = 0.5;
            }
            
            return Math.sign(value) * niceNumber * magnitude;
        }

        function getPowerAxisRange(data) {
            const values = data.flat().filter(v => v !== null && !isNaN(v));
            if (values.length === 0) return { min: 0, max: 1 };

            const min = Math.min(...values);
            const max = Math.max(...values);
            
            let finalMin = min;
            let finalMax = max;

            if (min === max) {
                const margin = Math.abs(min * 0.1) || 0.1; // Margen del 10% o 0.1
                finalMin -= margin;
                finalMax += margin;
            } else {
                const range = max - min;
                const margin = range * 0.05; // 5% de margen
                finalMin -= margin;
                finalMax += margin;
            }
            
            // La potencia aparente es siempre positiva, así que fijar el eje en cero.
            finalMin = Math.max(0, finalMin);
            
            return {
                min: finalMin,
                max: finalMax
            };
        }

        // Función para calcular el paso apropiado
        function calculateStepSize(min, max) {
            const range = max - min;
            return range / 10; // Dividir el rango en 10 pasos
        }

        // Función específica para obtener el rango de potencia y energía
        function getPowerEnergyRange(data) {
            const values = data.flat().filter(v => v !== null && !isNaN(v));
            if (values.length === 0) return { min: 0, max: 1, stepSize: 0.1 }; // Valores por defecto si no hay datos
            
            const min = Math.min(...values);
            const max = Math.max(...values);
            
            // Si min y max son iguales, agregar un pequeño rango
            if (min === max) {
                return {
                    min: min * 0.9,
                    max: max * 1.1,
                    stepSize: max * 0.02
                };
            }
            
            // Agregar un margen del 5%
            const range = max - min;
            const margin = range * 0.05;
            
            return {
                min: min - margin,
                max: max + margin,
                stepSize: range / 10
            };
        }

        console.log('Datos de energía:', {
            EPA: datos[0]?.EPA,
            EPB: datos[0]?.EPB,
            EPC: datos[0]?.EPC,
            EPSum: datos[0]?.EPSum,
            EQA: datos[0]?.EQA,
            EQB: datos[0]?.EQB,
            EQC: datos[0]?.EQC,
            EQSum: datos[0]?.EQSum
        });

        // Agregar el event listener para el botón de exportar PDF
        document.getElementById('exportPDF').addEventListener('click', exportToPDF);

        async function exportToPDF() {
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const pageWidth = doc.internal.pageSize.getWidth();
                const margin = 10;

                // Título principal
                doc.setFontSize(18);
                doc.setFont(undefined, 'bold');
                doc.text('Orión  Ingeniería en Mediciones Eléctricas', pageWidth / 2, margin + 10, { align: 'center' });
                doc.setFontSize(14);
                doc.text('ANALIZADOR DE CALIDAD DE ENERGÍA ME631', pageWidth / 2, margin + 25, { align: 'center' });
                doc.setFontSize(12);
                doc.text('Tipo de Conexión: 3 FASES 4 CONDUCTORES', pageWidth / 2, margin + 30, { align: 'center' });

                // Información del equipo
                doc.setFontSize(10);
                const serialNumber = document.getElementById('serialNumber').textContent;
                doc.text(`S/N: ${serialNumber}`, pageWidth / 2, margin + 34, { align: 'center' });

                // Fecha del reporte
                //doc.setFontSize(8);
                //const fecha = new Date().toLocaleDateString('es-ES');
                //doc.text(`Fecha del reporte: ${fecha}`, margin, 50);
                // Información del archivo
        const fileName2 = document.getElementById('csvFile').files[0]?.name || 'Datos no disponibles';
        doc.text(`Archivo: ${fileName2}`, margin, margin + 40);
        // Información del período
        const fechaInicio = document.getElementById('fechaInicio').value;
        const fechaFin = document.getElementById('fechaFin').value;
        doc.text(`Período: ${fechaInicio} - ${fechaFin}`, margin, margin + 45);


                let yPos = 60; // Posición inicial Y después de los títulos

                // Array de gráficos a exportar
                const graphConfigs = [
                    { canvas: 'graficaVoltaje' },
                    { canvas: 'graficaUTHD' },
                    { canvas: 'graficaCorriente' },
                    { canvas: 'graficaITH' },
                    { canvas: 'graficaPF' },
                    { canvas: 'graficaPotenciaActiva' },
                    { canvas: 'graficaPotenciaReactiva' },
                    { canvas: 'graficaPotenciaAparente' },
                    { canvas: 'graficaEnergiaActiva' },
                    { canvas: 'graficaEnergiaReactiva' }
                ];

                // Procesar cada gráfico
                for (let i = 0; i < graphConfigs.length; i++) {
                    const config = graphConfigs[i];
                    const canvas = document.getElementById(config.canvas);
                    
                    if (canvas) {
                        console.log(`Cargando gráfico: ${config.canvas}`); // Mostrar el nombre del gráfico en la consola
                        const imgData = canvas.toDataURL('image/png');
                        const xPos = (i % 2 === 0) ? margin : pageWidth / 2;

                        // Añadir nueva página si es necesario
                        if (i > 0 && i % 2 === 0) {
                            yPos += 80; // Ajustar la altura entre gráficos
                        }

                        // Verificar si se necesita una nueva página
                        if (yPos + 60 > doc.internal.pageSize.height - margin) {
                            doc.addPage();
                            yPos = 20; // Reiniciar la posición Y
                        }

                        // Añadir el gráfico
                        doc.addImage(imgData, 'PNG', xPos, yPos, (pageWidth / 2) - margin, 60);
                    } else {
                        console.warn(`No se encontró el gráfico: ${config.canvas}`); // Advertencia si no se encuentra el gráfico
                    }
                }

                // Construir el nombre del archivo
                const formattedDate = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
                const fileName = `ReporteElectrico_${formattedDate}_${serialNumber}_3P4W.pdf`;

                // Guardar el PDF con el nombre personalizado
                doc.save(fileName);

            } catch (error) {
                console.error('Error al exportar a PDF:', error);
                alert('Error al exportar a PDF: ' + error.message);
            }
        }

        // Función actualizada para obtener el rango de valores del eje Y
        function getYAxisRange(data) {
            const values = data.flat().filter(v => v !== null && isFinite(v));
            if (values.length === 0) return { min: 0, max: 1 };
            
            const min = Math.min(...values);
            const max = Math.max(...values);
            
            let finalMin, finalMax;

            if (min === max) {
                // Si el valor es único, darle un pequeño rango a su alrededor
                finalMin = min - 0.1;
                finalMax = max + 0.1;
            } else {
                const range = max - min;
                const margin = range * 0.05;
                finalMin = min - margin;
                finalMax = max + margin;
            }

            // Si el punto de datos más pequeño no es negativo, no permitir que el eje baje de cero
            if (min >= 0) {
                finalMin = Math.max(0, finalMin);
            }
            
            return {
                min: Number(finalMin.toFixed(3)),
                max: Number(finalMax.toFixed(3))
            };
        }
    
