import { randomUUID } from "node:crypto";
import { AuthorizationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { DocumentoRepository } from "./documento.repository";
import type { Documento } from "./documento.entity";
import type { AutorizarImagenInput } from "./documento.schema";

export class DocumentoService {
  constructor(
    private readonly documentoRepo: DocumentoRepository,
    private readonly alumnoRepo: AlumnoRepository,
  ) {}

  // Devuelve los documentos ya existentes del alumno (0 a 3 registros, uno
  // por tipo) — los tipos sin registro todavía se consideran "pendiente" y
  // el client los completa localmente, mismo criterio que ya usaba
  // obtenerAutorizacionImagen devolviendo null cuando no hay nada cargado.
  async listarPorAlumno(alumnoId: string, padreId?: string): Promise<Documento[]> {
    const alumno = await this.alumnoRepo.findById(alumnoId);
    if (!alumno) {
      throw new EntityNotFoundError("Alumno", alumnoId);
    }
    if (padreId && alumno.padreId !== padreId) {
      throw new AuthorizationError("Un padre solo puede ver los documentos de sus propios hijos");
    }

    return this.documentoRepo.findByAlumnoId(alumnoId);
  }

  // Admin/Secretario (carga manual, ej. llegó en papel) o el propio padre
  // (carga inicial desde su cuenta — ver "Documentación" en el legajo de
  // Admin) pueden marcar un documento como cargado. No hay almacenamiento de
  // archivos real todavía (se migrará junto con los datos históricos de
  // 2025), así que esto deja asentado que el documento ya fue recibido —
  // sin `urlArchivo`, el client debe seguir mostrando "Ver archivo" bloqueado
  // con el aviso correspondiente en vez de simular contenido.
  async marcarCargado(
    alumnoId: string,
    tipo: "formulario_inscripcion" | "copia_dni",
    padreId?: string,
  ): Promise<Documento> {
    const alumno = await this.alumnoRepo.findById(alumnoId);
    if (!alumno) {
      throw new EntityNotFoundError("Alumno", alumnoId);
    }
    if (padreId && alumno.padreId !== padreId) {
      throw new AuthorizationError("Un padre solo puede cargar los documentos de sus propios hijos");
    }

    const existente = await this.documentoRepo.findByAlumnoYTipo(alumnoId, tipo);
    const ahora = new Date();

    if (existente) {
      return this.documentoRepo.update(existente.id, {
        ...existente,
        estado: "cargado",
        fechaCarga: ahora,
      });
    }

    const documento: Documento = {
      id: randomUUID(),
      alumnoId,
      tipo,
      estado: "cargado",
      fechaCarga: ahora,
    };
    return this.documentoRepo.create(documento);
  }

  async obtenerAutorizacionImagen(alumnoId: string, padreId?: string): Promise<Documento | null> {
    const alumno = await this.alumnoRepo.findById(alumnoId);
    if (!alumno) {
      throw new EntityNotFoundError("Alumno", alumnoId);
    }
    if (padreId && alumno.padreId !== padreId) {
      throw new AuthorizationError("Un padre solo puede ver los datos de sus propios hijos");
    }

    return this.documentoRepo.findByAlumnoYTipo(alumnoId, "autorizacion_imagen");
  }

  async autorizarImagen(datos: AutorizarImagenInput, padreId: string): Promise<Documento> {
    const alumno = await this.alumnoRepo.findById(datos.alumnoId);
    if (!alumno) {
      throw new EntityNotFoundError("Alumno", datos.alumnoId);
    }
    if (alumno.padreId !== padreId) {
      throw new AuthorizationError("Solo el padre/tutor del alumno puede autorizar el uso de su imagen");
    }

    const existente = await this.documentoRepo.findByAlumnoYTipo(datos.alumnoId, "autorizacion_imagen");
    if (existente?.estado === "autorizado") {
      throw new ConflictError("La autorización de imagen ya fue aceptada y no puede volver a modificarse");
    }

    const ahora = new Date();

    if (existente) {
      return this.documentoRepo.update(existente.id, {
        ...existente,
        estado: "autorizado",
        autorizadoPor: padreId,
        fechaAutorizacion: ahora,
        tipoAutorizacion: "digital",
      });
    }

    const documento: Documento = {
      id: randomUUID(),
      alumnoId: datos.alumnoId,
      tipo: "autorizacion_imagen",
      estado: "autorizado",
      autorizadoPor: padreId,
      fechaAutorizacion: ahora,
      tipoAutorizacion: "digital",
    };

    return this.documentoRepo.create(documento);
  }

  // Solo Admin/Secretario: cubre el caso de una autorización firmada en papel
  // (no digital) que igual hay que dejar asentada en el sistema.
  async marcarAutorizacionManual(alumnoId: string): Promise<Documento> {
    const alumno = await this.alumnoRepo.findById(alumnoId);
    if (!alumno) {
      throw new EntityNotFoundError("Alumno", alumnoId);
    }

    const existente = await this.documentoRepo.findByAlumnoYTipo(alumnoId, "autorizacion_imagen");
    if (existente?.estado === "autorizado") {
      throw new ConflictError("La autorización de imagen ya fue aceptada y no puede volver a modificarse");
    }

    const ahora = new Date();
    if (existente) {
      return this.documentoRepo.update(existente.id, {
        ...existente,
        estado: "autorizado",
        autorizadoPor: alumno.padreId,
        fechaAutorizacion: ahora,
        tipoAutorizacion: "manual",
      });
    }

    const documento: Documento = {
      id: randomUUID(),
      alumnoId,
      tipo: "autorizacion_imagen",
      estado: "autorizado",
      autorizadoPor: alumno.padreId,
      fechaAutorizacion: ahora,
      tipoAutorizacion: "manual",
    };
    return this.documentoRepo.create(documento);
  }

  // Solo Admin/Secretario: revierte una autorización ya aceptada (ej. el
  // padre pidió retractarse) — vuelve a "pendiente" para que se pueda
  // completar de nuevo, digital o manualmente.
  async revocarAutorizacion(alumnoId: string): Promise<Documento> {
    const existente = await this.documentoRepo.findByAlumnoYTipo(alumnoId, "autorizacion_imagen");
    if (!existente || existente.estado !== "autorizado") {
      throw new ValidationError("Este alumno no tiene una autorización de imagen vigente para revocar");
    }

    return this.documentoRepo.update(existente.id, {
      ...existente,
      estado: "pendiente",
      autorizadoPor: undefined,
      fechaAutorizacion: undefined,
      tipoAutorizacion: undefined,
    });
  }
}
