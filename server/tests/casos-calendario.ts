// Tabla de casos de las reglas del calendario del ciclo. Corre contra la copia del server y la del client.
export interface CalendarioDeCaso {
  anio: number;
  inicio: string;
  fin: string;
  pausas: { desde: string; hasta: string; nombre: string }[];
}

export const CALENDARIO_C: CalendarioDeCaso = {
  anio: 2026,
  inicio: "2026-03-16",
  fin: "2026-11-27",
  pausas: [
    { desde: "2026-07-20", hasta: "2026-07-31", nombre: "Receso de invierno" },
    { desde: "2026-07-09", hasta: "2026-07-09", nombre: "Día de la Independencia" },
  ],
};

export const CALENDARIO_D: CalendarioDeCaso = {
  anio: 2026,
  inicio: "2026-03-01",
  fin: "2026-11-30",
  pausas: [{ desde: "2026-08-01", hasta: "2026-08-31", nombre: "Vacaciones" }],
};

export const CASOS_MOTIVO: [string, string | null][] = [
  ["2026-03-15", "Fuera del ciclo lectivo"],
  ["2026-03-16", null],
  ["2026-11-27", null],
  ["2026-11-28", "Fuera del ciclo lectivo"],
  ["2026-01-20", "Fuera del ciclo lectivo"],
  ["2026-07-09", "Día de la Independencia"],
  ["2026-07-20", "Receso de invierno"],
  ["2026-07-31", "Receso de invierno"],
  ["2026-08-03", null],
];

export const CASOS_MES: [CalendarioDeCaso, number, boolean][] = [
  [CALENDARIO_C, 3, true],
  [CALENDARIO_C, 2, false],
  [CALENDARIO_C, 1, false],
  [CALENDARIO_C, 7, true],
  [CALENDARIO_C, 11, true],
  [CALENDARIO_C, 12, false],
  [CALENDARIO_D, 8, false],
  [CALENDARIO_D, 7, true],
];
