// FUNCIÓN CORREGIDA - Reemplazar en 1P2W.js línea 1274
// El campo ts de la API está en UTC, necesitamos convertir a Buenos Aires (UTC-3)

function transformarDatosAPI(apiData) {
  // Transformar datos de la API al formato CSV esperado
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
