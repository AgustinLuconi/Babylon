import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fichasCoincidentes, fichasParecidas } from "../../client/src/features/padres/fichasParecidas";

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

const completa = (id: string, nombre: string, apellido: string, dni?: string, telefono?: string, email?: string) => ({ id, nombre, apellido, dni, telefono, email });
const fichas = [
  completa("1", "María", "Gómez", "30111222", "+5493515551234", "maria@ejemplo.com"),
  completa("2", "Lucía", "Pérez", undefined, "+5493516667788", undefined),
  completa("3", "Rosa", "Gil", "27333444", undefined, "rosa@ejemplo.com"),
];
const idsDe = (r: { ficha: { id: string } }[]) => r.map((c) => c.ficha.id);

describe("fichasCoincidentes", () => {
  test("mismo DNI escrito con puntos", () => {
    const r = fichasCoincidentes({ dni: "30.111.222" }, fichas);
    assert.deepEqual(idsDe(r), ["1"]);
    assert.deepEqual(r[0].motivos, ["dni"]);
  });
  test("mismo celular escrito de otra forma", () => {
    const r = fichasCoincidentes({ telefono: "351 555-1234" }, fichas);
    assert.deepEqual(idsDe(r), ["1"]);
    assert.deepEqual(r[0].motivos, ["celular"]);
  });
  test("mismo celular con código de país y 9", () => assert.deepEqual(idsDe(fichasCoincidentes({ telefono: "+54 9 351 666-7788" }, fichas)), ["2"]));
  test("mismo email con mayúsculas y espacios", () => assert.deepEqual(idsDe(fichasCoincidentes({ email: "  ROSA@Ejemplo.com " }, fichas)), ["3"]));
  test("una ficha con varios motivos aparece una vez con todos", () => {
    const r = fichasCoincidentes({ dni: "30111222", telefono: "3515551234", email: "maria@ejemplo.com" }, fichas);
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].motivos, ["dni", "celular", "email"]);
  });
  test("datos distintos en fichas distintas devuelven cada una", () =>
    assert.deepEqual(idsDe(fichasCoincidentes({ dni: "27333444", telefono: "3516667788" }, fichas)).sort(), ["2", "3"]));
  test("lo que todavía no se escribió o no es válido no coincide con nada", () => {
    assert.deepEqual(fichasCoincidentes({ dni: "", telefono: "  ", email: undefined }, fichas), []);
    assert.deepEqual(fichasCoincidentes({ dni: "123", telefono: "555", email: "no-es-email" }, fichas), []);
  });
  test("una ficha sin ese dato no coincide con un dato vacío", () => assert.deepEqual(fichasCoincidentes({ telefono: "" }, [completa("9", "Ana", "Paz")]), []));
  test("sin fichas no hay coincidencias", () => assert.deepEqual(fichasCoincidentes({ dni: "30111222" }, []), []));
});
