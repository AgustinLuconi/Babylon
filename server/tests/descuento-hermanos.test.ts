import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as cliente from "../../client/src/features/alumnos/descuentoHermanos";
import * as servidor from "../src/modules/alumnos/alumno.hermanos";

type Estado = "activo" | "inactivo" | "egresado";
const alumno = (id: string, dia: number, estado: Estado = "activo", marca = false) => ({
  id,
  estado,
  fechaInscripcion: new Date(Date.UTC(2026, 2, dia)),
  aplicaDescuentoHermanos: marca,
});
const ids = (s: Set<string>) => [...s].sort();

// La misma tabla corre contra la copia del server y la del client: son dos escrituras de la misma regla.
const implementaciones = [
  { nombre: "server", ...servidor },
  { nombre: "client", ...cliente },
];

for (const impl of implementaciones) {
  describe(`descuento por hermanos (${impl.nombre})`, () => {
    test("un solo alumno activo: sin descuento y paga completo", () => {
      const a = [alumno("a", 1)];
      assert.deepEqual(ids(impl.alumnosConDescuento(a)), []);
      assert.equal(impl.quienPagaCompleto(a), "a");
    });
    test("dos activos: el segundo tiene descuento", () => {
      const a = [alumno("b", 2), alumno("a", 1)];
      assert.deepEqual(ids(impl.alumnosConDescuento(a)), ["b"]);
      assert.equal(impl.quienPagaCompleto(a), "a");
    });
    test("tres activos: paga completo el más antiguo", () => {
      const a = [alumno("a", 1), alumno("b", 2), alumno("c", 3)];
      assert.deepEqual(ids(impl.alumnosConDescuento(a)), ["b", "c"]);
    });
    test("si el primero está inactivo, el siguiente pasa a pagar completo", () => {
      const a = [alumno("a", 1, "inactivo"), alumno("b", 2), alumno("c", 3)];
      assert.deepEqual(ids(impl.alumnosConDescuento(a)), ["c"]);
      assert.equal(impl.quienPagaCompleto(a), "b");
    });
    test("un egresado no cuenta ni recibe descuento", () => {
      const a = [alumno("a", 1, "egresado"), alumno("b", 2)];
      assert.deepEqual(ids(impl.alumnosConDescuento(a)), []);
    });
    test("sin activos: nadie y null", () => {
      const a = [alumno("a", 1, "inactivo")];
      assert.deepEqual(ids(impl.alumnosConDescuento(a)), []);
      assert.equal(impl.quienPagaCompleto(a), null);
      assert.equal(impl.quienPagaCompleto([]), null);
    });
    test("misma fecha: desempata el id", () => {
      const a = [alumno("b", 1), alumno("a", 1)];
      assert.deepEqual(ids(impl.alumnosConDescuento(a)), ["b"]);
      assert.equal(impl.quienPagaCompleto(a), "a");
    });
    test("correcciones: solo los activos cuya marca no coincide", () => {
      const a = [alumno("a", 1, "activo", true), alumno("b", 2, "activo", true)];
      assert.deepEqual(impl.correccionesDeDescuento(a), [{ alumnoId: "a", aplica: false }]);
    });
    test("correcciones: la marca que falta se agrega", () => {
      const a = [alumno("a", 1), alumno("b", 2, "activo", false)];
      assert.deepEqual(impl.correccionesDeDescuento(a), [{ alumnoId: "b", aplica: true }]);
    });
    test("correcciones: un inactivo con marca vieja no se toca", () => {
      const a = [alumno("a", 1, "inactivo", true), alumno("b", 2)];
      assert.deepEqual(impl.correccionesDeDescuento(a), []);
    });
    test("correcciones: familia ya correcta no devuelve nada", () => {
      const a = [alumno("a", 1), alumno("b", 2, "activo", true)];
      assert.deepEqual(impl.correccionesDeDescuento(a), []);
    });
  });
}
