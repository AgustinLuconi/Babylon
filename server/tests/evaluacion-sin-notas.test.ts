import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { evaluacionSinNotas } from "../src/modules/automatizaciones/automatizacion.sinNotas";

// Las fechas calendario se guardan a medianoche UTC; "hoy" también.
const hoy = new Date("2026-11-17T00:00:00.000Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("evaluacionSinNotas", () => {
  test("hace exactamente N días sin ninguna nota: sí", () => assert.equal(evaluacionSinNotas({ fecha: dia("2026-11-10"), notas: 0 }, hoy, 7), true));
  test("hace más de N días sin notas: sí", () => assert.equal(evaluacionSinNotas({ fecha: dia("2026-10-01"), notas: 0 }, hoy, 7), true));
  test("hace N−1 días: no", () => assert.equal(evaluacionSinNotas({ fecha: dia("2026-11-11"), notas: 0 }, hoy, 7), false));
  test("con una sola nota cargada: no", () => assert.equal(evaluacionSinNotas({ fecha: dia("2026-11-10"), notas: 1 }, hoy, 7), false));
  test("fecha futura o de hoy: no", () => {
    assert.equal(evaluacionSinNotas({ fecha: dia("2026-11-17"), notas: 0 }, hoy, 7), false);
    assert.equal(evaluacionSinNotas({ fecha: dia("2026-12-01"), notas: 0 }, hoy, 7), false);
  });
  test("con el número en 1, la de ayer alcanza", () => assert.equal(evaluacionSinNotas({ fecha: dia("2026-11-16"), notas: 0 }, hoy, 1), true));
});
