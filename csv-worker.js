self.onmessage = function(e) {
    const file = e.data;
    const reader = new FileReader();

    reader.onload = function(event) {
        const text = event.target.result;
        const lines = text.split('\n');
        
        const datos = [];
        const serialNumber = lines[0].split(':')[1]?.trim() || '';

        let startIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Date,Time')) {
                startIndex = i + 1;
                break;
            }
        }

        if (startIndex === -1) {
            self.postMessage({ type: 'error', payload: 'No se encontró la línea de encabezados correcta' });
            return;
        }

        for (let i = startIndex; i < lines.length; i++) {
            const row = lines[i].trim().split(',');
            if (row.length > 8 && row[0].trim() !== '') {
                try {
                    if (!isNaN(parseFloat(row[2]))) { // Verifica si UA es un número
                        datos.push({
                            Date: row[0],
                            Time: row[1],
                            // Voltajes
                            UA: parseFloat(row[2]) || 0,
                            UB: parseFloat(row[3]) || 0,
                            UC: parseFloat(row[4]) || 0,
                            UAvg: parseFloat(row[5]) || 0,
                            // UTHD
                            UTHA: parseFloat(row[6]) || 0,
                            UTHB: parseFloat(row[7]) || 0,
                            UTHC: parseFloat(row[8]) || 0,
                            UTHAvg: parseFloat(row[9]) || 0,
                            // Corrientes
                            IA: parseFloat(row[10]) || 0,
                            IB: parseFloat(row[11]) || 0,
                            IC: parseFloat(row[12]) || 0,
                            IAvg: parseFloat(row[13]) || 0,
                            // ITHD
                            ITHA: parseFloat(row[14]) || 0,
                            ITHB: parseFloat(row[15]) || 0,
                            ITHC: parseFloat(row[16]) || 0,
                            ITHAvg: parseFloat(row[17]) || 0,
                            //3er armonico
                            ITHXA: parseFloat(row[18]) || 0,
                            ITHXB: parseFloat(row[19]) || 0,
                            ITHXC: parseFloat(row[20]) || 0,
                            //5to
                            ITHYA: parseFloat(row[21]) || 0,
                            ITHYB: parseFloat(row[22]) || 0,
                            ITHYC: parseFloat(row[23]) || 0,
                            //7mo
                            ITHZA: parseFloat(row[24]) || 0,
                            ITHZB: parseFloat(row[25]) || 0,
                            ITHZC: parseFloat(row[26]) || 0,
                            // Frecuencias
                            //FA: parseFloat(row[27]) || 0,
                            //FB: parseFloat(row[28]) || 0,
                            //FC: parseFloat(row[29]) || 0,
                            //FAvg: parseFloat(row[30]) || 0,
                            // Factor de Potencia
                            PFA: parseFloat(row[31]) || 0,
                            PFB: parseFloat(row[32]) || 0,
                            PFC: parseFloat(row[33]) || 0,
                            PFAvg: parseFloat(row[34]) || 0,
                            // Potencia Activa
                            PA: parseFloat(row[35]) || 0,
                            PB: parseFloat(row[36]) || 0,
                            PC: parseFloat(row[37]) || 0,
                            PSum: parseFloat(row[38]) || 0,
                            // Potencia Reactiva
                            QA: parseFloat(row[39]) || 0,
                            QB: parseFloat(row[40]) || 0,
                            QC: parseFloat(row[41]) || 0,
                            QSum: parseFloat(row[42]) || 0,
                            // Potencia Aparente
                            SA: parseFloat(row[43]) || 0,
                            SB: parseFloat(row[44]) || 0,
                            SC: parseFloat(row[45]) || 0,
                            SSum: parseFloat(row[46]) || 0,
                            // Energías
                            EPA: parseFloat(row[47]) || 0,
                            EPB: parseFloat(row[48]) || 0,
                            EPC: parseFloat(row[49]) || 0,
                            EPSum: parseFloat(row[50]) || 0,
                            EQA: parseFloat(row[51]) || 0,
                            EQB: parseFloat(row[52]) || 0,
                            EQC: parseFloat(row[53]) || 0,
                            EQSum: parseFloat(row[54]) || 0
                        });
                    }
                } catch (e) {
                    // Ignorar la línea si hay un error de parseo
                    console.warn('Worker: Error procesando línea', i, e);
                }
            }
        }
        
        self.postMessage({ type: 'complete', payload: { serialNumber, datos } });
    };

    reader.onerror = function() {
        self.postMessage({ type: 'error', payload: 'Error al leer el archivo en el worker.' });
    };

    reader.readAsText(file);
};