// Texto legible del dispositivo ("Chrome en Windows") a partir del encabezado User-Agent. Función pura y sin
// dependencias: alcanza para que la persona reconozca sus sesiones, no pretende ser un analizador completo.
// El orden importa: Edge y Opera también dicen "Chrome", y Chrome también dice "Safari"; Android dice
// "Linux" y el iPhone dice "Mac OS X", así que esos se miran antes.
const NAVEGADORES: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SISTEMAS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux|X11/, "Linux"],
];

export function describirDispositivo(userAgent: string | undefined): string {
  if (!userAgent) return "Dispositivo desconocido";
  const navegador = NAVEGADORES.find(([patron]) => patron.test(userAgent))?.[1];
  const sistema = SISTEMAS.find(([patron]) => patron.test(userAgent))?.[1];
  if (navegador && sistema) return `${navegador} en ${sistema}`;
  return navegador ?? sistema ?? "Dispositivo desconocido";
}
