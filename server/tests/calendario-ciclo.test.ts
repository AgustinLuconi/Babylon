import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calendarioPorDefecto, esMesLectivo, motivoSinClases, validarFechasDelCiclo, validarPausa } from "../src/modules/ciclos/ciclo.calendario";
import { vencimientoDelMes } from "../src/modules/cuotas/cuota.calendario";
import { CALENDARIO_C, CASOS_MES, CASOS_MOTIVO } from "./casos-calendario";

describe("motivoSinClases", () => {
  for (const [fecha, esperado] of CASOS_MOTIVO) test(`${fecha} → ${esperado}`, () => assert.equal(motivoSinClases(fecha, CALENDARIO_C), esperado));
});

describe("esMesLectivo", () => {
  for (const [calendario, mes, esperado] of CASOS_MES) test(`mes ${mes} del ${calendario.inicio} al ${calendario.fin} → ${esperado}`, () => assert.equal(esMesLectivo(mes, calendario), esperado));
});

describe("calendarioPorDefecto", () => {
  test("1 de marzo al 30 de noviembre, sin pausas", () => assert.deepEqual(calendarioPorDefecto(2026), { anio: 2026, inicio: "2026-03-01", fin: "2026-11-30", pausas: [] }));
});

describe("validarFechasDelCiclo", () => {
  test("inicio posterior al fin", () => assert.equal(validarFechasDelCiclo({ ...CALENDARIO_C, inicio: "2026-11-28" }), "La fecha de inicio no puede ser posterior a la de fin"));
  test("fuera del año del ciclo", () => assert.equal(validarFechasDelCiclo({ ...CALENDARIO_C, inicio: "2025-12-31" }), "Las fechas tienen que estar dentro del año 2026"));
  test("una pausa que queda afuera", () =>
    assert.equal(validarFechasDelCiclo({ ...CALENDARIO_C, pausas: [{ desde: "2026-02-01", hasta: "2026-02-10", nombre: "Vacaciones" }] }), 'La pausa "Vacaciones" quedaría fuera del ciclo'));
  test("válido", () => assert.equal(validarFechasDelCiclo(CALENDARIO_C), null));
});

describe("validarPausa", () => {
  test("hasta antes que desde", () => assert.equal(validarPausa(CALENDARIO_C, { desde: "2026-08-10", hasta: "2026-08-09", nombre: "X" }, []), "La pausa tiene que terminar el mismo día o después de empezar"));
  test("fuera del ciclo", () => assert.equal(validarPausa(CALENDARIO_C, { desde: "2026-12-01", hasta: "2026-12-02", nombre: "X" }, []), "La pausa tiene que estar dentro del ciclo lectivo"));
  test("superpuesta", () => assert.equal(validarPausa(CALENDARIO_C, { desde: "2026-07-31", hasta: "2026-08-03", nombre: "X" }, CALENDARIO_C.pausas), 'La pausa se superpone con "Receso de invierno"'));
  test("válida", () => assert.equal(validarPausa(CALENDARIO_C, { desde: "2026-08-10", hasta: "2026-08-10", nombre: "X" }, CALENDARIO_C.pausas), null));
});

describe("vencimientoDelMes", () => {
  const iso = (d: Date) => d.toISOString();
  test("antes del día de vencimiento, en su mes", () => assert.equal(iso(vencimientoDelMes(3, 2026, new Date("2026-03-05T15:00:00Z"), 10)), "2026-03-10T00:00:00.000Z"));
  test("después del día 10 en su propio mes: fin de mes", () => assert.equal(iso(vencimientoDelMes(3, 2026, new Date("2026-03-15T15:00:00Z"), 10)), "2026-03-31T00:00:00.000Z"));
  test("día 20 con hoy 15: todavía no pasó", () => assert.equal(iso(vencimientoDelMes(3, 2026, new Date("2026-03-15T15:00:00Z"), 20)), "2026-03-20T00:00:00.000Z"));
  test("mes futuro", () => assert.equal(iso(vencimientoDelMes(4, 2026, new Date("2026-03-15T15:00:00Z"), 10)), "2026-04-10T00:00:00.000Z"));
  test("día 5 con hoy 8: fin de mes", () => assert.equal(iso(vencimientoDelMes(3, 2026, new Date("2026-03-08T15:00:00Z"), 5)), "2026-03-31T00:00:00.000Z"));
});
