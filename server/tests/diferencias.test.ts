import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cambiosParaEnviar, hayCambios } from "../../client/src/core/lib/diferencias";
import { erroresDeCampo } from "../../client/src/core/lib/erroresDeCampo";

const base = { nombre: "Ana", apellido: "Gómez", telefono: "351 555-1234", direccion: "Calle 1" };
const borrables = ["telefono", "direccion"] as const;

describe("cambiosParaEnviar", () => {
  test("sin cambios no manda nada", () => assert.deepEqual(cambiosParaEnviar({ ...base }, base, borrables), {}));
  test("manda solo el campo tocado", () => assert.deepEqual(cambiosParaEnviar({ ...base, telefono: "11 5555 1234" }, base, borrables), { telefono: "11 5555 1234" }));
  test("compara recortado: espacios de más no son un cambio", () => assert.deepEqual(cambiosParaEnviar({ ...base, nombre: "  Ana " }, base, borrables), {}));
  test("manda el texto recortado", () => assert.deepEqual(cambiosParaEnviar({ ...base, nombre: "  Ana María " }, base, borrables), { nombre: "Ana María" }));
  test("vaciar un campo borrable manda null", () => assert.deepEqual(cambiosParaEnviar({ ...base, direccion: "" }, base, borrables), { direccion: null }));
  test("puros espacios en un campo borrable también manda null", () => assert.deepEqual(cambiosParaEnviar({ ...base, direccion: "   " }, base, borrables), { direccion: null }));
  test("vaciar un campo obligatorio no manda nada", () => assert.deepEqual(cambiosParaEnviar({ ...base, nombre: "" }, base, borrables), {}));
  test("un campo vacío que ya estaba vacío no es un cambio", () =>
    assert.deepEqual(cambiosParaEnviar({ ...base, direccion: "" }, { ...base, direccion: "" }, borrables), {}));
  test("completar un campo que estaba vacío es un cambio", () =>
    assert.deepEqual(cambiosParaEnviar({ ...base, direccion: "Calle 9" }, { ...base, direccion: "" }, borrables), { direccion: "Calle 9" }));
  test("valores que no son texto se comparan por contenido", () => {
    const con = { horarios: [{ d: "lunes" }], cupo: 10 };
    assert.deepEqual(cambiosParaEnviar({ horarios: [{ d: "lunes" }], cupo: 10 }, con, []), {});
    assert.deepEqual(cambiosParaEnviar({ horarios: [{ d: "martes" }], cupo: 12 }, con, []), { horarios: [{ d: "martes" }], cupo: 12 });
  });
  test("hayCambios", () => {
    assert.equal(hayCambios({}), false);
    assert.equal(hayCambios({ direccion: null }), true);
  });
});

class ErrorDeApi extends Error {
  constructor(
    mensaje: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(mensaje);
  }
}

describe("erroresDeCampo", () => {
  test("reparte el detalle por campo", () => {
    const r = erroresDeCampo(new ErrorDeApi("Datos inválidos", 400, { telefono: ["El celular no es válido"], dni: ["El DNI no es válido"] }));
    assert.deepEqual(r, { campos: { telefono: "El celular no es válido", dni: "El DNI no es válido" }, general: null });
  });
  test("un DNI repetido (409) va al campo del DNI", () => {
    const r = erroresDeCampo(new ErrorDeApi("Ya existe un alumno con el DNI 12345678", 409));
    assert.deepEqual(r, { campos: { dni: "Ya existe un alumno con el DNI 12345678" }, general: null });
  });
  test("un error sin campos queda como error general", () => {
    assert.deepEqual(erroresDeCampo(new ErrorDeApi("Curso con id x no encontrado/a", 404)), { campos: {}, general: "Curso con id x no encontrado/a" });
  });
  test("un valor que no es un error tiene un mensaje general", () => {
    assert.deepEqual(erroresDeCampo("algo"), { campos: {}, general: "No se pudo guardar" });
  });
  test("los campos anidados llegan con su ruta", () => {
    const r = erroresDeCampo(new ErrorDeApi("Datos inválidos", 400, { responsable: ["x"], "responsable.datos.telefono": ["El celular no es válido"] }));
    assert.equal(r.campos["responsable.datos.telefono"], "El celular no es válido");
  });
});
