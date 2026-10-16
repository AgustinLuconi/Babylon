// Lo que llega por la conexión en vivo (el formato lo arma el servidor en core/tiempoReal.ts).
export interface SenalEnVivo {
  tipo: string;
  datos: unknown;
}

// Lector del formato SSE: recibe el texto a trozos (un trozo puede cortar una línea por la mitad) y entrega cada señal
// completa. Las líneas que empiezan con ":" (el latido) se ignoran. El servidor termina las líneas con "\n".
export function crearLectorSse(alSenal: (senal: SenalEnVivo) => void): (trozo: string) => void {
  let resto = "";
  let tipo = "message";
  let datos: string[] = [];
  return (trozo) => {
    resto += trozo;
    const lineas = resto.split(/\r\n|\n|\r/);
    resto = lineas.pop() ?? "";
    for (const linea of lineas) {
      if (linea === "") {
        if (datos.length > 0) {
          const texto = datos.join("\n");
          let valor: unknown = texto;
          try {
            valor = JSON.parse(texto);
          } catch {
            // texto plano
          }
          alSenal({ tipo, datos: valor });
        }
        tipo = "message";
        datos = [];
        continue;
      }
      if (linea.startsWith(":")) continue;
      const corte = linea.indexOf(":");
      const campo = corte === -1 ? linea : linea.slice(0, corte);
      const valor = corte === -1 ? "" : linea.slice(corte + 1).replace(/^ /, "");
      if (campo === "event") tipo = valor;
      else if (campo === "data") datos.push(valor);
    }
  };
}
