import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { reconciliar, textoDelAviso } from "../../client/src/core/formularios/reconciliar";

const base = { telefono: "351 555-1234", direccion: "Calle 1", nombre: "Ana" };

describe("reconciliar", () => {
  test("un campo sin tocar toma el valor nuevo del servidor y figura como actualizado", () => {
    const r = reconciliar({ valores: { ...base }, base, servidor: { ...base, telefono: "11 5555 1234" } });
    assert.deepEqual(r.valores, { ...base, telefono: "11 5555 1234" });
    assert.deepEqual(r.actualizados, ["telefono"]);
  });
  test("un campo tocado conserva lo escrito aunque el otro lo haya cambiado, y no figura", () => {
    const r = reconciliar({ valores: { ...base, telefono: "mi número" }, base, servidor: { ...base, telefono: "11 5555 1234" } });
    assert.equal(r.valores.telefono, "mi número");
    assert.deepEqual(r.actualizados, []);
  });
  test("un campo tocado que el otro no cambió se conserva", () => {
    const r = reconciliar({ valores: { ...base, direccion: "Calle 9" }, base, servidor: { ...base, telefono: "11 5555 1234" } });
    assert.deepEqual(r.valores, { ...base, direccion: "Calle 9", telefono: "11 5555 1234" });
    assert.deepEqual(r.actualizados, ["telefono"]);
  });
  test("si se escribe y se vuelve al valor original, el campo cuenta como sin tocar", () => {
    const r = reconciliar({ valores: { ...base, direccion: "Calle 1" }, base, servidor: { ...base, direccion: "Calle 7" } });
    assert.equal(r.valores.direccion, "Calle 7");
    assert.deepEqual(r.actualizados, ["direccion"]);
  });
  test("la base nueva es la del servidor", () => {
    const servidor = { ...base, nombre: "Ana María" };
    assert.deepEqual(reconciliar({ valores: { ...base, direccion: "Calle 9" }, base, servidor }).base, servidor);
  });
  test("sin diferencias no hay nada actualizado", () => {
    const r = reconciliar({ valores: { ...base, direccion: "Calle 9" }, base, servidor: { ...base } });
    assert.deepEqual(r.actualizados, []);
    assert.equal(r.valores.direccion, "Calle 9");
  });
  test("los espacios de más no cuentan como una diferencia", () => {
    const r = reconciliar({ valores: { ...base }, base, servidor: { ...base, nombre: " Ana " } });
    assert.deepEqual(r.actualizados, []);
  });
  test("si el otro cambió dos campos, ambos figuran", () => {
    const r = reconciliar({ valores: { ...base }, base, servidor: { ...base, telefono: "x1", direccion: "y1" } });
    assert.deepEqual(r.actualizados.sort(), ["direccion", "telefono"]);
  });
});

describe("textoDelAviso", () => {
  test("un campo", () => assert.equal(textoDelAviso("Lucía", ["teléfono"]), "Mientras editabas, Lucía cambió: teléfono. Ya se actualizó en el formulario."));
  test("dos campos", () => assert.equal(textoDelAviso("Lucía", ["teléfono", "dirección"]), "Mientras editabas, Lucía cambió: teléfono y dirección. Ya se actualizó en el formulario."));
  test("tres campos", () => assert.equal(textoDelAviso("Lucía", ["a", "b", "c"]), "Mientras editabas, Lucía cambió: a, b y c. Ya se actualizó en el formulario."));
  test("el sistema", () => assert.equal(textoDelAviso(null, ["a"]), "Mientras editabas, el sistema cambió: a. Ya se actualizó en el formulario."));
  test("sin saber quién", () => assert.equal(textoDelAviso(undefined, ["a"]), "Mientras editabas, alguien cambió: a. Ya se actualizó en el formulario."));
});
