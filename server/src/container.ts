import { configurarValidadorDeSesion } from "./core/middlewares/authMiddleware";
import { prisma } from "./core/database";
import { PrismaUnitOfWork } from "./core/adapters/PrismaUnitOfWork";
import { ConsoleMailer } from "./core/adapters/ConsoleMailer";
import { SmtpMailer } from "./core/adapters/SmtpMailer";
import { config } from "./core/config";
import type { Mailer } from "./core/ports";

import { PrismaUsuarioRepository } from "./modules/usuarios/usuario.repository.prisma";
import { UsuarioService } from "./modules/usuarios/usuario.service";
import { UsuarioController } from "./modules/usuarios/usuario.controller";

import { PrismaCicloRepository } from "./modules/ciclos/ciclo.repository.prisma";
import { CicloService } from "./modules/ciclos/ciclo.service";
import { CicloController } from "./modules/ciclos/ciclo.controller";

import { PrismaPadreRepository } from "./modules/padres/padre.repository.prisma";
import { PadreService } from "./modules/padres/padre.service";
import { PadreController } from "./modules/padres/padre.controller";

import { PrismaProfesorRepository } from "./modules/profesores/profesor.repository.prisma";
import { ProfesorService } from "./modules/profesores/profesor.service";
import { ProfesorController } from "./modules/profesores/profesor.controller";

import { PrismaAlumnoRepository } from "./modules/alumnos/alumno.repository.prisma";
import { AlumnoService } from "./modules/alumnos/alumno.service";
import { AlumnoController } from "./modules/alumnos/alumno.controller";

import { PrismaCursoRepository } from "./modules/cursos/curso.repository.prisma";
import { CursoService } from "./modules/cursos/curso.service";
import { CursoController } from "./modules/cursos/curso.controller";

import { PrismaAsistenciaRepository } from "./modules/asistencia/asistencia.repository.prisma";
import { AsistenciaService } from "./modules/asistencia/asistencia.service";
import { AsistenciaController } from "./modules/asistencia/asistencia.controller";

import { PrismaCuotaRepository } from "./modules/cuotas/cuota.repository.prisma";
import { CuotaService } from "./modules/cuotas/cuota.service";
import { NotificacionService } from "./modules/notificaciones/notificacion.service";
import { NotificacionController } from "./modules/notificaciones/notificacion.controller";
import { PrismaConfiguracionRepository } from "./modules/configuraciones/configuracion.repository.prisma";
import { ConfiguracionService } from "./modules/configuraciones/configuracion.service";
import { ConfiguracionController } from "./modules/configuraciones/configuracion.controller";
import { CuotaController } from "./modules/cuotas/cuota.controller";

import { PrismaDocumentoRepository } from "./modules/documentos/documento.repository.prisma";
import { DocumentoService } from "./modules/documentos/documento.service";
import { DocumentoController } from "./modules/documentos/documento.controller";

import { PrismaCalificacionRepository } from "./modules/calificaciones/calificacion.repository.prisma";
import { CalificacionService } from "./modules/calificaciones/calificacion.service";
import { CalificacionController } from "./modules/calificaciones/calificacion.controller";

import { PrismaObservacionRepository } from "./modules/observaciones/observacion.repository.prisma";
import { ObservacionService } from "./modules/observaciones/observacion.service";
import { ObservacionController } from "./modules/observaciones/observacion.controller";

import { PrismaChatRepository } from "./modules/chats/chat.repository.prisma";
import { ChatService } from "./modules/chats/chat.service";
import { ChatController } from "./modules/chats/chat.controller";

import { ReporteService } from "./modules/reportes/reporte.service";
import { ReporteController } from "./modules/reportes/reporte.controller";

// --- Repositorios: Prisma real, conectado a PostgreSQL. Los datos de
// desarrollo ya no se siembran acá — correr `npm run prisma:seed`. ---
const usuarioRepository = new PrismaUsuarioRepository(prisma);
configurarValidadorDeSesion(async (usuarioId) => {
  const usuario = await usuarioRepository.findById(usuarioId);
  return usuario ? { activo: usuario.estado === "activo", versionSesion: usuario.versionSesion } : null;
});
const cicloRepository = new PrismaCicloRepository(prisma);
const padreRepository = new PrismaPadreRepository(prisma);
const profesorRepository = new PrismaProfesorRepository(prisma);
const alumnoRepository = new PrismaAlumnoRepository(prisma);
const cursoRepository = new PrismaCursoRepository(prisma);
const asistenciaRepository = new PrismaAsistenciaRepository(prisma);
const cuotaRepository = new PrismaCuotaRepository(prisma);
const configuracionRepository = new PrismaConfiguracionRepository(prisma);
const documentoRepository = new PrismaDocumentoRepository(prisma);
const calificacionRepository = new PrismaCalificacionRepository(prisma);
const observacionRepository = new PrismaObservacionRepository(prisma);
const chatRepository = new PrismaChatRepository(prisma);
const unitOfWork = new PrismaUnitOfWork(prisma);

// Correo: SMTP real si está configurado; si no, se escribe en la consola (desarrollo).
const mailer: Mailer = config.SMTP_HOST
  ? new SmtpMailer({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      user: config.SMTP_USER ?? "",
      pass: config.SMTP_PASS ?? "",
      from: config.MAIL_FROM,
    })
  : new ConsoleMailer();

// --- Servicios ---
const usuarioService = new UsuarioService(usuarioRepository, profesorRepository, unitOfWork, mailer);
const cicloService = new CicloService(cicloRepository, unitOfWork);
const padreService = new PadreService(padreRepository, usuarioRepository, unitOfWork);
const profesorService = new ProfesorService(profesorRepository, usuarioRepository, unitOfWork);
const cuotaService = new CuotaService(cuotaRepository, alumnoRepository, cicloRepository, configuracionRepository, unitOfWork);
const configuracionService = new ConfiguracionService(configuracionRepository);
const alumnoService = new AlumnoService(
  alumnoRepository,
  cursoRepository,
  profesorRepository,
  cicloRepository,
  cuotaService,
  unitOfWork,
);
const cursoService = new CursoService(cursoRepository, profesorRepository, cicloRepository, unitOfWork);
const asistenciaService = new AsistenciaService(asistenciaRepository, cursoRepository, alumnoRepository, unitOfWork);
const documentoService = new DocumentoService(documentoRepository, alumnoRepository);
const calificacionService = new CalificacionService(
  calificacionRepository,
  cursoRepository,
  alumnoRepository,
  unitOfWork,
);
const observacionService = new ObservacionService(observacionRepository, alumnoRepository, cursoRepository, usuarioRepository);
const chatService = new ChatService(chatRepository, usuarioRepository);
const reporteService = new ReporteService(prisma);
const notificacionService = new NotificacionService(prisma);

// --- Composition root: lo único que server.ts necesita para montar rutas ---
export const container = {
  // Expuesto para la tarea periódica de cuotas (ver server.ts).
  cuotaService,
  // Expuesto para verificar los avisos con fechas fijas.
  notificacionService,
  // Expuesto para verificar el adaptador de correo elegido.
  mailer,
  configuracionController: new ConfiguracionController(configuracionService),
  usuarioController: new UsuarioController(usuarioService),
  cicloController: new CicloController(cicloService),
  padreController: new PadreController(padreService),
  profesorController: new ProfesorController(profesorService),
  alumnoController: new AlumnoController(alumnoService, padreService),
  cursoController: new CursoController(cursoService, profesorService, alumnoService),
  asistenciaController: new AsistenciaController(asistenciaService, profesorService, padreService),
  cuotaController: new CuotaController(cuotaService, padreService),
  documentoController: new DocumentoController(documentoService, padreService),
  calificacionController: new CalificacionController(calificacionService, profesorService, padreService),
  observacionController: new ObservacionController(observacionService, padreService, profesorService),
  chatController: new ChatController(chatService, padreService),
  reporteController: new ReporteController(reporteService),
  notificacionController: new NotificacionController(notificacionService, padreService, profesorService),
};
