import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ValidationError } from "../src/core/errors";
import { cambioDeRoles, contarOtrosAdminsActivos, validarCambioDeRoles } from "../src/modules/usuarios/usuario.roles";

describe("cambioDeRoles", () => {
  test("agregados y quitados", () => {
    assert.deepEqual(cambioDeRoles(["admin", "profesor"], ["admin", "secretario"]), { agregados: ["secretario"], quitados: ["profesor"] });
  });
  test("sin cambios", () => assert.deepEqual(cambioDeRoles(["padre"], ["padre"]), { agregados: [], quitados: [] }));
  test("el orden no importa", () => assert.deepEqual(cambioDeRoles(["admin", "secretario"], ["secretario", "admin"]), { agregados: [], quitados: [] }));
});

describe("validarCambioDeRoles", () => {
  const base = { cuentaId: "u1", actorId: "u2", actuales: ["admin", "secretario"] as const, otrosAdminsActivos: 1 };
  const mensaje = (f: () => void) => {
    try {
      f();
      return "ok";
    } catch (e) {
      assert.ok(e instanceof ValidationError);
      return e.message;
    }
  };
  test("quitar un rol que no es admin está permitido", () => assert.equal(mensaje(() => validarCambioDeRoles({ ...base, actuales: [...base.actuales], finales: ["admin"] })), "ok"));
  test("la cuenta no puede quedar sin roles", () => assert.match(mensaje(() => validarCambioDeRoles({ ...base, actuales: [...base.actuales], finales: [] })), /al menos un rol/));
  test("un administrador no puede quitarse a sí mismo el rol de administrador", () => {
    assert.match(mensaje(() => validarCambioDeRoles({ ...base, actuales: [...base.actuales], cuentaId: "u2", finales: ["secretario"] })), /tu propio rol de administrador/);
  });
  test("agregarse roles a sí mismo está permitido", () => {
    assert.equal(mensaje(() => validarCambioDeRoles({ ...base, actuales: ["admin"], cuentaId: "u2", finales: ["admin", "secretario"] })), "ok");
  });
  test("no se puede dejar al sistema sin ningún administrador activo", () => {
    assert.match(mensaje(() => validarCambioDeRoles({ ...base, actuales: [...base.actuales], otrosAdminsActivos: 0, finales: ["secretario"] })), /ningún administrador/);
  });
  test("quitar admin a otra cuenta con más administradores activos está permitido", () => {
    assert.equal(mensaje(() => validarCambioDeRoles({ ...base, actuales: [...base.actuales], otrosAdminsActivos: 2, finales: ["secretario"] })), "ok");
  });
  test("sin cambios no valida nada", () => assert.equal(mensaje(() => validarCambioDeRoles({ ...base, actuales: ["secretario"], otrosAdminsActivos: 0, finales: ["secretario"] })), "ok"));
});

describe("contarOtrosAdminsActivos", () => {
  const cuentas = [
    { id: "a", estado: "activo" as const, roles: ["admin" as const] },
    { id: "b", estado: "activo" as const, roles: ["admin" as const, "profesor" as const] },
    { id: "c", estado: "inactivo" as const, roles: ["admin" as const] },
    { id: "d", estado: "activo" as const, roles: ["secretario" as const] },
  ];
  test("no cuenta a la propia cuenta, a las inactivas ni a quien no es administrador", () => assert.equal(contarOtrosAdminsActivos(cuentas, "a"), 1));
  test("con una sola administradora activa, las otras son 0", () => assert.equal(contarOtrosAdminsActivos(cuentas.filter((c) => c.id !== "b"), "a"), 0));
  test("sin lista, 0", () => assert.equal(contarOtrosAdminsActivos([], "a"), 0));
});
