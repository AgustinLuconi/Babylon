import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fichasParecidas } from "../../client/src/features/padres/fichasParecidas";

const ficha = (id: string, nombre: string, apellido: string) => ({ id, nombre, apellido });
const existentes = [ficha("1", "María", "Gómez"), ficha("2", "María José", "Pérez"), ficha("3", "Mariana", "Gómez"), ficha("4", "Ana", "Pérez")];
const ids = (r: { id: string }[]) => r.map((f) => f.id);

describe("fichasParecidas", () => {
  test("mismo nombre con otras mayúsculas, tildes y espacios", () =>
    assert.deepEqual(ids(fichasParecidas({ nombre: "  maria ", apellido: "GOMEZ" }, existentes)), ["1"]));
  test("un nombre contenido en el otro: María y María José", () =>
    assert.deepEqual(ids(fichasParecidas({ nombre: "María", apellido: "Pérez" }, existentes)), ["2"]));
  test("al revés: María José contra María", () =>
    assert.deepEqual(ids(fichasParecidas({ nombre: "María José", apellido: "Gómez" }, existentes)), ["1"]));
  test("mismo nombre y otro apellido no coincide", () => assert.deepEqual(ids(fichasParecidas({ nombre: "Ana", apellido: "Gómez" }, existentes)), []));
  test("una parte de una palabra no cuenta: Ana no es Mariana", () =>
    assert.deepEqual(ids(fichasParecidas({ nombre: "Ana", apellido: "Gómez" }, [ficha("5", "Mariana", "Gómez")])), []));
  test("varios nombres: José Luis Pérez contra jose perez", () =>
    assert.deepEqual(ids(fichasParecidas({ nombre: "José Luis", apellido: "Pérez" }, [ficha("6", "jose", "perez")])), ["6"]));
  test("sin fichas no hay coincidencias", () => assert.deepEqual(fichasParecidas({ nombre: "Ana", apellido: "Pérez" }, []), []));
  test("sin nombre o sin apellido escrito no sugiere nada", () => {
    assert.deepEqual(fichasParecidas({ nombre: "", apellido: "Pérez" }, existentes), []);
    assert.deepEqual(fichasParecidas({ nombre: "Ana", apellido: "  " }, existentes), []);
  });
});
