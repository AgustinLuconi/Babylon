import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, test } from "node:test";
import * as client from "../../client/src/core/lib/validacion";
import * as server from "../src/core/validacion";
import { CASOS_CELULAR, CASOS_DNI, CASOS_EMAIL, CASOS_FECHA_NACIMIENTO, CASOS_RECORTAR, HOY_FECHA } from "./casos-validacion";

const copias = { server, client } as const;
// Cada copia se prueba con el zod de su propio proyecto (los formularios del client usan el suyo).
const zodDe = {
  server: createRequire(path.resolve(__dirname, "../package.json"))("zod"),
  client: createRequire(path.resolve(__dirname, "../../client/package.json"))("zod"),
} as const;

for (const [nombre, v] of Object.entries(copias)) {
  describe(`validación (${nombre})`, () => {
    for (const [entrada, esperado] of CASOS_DNI) {
      test(`normalizarDni(${JSON.stringify(entrada)}) → ${JSON.stringify(esperado)}`, () => assert.equal(v.normalizarDni(entrada), esperado));
    }
    for (const [entrada, esperado] of CASOS_CELULAR) {
      test(`normalizarCelular(${JSON.stringify(entrada)}) → ${JSON.stringify(esperado)}`, () => assert.equal(v.normalizarCelular(entrada), esperado));
    }
    for (const [entrada, esperado] of CASOS_EMAIL) {
      test(`normalizarEmail(${JSON.stringify(entrada)}) → ${JSON.stringify(esperado)}`, () => assert.equal(v.normalizarEmail(entrada), esperado));
    }
    for (const [entrada, esperado] of CASOS_FECHA_NACIMIENTO) {
      test(`fechaNacimientoValida(${JSON.stringify(entrada)}, ${HOY_FECHA}) → ${esperado}`, () =>
        assert.equal(v.fechaNacimientoValida(entrada, HOY_FECHA), esperado));
    }
    for (const [entrada, esperado] of CASOS_RECORTAR) {
      test(`recortar(${JSON.stringify(entrada)}) → ${JSON.stringify(esperado)}`, () => assert.equal(v.recortar(entrada), esperado));
    }

    test("dniSchema entrega el DNI normalizado y rechaza uno inválido", () => {
      assert.equal(v.dniSchema.parse("12.345.678"), "12345678");
      assert.equal(v.dniSchema.safeParse("12A").success, false);
    });
    test("celularSchema entrega +549 y los 10 dígitos", () => {
      assert.equal(v.celularSchema.parse("351 555-1234"), "+5493515551234");
      assert.equal(v.celularSchema.safeParse("hola").success, false);
    });
    test("textoRequerido rechaza puros espacios, recorta y respeta el máximo", () => {
      const nombreSchema = v.textoRequerido("El nombre", 5);
      assert.equal(nombreSchema.safeParse("   ").success, false);
      assert.equal(nombreSchema.parse("  Ana "), "Ana");
      assert.equal(nombreSchema.safeParse("abcdef").success, false);
    });
    test("opcional convierte vacío en undefined y borrable en null", () => {
      assert.equal(v.opcional(v.dniSchema).parse(""), undefined);
      assert.equal(v.opcional(v.dniSchema).parse(undefined), undefined);
      assert.equal(v.borrable(v.dniSchema).parse(""), null);
      assert.equal(v.borrable(v.dniSchema).parse(null), null);
      assert.equal(v.borrable(v.dniSchema).parse("  "), null);
      assert.equal(v.borrable(v.dniSchema).parse("12.345.678"), "12345678");
    });
    test("fechaNacimientoSchema acepta una fecha real y rechaza una futura", () => {
      assert.equal(v.fechaNacimientoSchema.parse("2020-01-01"), "2020-01-01");
      assert.equal(v.fechaNacimientoSchema.safeParse("2999-01-01").success, false);
    });
    test("dentro de un objeto, una clave ausente no falla y los vacíos se normalizan", () => {
      const z = zodDe[nombre as "server" | "client"];
      const crear = z.object({ dni: v.opcional(v.dniSchema), telefono: v.opcional(v.celularSchema) });
      assert.deepEqual(crear.parse({}), {});
      assert.deepEqual(crear.parse({ dni: "", telefono: "351 555-1234" }), { dni: undefined, telefono: "+5493515551234" });
      const editar = z.object({ dni: v.borrable(v.dniSchema) });
      assert.deepEqual(editar.parse({}), {});
      assert.deepEqual(editar.parse({ dni: null }), { dni: null });
      assert.deepEqual(editar.parse({ dni: " " }), { dni: null });
    });
    test("texto(max) recorta, respeta el máximo y con borrable deja null en vacío", () => {
      assert.equal(v.texto(5).parse("  ab "), "ab");
      assert.equal(v.texto(5).safeParse("abcdef").success, false);
      assert.equal(v.borrable(v.texto(5)).parse("   "), null);
      assert.equal(v.borrable(v.texto(5)).parse(null), null);
      assert.equal(v.borrable(v.texto(5)).parse("ab"), "ab");
    });
    test("textoOpcional trata puros espacios como vacío", () => {
      assert.equal(v.textoOpcional(10).parse("   "), undefined);
      assert.equal(v.textoOpcional(10).safeParse("x".repeat(11)).success, false);
    });
  });
}

// Solo del servidor: fechas de calendario de evaluaciones y asistencia (se comparan contra "hoy" en Argentina).
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
describe("fechas de calendario (server)", () => {
  test("fechaCalendario acepta AAAA-MM-DD y un ISO con hora, y devuelve medianoche UTC", () => {
    assert.equal(server.fechaCalendario("x").parse("2026-03-04").toISOString(), "2026-03-04T00:00:00.000Z");
    assert.equal(server.fechaCalendario("x").parse("2026-03-04T15:30:00.000Z").toISOString(), "2026-03-04T00:00:00.000Z");
  });
  test("fechaCalendario rechaza fechas inexistentes y textos", () => {
    assert.equal(server.fechaCalendario("x").safeParse("2026-02-31").success, false);
    assert.equal(server.fechaCalendario("x").safeParse("mañana").success, false);
    assert.equal(server.fechaCalendario("x").safeParse(20260304).success, false);
  });
  test("fechaDeEvaluacionSchema: entre un año atrás y un año adelante", () => {
    assert.equal(server.fechaDeEvaluacionSchema.safeParse(dias(0)).success, true);
    assert.equal(server.fechaDeEvaluacionSchema.safeParse(dias(300)).success, true);
    assert.equal(server.fechaDeEvaluacionSchema.safeParse(dias(-300)).success, true);
    assert.equal(server.fechaDeEvaluacionSchema.safeParse(dias(400)).success, false);
    assert.equal(server.fechaDeEvaluacionSchema.safeParse(dias(-400)).success, false);
  });
  test("fechaDeAsistenciaSchema: no futura", () => {
    assert.equal(server.fechaDeAsistenciaSchema.safeParse(dias(-3)).success, true);
    assert.equal(server.fechaDeAsistenciaSchema.safeParse(dias(2)).success, false);
  });
});
