import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatCelular, formatDni } from "../../client/src/core/lib/utils";

describe("formatCelular", () => {
  test("un celular guardado como +549 y 10 dígitos se muestra legible", () => assert.equal(formatCelular("+5493515551234"), "+54 9 351555-1234"));
  test("un teléfono viejo con otro formato se muestra tal cual", () => assert.equal(formatCelular("2622-553670M"), "2622-553670M"));
  test("sin teléfono", () => {
    assert.equal(formatCelular(undefined), "—");
    assert.equal(formatCelular(""), "—");
  });
});

describe("formatDni", () => {
  test("sin DNI dice que falta cargarlo", () => assert.equal(formatDni(undefined), "sin cargar"));
  test("con puntos", () => assert.equal(formatDni("12345678"), "12.345.678"));
});
