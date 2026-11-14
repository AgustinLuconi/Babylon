import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { planificarPaseDeAnio, type DatosDelPlan } from "../src/modules/ciclos/paseDeAnio.plan";

const alumno = (id: string, cursoActualId: string | null) => ({ id, nombre: `Alumno ${id}`, cursoActualId });
const datos = (parcial: Partial<DatosDelPlan> = {}): DatosDelPlan => ({
  origen: [
    { id: "k1", nombre: "A1 (Niños)", alumnos: [alumno("a", "k1"), alumno("b", "k1")] },
    { id: "k2", nombre: "A2 (Niños)", alumnos: [alumno("c", "k2")] },
  ],
  cursosDestino: [],
  yaInscriptos: new Map(),
  copiar: ["k1", "k2"],
  decisiones: [
    { cursoOrigenId: "k1", destino: { tipo: "copia", copiaDe: "k2" } },
    { cursoOrigenId: "k2", destino: { tipo: "egresan" } },
  ],
  ...parcial,
});

describe("planificarPaseDeAnio", () => {
  test("todos los alumnos de un curso pasan a la copia elegida", () => {
    const plan = planificarPaseDeAnio(datos());
    assert.deepEqual(plan.movimientos, [
      { alumnoId: "a", destino: { tipo: "copia", copiaDe: "k2" } },
      { alumnoId: "b", destino: { tipo: "copia", copiaDe: "k2" } },
      { alumnoId: "c", destino: { tipo: "egresan" } },
    ]);
    assert.deepEqual(plan.cursosSinDecision, []);
    assert.deepEqual(plan.invalidos, []);
  });

  test("una excepción manda a un alumno a otro destino", () => {
    const plan = planificarPorExcepcion();
    assert.deepEqual(plan.movimientos.find((m) => m.alumnoId === "b"), { alumnoId: "b", destino: { tipo: "no-continuan" } });
    assert.deepEqual(plan.movimientos.find((m) => m.alumnoId === "a"), { alumnoId: "a", destino: { tipo: "copia", copiaDe: "k2" } });
  });

  test("un alumno ya inscripto en el destino se saltea y figura", () => {
    const plan = planificarPaseDeAnio(datos({ yaInscriptos: new Map([["a", "A9 (Teens)"]]) }));
    assert.deepEqual(plan.yaInscriptos, [{ alumnoId: "a", cursoNombre: "A9 (Teens)" }]);
    assert.equal(plan.movimientos.some((m) => m.alumnoId === "a"), false);
  });

  test("un curso actual distinto del curso de origen es un aviso y no saca al alumno del plan", () => {
    const origen = [{ id: "k1", nombre: "A1 (Niños)", alumnos: [alumno("a", "otro"), alumno("b", null)] }];
    const plan = planificarPaseDeAnio(datos({ origen, copiar: ["k1"], decisiones: [{ cursoOrigenId: "k1", destino: { tipo: "copia", copiaDe: "k1" } }] }));
    assert.deepEqual(plan.avisos, [{ alumnoId: "a", tipo: "curso-actual-distinto" }]);
    assert.equal(plan.movimientos.length, 2);
  });

  test("un curso con alumnos y sin decisión queda en cursosSinDecision", () => {
    const plan = planificarPaseDeAnio(datos({ decisiones: [{ cursoOrigenId: "k1", destino: { tipo: "copia", copiaDe: "k2" } }] }));
    assert.deepEqual(plan.cursosSinDecision, ["k2"]);
    assert.equal(plan.movimientos.some((m) => m.alumnoId === "c"), false);
  });

  test("sin destino de curso pero con una excepción para cada alumno no falta decisión", () => {
    const plan = planificarPaseDeAnio(
      datos({ decisiones: [{ cursoOrigenId: "k1", excepciones: [{ alumnoId: "a", destino: { tipo: "egresan" } }, { alumnoId: "b", destino: { tipo: "egresan" } }] }, { cursoOrigenId: "k2", destino: { tipo: "egresan" } }] }),
    );
    assert.deepEqual(plan.cursosSinDecision, []);
  });

  test("un curso sin alumnos activos no exige decisión", () => {
    const origen = [{ id: "k1", nombre: "A1 (Niños)", alumnos: [] }];
    const plan = planificarPaseDeAnio(datos({ origen, copiar: [], decisiones: [] }));
    assert.deepEqual(plan.cursosSinDecision, []);
    assert.deepEqual(plan.movimientos, []);
  });

  test("si el destino ya tiene un curso con el mismo nombre (sin mirar mayúsculas ni tildes) se reutiliza", () => {
    const plan = planificarPaseDeAnio(datos({ cursosDestino: [{ id: "d1", nombre: "a1 (ninos)" }] }));
    assert.deepEqual(plan.copias, [
      { cursoOrigenId: "k1", reutilizaCursoId: "d1" },
      { cursoOrigenId: "k2", reutilizaCursoId: null },
    ]);
  });

  test("una copia de un curso que no se copia, o un curso que no es del destino, es inválido", () => {
    const plan = planificarPaseDeAnio(
      datos({
        copiar: ["k1"],
        decisiones: [
          { cursoOrigenId: "k1", destino: { tipo: "copia", copiaDe: "k2" } },
          { cursoOrigenId: "k2", destino: { tipo: "curso", cursoId: "ajeno" } },
        ],
      }),
    );
    assert.deepEqual([...plan.invalidos].sort(), ["copia:k2", "curso:ajeno"]);
    assert.deepEqual(plan.movimientos, []);
  });

  test("volver a planificar con todos ya inscriptos no deja movimientos (idempotencia)", () => {
    const todos = new Map([["a", "x"], ["b", "x"], ["c", "x"]]);
    const plan = planificarPaseDeAnio(datos({ yaInscriptos: todos }));
    assert.deepEqual(plan.movimientos, []);
    assert.equal(plan.yaInscriptos.length, 3);
  });
});

function planificarPorExcepcion() {
  return planificarPaseDeAnio(
    datos({
      decisiones: [
        { cursoOrigenId: "k1", destino: { tipo: "copia", copiaDe: "k2" }, excepciones: [{ alumnoId: "b", destino: { tipo: "no-continuan" } }] },
        { cursoOrigenId: "k2", destino: { tipo: "egresan" } },
      ],
    }),
  );
}
