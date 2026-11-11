import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { notaNumericaSchema } from "../src/core/validacion";

const evaluacion = notaNumericaSchema(0);
const cierre = notaNumericaSchema(1);
const resultado = (esquema: typeof evaluacion, entrada: unknown) => {
  const r = esquema.safeParse(entrada);
  return r.success ? r.data : null;
};

describe("notaNumericaSchema: solo notas numéricas de 0 a 10", () => {
  const validas: [unknown, string][] = [
    ["7", "7"],
    ["7.5", "7.5"],
    ["7,5", "7.5"],
    [" 8 ", "8"],
    ["10", "10"],
    ["10.0", "10"],
    ["0", "0"],
    ["08", "8"],
    ["6.25", "6.25"],
  ];
  for (const [entrada, esperada] of validas) {
    test(`evaluación: ${JSON.stringify(entrada)} → ${esperada}`, () => assert.equal(resultado(evaluacion, entrada), esperada));
  }
  const invalidas: unknown[] = ["MB", "B", "R", "M", "abc", "", "   ", "11", "10.5", "-1", "7.555", "7,5,5", "1e1", "NaN", "Infinity", "7 8", 7.5, null];
  for (const entrada of invalidas) {
    test(`evaluación: ${JSON.stringify(entrada)} se rechaza`, () => assert.equal(resultado(evaluacion, entrada), null));
  }
  test("la nota de cierre empieza en 1: el 0 se rechaza y el 1 se acepta", () => {
    assert.equal(resultado(cierre, "0"), null);
    assert.equal(resultado(cierre, "0.5"), null);
    assert.equal(resultado(cierre, "1"), "1");
    assert.equal(resultado(cierre, "10"), "10");
  });
  test("el mensaje explica el rango", () => {
    const r = evaluacion.safeParse("MB");
    assert.equal(r.success, false);
    if (!r.success) assert.match(r.error.issues[0].message, /número entre 0 y 10/);
    const c = cierre.safeParse("0");
    if (!c.success) assert.match(c.error.issues[0].message, /número entre 1 y 10/);
  });
});
