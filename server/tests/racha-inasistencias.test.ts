import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { rachaDeInasistencias } from "../src/modules/automatizaciones/automatizacion.racha";

type Estado = "presente" | "tarde" | "ausente";
const dia = (n: number) => new Date(Date.UTC(2026, 2, n));
const r = (n: number, estado: Estado, justificada = false) => ({ fecha: dia(n), estado, justificada });

describe("rachaDeInasistencias", () => {
  test("tres ausencias sin justificar seguidas", () => assert.equal(rachaDeInasistencias([r(1, "ausente"), r(2, "ausente"), r(3, "ausente")]), 3));
  test("cuenta desde el registro más nuevo", () => assert.equal(rachaDeInasistencias([r(1, "presente"), r(2, "ausente"), r(3, "ausente")]), 2));
  test("un presente en el medio corta la racha", () => assert.equal(rachaDeInasistencias([r(1, "ausente"), r(2, "presente"), r(3, "ausente"), r(4, "ausente")]), 2));
  test("llegar tarde corta la racha", () => assert.equal(rachaDeInasistencias([r(1, "ausente"), r(2, "ausente"), r(3, "tarde")]), 0));
  test("una ausencia justificada corta la racha (ausente, justificada, ausente, ausente → 2)", () =>
    assert.equal(rachaDeInasistencias([r(1, "ausente"), r(2, "ausente", true), r(3, "ausente"), r(4, "ausente")]), 2));
  test("si lo más nuevo es una justificada, la racha es 0", () => assert.equal(rachaDeInasistencias([r(1, "ausente"), r(2, "ausente"), r(3, "ausente", true)]), 0));
  test("sin registros, 0", () => assert.equal(rachaDeInasistencias([]), 0));
  test("entran desordenados: se ordenan por fecha", () => assert.equal(rachaDeInasistencias([r(3, "ausente"), r(1, "presente"), r(2, "ausente")]), 2));
  test("la racha es más larga que el mínimo", () => assert.equal(rachaDeInasistencias([r(1, "ausente"), r(2, "ausente"), r(3, "ausente"), r(4, "ausente"), r(5, "ausente")]), 5));
});
