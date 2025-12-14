self.onmessage = function (e) {
  const file = e.data;
  const reader = new FileReader();

  reader.onload = function (event) {
    const text = event.target.result;
    const lines = text.split("\n");

    const datos = [];
    const serialNumber = lines[0].split(":")[1]?.trim() || "";

    // Buscar la línea que contiene "Date,Time" (línea 3 en archivos 3P3W)
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
      if (row.length > 20 && row[0].trim() !== "") {
        try {
          // Verificar que la primera columna sea una fecha válida
          if (row[0].match(/\d{4}-\d{2}-\d{2}/)) {
            datos.push({
              Date: row[0],
              Time: row[1],
              // Voltajes Línea-Línea (3P3W no tiene neutro)
              UAB: parseFloat(row[2]) || 0,
              UBC: parseFloat(row[3]) || 0,
              UCA: parseFloat(row[4]) || 0,
              UAvg: parseFloat(row[5]) || 0,
              // THD Voltajes
              UTHAB: parseFloat(row[6]) || 0,
              UTHBC: parseFloat(row[7]) || 0,
              UTHCA: parseFloat(row[8]) || 0,
              UTHAvg: parseFloat(row[9]) || 0,
              // Corrientes
              IA: parseFloat(row[10]) || 0,
              IB: parseFloat(row[11]) || 0,
              IC: parseFloat(row[12]) || 0,
              IAvg: parseFloat(row[13]) || 0,
              // THD Corrientes
              ITHA: parseFloat(row[14]) || 0,
              ITHB: parseFloat(row[15]) || 0,
              ITHC: parseFloat(row[16]) || 0,
              ITHAvg: parseFloat(row[17]) || 0,
              // Armónicas 3ra
              ITHXA: parseFloat(row[18]) || 0,
              ITHXB: parseFloat(row[19]) || 0,
              ITHXC: parseFloat(row[20]) || 0,
              // Armónicas 5ta
              ITHYA: parseFloat(row[21]) || 0,
              ITHYB: parseFloat(row[22]) || 0,
              ITHYC: parseFloat(row[23]) || 0,
              // Armónicas 7ma
              ITHZA: parseFloat(row[24]) || 0,
              ITHZB: parseFloat(row[25]) || 0,
              ITHZC: parseFloat(row[26]) || 0,
              // Frecuencia
              F: parseFloat(row[27]) || 0,
              // Factor de Potencia
              PF: parseFloat(row[28]) || 0,
              // Potencias (solo suma en 3P3W)
              PSum: parseFloat(row[29]) || 0,
              QSum: parseFloat(row[30]) || 0,
              SSum: parseFloat(row[31]) || 0,
              // Energías (solo suma en 3P3W)
              EPSum: parseFloat(row[32]) || 0,
              EQSum: parseFloat(row[33]) || 0,
              ESSum: parseFloat(row[34]) || 0,
              // Demandas de corriente
              DmIA: parseFloat(row[35]) || 0,
              DmIB: parseFloat(row[36]) || 0,
              DmIC: parseFloat(row[37]) || 0,
              DmIAVG: parseFloat(row[38]) || 0,
              // Picos de demanda de corriente
              PDmIA: parseFloat(row[39]) || 0,
              PDmIA_DT: row[40] || "",
              PDmIB: parseFloat(row[41]) || 0,
              PDmIB_DT: row[42] || "",
              PDmIC: parseFloat(row[43]) || 0,
              PDmIC_DT: row[44] || "",
              PDmIAVG: parseFloat(row[45]) || 0,
              PDmIAVG_DT: row[46] || "",
              // Demandas de potencia
              DmP: parseFloat(row[47]) || 0,
              PDmP: parseFloat(row[48]) || 0,
              PDmP_DT: row[49] || "",
              DmQ: parseFloat(row[50]) || 0,
              PDmQ: parseFloat(row[51]) || 0,
              PDmQ_DT: row[52] || "",
              DmS: parseFloat(row[53]) || 0,
              PDmS: parseFloat(row[54]) || 0,
              PDmS_DT: row[55] || "",
            });
          }
        } catch (e) {
          console.warn("Worker 3P3W: Error procesando línea", i, e);
        }
      }
    }

    console.log(`Worker 3P3W: Procesados ${datos.length} registros`);
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
