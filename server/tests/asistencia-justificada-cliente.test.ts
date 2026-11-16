import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { etiquetaDeAsistencia } from "../../client/src/features/asistencia/types";

describe("asistencia (pantalla): etiqueta de un registro", () => {
  test("ausente justificada", () => assert.equal(etiquetaDeAsistencia({ estado: "ausente", justificada: true }), "Ausente (justificada)"));
  test("ausente sin justificar", () => assert.equal(etiquetaDeAsistencia({ estado: "ausente", justificada: false }), "Ausente"));
  test("presente", () => assert.equal(etiquetaDeAsistencia({ estado: "presente", justificada: false }), "Presente"));
  test("tarde", () => assert.equal(etiquetaDeAsistencia({ estado: "tarde", justificada: false }), "Tarde"));
  test("un presente nunca se muestra como justificado, aunque llegue el dato", () => assert.equal(etiquetaDeAsistencia({ estado: "presente", justificada: true }), "Presente"));
});
