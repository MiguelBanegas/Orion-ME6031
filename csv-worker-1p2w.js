self.onmessage = function (e) {
  const file = e.data;
  const reader = new FileReader();

  reader.onload = function (event) {
    const text = event.target.result;
    const lines = text.split("\n");

    const datos = [];
    const serialNumber = lines[0].split(":")[1]?.trim() || "";

    // Buscar la línea que contiene "Date,Time" (línea 3 en archivos 1P2W)
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Date,Time")) {
        startIndex = i + 1;
        break;
      }
    }

    if (startIndex === -1) {
      self.postMessage({
        type: "error",
        payload: "No se encontró la línea de encabezados correcta",
      });
      return;
    }

    // Procesar datos desde startIndex
    for (let i = startIndex; i < lines.length; i++) {
      const row = lines[i].trim().split(",");
      if (row.length > 10 && row[0].trim() !== "") {
        try {
          // Verificar que la primera columna sea una fecha válida
          if (row[0].match(/\d{4}-\d{2}-\d{2}/)) {
            datos.push({
              Date: row[0],
              Time: row[1],
              // Voltaje
              UA: parseFloat(row[2]) || 0,
              // THD Voltaje
              UTHA: parseFloat(row[3]) || 0,
              // Corriente
              IA: parseFloat(row[4]) || 0,
              // THD Corriente
              ITHA: parseFloat(row[5]) || 0,
              // Armónicas de corriente
              ITHXA: parseFloat(row[6]) || 0, // 3ra armónica
              ITHYA: parseFloat(row[7]) || 0, // 5ta armónica
              ITHZA: parseFloat(row[8]) || 0, // 7ma armónica
              // Frecuencia
              FA: parseFloat(row[9]) || 0,
              // Factor de Potencia
              PFA: parseFloat(row[10]) || 0,
              // Potencia Activa
              PA: parseFloat(row[11]) || 0,
              // Potencia Reactiva
              QA: parseFloat(row[12]) || 0,
              // Potencia Aparente
              SA: parseFloat(row[13]) || 0,
              // Energía Activa
              EPA: parseFloat(row[14]) || 0,
              // Energía Reactiva
              EQA: parseFloat(row[15]) || 0,
              // Energía Aparente
              ESA: parseFloat(row[16]) || 0,
              // Demandas de corriente
              DmIA: parseFloat(row[17]) || 0,
              PDmIA: parseFloat(row[18]) || 0,
              PDmIA_DT: row[19] || "",
              // Demandas de potencia activa
              DmP: parseFloat(row[20]) || 0,
              PDmP: parseFloat(row[21]) || 0,
              PDmP_DT: row[22] || "",
              // Demandas de potencia reactiva
              DmQ: parseFloat(row[23]) || 0,
              PDmQ: parseFloat(row[24]) || 0,
              PDmQ_DT: row[25] || "",
              // Demandas de potencia aparente
              DmS: parseFloat(row[26]) || 0,
              PDmS: parseFloat(row[27]) || 0,
              PDmS_DT: row[28] || "",
            });
          }
        } catch (e) {
          console.warn("Worker 1P2W: Error procesando línea", i, e);
        }
      }
    }

    console.log(`Worker 1P2W: Procesados ${datos.length} registros`);
    self.postMessage({ type: "complete", payload: { serialNumber, datos } });
  };

  reader.onerror = function () {
    self.postMessage({
      type: "error",
      payload: "Error al leer el archivo en el worker.",
    });
  };

  reader.readAsText(file);
};
