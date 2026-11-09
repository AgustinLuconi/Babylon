import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { datosFaltantes } from "../src/modules/alumnos/alumno.incompleto";

const alumnoCompleto = { dni: "12345678", fechaNacimiento: new Date("2015-01-01T00:00:00Z"), padreId: "p1", vinculoResponsable: "madre" as const };
const fichaCompleta = { dni: "30111222", telefono: "+5493515551234", email: "mama@mail.com" };

describe("datosFaltantes", () => {
  test("un alumno con todo cargado no tiene faltantes", () => assert.deepEqual(datosFaltantes(alumnoCompleto, fichaCompleta), []));
  test("sin DNI ni fecha de nacimiento", () =>
    assert.deepEqual(datosFaltantes({ ...alumnoCompleto, dni: undefined, fechaNacimiento: undefined }, fichaCompleta), ["dni", "fechaNacimiento"]));
  test("sin responsable: solo se informa el responsable, no sus datos", () =>
    assert.deepEqual(datosFaltantes({ ...alumnoCompleto, padreId: undefined, vinculoResponsable: undefined }, null), ["responsable"]));
  test("sin responsable y sin DNI", () =>
    assert.deepEqual(datosFaltantes({ ...alumnoCompleto, dni: undefined, padreId: undefined, vinculoResponsable: undefined }, null), ["dni", "responsable"]));
  test("con responsable pero sin vínculo", () =>
    assert.deepEqual(datosFaltantes({ ...alumnoCompleto, vinculoResponsable: undefined }, fichaCompleta), ["vinculo"]));
  test("responsable sin celular ni email", () =>
    assert.deepEqual(datosFaltantes(alumnoCompleto, { dni: "30111222", telefono: undefined, email: undefined }), ["responsableTelefono", "responsableEmail"]));
  test("responsable sin DNI", () =>
    assert.deepEqual(datosFaltantes(alumnoCompleto, { ...fichaCompleta, dni: undefined }), ["responsableDni"]));
  test("propio: el DNI de la ficha no se informa aparte", () =>
    assert.deepEqual(datosFaltantes({ ...alumnoCompleto, vinculoResponsable: "propio" }, { ...fichaCompleta, dni: undefined }), []));
  test("propio sin DNI: se informa una sola vez, como dni", () =>
    assert.deepEqual(datosFaltantes({ ...alumnoCompleto, vinculoResponsable: "propio", dni: undefined }, { ...fichaCompleta, dni: undefined }), ["dni"]));
  test("propio sin email", () =>
    assert.deepEqual(datosFaltantes({ ...alumnoCompleto, vinculoResponsable: "propio" }, { ...fichaCompleta, email: undefined }), ["responsableEmail"]));
});
