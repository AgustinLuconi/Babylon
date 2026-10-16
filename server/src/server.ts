// Express 5 reenvía nativamente a next(err) cuando un handler async rechaza
// una promesa (antes hacía falta "express-async-errors" para esto en
// Express 4; el paquete además dejó de funcionar en Express 5, porque
// parcheaba un archivo interno — express/lib/router/layer — que cambió de
// lugar en la v5).
import express from "express";
import cors from "cors";
import { config } from "./core/config";
import { errorHandler } from "./core/middlewares/errorHandler";
import { tiempoRealRoutes } from "./core/tiempoReal";
import { container } from "./container";
import { invitacionRoutes } from "./modules/usuarios/invitacion.routes";
import { usuarioRoutes } from "./modules/usuarios/usuario.routes";
import { cicloRoutes } from "./modules/ciclos/ciclo.routes";
import { padreRoutes } from "./modules/padres/padre.routes";
import { profesorRoutes } from "./modules/profesores/profesor.routes";
import { alumnoRoutes } from "./modules/alumnos/alumno.routes";
import { cursoRoutes } from "./modules/cursos/curso.routes";
import { asistenciaRoutes } from "./modules/asistencia/asistencia.routes";
import { cuotaRoutes } from "./modules/cuotas/cuota.routes";
import { iniciarMantenimientoDeCuotas } from "./modules/cuotas/cuota.scheduler";
import { iniciarDepuracionDeSesiones } from "./modules/usuarios/sesion.scheduler";
import { configuracionRoutes } from "./modules/configuraciones/configuracion.routes";
import { documentoRoutes } from "./modules/documentos/documento.routes";
import { calificacionRoutes } from "./modules/calificaciones/calificacion.routes";
import { observacionRoutes } from "./modules/observaciones/observacion.routes";
import { chatRoutes } from "./modules/chats/chat.routes";
import { reporteRoutes } from "./modules/reportes/reporte.routes";
import { notificacionRoutes } from "./modules/notificaciones/notificacion.routes";
import { iniciarAvisosPeriodicos } from "./modules/notificaciones/notificacion.scheduler";

const app = express();

const trustProxy = config.TRUST_PROXY;
app.set("trust proxy", trustProxy === "false" ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", usuarioRoutes(container.usuarioController));
app.use("/api/auth", invitacionRoutes(container.invitacionController));
app.use("/api/ciclos", cicloRoutes(container.cicloController));
app.use("/api/padres", padreRoutes(container.padreController));
app.use("/api/profesores", profesorRoutes(container.profesorController));
app.use("/api/alumnos", alumnoRoutes(container.alumnoController));
app.use("/api/cursos", cursoRoutes(container.cursoController));
app.use("/api/asistencia", asistenciaRoutes(container.asistenciaController));
app.use("/api/configuracion", configuracionRoutes(container.configuracionController));
app.use("/api/cuotas", cuotaRoutes(container.cuotaController));
app.use("/api/documentos", documentoRoutes(container.documentoController));
app.use("/api/calificaciones", calificacionRoutes(container.calificacionController));
app.use("/api/observaciones", observacionRoutes(container.observacionController));
app.use("/api/chats", chatRoutes(container.chatController));
app.use("/api/reportes", reporteRoutes(container.reporteController));
app.use("/api/notificaciones", notificacionRoutes(container.notificacionController));
app.use("/api/tiempo-real", tiempoRealRoutes(container.canalEnVivo, container.validadorDeSesion));

app.use(errorHandler);

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Babylon API escuchando en http://localhost:${config.PORT}`);
  iniciarMantenimientoDeCuotas(container.cuotaService);
  iniciarDepuracionDeSesiones(container.usuarioService);
  iniciarAvisosPeriodicos(container.notificacionService);
});
