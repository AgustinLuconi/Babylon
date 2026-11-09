import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { etiquetasDelPanel, modoDelPanel } from "../../client/src/features/alumnos/modoDelPanel";

describe("modoDelPanel", () => {
  test("sin cursadas es el panel de una familia", () => assert.equal(modoDelPanel([]), "hijos"));
  test("con un hijo", () => assert.equal(modoDelPanel([{ vinculoResponsable: "madre" }]), "hijos"));
  test("con hijos con vínculos distintos", () => assert.equal(modoDelPanel([{ vinculoResponsable: "madre" }, { vinculoResponsable: "tutor" }]), "hijos"));
  test("un adulto solo con su propia cursada", () => assert.equal(modoDelPanel([{ vinculoResponsable: "propio" }]), "propio"));
  test("una cursada sin vínculo cargado cuenta como de un hijo", () => assert.equal(modoDelPanel([{}]), "hijos"));
  test("la propia más un hijo", () => assert.equal(modoDelPanel([{ vinculoResponsable: "propio" }, { vinculoResponsable: "madre" }]), "mixto"));
  test("el orden no importa", () => assert.equal(modoDelPanel([{ vinculoResponsable: "padre" }, { vinculoResponsable: "propio" }]), "mixto"));
});

describe("etiquetasDelPanel", () => {
  test("familia: los textos de siempre", () => {
    const e = etiquetasDelPanel("hijos");
    assert.equal(e.menu.resumen, "Resumen");
    assert.equal(e.menu.chat, "Mensajes");
    assert.equal(e.grupo, "Mi familia");
  });
  test("adulto solo: en primera persona", () => {
    const e = etiquetasDelPanel("propio");
    assert.deepEqual(e.menu, { resumen: "Mi cursada", notas: "Mis notas", asistencia: "Mi asistencia", cuotas: "Mis cuotas", documentacion: "Mi documentación", chat: "Chat con el instituto" });
    assert.equal(e.grupo, "Mi cursada");
  });
  test("adulto con hijos: cursadas", () => {
    const e = etiquetasDelPanel("mixto");
    assert.equal(e.menu.resumen, "Cursadas");
    assert.equal(e.menu.notas, "Calificaciones");
    assert.equal(e.grupo, "Mi familia");
  });
  test("el subtítulo del legajo no habla de un hijo cuando es la propia cursada", () => {
    assert.equal(etiquetasDelPanel("propio").subtituloDocumentacion, "Tu legajo digital");
    assert.equal(etiquetasDelPanel("hijos").subtituloDocumentacion, "Legajo digital de tu hijo/a");
  });
});
