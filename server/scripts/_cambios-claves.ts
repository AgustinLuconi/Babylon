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
ok("padres", k("padres"), '["padres"] ["pendientes"] ["alumnos"]');
ok("profesores", k("profesores"), '["profesores"] ["pendientes"] ["cursos"]');
ok("usuarios", k("usuarios"), '["usuarios"] ["pendientes"]');
ok("configuración", k("configuracion"), '["configuracion"]');
ok("ciclos: todo", k("ciclos"), "todo");
ok("sesiones", k("sesiones"), '["sesiones"]');
