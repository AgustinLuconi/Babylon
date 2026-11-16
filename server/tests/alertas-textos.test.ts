import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { textoDeAlertaDeDeuda, textoDeAlertaDeFaltas } from "../src/modules/notificaciones/notificacion.alertas";

describe("textos de las alertas automáticas", () => {
  test("deuda en plural", () => assert.equal(textoDeAlertaDeDeuda("Ana Gómez", 2), "Ana Gómez debe 2 cuotas vencidas"));
  test("deuda en singular", () => assert.equal(textoDeAlertaDeDeuda("Ana Gómez", 1), "Ana Gómez debe 1 cuota vencida"));
  test("faltas en plural", () => assert.equal(textoDeAlertaDeFaltas("Luis Peña", 3, "A2 (Niños)"), "Luis Peña tiene 3 inasistencias seguidas en A2 (Niños)"));
  test("faltas en singular", () => assert.equal(textoDeAlertaDeFaltas("Luis Peña", 1, "A2 (Niños)"), "Luis Peña tiene 1 inasistencia seguida en A2 (Niños)"));
  test("respeta tildes y eñes", () => assert.equal(textoDeAlertaDeDeuda("Íñigo Muñoz", 3), "Íñigo Muñoz debe 3 cuotas vencidas"));
});
