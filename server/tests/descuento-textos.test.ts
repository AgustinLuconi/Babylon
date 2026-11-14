import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { textoDeAvisoDeDescuento } from "../src/modules/notificaciones/notificacion.descuento";

const S = " Rige desde la próxima cuota que se genere.";
const base = { destinatario: "instituto" as const, alumno: "Bruno Pérez", aplica: false, causa: "baja" as const, alumnoDeLaCausa: "Ana Pérez", esElQueSeMovio: false };

describe("textoDeAvisoDeDescuento", () => {
  test("baja: pasa a pagar completo", () =>
    assert.equal(textoDeAvisoDeDescuento(base), `Bruno Pérez pasó a pagar la cuota completa porque Ana Pérez se dio de baja.${S}`));
  test("baja: la familia ve el mismo texto", () =>
    assert.equal(textoDeAvisoDeDescuento({ ...base, destinatario: "familia" }), `Bruno Pérez pasó a pagar la cuota completa porque Ana Pérez se dio de baja.${S}`));
  test("reactivación: gana el descuento", () =>
    assert.equal(
      textoDeAvisoDeDescuento({ ...base, aplica: true, causa: "reactivacion" }),
      `Bruno Pérez pasó a tener 10% de descuento por hermanos porque Ana Pérez volvió a estar activo.${S}`,
    ));
  test("reactivación: pierde el descuento", () =>
    assert.equal(
      textoDeAvisoDeDescuento({ ...base, aplica: false, causa: "reactivacion" }),
      `Bruno Pérez pasó a pagar la cuota completa porque Ana Pérez volvió a estar activo.${S}`,
    ));
  test("cambio de responsable, el que se movió, con descuento", () =>
    assert.equal(
      textoDeAvisoDeDescuento({ ...base, aplica: true, causa: "cambio-responsable", esElQueSeMovio: true }),
      `Bruno Pérez pasó a tener 10% de descuento por hermanos por el cambio de responsable.${S}`,
    ));
  test("cambio de responsable, el que se movió, completo", () =>
    assert.equal(
      textoDeAvisoDeDescuento({ ...base, aplica: false, causa: "cambio-responsable", esElQueSeMovio: true }),
      `Bruno Pérez pasó a pagar la cuota completa por el cambio de responsable.${S}`,
    ));
  test("cambio de responsable, otro alumno: el instituto nombra al que se movió", () =>
    assert.equal(
      textoDeAvisoDeDescuento({ ...base, alumno: "Carla Pérez", aplica: false, causa: "cambio-responsable", alumnoDeLaCausa: "Zoe Ajena" }),
      `Carla Pérez pasó a pagar la cuota completa porque Zoe Ajena cambió de responsable.${S}`,
    ));
  test("cambio de responsable, otro alumno: la familia nunca nombra al que se movió", () => {
    const sale = textoDeAvisoDeDescuento({ ...base, destinatario: "familia", alumno: "Carla Pérez", aplica: false, causa: "cambio-responsable", alumnoDeLaCausa: "Zoe Ajena" });
    assert.equal(sale, `Carla Pérez pasó a pagar la cuota completa porque un hermano dejó de estar a tu cargo.${S}`);
    assert.ok(!sale.includes("Zoe Ajena"));
    const entra = textoDeAvisoDeDescuento({ ...base, destinatario: "familia", alumno: "Carla Pérez", aplica: true, causa: "cambio-responsable", alumnoDeLaCausa: "Zoe Ajena" });
    assert.equal(entra, `Carla Pérez pasó a tener 10% de descuento por hermanos porque se sumó un hermano a tu cargo.${S}`);
    assert.ok(!entra.includes("Zoe Ajena"));
  });
  test("baja que corrige una marca vieja: el texto sigue el efecto real", () =>
    assert.equal(
      textoDeAvisoDeDescuento({ ...base, aplica: true, causa: "baja" }),
      `Bruno Pérez pasó a tener 10% de descuento por hermanos porque Ana Pérez se dio de baja.${S}`,
    ));
  test("reactivación del propio alumno: no se nombra a sí mismo como causa", () => {
    const con = textoDeAvisoDeDescuento({ ...base, aplica: true, causa: "reactivacion", alumnoDeLaCausa: "Bruno Pérez", esElQueSeMovio: true });
    assert.equal(con, `Bruno Pérez pasó a tener 10% de descuento por hermanos porque volvió a estar activo.${S}`);
    const sin = textoDeAvisoDeDescuento({ ...base, aplica: false, causa: "reactivacion", alumnoDeLaCausa: "Bruno Pérez", esElQueSeMovio: true });
    assert.equal(sin, `Bruno Pérez pasó a pagar la cuota completa porque volvió a estar activo.${S}`);
  });
});
