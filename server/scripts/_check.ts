// Imprime "etiqueta: real (esperado X)": python3 $SCRATCH/chequear.py compara ambos valores.
export const ok = (etiqueta: string, real: unknown, esperado: unknown) => console.log(`${etiqueta}: ${real} (esperado ${esperado})`);
export const si = (b: boolean) => (b ? "sí" : "no");
