// Variables globales (fuera del DOMContentLoaded para que sean accesibles)
let datos = [];
let datosActivos = [];
let charts = {};
const loadingDelay = 500;

// Variables para modo API
let modoActual = "csv"; // 'api' o 'csv'
let updateInterval = null;
const API_URL =
  "https://api.orion.mabcontrol.ar/api/energy/1p2w?device_uid=ESP32_001";
const UPDATE_INTERVAL_MS = 5000; // 5 segundos
let currentLimit = 50;
let isPaused = false; // Control de pausa para filtros
let lastFetchedId = null; // Para obtener solo datos nuevos
const MAX_DATA_POINTS = 100; // Máximo de puntos en gráficos de tiempo real

// Esperar a que el DOM esté cargado
document.addEventListener("DOMContentLoaded", function () {
  // Event listeners para cambio de modo
  document
    .querySelectorAll('input[name="modoVisualizacion"]')
    .forEach((radio) => {
      radio.addEventListener("change", function (e) {
        modoActual = e.target.value;

        // Mostrar/ocultar controles según el modo
        const controlesAPI = document.getElementById("controlesAPI");
        const controlesCSV = document.getElementById("controlesCSV");

        if (modoActual === "api") {
          controlesAPI.style.display = "block";
          controlesCSV.style.display = "none";

          // Iniciar carga de datos en tiempo real
          isPaused = false;
          const btnPauseResume = document.getElementById("btnPauseResume");
          if (btnPauseResume) {
            const icon = btnPauseResume.querySelector("i");
            const text = document.getElementById("pauseResumeText");
            icon.className = "fas fa-pause me-1";
            text.textContent = "Pausar";
            btnPauseResume.classList.remove("btn-success");
            btnPauseResume.classList.add("btn-warning");
          }

          // Iniciar actualización automática
          if (updateInterval) {
            clearInterval(updateInterval);
          }

          // Realizar primera carga inmediata
          cargarDatosAPI();

          // Configurar actualización periódica
          updateInterval = setInterval(() => {
            if (!isPaused) {
              cargarDatosAPI();
            }
          }, UPDATE_INTERVAL_MS);
        } else {
          controlesAPI.style.display = "none";
          controlesCSV.style.display = "block";

          // Detener actualización automática al cambiar a modo CSV
          if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
          }
        }
      });
    });

  // Iniciar en modo CSV por defecto (configurado en modoActual = "csv")
  // No se requiere función de inicialización adicional

  // Event listener para botón de pausa/reanudar
  const btnPauseResume = document.getElementById("btnPauseResume");
  if (btnPauseResume) {
    btnPauseResume.addEventListener("click", function () {
      isPaused = !isPaused;
      const icon = this.querySelector("i");
      const text = document.getElementById("pauseResumeText");

      if (isPaused) {
        icon.className = "fas fa-play me-1";
        text.textContent = "Reanudar";
        this.classList.remove("btn-warning");
        this.classList.add("btn-success");
        console.log("Actualizaciones pausadas");
      } else {
        icon.className = "fas fa-pause me-1";
        text.textContent = "Pausar";
        this.classList.remove("btn-success");
        this.classList.add("btn-warning");
        console.log("Actualizaciones reanudadas");
        // Fetch inmediato al reanudar
        fetchDataFromAPI();
      }
    });
  }

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

  // Botón de filtro avanzado
  const aplicarFiltro = document.getElementById("aplicarFiltro");
  if (aplicarFiltro) {
    aplicarFiltro.addEventListener("click", async function () {
      const fechaInicio = document.getElementById("fechaInicio").value;
      const fechaFin = document.getElementById("fechaFin").value;

      if (!fechaInicio || !fechaFin) {
        alert("Por favor, seleccione fechas de inicio y fin");
        return;
      }

      // Pausar actualizaciones automáticas al aplicar filtro (solo en modo API)
      if (modoActual === "api" && !isPaused) {
        isPaused = true;
        const btnPauseResume = document.getElementById("btnPauseResume");
        if (btnPauseResume) {
          const icon = btnPauseResume.querySelector("i");
          const text = document.getElementById("pauseResumeText");
          icon.className = "fas fa-play me-1";
          text.textContent = "Reanudar";
          btnPauseResume.classList.remove("btn-warning");
          btnPauseResume.classList.add("btn-success");
          console.log("Actualizaciones pausadas automáticamente por filtro");
        }
      }

      document.getElementById("loadingMessage").style.display = "block";

      try {
        // MODO CSV: Filtrado local
        if (modoActual === "csv") {
          console.log("=== APLICANDO FILTROS (MODO CSV) ===");

          if (!datos || datos.length === 0) {
            alert(
              "No hay datos cargados. Por favor, cargue un archivo CSV primero."
            );
            document.getElementById("loadingMessage").style.display = "none";
            return;
          }

          setTimeout(() => {
            try {
              const startDate = new Date(fechaInicio);
              const endDate = new Date(fechaFin);

              // Obtener filtros opcionales
              const tensionMin = document.getElementById("tensionMin").value;
              const tensionMax = document.getElementById("tensionMax").value;
              const corrienteMin =
                document.getElementById("corrienteMin").value;
              const corrienteMax =
                document.getElementById("corrienteMax").value;
              const potenciaMin = document.getElementById("potenciaMin").value;
              const potenciaMax = document.getElementById("potenciaMax").value;

              datosActivos = datos.filter((row) => {
                // Filtro por fecha
                const fechaRegistro = new Date(
                  formatearFechaHora(row.Date, row.Time)
                );
                if (fechaRegistro < startDate || fechaRegistro > endDate) {
                  return false;
                }

                // Filtro por tensión
                if (tensionMin && parseFloat(row.UA) < parseFloat(tensionMin)) {
                  return false;
                }
                if (tensionMax && parseFloat(row.UA) > parseFloat(tensionMax)) {
                  return false;
                }

                // Filtro por corriente
                if (
                  corrienteMin &&
                  parseFloat(row.IA) < parseFloat(corrienteMin)
                ) {
                  return false;
                }
                if (
                  corrienteMax &&
                  parseFloat(row.IA) > parseFloat(corrienteMax)
                ) {
                  return false;
                }

                // Filtro por potencia
                if (
                  potenciaMin &&
                  parseFloat(row.PA) < parseFloat(potenciaMin)
                ) {
                  return false;
                }
                if (
                  potenciaMax &&
                  parseFloat(row.PA) > parseFloat(potenciaMax)
                ) {
                  return false;
                }

                return true;
              });

              if (gridApi) {
                gridApi.setGridOption("rowData", datosActivos);
              }
              crearGraficos(datosActivos);

              if (datosActivos.length === 0) {
                alert("No se encontraron datos con los filtros aplicados");
              } else {
                let mensajeFiltros = `✅ Filtros aplicados: ${datosActivos.length} registros encontrados\n\n`;
                mensajeFiltros += `📅 Período: ${fechaInicio} a ${fechaFin}\n`;

                if (tensionMin || tensionMax) {
                  mensajeFiltros += `⚡ Tensión: ${tensionMin || "sin mín"} - ${
                    tensionMax || "sin máx"
                  } V\n`;
                }
                if (corrienteMin || corrienteMax) {
                  mensajeFiltros += `🔌 Corriente: ${
                    corrienteMin || "sin mín"
                  } - ${corrienteMax || "sin máx"} A\n`;
                }
                if (potenciaMin || potenciaMax) {
                  mensajeFiltros += `💡 Potencia: ${
                    potenciaMin || "sin mín"
                  } - ${potenciaMax || "sin máx"} W\n`;
                }

                alert(mensajeFiltros);
              }
            } catch (error) {
              console.error("Error al aplicar filtro:", error);
              alert("Error al aplicar el filtro: " + error.message);
            } finally {
              document.getElementById("loadingMessage").style.display = "none";
            }
          }, loadingDelay);

          return; // Salir de la función para modo CSV
        }

        // MODO API: Filtrado por API
        // Construir parámetros de filtro
        // Convertir fechas locales a UTC para la API
        const filtros = {
          device_uid: "ESP32_001",
          start_date: new Date(fechaInicio).toISOString(),
          end_date: new Date(fechaFin).toISOString(),
          limit: 5000, // Límite alto para filtros
        };

        // Agregar filtros opcionales solo si tienen valor
        const tensionMin = document.getElementById("tensionMin").value;
        const tensionMax = document.getElementById("tensionMax").value;
        const corrienteMin = document.getElementById("corrienteMin").value;
        const corrienteMax = document.getElementById("corrienteMax").value;
        const potenciaMin = document.getElementById("potenciaMin").value;
        const potenciaMax = document.getElementById("potenciaMax").value;

        if (tensionMin) filtros.ua_min = tensionMin;
        if (tensionMax) filtros.ua_max = tensionMax;
        if (corrienteMin) filtros.ia_min = corrienteMin;
        if (corrienteMax) filtros.ia_max = corrienteMax;
        if (potenciaMin) filtros.pa_min = potenciaMin;
        if (potenciaMax) filtros.pa_max = potenciaMax;

        // Construir URL con query string
        const params = new URLSearchParams(filtros);
        const url = `https://api.orion.mabcontrol.ar/api/energy/1p2w/filter?${params}`;

        console.log("=== APLICANDO FILTROS ===");
        console.log("Parámetros de filtro:", filtros);
        console.log("URL completa:", url);

        // Llamar al endpoint de filtros
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const apiData = await response.json();
        console.log("✅ Respuesta de la API:", apiData);
        console.log("Tipo de respuesta:", typeof apiData);
        console.log("Es array?", Array.isArray(apiData));

        // Verificar si la respuesta es un array o un objeto con datos
        let datos_api = apiData;
        let count = 0;
        let filters_applied = null;

        if (!Array.isArray(apiData)) {
          console.log(
            "La respuesta no es un array directo, buscando propiedad con datos..."
          );

          // Extraer información adicional si existe
          if (apiData.count !== undefined) {
            count = apiData.count;
            console.log("📊 Count de la API:", count);
          }
          if (apiData.filters_applied) {
            filters_applied = apiData.filters_applied;
            console.log("🔍 Filtros aplicados en la API:", filters_applied);
          }

          // Intentar encontrar el array en las propiedades comunes
          if (apiData.data) datos_api = apiData.data;
          else if (apiData.results) datos_api = apiData.results;
          else if (apiData.records) datos_api = apiData.records;
          else {
            console.error(
              "No se pudo encontrar el array de datos en la respuesta:",
              apiData
            );
            throw new Error("Formato de respuesta inesperado de la API");
          }
        }

        console.log(
          `✅ Datos filtrados recibidos: ${datos_api.length} registros`
        );
        console.log(
          `📊 Total según API: ${count || datos_api.length} registros`
        );
        if (datos_api.length > 0) {
          console.log("Primeros 3 registros:", datos_api.slice(0, 3));
        }

        if (datos_api && datos_api.length > 0) {
          // Transformar datos
          const datosFiltrados = transformarDatosAPI(datos_api);
          console.log("Datos transformados:", datosFiltrados.length);
          console.log("Primer registro transformado:", datosFiltrados[0]);

          // Actualizar variables globales
          datos = datosFiltrados;
          datosActivos = datosFiltrados;

          // Actualizar UI
          if (gridApi) {
            gridApi.setGridOption("rowData", datosActivos);
          } else {
            inicializarGrid();
          }

          crearGraficos(datosActivos);

          // Mostrar contenedores
          const contenidoDinamico =
            document.getElementById("contenidoDinamico");
          const myGrid = document.getElementById("myGrid");
          const graficosContainer =
            document.getElementById("graficosContainer");

          if (contenidoDinamico) contenidoDinamico.style.display = "block";
          if (myGrid) myGrid.style.display = "block";
          if (graficosContainer) graficosContainer.style.display = "block";

          // Mensaje detallado con información de filtros
          let mensajeFiltros = `✅ Filtros aplicados: ${datos_api.length} registros encontrados\n\n`;
          mensajeFiltros += `📅 Período: ${fechaInicio} a ${fechaFin}\n`;

          if (filtros.ua_min || filtros.ua_max) {
            mensajeFiltros += `⚡ Tensión: ${filtros.ua_min || "sin mín"} - ${
              filtros.ua_max || "sin máx"
            } V\n`;
          }
          if (filtros.ia_min || filtros.ia_max) {
            mensajeFiltros += `〰️ Corriente: ${filtros.ia_min || "sin mín"} - ${
              filtros.ia_max || "sin máx"
            } A\n`;
          }
          if (filtros.pa_min || filtros.pa_max) {
            mensajeFiltros += `🔌 Potencia: ${filtros.pa_min || "sin mín"} - ${
              filtros.pa_max || "sin máx"
            } W\n`;
          }

          alert(mensajeFiltros);
        } else {
          alert("No se encontraron datos con los filtros aplicados");
        }
      } catch (error) {
        console.error("Error al aplicar filtros:", error);
        alert("Error al aplicar filtros: " + error.message);
      } finally {
        document.getElementById("loadingMessage").style.display = "none";
      }
    });
  }

  // Botón limpiar filtros
  const limpiarFiltros = document.getElementById("limpiarFiltros");
  if (limpiarFiltros) {
    limpiarFiltros.addEventListener("click", function () {
      // Limpiar campos de filtro
      document.getElementById("tensionMin").value = "";
      document.getElementById("tensionMax").value = "";
      document.getElementById("corrienteMin").value = "";
      document.getElementById("corrienteMax").value = "";
      document.getElementById("potenciaMin").value = "";
      document.getElementById("potenciaMax").value = "";

      console.log("Filtros limpiados");

      // MODO CSV: Restaurar todos los datos
      if (modoActual === "csv") {
        if (datos.length > 0) {
          document.getElementById("loadingMessage").style.display = "block";

          setTimeout(() => {
            try {
              // Restaurar fechas originales
              const sortedDatos = [...datos].sort((a, b) => {
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

              // Restaurar todos los datos
              datosActivos = datos;
              if (gridApi) {
                gridApi.setGridOption("rowData", datosActivos);
              }
              crearGraficos(datosActivos);
            } catch (error) {
              console.error("Error al limpiar filtros:", error);
              alert("Error al limpiar filtros: " + error.message);
            } finally {
              document.getElementById("loadingMessage").style.display = "none";
            }
          }, loadingDelay);
        }
      }
      // MODO API: Recargar datos sin filtros
      else if (modoActual === "api" && !isPaused) {
        fetchDataFromAPI();
      }
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

    // Ordenar datos cronológicamente (de más antiguo a más reciente)
    const datosOrdenados = [...datos].sort((a, b) => {
      const dateA = new Date(formatearFechaHora(a.Date, a.Time));
      const dateB = new Date(formatearFechaHora(b.Date, b.Time));
      return dateA - dateB; // Orden ascendente (más antiguo primero)
    });

    // Destruir gráficos existentes
    Object.keys(charts).forEach((key) => {
      if (charts[key]) {
        charts[key].destroy();
        charts[key] = null;
      }
    });

    const MAX_POINTS = 200;
    const labels = downsampleArray(
      datosOrdenados.map((row) => (row.Time ? row.Time.substring(0, 5) : "")),
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
        datosOrdenados.map((row) => parseFloat(row.UA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.UTHA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.IA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.ITHA) || 0),
        MAX_POINTS
      );
      const ith3Data = downsampleArray(
        datosOrdenados.map((row) => parseFloat(row.ITHXA) || 0),
        MAX_POINTS
      );
      const ith5Data = downsampleArray(
        datosOrdenados.map((row) => parseFloat(row.ITHYA) || 0),
        MAX_POINTS
      );
      const ith7Data = downsampleArray(
        datosOrdenados.map((row) => parseFloat(row.ITHZA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.PFA) || 0),
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
        datosOrdenados.map((row) => {
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
        datosOrdenados.map((row) => parseFloat(row.PA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.FA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.QA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.SA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.EPA) || 0),
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
        datosOrdenados.map((row) => parseFloat(row.EQA) || 0),
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
      alert("Error al exportar a PDF: " + error.message);
    }
  }

  // ============================================
  // FUNCIONES PARA MODO API (TIEMPO REAL)
  // ============================================

  function cambiarModo(modo) {
    console.log("Cambiando a modo:", modo);

    // Detener actualizaciones automáticas si están activas
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }

    // Mostrar/ocultar controles según el modo
    if (modo === "api") {
      document.getElementById("controlesAPI").style.display = "block";
      document.getElementById("controlesCSV").style.display = "none";
      iniciarModoAPI();
    } else {
      document.getElementById("controlesAPI").style.display = "none";
      document.getElementById("controlesCSV").style.display = "block";
      updateStatus(false, "Modo archivo CSV");
    }
  }

  function iniciarModoAPI() {
    console.log("Iniciando modo API");
    updateStatus(false, "Conectando...");

    // Primera carga
    fetchDataFromAPI();

    // Configurar actualización automática
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    updateInterval = setInterval(fetchDataFromAPI, UPDATE_INTERVAL_MS);
  }

  async function fetchDataFromAPI() {
    // No hacer fetch si está pausado
    if (isPaused) {
      console.log("Fetch omitido: actualizaciones pausadas");
      return;
    }

    try {
      const url = `${API_URL}&limit=${currentLimit}`;
      console.log("Fetching data from:", url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const apiData = await response.json();
      console.log("Datos recibidos de la API:", apiData.length, "registros");

      if (apiData && apiData.length > 0) {
        // Transformar datos de API al formato esperado por los gráficos
        const datosTransformados = transformarDatosAPI(apiData);

        // Actualizar variables globales
        datos = datosTransformados;
        datosActivos = datosTransformados;

        // Actualizar UI
        actualizarUIConDatosAPI(datosTransformados);
        updateStatus(true, "Conectado");

        // Actualizar timestamp
        const lastUpdate = document.getElementById("lastUpdate");
        if (lastUpdate) {
          lastUpdate.textContent = new Date().toLocaleString("es-AR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        }
      } else {
        console.warn("No se recibieron datos de la API");
        updateStatus(false, "Sin datos");
      }
    } catch (error) {
      console.error("Error al obtener datos de la API:", error);
      updateStatus(false, "Error de conexión");
    }
  }

  function transformarDatosAPI(apiData) {
    // Transformar datos de la API al formato CSV esperado
    // El campo ts de la API está en UTC, necesitamos convertir a Buenos Aires (UTC-3)
    return apiData.map((item) => {
      try {
        // El timestamp viene en UTC, convertir a Buenos Aires (UTC-3)
        const fechaUTC = new Date(item.ts);

        // Validar que la fecha sea válida
        if (isNaN(fechaUTC.getTime())) {
          console.error("Timestamp inválido:", item.ts);
          throw new Error("Invalid timestamp");
        }

        // Restar 3 horas para convertir UTC a Buenos Aires (UTC-3)
        const fechaBuenosAires = new Date(
          fechaUTC.getTime() - 3 * 60 * 60 * 1000
        );

        // Formatear fecha y hora
        const year = fechaBuenosAires.getFullYear();
        const month = String(fechaBuenosAires.getMonth() + 1).padStart(2, "0");
        const day = String(fechaBuenosAires.getDate()).padStart(2, "0");
        const hours = String(fechaBuenosAires.getHours()).padStart(2, "0");
        const minutes = String(fechaBuenosAires.getMinutes()).padStart(2, "0");
        const seconds = String(fechaBuenosAires.getSeconds()).padStart(2, "0");

        const fechaFormateada = `${year}-${month}-${day}`;
        const horaFormateada = `${hours}:${minutes}:${seconds}`;

        // Log solo del primer registro
        if (apiData.indexOf(item) === 0) {
          console.log(
            `UTC: ${item.ts} -> Buenos Aires (UTC-3): ${fechaFormateada} ${horaFormateada}`
          );
        }

        return {
          Date: fechaFormateada,
          Time: horaFormateada,
          UA: parseFloat(item.ua) || 0,
          IA: parseFloat(item.ia) || 0,
          PA: parseFloat(item.pa) || 0,
          QA: parseFloat(item.qa) || 0,
          SA: parseFloat(item.sa) || 0,
          PFA: parseFloat(item.pfa) || 0,
          FA: parseFloat(item.fa) || 0,
          EPA: parseFloat(item.epa) || 0,
          EQA: parseFloat(item.eqa) || 0,
          UTHA: parseFloat(item.utha) || 0,
          ITHA: parseFloat(item.itha) || 0,
          ITHXA: 0,
          ITHYA: 0,
          ITHZA: 0,
        };
      } catch (error) {
        console.error("Error transformando registro:", item, error);
        // Retornar registro con valores por defecto
        const now = new Date();
        return {
          Date: now.toISOString().split("T")[0],
          Time: "00:00:00",
          UA: 0,
          IA: 0,
          PA: 0,
          QA: 0,
          SA: 0,
          PFA: 0,
          FA: 0,
          EPA: 0,
          EQA: 0,
          UTHA: 0,
          ITHA: 0,
          ITHXA: 0,
          ITHYA: 0,
          ITHZA: 0,
        };
      }
    });
  }

  // Función para cargar datos desde la API
  async function cargarDatosAPI() {
    try {
      updateStatus(false, "Cargando datos...");

      const url = `${API_URL}&limit=${currentLimit}`;
      console.log("Cargando datos desde:", url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const apiData = await response.json();
      console.log("Datos recibidos de la API:", apiData);

      // Verificar si hay datos
      let datos_api = Array.isArray(apiData) ? apiData : apiData.data || [];

      if (datos_api && datos_api.length > 0) {
        // Obtener el último registro (más reciente)
        const ultimoRegistro = datos_api[0]; // Asumiendo que vienen ordenados del más reciente al más antiguo

        // Verificar antigüedad del último registro
        // El timestamp viene de la API en formato UTC ISO
        // NOTA: La API está agregando 3 horas al timestamp de la BD
        // Necesitamos restar 3 horas para obtener el timestamp correcto
        const timestampUltimo = new Date(ultimoRegistro.ts);
        timestampUltimo.setHours(timestampUltimo.getHours() - 3);

        const ahora = new Date();

        // La diferencia debe ser positiva (ahora - pasado)
        const diferenciaSegundos = (ahora - timestampUltimo) / 1000;

        console.log("=== VERIFICACIÓN DE CONEXIÓN ===");
        console.log(`Timestamp original de API: ${ultimoRegistro.ts}`);
        console.log(
          `Timestamp corregido (-3h): ${timestampUltimo.toISOString()}`
        );
        console.log(
          `Fecha del último registro: ${timestampUltimo.toISOString()}`
        );
        console.log(`Fecha actual: ${ahora.toISOString()}`);
        console.log(`Diferencia en milisegundos: ${ahora - timestampUltimo}`);
        console.log(`Antigüedad: ${diferenciaSegundos.toFixed(1)} segundos`);
        console.log(
          `Estado: ${diferenciaSegundos <= 10 ? "CONECTADO" : "DESCONECTADO"}`
        );

        // Transformar datos de API a formato local
        const datosProcesados = transformarDatosAPI(datos_api);

        // Actualizar variables globales
        datos = datosProcesados;
        datosActivos = datosProcesados;

        // Actualizar UI
        actualizarUIConDatosAPI(datosProcesados);

        // Determinar estado según antigüedad del último registro
        // Usar valor absoluto para manejar diferencias de zona horaria
        const antiguedadAbsoluta = Math.abs(diferenciaSegundos);

        if (antiguedadAbsoluta <= 10) {
          updateStatus(true, "Conectado");
        } else {
          // Formatear tiempo de desconexión
          let tiempoDesconexion;
          if (antiguedadAbsoluta < 60) {
            // Menos de 1 minuto: mostrar en segundos
            tiempoDesconexion = `${Math.floor(antiguedadAbsoluta)}s`;
          } else if (antiguedadAbsoluta < 3600) {
            // Menos de 60 minutos: mostrar en minutos
            const minutos = Math.floor(antiguedadAbsoluta / 60);
            tiempoDesconexion = `${minutos}min`;
          } else {
            // Más de 60 minutos: mostrar en horas
            const horas = Math.floor(antiguedadAbsoluta / 3600);
            const minutos = Math.floor((antiguedadAbsoluta % 3600) / 60);
            tiempoDesconexion =
              minutos > 0 ? `${horas}h ${minutos}min` : `${horas}h`;
          }

          updateStatus(false, `Desconectado (${tiempoDesconexion} sin datos)`);
        }

        // Actualizar última actualización
        const now = new Date();
        const lastUpdateElement = document.getElementById("lastUpdate");
        if (lastUpdateElement) {
          lastUpdateElement.textContent = now.toLocaleTimeString("es-AR");
        }
      } else {
        updateStatus(false, "Sin datos");
      }
    } catch (error) {
      console.error("Error al cargar datos de la API:", error);
      updateStatus(false, "Error de conexión");
    }
  }

  function actualizarUIConDatosAPI(datosProcesados) {
    try {
      // Actualizar número de serie (si está disponible)
      const serialNumber = document.getElementById("serialNumber");
      if (serialNumber && datosProcesados.length > 0) {
        serialNumber.textContent = "ESP32_001"; // Puedes ajustar esto según tus necesidades
      }

      // Configurar las fechas
      if (datosProcesados.length > 0) {
        const sortedDatos = [...datosProcesados].sort((a, b) => {
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
          const fechaInicioInput = document.getElementById("fechaInicio");
          const fechaFinInput = document.getElementById("fechaFin");
          if (fechaInicioInput) fechaInicioInput.value = fechaInicio;
          if (fechaFinInput) fechaFinInput.value = fechaFin;
        }
      }

      // Mostrar contenedores
      const contenidoDinamico = document.getElementById("contenidoDinamico");
      const myGrid = document.getElementById("myGrid");
      const graficosContainer = document.getElementById("graficosContainer");

      if (contenidoDinamico) contenidoDinamico.style.display = "block";
      if (myGrid) myGrid.style.display = "block";
      if (graficosContainer) graficosContainer.style.display = "block";

      document.getElementById("loadingMessage").style.display = "none";

      // Actualizar grid y gráficos
      inicializarGrid();
      crearGraficos(datosProcesados);
    } catch (error) {
      console.error("Error al actualizar la UI con datos de API:", error);
    }
  }

  function updateStatus(isOnline, statusText) {
    const indicator = document.getElementById("statusIndicator");
    const textElement = document.getElementById("statusText");

    if (indicator) {
      if (isOnline) {
        indicator.className = "status-indicator status-online";
      } else {
        indicator.className = "status-indicator status-offline";
      }
    }

    if (textElement) {
      textElement.textContent = statusText;
    }
  }

  // Limpiar interval cuando se cierra la página
  window.addEventListener("beforeunload", () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
}); // Fin del DOMContentLoaded
