import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cierreInicial, destinoDeValor, sinCopiasQueNoEstan, valorDeDestino } from "../../client/src/features/ciclos/paseDeAnio";

describe("pase de año (pantalla): destinos como texto", () => {
  test("ida y vuelta", () => {
    for (const v of ["curso:abc", "copia:xyz", "egresan", "no-continuan"]) assert.equal(valorDeDestino(destinoDeValor(v)), v);
    assert.equal(destinoDeValor(""), undefined);
    assert.equal(valorDeDestino(undefined), "");
  });
});

describe("pase de año (pantalla): al desmarcar un curso se limpian las decisiones que apuntaban a su copia", () => {
  const decisiones = {
    k1: { destino: "copia:k1", excepciones: { a: "copia:k2", b: "egresan" } },
    k2: { destino: "curso:d1", excepciones: {} },
    k3: { destino: "copia:k2", excepciones: { c: "copia:k1" } },
  };
  test("se vacía el destino y se quitan las excepciones que apuntaban a una copia que ya no está", () => {
    const r = sinCopiasQueNoEstan(decisiones, ["k2"]);
    assert.deepEqual(r.k1, { destino: "", excepciones: { a: "copia:k2", b: "egresan" } });
    assert.deepEqual(r.k2, { destino: "curso:d1", excepciones: {} });
    assert.deepEqual(r.k3, { destino: "copia:k2", excepciones: {} });
  });
  test("sin cambios devuelve lo mismo", () => {
    assert.deepEqual(sinCopiasQueNoEstan(decisiones, ["k1", "k2"]), decisiones);
  });
});

describe("pase de año (pantalla): el cierre viene marcado solo si el año del origen ya terminó", () => {
  test("año terminado: activar y bloquear", () => assert.deepEqual(cierreInicial(false), { activarDestino: true, bloquearOrigen: true }));
  test("año en curso: nada marcado", () => assert.deepEqual(cierreInicial(true), { activarDestino: false, bloquearOrigen: false }));
});
