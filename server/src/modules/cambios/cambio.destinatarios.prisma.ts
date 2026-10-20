import type { PrismaClient } from "@prisma/client";
import type { Rol } from "../../core/ports";
import type { CambioDeDatos, Destinatarios } from "./cambio.entity";

// Quiénes pueden ver el dato que cambió: la misma regla que las rutas de la API (una señal nunca le dice a alguien algo
// que la API no le dejaría leer). Como reportes/ y los criterios de los avisos, es una lectura que cruza módulos y
// consulta Prisma directo. Solo cuentas activas.
export interface DestinatariosDeCambios {
  resolver(cambio: CambioDeDatos): Promise<Destinatarios>;
}

const STAFF: Rol[] = ["admin", "secretario"];
const TODOS: Rol[] = ["admin", "secretario", "profesor", "padre"];
const activa = (rol: Rol) => ({ estado: "activo" as const, roles: { has: rol } });

export class PrismaDestinatariosDeCambios implements DestinatariosDeCambios {
  constructor(private readonly prisma: PrismaClient) {}

  async resolver({ dato, accion, ids, visibleParaFamilias }: CambioDeDatos): Promise<Destinatarios> {
    const alumnos = ids.alumnoIds ?? [];
    const cursos = ids.cursoIds ?? [];
    const cuentas: Destinatarios["cuentas"] = [];
    const sumar = async (rol: Rol, usuarioIds: Promise<string[]>) => {
      for (const usuarioId of await usuarioIds) cuentas.push({ usuarioId, rol });
    };
    let roles: Rol[] = STAFF;

    switch (dato) {
      case "cuotas":
      case "documentos":
        await sumar("padre", this.padresDeAlumnos(alumnos));
        break;
      case "alumnos":
        await sumar("padre", this.padresDeAlumnos(alumnos));
        await sumar("profesor", this.profesoresDeCursos(cursos));
        break;
      case "cursos":
        await sumar("profesor", this.profesores(ids.profesorIds ?? [], cursos));
        await sumar("padre", this.padresDeCursos(cursos));
        break;
      case "evaluaciones":
        await sumar("profesor", this.profesoresDeCursos(cursos));
        if (accion === "publicacion") await sumar("padre", this.padresDeCursos(cursos));
        break;
      case "calificaciones":
        await sumar("profesor", this.profesoresDeCursos(cursos));
        if (visibleParaFamilias) await sumar("padre", this.padresDeAlumnos(alumnos));
        break;
      case "notas-cierre":
        await sumar("profesor", this.profesoresDeCursos(cursos));
        if (accion === "publicacion") await sumar("padre", this.padresDeAlumnos(alumnos));
        break;
      case "asistencia":
        await sumar("profesor", this.profesoresDeCursos(cursos));
        await sumar("padre", this.padresDeAlumnos(alumnos));
        break;
      case "observaciones":
        await sumar("profesor", this.profesoresDeAlumnos(alumnos));
        await sumar("padre", this.padresDeAlumnos(alumnos));
        break;
      case "categorias":
        await sumar("profesor", this.profesoresDeCursos(cursos));
        break;
      case "padres":
      case "profesores":
      case "configuracion":
        break;
      case "usuarios":
        roles = ["admin"];
        break;
      case "ciclos":
        roles = TODOS;
        break;
      case "sesiones":
        roles = [];
        for (const u of await this.prisma.usuario.findMany({ where: { id: { in: ids.usuarioIds ?? [] }, estado: "activo" } })) {
          for (const rol of u.roles) cuentas.push({ usuarioId: u.id, rol });
        }
        break;
    }
    const unicas = new Map(cuentas.map((c) => [`${c.usuarioId}|${c.rol}`, c]));
    return { roles, cuentas: [...unicas.values()] };
  }

  private async padresDeAlumnos(alumnoIds: string[]): Promise<string[]> {
    if (alumnoIds.length === 0) return [];
    const padres = await this.prisma.padre.findMany({
      where: { alumnos: { some: { id: { in: alumnoIds } } }, usuario: activa("padre") },
      select: { usuarioId: true },
    });
    return padres.map((p) => p.usuarioId as string);
  }

  // Familias de los alumnos activos de esos cursos.
  private async padresDeCursos(cursoIds: string[]): Promise<string[]> {
    if (cursoIds.length === 0) return [];
    const padres = await this.prisma.padre.findMany({
      where: { alumnos: { some: { cursoId: { in: cursoIds }, estado: "activo" } }, usuario: activa("padre") },
      select: { usuarioId: true },
    });
    return padres.map((p) => p.usuarioId as string);
  }

  private async profesoresDeCursos(cursoIds: string[]): Promise<string[]> {
    return this.profesores([], cursoIds);
  }

  // Los profesores por id (el anterior y el nuevo de un curso reasignado) y los de esos cursos.
  private async profesores(profesorIds: string[], cursoIds: string[]): Promise<string[]> {
    if (profesorIds.length === 0 && cursoIds.length === 0) return [];
    const profesores = await this.prisma.profesor.findMany({
      where: { OR: [{ id: { in: profesorIds } }, { cursos: { some: { id: { in: cursoIds } } } }], usuario: activa("profesor") },
      select: { usuarioId: true },
    });
    return profesores.map((p) => p.usuarioId as string);
  }

  private async profesoresDeAlumnos(alumnoIds: string[]): Promise<string[]> {
    if (alumnoIds.length === 0) return [];
    const cursos = await this.prisma.alumno.findMany({ where: { id: { in: alumnoIds }, cursoId: { not: null } }, select: { cursoId: true } });
    return this.profesoresDeCursos(cursos.map((c) => c.cursoId as string));
  }
}
