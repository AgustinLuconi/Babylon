import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { claveDeAlerta, reconciliarAlertas, type AlertaAbierta, type AlertaEsperada } from "../src/modules/automatizaciones/automatizacion.reconciliar";

let n = 0;
const nuevoId = () => `nueva-${++n}`;
const abierta = (id: string, alumnoId: string, cursoId: string | null, nivel: number): AlertaAbierta => ({ id, alumnoId, cursoId, nivel });
const esperada = (alumnoId: string, cursoId: string | null, nivel: number): AlertaEsperada => ({ alumnoId, cursoId, nivel });
const base = { abiertas: [] as AlertaAbierta[], esperadas: [] as AlertaEsperada[], poblacion: new Set<string>(), causa: "revision" as const, nuevoId };

describe("reconciliarAlertas", () => {
  test("lo esperado que no está abierto se abre", () => {
    const r = reconciliarAlertas({ ...base, esperadas: [esperada("a", null, 2)] });
    assert.equal(r.abrir.length, 1);
    assert.deepEqual({ alumnoId: r.abrir[0].alumnoId, cursoId: r.abrir[0].cursoId, nivel: r.abrir[0].nivel }, { alumnoId: "a", cursoId: null, nivel: 2 });
    assert.deepEqual([r.actualizar, r.cerrar], [[], []]);
  });
  test("lo abierto y esperado con el mismo nivel no se toca", () => {
    const r = reconciliarAlertas({ ...base, abiertas: [abierta("x", "a", null, 2)], esperadas: [esperada("a", null, 2)] });
    assert.deepEqual([r.abrir, r.actualizar, r.cerrar], [[], [], []]);
  });
  test("con otro nivel se actualiza la misma fila", () => {
    const r = reconciliarAlertas({ ...base, abiertas: [abierta("x", "a", null, 2)], esperadas: [esperada("a", null, 3)] });
    assert.deepEqual(r.actualizar, [{ id: "x", nivel: 3 }]);
    assert.deepEqual([r.abrir, r.cerrar], [[], []]);
  });
  test("lo abierto que ya no se espera y sigue en la población se resuelve", () => {
    const r = reconciliarAlertas({ ...base, abiertas: [abierta("x", "a", null, 2)], poblacion: new Set([claveDeAlerta({ alumnoId: "a", cursoId: null })]) });
    assert.deepEqual(r.cerrar, [{ id: "x", motivo: "resuelta" }]);
  });
  test("si el alumno salió de la población: ya-no-corresponde", () => {
    const r = reconciliarAlertas({ ...base, abiertas: [abierta("x", "a", null, 2)] });
    assert.deepEqual(r.cerrar, [{ id: "x", motivo: "ya-no-corresponde" }]);
  });
  test("con la regla apagada el motivo es regla-apagada", () => {
    const r = reconciliarAlertas({ ...base, causa: "regla-apagada", abiertas: [abierta("x", "a", null, 2)] });
    assert.deepEqual(r.cerrar, [{ id: "x", motivo: "regla-apagada" }]);
  });
  test("al cambiar el número el motivo es cambio-de-numero", () => {
    const r = reconciliarAlertas({ ...base, causa: "cambio-de-numero", abiertas: [abierta("x", "a", null, 2)] });
    assert.deepEqual(r.cerrar, [{ id: "x", motivo: "cambio-de-numero" }]);
  });
  test("el mismo alumno en dos cursos son dos alertas distintas", () => {
    const r = reconciliarAlertas({ ...base, abiertas: [abierta("x", "a", "c1", 3)], esperadas: [esperada("a", "c1", 3), esperada("a", "c2", 3)] });
    assert.equal(r.abrir.length, 1);
    assert.equal(r.abrir[0].cursoId, "c2");
  });
  test("las claves distinguen curso nulo de curso con id", () => {
    assert.notEqual(claveDeAlerta({ alumnoId: "a", cursoId: null }), claveDeAlerta({ alumnoId: "a", cursoId: "c1" }));
  });
});
