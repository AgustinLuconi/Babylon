import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MINUTOS_PARA_CORREGIR, puedeCorregir } from "../../client/src/features/chats/correccion";
import { noLeidos, vistoDelUltimo } from "../../client/src/features/chats/visto";
import type { Mensaje } from "../../client/src/features/chats/types";

const AHORA = new Date("2026-11-11T15:00:00.000Z");
const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * 60_000).toISOString();
const mensaje = (extra: Partial<Mensaje> = {}): Mensaje => ({
  id: "m", chatId: "c", emisorId: "u", rolEmisor: "padre", texto: "Hola", fecha: hace(1), vistoEn: null, editadoEn: null, eliminadoEn: null, ...extra,
});

describe("puedeCorregir", () => {
  it("el plazo es de 15 minutos", () => assert.equal(MINUTOS_PARA_CORREGIR, 15));
  it("la familia puede con lo suyo dentro del plazo", () => assert.equal(puedeCorregir(mensaje({ fecha: hace(14) }), false, AHORA), true));
  it("pasado el plazo ya no", () => assert.equal(puedeCorregir(mensaje({ fecha: hace(16) }), false, AHORA), false));
  it("corregirlo no renueva el plazo (cuenta desde el envío)", () => {
    assert.equal(puedeCorregir(mensaje({ fecha: hace(16), editadoEn: hace(1) }), false, AHORA), false);
  });
  it("la familia no puede con lo del instituto, ni al revés", () => {
    assert.equal(puedeCorregir(mensaje({ rolEmisor: "secretario" }), false, AHORA), false);
    assert.equal(puedeCorregir(mensaje({ rolEmisor: "padre" }), true, AHORA), false);
  });
  it("cualquiera del instituto puede con lo del instituto (admin o secretaría)", () => {
    assert.equal(puedeCorregir(mensaje({ rolEmisor: "admin" }), true, AHORA), true);
    assert.equal(puedeCorregir(mensaje({ rolEmisor: "secretario" }), true, AHORA), true);
  });
  it("uno eliminado no se toca", () => assert.equal(puedeCorregir(mensaje({ eliminadoEn: hace(1) }), false, AHORA), false));
});

describe("mensajes eliminados en el chat", () => {
  it("no cuentan como sin leer", () => {
    const lista = [mensaje({ id: "a", rolEmisor: "secretario" }), mensaje({ id: "b", rolEmisor: "secretario", eliminadoEn: hace(1), texto: "" })];
    assert.deepEqual(noLeidos(lista, false).map((m) => m.id), ["a"]);
  });
  it("no llevan 'Visto'", () => {
    const eliminado = mensaje({ vistoEn: hace(1), eliminadoEn: hace(1), texto: "" });
    assert.equal(vistoDelUltimo([eliminado], false), null);
  });
  it("uno corregido conserva su 'Visto'", () => {
    assert.equal(vistoDelUltimo([mensaje({ vistoEn: hace(2), editadoEn: hace(1) })], false), hace(2));
  });
});
