import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mesesDeFechas } from "../../client/src/features/asistencia/meses";

describe("mesesDeFechas: los meses que se pueden recorrer en el calendario de asistencia", () => {
  test("sin fechas, ninguno", () => assert.deepEqual(mesesDeFechas([]), []));
  test("un mes por varias fechas del mismo mes", () => assert.deepEqual(mesesDeFechas(["2026-03-17", "2026-03-19T00:00:00.000Z"]), [{ anio: 2026, mes: 3 }]));
  test("del más nuevo al más viejo, también entre años", () =>
    assert.deepEqual(mesesDeFechas(["2025-11-04", "2026-03-17", "2026-10-02", "2025-03-01"]), [
      { anio: 2026, mes: 10 },
      { anio: 2026, mes: 3 },
      { anio: 2025, mes: 11 },
      { anio: 2025, mes: 3 },
    ]));
  test("un mes que solo tiene una clase sin dictar también cuenta (se pasan juntas las de asistencia y las de sin clases)", () =>
    assert.deepEqual(mesesDeFechas(["2026-03-17", "2026-05-05"]), [
      { anio: 2026, mes: 5 },
      { anio: 2026, mes: 3 },
    ]));
});
