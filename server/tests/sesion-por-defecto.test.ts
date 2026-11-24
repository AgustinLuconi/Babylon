import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sesionPorDefecto } from "../../client/src/features/asistencia/sesionPorDefecto";

// Las sesiones vienen de la más reciente a la más vieja (días AAAA-MM-DD).
const sesiones = ["2026-07-09", "2026-07-07", "2026-07-02"];

describe("sesionPorDefecto: qué clase abre la pantalla de asistencia", () => {
  test("la más reciente, si ese día hay clases", () => assert.equal(sesionPorDefecto(sesiones, () => true), "2026-07-09"));
  test("si la más reciente cae en un feriado, la siguiente con clases", () => assert.equal(sesionPorDefecto(sesiones, (d) => d !== "2026-07-09"), "2026-07-07"));
  test("salta todas las que no tienen clases", () => assert.equal(sesionPorDefecto(sesiones, (d) => d === "2026-07-02"), "2026-07-02"));
  test("si ninguna tiene clases, la más reciente (la pantalla avisa)", () => assert.equal(sesionPorDefecto(sesiones, () => false), "2026-07-09"));
  test("sin sesiones, nada", () => assert.equal(sesionPorDefecto([], () => true), null));
});
