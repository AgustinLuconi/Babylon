import "express-async-errors";
import express from "express";
import cors from "cors";
import { config } from "./core/config";
import { errorHandler } from "./core/middlewares/errorHandler";
import { container } from "./container";
import { usuarioRoutes } from "./modules/usuarios/usuario.routes";
import { cicloRoutes } from "./modules/ciclos/ciclo.routes";
import { padreRoutes } from "./modules/padres/padre.routes";
import { profesorRoutes } from "./modules/profesores/profesor.routes";
import { alumnoRoutes } from "./modules/alumnos/alumno.routes";
import { cursoRoutes } from "./modules/cursos/curso.routes";
import { asistenciaRoutes } from "./modules/asistencia/asistencia.routes";
import { cuotaRoutes } from "./modules/cuotas/cuota.routes";
import { documentoRoutes } from "./modules/documentos/documento.routes";
import { calificacionRoutes } from "./modules/calificaciones/calificacion.routes";
import { observacionRoutes } from "./modules/observaciones/observacion.routes";
import { chatRoutes } from "./modules/chats/chat.routes";
import { reporteRoutes } from "./modules/reportes/reporte.routes";

const app = express();

app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", usuarioRoutes(container.usuarioController));
app.use("/api/ciclos", cicloRoutes(container.cicloController));
app.use("/api/padres", padreRoutes(container.padreController));
app.use("/api/profesores", profesorRoutes(container.profesorController));
app.use("/api/alumnos", alumnoRoutes(container.alumnoController));
app.use("/api/cursos", cursoRoutes(container.cursoController));
app.use("/api/asistencia", asistenciaRoutes(container.asistenciaController));
app.use("/api/cuotas", cuotaRoutes(container.cuotaController));
app.use("/api/documentos", documentoRoutes(container.documentoController));
app.use("/api/calificaciones", calificacionRoutes(container.calificacionController));
app.use("/api/observaciones", observacionRoutes(container.observacionController));
app.use("/api/chats", chatRoutes(container.chatController));
app.use("/api/reportes", reporteRoutes(container.reporteController));

app.use(errorHandler);

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Babylon API escuchando en http://localhost:${config.PORT}`);
});
