import { clavesAfectadas } from "../../client/src/features/cambios/claves";
import type { SenalCambio } from "../../client/src/features/cambios/types";
import { ok } from "./_check";

const c = (dato: SenalCambio["dato"]): SenalCambio => ({ dato, accion: "alta", ids: {}, por: null });
const k = (dato: SenalCambio["dato"]) => {
  const r = clavesAfectadas(c(dato));
  return r === "todo" ? "todo" : r.map((x) => JSON.stringify(x)).join(" ");
};
ok("cuotas", k("cuotas"), '["cuotas"] ["reportes"]');
ok("alumnos", k("alumnos"), '["alumnos"] ["cursos"] ["cuotas"] ["documentos"] ["reportes"]');
ok("cursos", k("cursos"), '["cursos"] ["alumnos"] ["reportes"]');
ok("evaluaciones", k("evaluaciones"), '["evaluaciones"] ["calificaciones"] ["reportes"]');
ok("calificaciones", k("calificaciones"), '["calificaciones"] ["reportes"]');
ok("notas de cierre", k("notas-cierre"), '["calificaciones"] ["notasCierre"] ["reportes"]');
ok("asistencia", k("asistencia"), '["asistencia"] ["reportes"]');
ok("observaciones", k("observaciones"), '["observaciones"]');
ok("categorías", k("categorias"), '["categoriasPersonalizadas"]');
ok("documentos", k("documentos"), '["documentos"] ["autorizacionImagen"] ["reportes"]');
ok("padres", k("padres"), '["padres"] ["sin-cuenta"] ["alumnos"]');
ok("profesores", k("profesores"), '["profesores"] ["sin-cuenta"] ["cursos"]');
ok("usuarios", k("usuarios"), '["usuarios"] ["sin-cuenta"]');
ok("configuración", k("configuracion"), '["configuracion"]');
ok("ciclos: activar o crear uno cambia todo lo que muestran las pantallas", k("ciclos"), "todo");
const kAccion = (accion: SenalCambio["accion"]) => {
  const r = clavesAfectadas({ dato: "ciclos", accion, ids: {}, por: null });
  return r === "todo" ? "todo" : r.map((x) => JSON.stringify(x)).join(" ");
};
ok("ciclos: activación → todo", kAccion("activacion"), "todo");
ok("ciclos: editar fechas o pausas solo vuelve a pedir los ciclos", kAccion("edicion"), '["ciclos"]');
ok("sesiones", k("sesiones"), '["sesiones"]');
