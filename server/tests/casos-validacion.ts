// Tabla de casos de las reglas de validación. La corren las DOS copias (server y client) con los mismos nombres:
// si una cambia sin la otra, el test falla.
export const CASOS_DNI: [string, string | null][] = [
  ["12.345.678", "12345678"],
  ["1234567", "1234567"],
  [" 33444555 ", "33444555"],
  ["123456", null],
  ["123456789", null],
  ["12345678A", null],
  ["", null],
];

export const CASOS_CELULAR: [string, string | null][] = [
  ["351 555-1234", "+5493515551234"],
  ["0351 15 555 1234", "+5493515551234"],
  ["+54 9 351 5551234", "+5493515551234"],
  ["54 351 555 1234", "+5493515551234"],
  ["+5493515551234", "+5493515551234"],
  ["(011) 15-5555-1234", "+5491155551234"],
  ["11 5555 1234", "+5491155551234"],
  ["2622-553670", "+5492622553670"],
  ["hola", null],
  ["", null],
  ["123", null],
  ["351 555-123", null],
  ["2622-553670M", null],
  ["+54 9 351 5551234 5", null],
  ["0800 555 1234", null],
];

export const CASOS_EMAIL: [string, string][] = [[" Juan@Mail.COM ", "juan@mail.com"]];

// Con hoy = HOY_FECHA.
export const HOY_FECHA = "2026-11-07";
export const CASOS_FECHA_NACIMIENTO: [string, boolean][] = [
  ["2024-11-07", true],
  ["2024-11-08", false],
  ["1926-11-07", true],
  ["1925-11-07", false],
  ["2026-02-31", false],
  ["1800-01-01", false],
  ["mañana", false],
];

export const CASOS_RECORTAR: [string, string][] = [
  ["  Ana  ", "Ana"],
  ["   ", ""],
];
