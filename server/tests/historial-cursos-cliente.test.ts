import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cursoDeLaVista, filtrarPorCurso } from "../../client/src/features/alumnos/historialDeCursos";

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
