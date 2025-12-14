// Variables globales (fuera del DOMContentLoaded para que sean accesibles)
let datos = [];
let datosActivos = [];
let charts = {};
const loadingDelay = 500;

// Esperar a que el DOM esté cargado
document.addEventListener("DOMContentLoaded", function () {
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
    const isValidSuffix = fileName.includes("1P2W");
    if (!isValidExtension || !isValidSuffix) {
      alert(
        'Por favor, selecciona un archivo que contenga "1P2W" en su nombre y termine en .csv.'
      );
      return;
    }

    console.log("Iniciando procesamiento con Web Worker");
    document.getElementById("loadingMessage").style.display = "block";

    // Ocultar contenido mientras se procesa
    const contenidoDinamico = document.getElementById("contenidoDinamico");
    const graficosContainer = document.getElementById("graficosContainer");
    if (contenidoDinamico) contenidoDinamico.style.display = "none";
    if (graficosContainer) graficosContainer.style.display = "none";
    document.querySelectorAll(".grafico-container").forEach((container) => {
      container.style.display = "none";
    });

    // Lógica del Web Worker
    const worker = new Worker("csv-worker-1p2w.js");

    worker.onmessage = function (event) {
      const { type, payload } = event.data;

      if (type === "complete") {
        console.log(
          "Worker completado. Recibidos",
          payload.datos.length,
          "registros."
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
          primerRegistro.Time
        );
        const fechaFin = formatearFechaHora(
          ultimoRegistro.Date,
          ultimoRegistro.Time
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

        if (contenidoDinamico) contenidoDinamico.style.display = "block";
        if (myGrid) myGrid.style.display = "block";
        if (graficosContainer) graficosContainer.style.display = "block";

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
              formatearFechaHora(row.Date, row.Time)
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

  // Función downsampling
  function downsampleArray(arr, maxPoints) {
    if (arr.length <= maxPoints) return arr;
    const step = Math.ceil(arr.length / maxPoints);
    return arr.filter((_, idx) => idx % step === 0);
  }

  // Función para crear gráficos
  function crearGraficos(datos) {
    console.log("Iniciando creación de gráficos monofásicos");

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
      MAX_POINTS
    );

    // Mostrar contenedores de gráficos
    document.querySelectorAll(".grafico-container").forEach((container) => {
      container.style.display = "block";
    });

    // Gráfico de Voltaje (UA)
    const ctxVoltaje = document.getElementById("graficaVoltaje");
    if (ctxVoltaje) {
      const voltageData = downsampleArray(
        datos.map((row) => parseFloat(row.UA) || 0),
        MAX_POINTS
      );
      const voltageRange = getYAxisRange([voltageData]);
      charts.voltaje = new Chart(ctxVoltaje, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Tensión (V)",
              data: voltageData,
              borderColor: "rgb(0, 123, 255)",
              backgroundColor: "rgba(0, 123, 255, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { title: { display: true, text: "Tensión (V)" } },
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

    // Gráfico de UTHD (%)
    const ctxUTHD = document.getElementById("graficaUTHD");
    if (ctxUTHD) {
      const uthdData = downsampleArray(
        datos.map((row) => parseFloat(row.UTHA) || 0),
        MAX_POINTS
      );
      const uthdRange = getYAxisRange([uthdData]);
      charts.uthd = new Chart(ctxUTHD, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "THD Tensión (%)",
              data: uthdData,
              backgroundColor: "rgba(255, 193, 7, 0.7)",
              borderColor: "rgb(255, 193, 7)",
              borderWidth: 1,
            },
          ],
        },
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

    // Gráfico de Corriente (IA)
    const ctxCorriente = document.getElementById("graficaCorriente");
    if (ctxCorriente) {
      const currentData = downsampleArray(
        datos.map((row) => parseFloat(row.IA) || 0),
        MAX_POINTS
      );
      const currentRange = getYAxisRange([currentData]);
      charts.corriente = new Chart(ctxCorriente, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Corriente (A)",
              data: currentData,
              borderColor: "rgb(40, 167, 69)",
              backgroundColor: "rgba(40, 167, 69, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
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

    // Gráfico de ITHD (%) con armónicas
    const ctxITH = document.getElementById("graficaITH");
    if (ctxITH) {
      const ithaData = downsampleArray(
        datos.map((row) => parseFloat(row.ITHA) || 0),
        MAX_POINTS
      );
      const ith3Data = downsampleArray(
        datos.map((row) => parseFloat(row.ITHXA) || 0),
        MAX_POINTS
      );
      const ith5Data = downsampleArray(
        datos.map((row) => parseFloat(row.ITHYA) || 0),
        MAX_POINTS
      );
      const ith7Data = downsampleArray(
        datos.map((row) => parseFloat(row.ITHZA) || 0),
        MAX_POINTS
      );

      const ithRange = getYAxisRange([ithaData, ith3Data, ith5Data, ith7Data]);
      charts.ith = new Chart(ctxITH, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "THD Total (%)",
              data: ithaData,
              backgroundColor: "rgba(220, 53, 69, 0.7)",
              borderColor: "rgb(220, 53, 69)",
              borderWidth: 1,
            },
            {
              label: "3ra Armónica (%)",
              data: ith3Data,
              backgroundColor: "rgba(255, 193, 7, 0.7)",
              borderColor: "rgb(255, 193, 7)",
              borderWidth: 1,
            },
            {
              label: "5ta Armónica (%)",
              data: ith5Data,
              backgroundColor: "rgba(0, 123, 255, 0.7)",
              borderColor: "rgb(0, 123, 255)",
              borderWidth: 1,
            },
            {
              label: "7ma Armónica (%)",
              data: ith7Data,
              backgroundColor: "rgba(153, 102, 255, 0.7)",
              borderColor: "rgb(153, 102, 255)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: "THD Corriente y Armónicas (%)" },
          },
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

    // Gráfico de Factor de Potencia
    const ctxPF = document.getElementById("graficaPF");
    if (ctxPF) {
      const pfData = downsampleArray(
        datos.map((row) => parseFloat(row.PFA) || 0),
        MAX_POINTS
      );
      const pfRange = getYAxisRange([pfData]);
      charts.pf = new Chart(ctxPF, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Factor de Potencia",
              data: pfData,
              borderColor: "rgb(111, 66, 193)",
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
              ticks: {
                stepSize: 0.1,
                callback: (value) => value.toFixed(2),
              },
            },
          },
        },
      });
    }

    // Gráfico de Cos Phi (calculado)
    const ctxCosPhi = document.getElementById("graficaCosPhi2");
    if (ctxCosPhi) {
      const cosPhiData = downsampleArray(
        datos.map((row) => {
          const P = parseFloat(row.PA) || 0;
          const Q = parseFloat(row.QA) || 0;
          const S = Math.sqrt(P * P + Q * Q);
          return S !== 0 ? Number((P / S).toFixed(3)) : 0;
        }),
        MAX_POINTS
      );
      const cosPhiRange = getYAxisRange([cosPhiData]);
      charts.cosPhi = new Chart(ctxCosPhi, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Cos φ",
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
          plugins: { title: { display: true, text: "Cos φ" } },
          scales: {
            x: { ticks: { maxRotation: 45, minRotation: 45 } },
            y: {
              min: Math.max(cosPhiRange.min, -1),
              max: Math.min(cosPhiRange.max, 1),
              ticks: {
                stepSize: 0.1,
                callback: (value) => value.toFixed(2),
              },
            },
          },
        },
      });
    }

    // Gráfico de Potencia Activa
    const ctxPA = document.getElementById("graficaPotenciaActiva");
    if (ctxPA) {
      const paData = downsampleArray(
        datos.map((row) => parseFloat(row.PA) || 0),
        MAX_POINTS
      );
      const paRange = getPowerEnergyRange([paData]);
      charts.potenciaActiva = new Chart(ctxPA, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Potencia Activa (W)",
              data: paData,
              borderColor: "rgb(0, 123, 255)",
              backgroundColor: "rgba(0, 123, 255, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { title: { display: true, text: "Potencia Activa (W)" } },
          scales: {
            x: { ticks: { maxRotation: 45, minRotation: 45 } },
            y: {
              min: paRange.min,
              max: paRange.max,
              ticks: { stepSize: paRange.stepSize },
            },
          },
        },
      });
    }

    // Gráfico de Frecuencia
    const ctxFreq = document.getElementById("graficaCosPhi");
    if (ctxFreq) {
      const freqData = downsampleArray(
        datos.map((row) => parseFloat(row.FA) || 0),
        MAX_POINTS
      );
      const freqRange = getYAxisRange([freqData]);
      charts.frecuencia = new Chart(ctxFreq, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Frecuencia (Hz)",
              data: freqData,
              borderColor: "rgb(255, 159, 64)",
              backgroundColor: "rgba(255, 159, 64, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { title: { display: true, text: "Frecuencia (Hz)" } },
          scales: {
            x: { ticks: { maxRotation: 45, minRotation: 45 } },
            y: {
              min: Math.max(freqRange.min, 49),
              max: Math.min(freqRange.max, 51),
              ticks: {
                stepSize: 0.1,
                callback: (value) => value.toFixed(2) + " Hz",
              },
            },
          },
        },
      });
    }

    // Gráfico de Potencia Reactiva
    const ctxPR = document.getElementById("graficaPotenciaReactiva");
    if (ctxPR) {
      const prData = downsampleArray(
        datos.map((row) => parseFloat(row.QA) || 0),
        MAX_POINTS
      );
      const prRange = getPowerEnergyRange([prData]);
      charts.potenciaReactiva = new Chart(ctxPR, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Potencia Reactiva (Var)",
              data: prData,
              borderColor: "rgb(255, 193, 7)",
              backgroundColor: "rgba(255, 193, 7, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: "Potencia Reactiva (Var)" },
          },
          scales: {
            x: { ticks: { maxRotation: 45, minRotation: 45 } },
            y: {
              min: prRange.min,
              max: prRange.max,
              ticks: { stepSize: prRange.stepSize },
            },
          },
        },
      });
    }

    // Gráfico de Potencia Aparente
    const ctxPS = document.getElementById("graficaPotenciaAparente");
    if (ctxPS) {
      const psData = downsampleArray(
        datos.map((row) => parseFloat(row.SA) || 0),
        MAX_POINTS
      );
      const psRange = getPowerEnergyRange([psData]);
      charts.potenciaAparente = new Chart(ctxPS, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Potencia Aparente (VA)",
              data: psData,
              borderColor: "rgb(153, 102, 255)",
              backgroundColor: "rgba(153, 102, 255, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { title: { display: true, text: "Potencia Aparente (VA)" } },
          scales: {
            x: { ticks: { maxRotation: 45, minRotation: 45 } },
            y: {
              min: psRange.min,
              max: psRange.max,
              ticks: { stepSize: psRange.stepSize },
            },
          },
        },
      });
    }

    // Gráfico de Energía Activa
    const ctxEA = document.getElementById("graficaEnergiaActiva");
    if (ctxEA) {
      const eaData = downsampleArray(
        datos.map((row) => parseFloat(row.EPA) || 0),
        MAX_POINTS
      );
      const eaRange = getPowerEnergyRange([eaData]);
      charts.energiaActiva = new Chart(ctxEA, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Energía Activa (Wh)",
              data: eaData,
              borderColor: "rgb(40, 167, 69)",
              backgroundColor: "rgba(40, 167, 69, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { title: { display: true, text: "Energía Activa (Wh)" } },
          scales: {
            x: { ticks: { maxRotation: 45, minRotation: 45 } },
            y: {
              min: eaRange.min,
              max: eaRange.max,
              ticks: { stepSize: eaRange.stepSize },
            },
          },
        },
      });
    }

    // Gráfico de Energía Reactiva
    const ctxER = document.getElementById("graficaEnergiaReactiva");
    if (ctxER) {
      const erData = downsampleArray(
        datos.map((row) => parseFloat(row.EQA) || 0),
        MAX_POINTS
      );
      const erRange = getPowerEnergyRange([erData]);
      charts.energiaReactiva = new Chart(ctxER, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Energía Reactiva (Varh)",
              data: erData,
              borderColor: "rgb(220, 53, 69)",
              backgroundColor: "rgba(220, 53, 69, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: "Energía Reactiva (Varh)" },
          },
          scales: {
            x: { ticks: { maxRotation: 45, minRotation: 45 } },
            y: {
              min: erRange.min,
              max: erRange.max,
              ticks: { stepSize: erRange.stepSize },
            },
          },
        },
      });
    }

    console.log("Gráficos monofásicos creados exitosamente");
  }

  // Funciones de utilidad
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
        { align: "center" }
      );
      doc.setFontSize(14);
      doc.text(
        "ANALIZADOR DE CALIDAD DE ENERGÍA ME631",
        pageWidth / 2,
        margin + 25,
        { align: "center" }
      );
      doc.setFontSize(12);
      doc.text(
        "Tipo de Conexión: 1 FASE 2 CONDUCTORES",
        pageWidth / 2,
        margin + 30,
        { align: "center" }
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
      const fileName = `ReporteElectrico_${formattedDate}_${serialNumber}_1P2W.pdf`;

      doc.save(fileName);
    } catch (error) {
      console.error("Error al exportar a PDF:", error);
      alert("Error al exportar a PDF: " + error.message);
    }
  }
}); // Fin del DOMContentLoaded
