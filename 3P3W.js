const { jsPDF } = window.jspdf;

// Variables globales
let datos = [];
let datosActivos = [];
let charts = {};
const loadingDelay = 500; // 0.5 segundos

// Event listener para el archivo CSV
document.getElementById("csvFile").addEventListener("change", function (e) {
  console.log("Archivo seleccionado");
  const file = e.target.files[0];
  if (!file) {
    return;
  }

  // Validación del nombre de archivo
  const fileName = file.name;
  const isValidExtension = fileName.endsWith(".csv");
  const isValidSuffix = fileName.includes("3P3W");
  if (!isValidExtension || !isValidSuffix) {
    alert(
      'Por favor, selecciona un archivo que contenga "3P3W" en su nombre y termine en .csv.',
    );
    return;
  }

  console.log("Iniciando procesamiento con Web Worker");
  document.getElementById("loadingMessage").style.display = "block";

  // Ocultar contenido mientras se procesa
  const contenidoDinamico = document.getElementById("contenidoDinamico");
  const graficosContainer = document.getElementById("graficosContainer");
  const tablaContainer = document.getElementById("tablaContainer");

  if (contenidoDinamico) contenidoDinamico.style.display = "none";
  if (graficosContainer) graficosContainer.style.display = "none";
  if (tablaContainer) tablaContainer.style.display = "none";

  document.querySelectorAll(".grafico-container").forEach((container) => {
    container.style.display = "none";
  });

  // Lógica del Web Worker específico para 3P3W
  const worker = new Worker("csv-worker-3p3w.js");

  worker.onmessage = function (event) {
    const { type, payload } = event.data;

    if (type === "complete") {
      console.log(
        "Worker completado. Recibidos",
        payload.datos.length,
        "registros.",
      );
      datos = payload.datos;
      datosActivos = datos;

      actualizarUIMostrarResultados(payload.serialNumber, payload.datos);
      worker.terminate();
    } else if (type === "error") {
      console.error("Error desde el worker:", payload);
      alert("Error al procesar el archivo: " + payload);
      document.getElementById("loadingMessage").style.display = "none";
      worker.terminate();
    }
  };

  worker.onerror = function (error) {
    console.error("Error en el worker:", error);
    alert("Ocurrió un error en el worker de procesamiento.");
    document.getElementById("loadingMessage").style.display = "none";
    worker.terminate();
  };

  // Enviar el archivo al worker
  worker.postMessage(file);
});

// Función para actualizar la UI
function actualizarUIMostrarResultados(serialNumber, datosProcesados) {
  try {
    document.getElementById("serialNumber").textContent = serialNumber;

    // Configurar las fechas
    if (datosActivos.length > 0) {
      const sortedDatos = [...datosActivos].sort((a, b) => {
        const dateA = new Date(formatearFechaHora(a.Date, a.Time));
        const dateB = new Date(formatearFechaHora(b.Date, b.Time));
        return dateA - dateB;
      });

      const primerRegistro = sortedDatos[0];
      const ultimoRegistro = sortedDatos[sortedDatos.length - 1];

      const fechaInicio = formatearFechaHora(
        primerRegistro.Date,
        primerRegistro.Time,
      );
      const fechaFin = formatearFechaHora(
        ultimoRegistro.Date,
        ultimoRegistro.Time,
      );

      if (fechaInicio && fechaFin) {
        document.getElementById("fechaInicio").value = fechaInicio;
        document.getElementById("fechaFin").value = fechaFin;
      }
    }

    // Mostrar contenedores
    setTimeout(() => {
      const contenidoDinamico = document.getElementById("contenidoDinamico");
      const myGrid = document.getElementById("myGrid");
      const graficosContainer = document.getElementById("graficosContainer");
      const tablaContainer = document.getElementById("tablaContainer");

      if (contenidoDinamico) contenidoDinamico.style.display = "block";
      if (myGrid) myGrid.style.display = "block";
      if (graficosContainer) graficosContainer.style.display = "block";
      if (tablaContainer) tablaContainer.style.display = "block";

      document.getElementById("loadingMessage").style.display = "none";

      inicializarGrid();
      crearGraficos(datosActivos);
    }, loadingDelay);
  } catch (error) {
    console.error("Error al actualizar la UI:", error);
    alert("Error al mostrar los resultados: " + error.message);
    document.getElementById("loadingMessage").style.display = "none";
  }
}

// AG-Grid
let gridOptions = null;
let gridApi = null;

function inicializarGrid() {
  console.log("Inicializando AG-Grid");
  const gridDiv = document.querySelector("#myGrid");
  if (!gridDiv) {
    console.error("No se encontró el div #myGrid");
    return;
  }

  if (gridApi) {
    gridApi.destroy();
  }

  if (!datosActivos || datosActivos.length === 0) {
    console.warn("No hay datos activos para mostrar en el grid");
    return;
  }

  const columnDefs = Object.keys(datosActivos[0]).map((key) => {
    return {
      field: key,
      sortable: true,
      filter: true,
      resizable: true,
    };
  });

  gridOptions = {
    columnDefs: columnDefs,
    rowData: datosActivos,
    theme: "legacy",
    defaultColDef: {
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    animateRows: true,
    pagination: true,
    paginationPageSize: 20,
  };

  gridApi = agGrid.createGrid(gridDiv, gridOptions);
}

// Función para formatear fecha y hora
function formatearFechaHora(fecha, hora) {
  try {
    if (!fecha || !hora) {
      console.warn("Fecha u hora faltante:", { fecha, hora });
      return "";
    }

    let año, mes, dia;

    if (fecha.includes("-")) {
      [año, mes, dia] = fecha.split("-");
    } else if (fecha.includes("/")) {
      [dia, mes, año] = fecha.split("/");
    } else {
      console.warn("Formato de fecha no reconocido:", fecha);
      return "";
    }

    const mesFormateado = mes.toString().padStart(2, "0");
    const diaFormateado = dia.toString().padStart(2, "0");
    const horaFormateada = hora.split(".")[0];

    return `${año}-${mesFormateado}-${diaFormateado}T${horaFormateada}`;
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return "";
  }
}

// Event listeners para botones
console.log("Configurando event listeners para botones");

// Botón de filtro
const aplicarFiltro = document.getElementById("aplicarFiltro");
if (aplicarFiltro) {
  aplicarFiltro.addEventListener("click", function () {
    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;
    if (!fechaInicio || !fechaFin) {
      alert("Por favor, seleccione fechas válidas");
      return;
    }

    if (!gridApi) {
      alert("El grid no está inicializado. Cargue datos primero.");
      return;
    }

    document.getElementById("loadingMessage").style.display = "block";

    setTimeout(() => {
      try {
        const startDate = new Date(fechaInicio);
        const endDate = new Date(fechaFin);

        datosActivos = datos.filter((row) => {
          const fechaRegistro = new Date(
            formatearFechaHora(row.Date, row.Time),
          );
          return fechaRegistro >= startDate && fechaRegistro <= endDate;
        });

        gridApi.setGridOption("rowData", datosActivos);
        crearGraficos(datosActivos);

        if (datosActivos.length === 0) {
          alert("No se encontraron datos en el rango seleccionado");
        }
      } catch (error) {
        console.error("Error al aplicar filtro:", error);
        alert("Error al aplicar el filtro: " + error.message);
      } finally {
        document.getElementById("loadingMessage").style.display = "none";
      }
    }, loadingDelay);
  });
}

// Botón de reset
const resetFiltro = document.getElementById("resetFiltro");
if (resetFiltro) {
  resetFiltro.addEventListener("click", function () {
    if (datos.length > 0) {
      const sortedDatos = [...datos].sort((a, b) => {
        const dateA = new Date(formatearFechaHora(a.Date, a.Time));
        const dateB = new Date(formatearFechaHora(b.Date, b.Time));
        return dateA - dateB;
      });
      const primerRegistro = sortedDatos[0];
      const ultimoRegistro = sortedDatos[sortedDatos.length - 1];

      document.getElementById("fechaInicio").value = formatearFechaHora(
        primerRegistro.Date,
        primerRegistro.Time,
      );
      document.getElementById("fechaFin").value = formatearFechaHora(
        ultimoRegistro.Date,
        ultimoRegistro.Time,
      );
    }

    if (!gridApi) return;

    document.getElementById("loadingMessage").style.display = "block";

    setTimeout(() => {
      try {
        datosActivos = datos;
        gridApi.setGridOption("rowData", datosActivos);
        crearGraficos(datosActivos);
      } catch (error) {
        console.error("Error al resetear:", error);
        alert("Error al resetear: " + error.message);
      } finally {
        document.getElementById("loadingMessage").style.display = "none";
      }
    }, loadingDelay);
  });
}

function downsampleArray(arr, maxPoints) {
  if (!arr) return [];
  if (arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, idx) => idx % step === 0);
}

// Función para crear gráficos
function crearGraficos(datos) {
  console.log("Iniciando creación de gráficos 3P3W");

  // Destruir gráficos existentes
  Object.keys(charts).forEach((key) => {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  });

  const MAX_POINTS = 200;
  const labels = downsampleArray(
    datos.map((row) => (row.Time ? row.Time.substring(0, 5) : "")),
    MAX_POINTS,
  );

  const COLORS = {
    A: "rgb(205, 133, 63)",
    B: "rgb(0, 0, 0)",
    C: "rgb(255, 0, 0)",
    Sum: "rgb(128, 128, 128)",
    PF: "rgb(111, 66, 193)",
  };

  document.querySelectorAll(".grafico-container").forEach((container) => {
    container.style.display = "block";
  });

  // Gráfico de Voltaje (Línea-Línea para 3P3W)
  const ctxVoltaje = document.getElementById("graficaVoltaje");
  if (ctxVoltaje) {
    const voltageDatasets = [
      {
        label: "UAB",
        data: downsampleArray(
          datos.map((row) => row.UAB),
          MAX_POINTS,
        ),
        borderColor: COLORS.A,
        tension: 0.1,
        hidden: false,
      },
      {
        label: "UBC",
        data: downsampleArray(
          datos.map((row) => row.UBC),
          MAX_POINTS,
        ),
        borderColor: COLORS.B,
        tension: 0.1,
        hidden: false,
      },
      {
        label: "UCA",
        data: downsampleArray(
          datos.map((row) => row.UCA),
          MAX_POINTS,
        ),
        borderColor: COLORS.C,
        tension: 0.1,
        hidden: false,
      },
      {
        label: "UAvg",
        data: downsampleArray(
          datos.map((row) => row.UAvg),
          MAX_POINTS,
        ),
        borderColor: COLORS.Sum,
        tension: 0.1,
        hidden: false,
      },
    ];
    const voltageRange = getYAxisRange(voltageDatasets.map((ds) => ds.data));
    charts.graficaVoltaje = new Chart(ctxVoltaje, {
      type: "line",
      data: { labels: labels, datasets: voltageDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: "Tensión Línea-Línea (V)" } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: voltageRange.min,
            max: voltageRange.max,
            ticks: {
              stepSize: Math.ceil((voltageRange.max - voltageRange.min) / 10),
            },
          },
        },
      },
    });
  }

  // Gráfico de UTHD (Línea-Línea)
  const ctxUTHD = document.getElementById("graficaUTHD");
  if (ctxUTHD) {
    const uthdDatasets = [
      {
        label: "UTHAB",
        data: downsampleArray(
          datos.map((row) => row.UTHAB),
          MAX_POINTS,
        ),
        backgroundColor: COLORS.A,
        borderColor: COLORS.A,
        borderWidth: 1,
      },
      {
        label: "UTHBC",
        data: downsampleArray(
          datos.map((row) => row.UTHBC),
          MAX_POINTS,
        ),
        backgroundColor: COLORS.B,
        borderColor: COLORS.B,
        borderWidth: 1,
      },
      {
        label: "UTHCA",
        data: downsampleArray(
          datos.map((row) => row.UTHCA),
          MAX_POINTS,
        ),
        backgroundColor: COLORS.C,
        borderColor: COLORS.C,
        borderWidth: 1,
      },
    ];
    const uthdRange = getYAxisRange(uthdDatasets.map((ds) => ds.data));
    charts.graficaUTHD = new Chart(ctxUTHD, {
      type: "bar",
      data: { labels: labels, datasets: uthdDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: "THD Tensión (%)" } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            beginAtZero: true,
            min: uthdRange.min,
            max: uthdRange.max,
            ticks: { callback: (value) => value.toFixed(1) + "%" },
          },
        },
      },
    });
  }

  // Gráfico de Corriente
  const ctxCorriente = document.getElementById("graficaCorriente");
  if (ctxCorriente) {
    const currentDatasets = [
      {
        label: "IA",
        data: downsampleArray(
          datos.map((row) => row.IA),
          MAX_POINTS,
        ),
        borderColor: COLORS.A,
        tension: 0.1,
      },
      {
        label: "IB",
        data: downsampleArray(
          datos.map((row) => row.IB),
          MAX_POINTS,
        ),
        borderColor: COLORS.B,
        tension: 0.1,
      },
      {
        label: "IC",
        data: downsampleArray(
          datos.map((row) => row.IC),
          MAX_POINTS,
        ),
        borderColor: COLORS.C,
        tension: 0.1,
      },
      {
        label: "IAvg",
        data: downsampleArray(
          datos.map((row) => row.IAvg),
          MAX_POINTS,
        ),
        borderColor: COLORS.Sum,
        tension: 0.1,
      },
    ];
    const currentRange = getYAxisRange(currentDatasets.map((ds) => ds.data));
    charts.graficaCorriente = new Chart(ctxCorriente, {
      type: "line",
      data: { labels: labels, datasets: currentDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: "Corriente (A)" } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: currentRange.min,
            max: currentRange.max,
            ticks: {
              stepSize: Math.ceil((currentRange.max - currentRange.min) / 10),
            },
          },
        },
      },
    });
  }

  // Gráfico de ITHD
  const ctxITH = document.getElementById("graficaITH");
  if (ctxITH) {
    const ithDatasets = [
      {
        label: "ITHA",
        data: downsampleArray(
          datos.map((row) => row.ITHA),
          MAX_POINTS,
        ),
        backgroundColor: COLORS.A,
        borderColor: COLORS.A,
        borderWidth: 1,
      },
      {
        label: "ITHB",
        data: downsampleArray(
          datos.map((row) => row.ITHB),
          MAX_POINTS,
        ),
        backgroundColor: COLORS.B,
        borderColor: COLORS.B,
        borderWidth: 1,
      },
      {
        label: "ITHC",
        data: downsampleArray(
          datos.map((row) => row.ITHC),
          MAX_POINTS,
        ),
        backgroundColor: COLORS.C,
        borderColor: COLORS.C,
        borderWidth: 1,
      },
    ];
    const ithRange = getYAxisRange(ithDatasets.map((ds) => ds.data));
    charts.graficaITH = new Chart(ctxITH, {
      type: "bar",
      data: { labels: labels, datasets: ithDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: "THD Corriente (%)" } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            beginAtZero: true,
            min: ithRange.min,
            max: ithRange.max,
            ticks: { callback: (value) => value.toFixed(1) + "%" },
          },
        },
      },
    });
  }

  // Gráfico de Factor de Potencia (PF único)
  const ctxPF = document.getElementById("graficaPF");
  if (ctxPF) {
    const pfData = downsampleArray(
      datos.map((row) => parseFloat(row.PF) || 0),
      MAX_POINTS,
    );
    const pfRange = getYAxisRange([pfData]);
    charts.graficaPF = new Chart(ctxPF, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Factor de Potencia",
            data: pfData,
            borderColor: COLORS.PF,
            backgroundColor: "rgba(111, 66, 193, 0.1)",
            tension: 0.1,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: "Factor de Potencia" } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: Math.max(pfRange.min, -1),
            max: Math.min(pfRange.max, 1),
            ticks: { stepSize: 0.1, callback: (value) => value.toFixed(2) },
          },
        },
      },
    });
  }

  // Gráfico de Cos Phi
  const ctxCosPhi = document.getElementById("graficaCosPhi2");
  if (ctxCosPhi) {
    const cosPhiData = downsampleArray(
      datos.map((row) => {
        const P = parseFloat(row.PSum) || 0;
        const Q = parseFloat(row.QSum) || 0;
        const S = Math.sqrt(P * P + Q * Q);
        return S !== 0 ? Number((P / S).toFixed(3)) : 0;
      }),
      MAX_POINTS,
    );
    const cosPhiRange = getYAxisRange([cosPhiData]);
    charts.graficaCosPhi2 = new Chart(ctxCosPhi, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Cos φ Total",
            data: cosPhiData,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.1)",
            tension: 0.1,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: "Cos φ (Calculado)" } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: Math.max(cosPhiRange.min, -1),
            max: Math.min(cosPhiRange.max, 1),
            ticks: { stepSize: 0.1, callback: (value) => value.toFixed(2) },
          },
        },
      },
    });
  }

  // Gráfico de Potencia Activa (Solo Suma)
  const ctxPA = document.getElementById("graficaPotenciaActiva");
  if (ctxPA) {
    const paData = downsampleArray(
      datos.map((row) => (row.PSum || 0) / 1000),
      MAX_POINTS,
    );
    const paRange = getPowerEnergyRange([paData]);
    charts.graficaPotenciaActiva = new Chart(ctxPA, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Potencia Activa Total (kW)",
            data: paData,
            borderColor: COLORS.Sum,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Potencia Activa Total (kW)" },
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: paRange.min,
            max: paRange.max,
            ticks: {
              stepSize: paRange.stepSize,
              callback: (value) => value.toFixed(1),
            },
          },
        },
      },
    });
  }

  // Gráfico de Potencia Reactiva (Solo Suma)
  const ctxPR = document.getElementById("graficaPotenciaReactiva");
  if (ctxPR) {
    const prData = downsampleArray(
      datos.map((row) => (row.QSum || 0) / 1000),
      MAX_POINTS,
    );
    const prRange = getPowerEnergyRange([prData]);
    charts.graficaPotenciaReactiva = new Chart(ctxPR, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Potencia Reactiva Total (kVar)",
            data: prData,
            borderColor: COLORS.Sum,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Potencia Reactiva Total (kVar)" },
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: prRange.min,
            max: prRange.max,
            ticks: {
              stepSize: prRange.stepSize,
              callback: (value) => value.toFixed(1),
            },
          },
        },
      },
    });
  }

  // Gráfico de Potencia Aparente (Solo Suma)
  const ctxPS = document.getElementById("graficaPotenciaAparente");
  if (ctxPS) {
    const psData = downsampleArray(
      datos.map((row) => (row.SSum || 0) / 1000),
      MAX_POINTS,
    );
    const psRange = getPowerEnergyRange([psData]);
    charts.graficaPotenciaAparente = new Chart(ctxPS, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Potencia Aparente Total (kVA)",
            data: psData,
            borderColor: COLORS.Sum,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Potencia Aparente Total (kVA)" },
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: psRange.min,
            max: psRange.max,
            ticks: {
              stepSize: psRange.stepSize,
              callback: (value) => value.toFixed(1),
            },
          },
        },
      },
    });
  }

  // Gráfico de Energía Activa (Solo Suma)
  const ctxEA = document.getElementById("graficaEnergiaActiva");
  if (ctxEA) {
    const eaData = downsampleArray(
      datos.map((row) => (row.EPSum || 0) / 1000),
      MAX_POINTS,
    );
    const eaRange = getPowerEnergyRange([eaData]);
    charts.graficaEnergiaActiva = new Chart(ctxEA, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Energía Activa Total (kWh)",
            data: eaData,
            borderColor: COLORS.Sum,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Energía Activa Total (kWh)" },
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: eaRange.min,
            max: eaRange.max,
            ticks: {
              stepSize: eaRange.stepSize,
              callback: (value) => value.toFixed(1),
            },
          },
        },
      },
    });
  }

  // Gráfico de Energía Reactiva (Solo Suma)
  const ctxER = document.getElementById("graficaEnergiaReactiva");
  if (ctxER) {
    const erData = downsampleArray(
      datos.map((row) => (row.EQSum || 0) / 1000),
      MAX_POINTS,
    );
    const erRange = getPowerEnergyRange([erData]);
    charts.graficaEnergiaReactiva = new Chart(ctxER, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Energía Reactiva Total (kVarh)",
            data: erData,
            borderColor: COLORS.Sum,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Energía Reactiva Total (kVarh)" },
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            min: erRange.min,
            max: erRange.max,
            ticks: {
              stepSize: erRange.stepSize,
              callback: (value) => value.toFixed(1),
            },
          },
        },
      },
    });
  }

  // Crear histogramas complementarios
  crearHistogramasComplementarios(datos);

  // Inicializar eventos para vista ampliada
  inicializarEventosGraficos();
}

// Función para inicializar eventos de clic en los gráficos
function inicializarEventosGraficos() {
  const canvases = document.querySelectorAll(".grafico-container canvas");
  const modalElement = document.getElementById("graphModal");
  const modalCanvas = document.getElementById("modalCanvas");

  if (!modalElement || !modalCanvas) {
    console.error("No se encontró el elemento modal o el canvas del modal.");
    return;
  }

  let modalChart = null;

  canvases.forEach((canvas) => {
    canvas.onclick = function () {
      const chartId = canvas.id;
      const originalChart =
        typeof charts !== "undefined"
          ? charts[chartId]
          : Chart.getChart(canvas);

      if (!originalChart) {
        console.warn("No se encontró la instancia del gráfico para:", chartId);
        return;
      }

      // Obtener o crear instancia del modal (Bootstrap 5)
      const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
      bsModal.show();

      // Limpiar gráfico previo en el modal si existe (usando el método más robusto)
      const existingChart = Chart.getChart(modalCanvas);
      if (existingChart) {
        existingChart.destroy();
      }

      // Esperar a que el modal se muestre para obtener las dimensiones correctas
      const onShown = function () {
        const ctx = modalCanvas.getContext("2d");

        new Chart(ctx, {
          type: originalChart.config.type,
          data: originalChart.config.data,
          options: {
            ...originalChart.config.options,
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
              ...originalChart.config.options.plugins,
              legend: {
                ...originalChart.config.options.plugins?.legend,
                display: true,
              },
            },
          },
        });

        // Remover el listener para evitar duplicados en la próxima apertura
        modalElement.removeEventListener("shown.bs.modal", onShown);
      };

      modalElement.addEventListener("shown.bs.modal", onShown);
    };
  });
}

// Función para crear histogramas complementarios (con diferenciación de fases)
function crearHistogramasComplementarios(datos) {
  console.log("Iniciando creación de histogramas complementarios (3P3W)");

  // 1. Histograma de Voltaje (Diferenciado por fases, 0 decimales)
  const ua = datos.map((row) => parseFloat(row.UA)).filter((v) => !isNaN(v));
  const ub = datos.map((row) => parseFloat(row.UB)).filter((v) => !isNaN(v));
  const uc = datos.map((row) => parseFloat(row.UC)).filter((v) => !isNaN(v));
  crearHistograma(
    "histoVoltaje",
    [
      { label: "Fase A", data: ua, color: "rgba(255, 206, 86, 0.7)" },
      { label: "Fase B", data: ub, color: "rgba(75, 192, 192, 0.7)" },
      { label: "Fase C", data: uc, color: "rgba(255, 99, 132, 0.7)" },
    ],
    "Tensión por Fase (V)",
    "V",
    0,
  );

  // 2. Histograma de Corriente (Diferenciado por fases, 0 decimales)
  const ia = datos.map((row) => parseFloat(row.IA)).filter((v) => !isNaN(v));
  const ib = datos.map((row) => parseFloat(row.IB)).filter((v) => !isNaN(v));
  const ic = datos.map((row) => parseFloat(row.IC)).filter((v) => !isNaN(v));
  crearHistograma(
    "histoCorriente",
    [
      { label: "Fase A", data: ia, color: "rgba(255, 206, 86, 0.7)" },
      { label: "Fase B", data: ib, color: "rgba(75, 192, 192, 0.7)" },
      { label: "Fase C", data: ic, color: "rgba(255, 99, 132, 0.7)" },
    ],
    "Corriente por Fase (A)",
    "A",
    0,
  );

  // 3. Histograma de Potencia Activa (PSum en kW, 2 decimales)
  const paData = datos
    .map((row) => parseFloat(row.PSum) / 1000)
    .filter((v) => !isNaN(v));
  crearHistograma(
    "histoPotenciaActiva",
    [{ label: "Total", data: paData, color: "rgba(188, 188, 50, 0.8)" }],
    "Potencia Activa Total (kW)",
    "kW",
    2,
  );

  // 4. Histograma de Factor de Potencia (PF, 2 decimales)
  const pfData = datos
    .map((row) => parseFloat(row.PF))
    .filter((v) => !isNaN(v));
  crearHistograma(
    "histoPF",
    [{ label: "PF", data: pfData, color: "rgba(111, 66, 193, 0.8)" }],
    "Factor de Potencia",
    "",
    2,
  );
}

// Función genérica para crear un histograma con estilo "Reporte Técnico" mejorado para multifase
function crearHistograma(canvasId, datasets, label, unit, precision = 0) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || datasets.length === 0 || datasets[0].data.length === 0) return;

  // Calcular media global
  let titleMediaText = "";
  datasets.forEach((ds, idx) => {
    const sum = ds.data.reduce((a, b) => a + b, 0);
    const media = (sum / ds.data.length).toFixed(precision);
    titleMediaText += `${datasets.length > 1 ? ds.label + ": " : ""}${media}${unit}${idx < datasets.length - 1 ? " | " : ""}`;
  });

  // Configurar bins (intervalos) basados en el rango global de todos los datasets
  const allData = datasets.flatMap((ds) => ds.data);
  const numBins = 50;
  const min = Math.min(...allData);
  const max = Math.max(...allData);
  const binSize = (max - min) / numBins || 0.1;

  const labels = [];
  const chartDatasets = datasets.map((ds) => {
    const bins = new Array(numBins).fill(0);
    for (let i = 0; i < numBins; i++) {
      const binStart = min + i * binSize;
      const binEnd = binStart + binSize;
      bins[i] = ds.data.filter(
        (v) => v >= binStart && (i === numBins - 1 ? v <= binEnd : v < binEnd),
      ).length;
    }
    return {
      label: ds.label,
      data: bins,
      backgroundColor: ds.color || "rgba(188, 188, 50, 0.8)",
      borderColor: "#000000",
      borderWidth: 1,
      barPercentage: 1.0,
      categoryPercentage: 1.0,
    };
  });

  for (let i = 0; i < numBins; i++) {
    labels.push((min + i * binSize).toFixed(precision));
  }

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: chartDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${label} - Media: ${titleMediaText}`,
          color: "#000",
          font: { size: 14, weight: "bold" },
        },
        legend: { display: datasets.length > 1 },
      },
      scales: {
        x: {
          title: { display: true, text: `Valor (${unit})`, color: "#000" },
          grid: { color: "rgba(0, 0, 0, 0.4)", lineWidth: 1.2 },
          ticks: { color: "#000", maxRotation: 45, minRotation: 45 },
        },
        y: {
          title: { display: true, text: "Número de eventos", color: "#000" },
          grid: { color: "rgba(0, 0, 0, 0.4)", lineWidth: 1.2 },
          ticks: { color: "#000" },
          beginAtZero: true,
        },
      },
    },
  });

  ctx.parentElement.style.backgroundColor = "white";
}

function getPowerEnergyRange(data) {
  const values = data.flat().filter((v) => v !== null && !isNaN(v));
  if (values.length === 0) return { min: 0, max: 1, stepSize: 0.1 };

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return {
      min: min * 0.9,
      max: max * 1.1,
      stepSize: max * 0.02,
    };
  }

  const range = max - min;
  const margin = range * 0.05;

  return {
    min: min - margin,
    max: max + margin,
    stepSize: range / 10,
  };
}

function getYAxisRange(data) {
  const values = data.flat().filter((v) => v !== null && isFinite(v));
  if (values.length === 0) return { min: 0, max: 1 };

  const min = Math.min(...values);
  const max = Math.max(...values);

  let finalMin, finalMax;

  if (min === max) {
    finalMin = min - 0.1;
    finalMax = max + 0.1;
  } else {
    const range = max - min;
    const margin = range * 0.05;
    finalMin = min - margin;
    finalMax = max + margin;
  }

  if (min >= 0) {
    finalMin = Math.max(0, finalMin);
  }

  return {
    min: Number(finalMin.toFixed(3)),
    max: Number(finalMax.toFixed(3)),
  };
}

// Event listener para exportar PDF
document.getElementById("exportPDF").addEventListener("click", exportToPDF);

async function exportToPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;

    // Título principal
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text(
      "Orión Ingeniería en Mediciones Eléctricas",
      pageWidth / 2,
      margin + 10,
      { align: "center" },
    );
    doc.setFontSize(14);
    doc.text(
      "ANALIZADOR DE CALIDAD DE ENERGÍA ME631",
      pageWidth / 2,
      margin + 25,
      { align: "center" },
    );
    doc.setFontSize(12);
    doc.text(
      "Tipo de Conexión: 3 FASES 3 CONDUCTORES",
      pageWidth / 2,
      margin + 30,
      { align: "center" },
    );

    // Información del equipo
    doc.setFontSize(10);
    const serialNumber = document.getElementById("serialNumber").textContent;
    doc.text(`S/N: ${serialNumber}`, pageWidth / 2, margin + 34, {
      align: "center",
    });

    const fileName2 =
      document.getElementById("csvFile").files[0]?.name ||
      "Datos no disponibles";
    doc.text(`Archivo: ${fileName2}`, margin, margin + 40);

    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;
    doc.text(`Período: ${fechaInicio} - ${fechaFin}`, margin, margin + 45);

    let yPos = 60;

    // Array de gráficos a exportar
    const graphConfigs = [
      { canvas: "graficaVoltaje" },
      { canvas: "graficaUTHD" },
      { canvas: "graficaCorriente" },
      { canvas: "graficaITH" },
      { canvas: "graficaPF" },
      { canvas: "graficaCosPhi2" },
      { canvas: "graficaPotenciaActiva" },
      { canvas: "graficaCosPhi" },
      { canvas: "graficaPotenciaReactiva" },
      { canvas: "graficaPotenciaAparente" },
      { canvas: "graficaEnergiaActiva" },
      { canvas: "graficaEnergiaReactiva" },
    ];

    // Procesar cada gráfico
    for (let i = 0; i < graphConfigs.length; i++) {
      const config = graphConfigs[i];
      const canvas = document.getElementById(config.canvas);

      if (canvas) {
        console.log(`Cargando gráfico: ${config.canvas}`);
        const imgData = canvas.toDataURL("image/png");
        const xPos = i % 2 === 0 ? margin : pageWidth / 2;

        if (i > 0 && i % 2 === 0) {
          yPos += 80;
        }

        if (yPos + 60 > doc.internal.pageSize.height - margin) {
          doc.addPage();
          yPos = 20;
        }

        doc.addImage(imgData, "PNG", xPos, yPos, pageWidth / 2 - margin, 60);
      } else {
        console.warn(`No se encontró el gráfico: ${config.canvas}`);
      }
    }

    const formattedDate = new Date().toISOString().split("T")[0];
    const fileName = `ReporteElectrico_${formattedDate}_${serialNumber}_3P3W.pdf`;

    doc.save(fileName);
  } catch (error) {
    console.error("Error al exportar a PDF:", error);
    alert("Error al exportar a PDF: " + error.message);
  }
}
