import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as servidor from "../src/modules/ciclos/ciclo.calendario";
import * as cliente from "../../client/src/features/ciclos/calendario";
import { CALENDARIO_C, CASOS_MES, CASOS_MOTIVO } from "./casos-calendario";

// La misma tabla de casos corre contra la copia del server y la del client: las dos reglas no pueden divergir.
for (const [nombre, reglas] of [["server", servidor], ["client", cliente]] as const) {
  describe(`calendario del ciclo (${nombre})`, () => {
    for (const [fecha, esperado] of CASOS_MOTIVO) test(`motivoSinClases ${fecha} → ${esperado}`, () => assert.equal(reglas.motivoSinClases(fecha, CALENDARIO_C), esperado));
    for (const [calendario, mes, esperado] of CASOS_MES) test(`esMesLectivo mes ${mes} (${calendario.inicio}) → ${esperado}`, () => assert.equal(reglas.esMesLectivo(mes, calendario), esperado));
    test("calendarioPorDefecto", () => assert.deepEqual(reglas.calendarioPorDefecto(2026), { anio: 2026, inicio: "2026-03-01", fin: "2026-11-30", pausas: [] }));
    test("validarFechasDelCiclo: inicio posterior al fin", () => assert.equal(reglas.validarFechasDelCiclo({ ...CALENDARIO_C, inicio: "2026-11-28" }), "La fecha de inicio no puede ser posterior a la de fin"));
    test("validarFechasDelCiclo: fuera del año", () => assert.equal(reglas.validarFechasDelCiclo({ ...CALENDARIO_C, inicio: "2025-12-31" }), "Las fechas tienen que estar dentro del año 2026"));
    test("validarFechasDelCiclo: pausa afuera", () =>
      assert.equal(reglas.validarFechasDelCiclo({ ...CALENDARIO_C, pausas: [{ desde: "2026-02-01", hasta: "2026-02-10", nombre: "Vacaciones" }] }), 'La pausa "Vacaciones" quedaría fuera del ciclo'));
    test("validarFechasDelCiclo: válido", () => assert.equal(reglas.validarFechasDelCiclo(CALENDARIO_C), null));
    test("validarPausa: orden", () => assert.equal(reglas.validarPausa(CALENDARIO_C, { desde: "2026-08-10", hasta: "2026-08-09", nombre: "X" }, []), "La pausa tiene que terminar el mismo día o después de empezar"));
    test("validarPausa: fuera del ciclo", () => assert.equal(reglas.validarPausa(CALENDARIO_C, { desde: "2026-12-01", hasta: "2026-12-02", nombre: "X" }, []), "La pausa tiene que estar dentro del ciclo lectivo"));
    test("validarPausa: superpuesta", () => assert.equal(reglas.validarPausa(CALENDARIO_C, { desde: "2026-07-31", hasta: "2026-08-03", nombre: "X" }, CALENDARIO_C.pausas), 'La pausa se superpone con "Receso de invierno"'));
    test("validarPausa: válida", () => assert.equal(reglas.validarPausa(CALENDARIO_C, { desde: "2026-08-10", hasta: "2026-08-10", nombre: "X" }, CALENDARIO_C.pausas), null));
  });
}

describe("calendarioDelCiclo (client): arma el calendario desde lo que llega de la API", () => {
  test("recorta las fechas ISO a día y trae las pausas", () =>
    assert.deepEqual(
      cliente.calendarioDelCiclo({
        id: "c", anio: 2026, activo: true, bloqueado: false, inicio: "2026-03-16T00:00:00.000Z", fin: "2026-11-27T00:00:00.000Z",
        pausas: [{ id: "p", cicloId: "c", desde: "2026-07-20T00:00:00.000Z", hasta: "2026-07-31T00:00:00.000Z", nombre: "Receso de invierno", tipo: "receso" }],
      }),
      { anio: 2026, inicio: "2026-03-16", fin: "2026-11-27", pausas: [{ desde: "2026-07-20", hasta: "2026-07-31", nombre: "Receso de invierno" }] },
    ));
});
