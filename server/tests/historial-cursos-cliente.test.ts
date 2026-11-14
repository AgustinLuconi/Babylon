import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cursoDeLaVista, filtrarObservaciones, filtrarPorCurso } from "../../client/src/features/alumnos/historialDeCursos";

const fila = (cursoId: string, anio: number, actual = false) => ({ cursoId, anio, actual });
const filas = [fila("c3", 2026, true), fila("c2", 2025)];

describe("historial de cursos (pantalla): qué curso se está mirando", () => {
  test("por defecto, el actual", () => assert.equal(cursoDeLaVista(filas, null), "c3"));
  test("el que se eligió, si está en el historial", () => assert.equal(cursoDeLaVista(filas, "c2"), "c2"));
  test("un curso elegido que no está en el historial cae en el actual", () => assert.equal(cursoDeLaVista(filas, "otro"), "c3"));
  test("sin curso actual marcado, el más nuevo", () => assert.equal(cursoDeLaVista([fila("c2", 2025), fila("c1", 2024)], null), "c2"));
  test("sin historial (o todavía cargando): ninguno, no se filtra", () => {
    assert.equal(cursoDeLaVista([], null), null);
    assert.equal(cursoDeLaVista(undefined, null), null);
  });
});

describe("historial de cursos (pantalla): filtrar notas, cierres y asistencia por curso", () => {
  const items = [{ id: 1, cursoId: "c3" }, { id: 2, cursoId: "c2" }, { id: 3, cursoId: "c3" }];
  test("deja solo los del curso", () => assert.deepEqual(filtrarPorCurso(items, "c3")?.map((i) => i.id), [1, 3]));
  test("sin curso elegido devuelve todo", () => assert.deepEqual(filtrarPorCurso(items, null)?.map((i) => i.id), [1, 2, 3]));
  test("sin datos todavía devuelve undefined", () => assert.equal(filtrarPorCurso(undefined, "c3"), undefined));
});

describe("historial de cursos (pantalla): las observaciones no guardan curso, cada curso muestra las de su año", () => {
  const obs = (id: number, fecha: string) => ({ id, fecha });
  const ids = (r: { id: number }[] | undefined) => r?.map((o) => o.id);
  const historial = [fila("c3", 2027, true), fila("c2", 2025)];

  test("cada año se queda con las de ese año", () => {
    const items = [obs(1, "2027-06-10T15:00:00Z"), obs(2, "2025-09-02T15:00:00Z")];
    assert.deepEqual(ids(filtrarObservaciones(items, historial, "c3")), [1]);
    assert.deepEqual(ids(filtrarObservaciones(items, historial, "c2")), [2]);
  });
  test("una escrita en un año sin curso en el historial no se muestra en ningún curso", () => {
    const items = [obs(1, "2026-06-10T15:00:00Z"), obs(2, "2025-09-02T15:00:00Z")];
    assert.deepEqual(ids(filtrarObservaciones(items, historial, "c3")), []);
    assert.deepEqual(ids(filtrarObservaciones(items, historial, "c2")), [2]);
  });
  test("sin historial, sin curso elegido o sin datos todavía no se filtra", () => {
    const items = [obs(1, "2026-06-10T15:00:00Z")];
    assert.deepEqual(ids(filtrarObservaciones(items, undefined, "c3")), [1]);
    assert.deepEqual(ids(filtrarObservaciones(items, [], "c3")), [1]);
    assert.deepEqual(ids(filtrarObservaciones(items, historial, null)), [1]);
    assert.equal(filtrarObservaciones(undefined, historial, "c3"), undefined);
  });
});
