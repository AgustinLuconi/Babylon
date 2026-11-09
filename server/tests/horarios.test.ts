import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { erroresDeHorarios } from "../../client/src/features/cursos/horarios";
import { crearCursoSchema } from "../src/modules/cursos/curso.schema";

const h = (diaSemana: string, horaInicio: string, horaFin: string) => ({ diaSemana, horaInicio, horaFin });
const base = { nombre: "Curso", nivel: "kids", profesorId: "p1", cupo: 10 };

// Las reglas de horarios del client y las del servidor tienen que dar siempre el mismo veredicto.
const casos: [string, ReturnType<typeof h>[], boolean][] = [
  ["sin horarios", [], true],
  ["un horario normal", [h("lunes", "10:00", "11:00")], true],
  ["termina antes de empezar", [h("lunes", "18:00", "17:00")], false],
  ["termina cuando empieza", [h("lunes", "10:00", "10:00")], false],
  ["dos horarios que se pisan el mismo día", [h("lunes", "10:00", "12:00"), h("lunes", "11:00", "13:00")], false],
  ["dos horarios seguidos el mismo día", [h("lunes", "10:00", "11:00"), h("lunes", "11:00", "12:00")], true],
  ["el mismo tramo en días distintos", [h("lunes", "10:00", "12:00"), h("martes", "11:00", "13:00")], true],
];

describe("horarios de un curso: client y servidor coinciden", () => {
  for (const [nombre, horarios, valido] of casos) {
    test(`${nombre}: ${valido ? "válido" : "inválido"}`, () => {
      assert.equal(erroresDeHorarios(horarios).length === 0, valido);
      assert.equal(crearCursoSchema.safeParse({ ...base, horarios }).success, valido);
    });
  }
  test("el error de una hora de fin inválida apunta a esa fila y a la hora de fin", () => {
    assert.deepEqual(erroresDeHorarios([h("lunes", "10:00", "11:00"), h("martes", "18:00", "17:00")]), [
      { indice: 1, campo: "horaFin", mensaje: "La hora de fin tiene que ser posterior a la de inicio" },
    ]);
  });
  test("el error de dos horarios que se pisan apunta al segundo", () => {
    assert.deepEqual(erroresDeHorarios([h("lunes", "10:00", "12:00"), h("lunes", "11:00", "13:00")]), [
      { indice: 1, campo: null, mensaje: "Dos horarios del mismo día no pueden pisarse" },
    ]);
  });
});
