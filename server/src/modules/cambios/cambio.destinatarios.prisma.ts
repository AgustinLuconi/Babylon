import type { PrismaClient } from "@prisma/client";
import type { Rol } from "../../core/ports";
import type { CambioDeDatos, Destinatarios, IdsDeCambio } from "./cambio.entity";

// Quiénes pueden ver el dato que cambió: la misma regla que las rutas de la API (una señal nunca le dice a alguien algo
// que la API no le dejaría leer). Como reportes/ y los criterios de los avisos, es una lectura que cruza módulos y
// consulta Prisma directo. Solo cuentas activas. Cada familia y cada profesor reciben los ids recortados a lo suyo: ni
// los de otras familias ni cantidades del instituto (un padre no se entera de cuántas cuotas vencieron en total).
export interface DestinatariosDeCambios {
  resolver(cambio: CambioDeDatos): Promise<Destinatarios>;
}

const STAFF: Rol[] = ["admin", "secretario"];
const TODOS: Rol[] = ["admin", "secretario", "profesor", "padre"];
const activa = (rol: Rol) => ({ estado: "activo" as const, roles: { has: rol } });

// Lo que una cuenta de familia o de profesor puede ver.
interface Alcance {
  usuarioId: string;
  rol: Rol;
  alumnos: Set<string>;
  cursos: Set<string>;
  profesorId?: string;
}

// De qué alumno es cada cuota u observación y de qué curso cada evaluación (para recortar esos ids).
interface Pertenencias {
  alumnoDeCuota: Map<string, string>;
  alumnoDeObservacion: Map<string, string>;
  cursoDeEvaluacion: Map<string, string>;
}

function recortar(ids: IdsDeCambio, a: Alcance, p: Pertenencias): IdsDeCambio {
  const dentro = (lista: string[] | undefined, permitido: (id: string) => boolean) => (lista ?? []).filter(permitido);
  const resultado: IdsDeCambio = {
    alumnoIds: dentro(ids.alumnoIds, (id) => a.alumnos.has(id)),
    cursoIds: dentro(ids.cursoIds, (id) => a.cursos.has(id)),
    cuotaIds: dentro(ids.cuotaIds, (id) => a.alumnos.has(p.alumnoDeCuota.get(id) ?? "")),
    observacionIds: dentro(ids.observacionIds, (id) => a.alumnos.has(p.alumnoDeObservacion.get(id) ?? "")),
    evaluacionIds: dentro(ids.evaluacionIds, (id) => a.cursos.has(p.cursoDeEvaluacion.get(id) ?? "")),
    profesorIds: dentro(ids.profesorIds, (id) => id === a.profesorId),
    usuarioIds: dentro(ids.usuarioIds, (id) => id === a.usuarioId),
    cicloIds: ids.cicloIds ?? [],
  };
  // Solo las listas con algo.
  return Object.fromEntries(Object.entries(resultado).filter(([, v]) => v.length > 0)) as IdsDeCambio;
}

export class PrismaDestinatariosDeCambios implements DestinatariosDeCambios {
  constructor(private readonly prisma: PrismaClient) {}

  async resolver(cambio: CambioDeDatos): Promise<Destinatarios> {
    const { dato, accion, ids, visibleParaFamilias } = cambio;
    const alumnos = ids.alumnoIds ?? [];
    const cursos = ids.cursoIds ?? [];
    const alcances: Alcance[] = [];
    const sumar = async (lista: Promise<Alcance[]>) => {
      alcances.push(...(await lista));
    };
    let roles: Rol[] = STAFF;

    switch (dato) {
      case "cuotas":
      case "documentos":
        await sumar(this.padres({ alumnoIds: alumnos }));
        break;
      case "alumnos":
        await sumar(this.padres({ alumnoIds: alumnos }));
        await sumar(this.profesores({ cursoIds: cursos }));
        break;
      case "cursos":
        await sumar(this.profesores({ cursoIds: cursos, profesorIds: ids.profesorIds ?? [] }));
        await sumar(this.padres({ cursoIds: cursos }));
        break;
      case "evaluaciones":
        await sumar(this.profesores({ cursoIds: cursos }));
        if (accion === "publicacion") await sumar(this.padres({ cursoIds: cursos }));
        break;
      case "calificaciones":
        await sumar(this.profesores({ cursoIds: cursos }));
        if (visibleParaFamilias) await sumar(this.padres({ alumnoIds: alumnos }));
        break;
      case "notas-cierre":
        await sumar(this.profesores({ cursoIds: cursos }));
        if (accion === "publicacion") await sumar(this.padres({ alumnoIds: alumnos }));
        break;
      case "asistencia":
        await sumar(this.profesores({ cursoIds: cursos }));
        await sumar(this.padres({ alumnoIds: alumnos }));
        break;
      case "observaciones":
        await sumar(this.profesores({ alumnoIds: alumnos }));
        await sumar(this.padres({ alumnoIds: alumnos }));
        break;
      case "categorias":
        await sumar(this.profesores({ cursoIds: cursos }));
        break;
      case "padres":
      case "configuracion":
        break;
      // GET /api/profesores es solo de administración.
      case "profesores":
      case "usuarios":
        roles = ["admin"];
        break;
      // Activar otro ciclo cambia todo lo que ven todos; un ciclo nuevo solo lo leen administración, secretaría y profesores.
      case "ciclos":
        roles = accion === "activacion" ? TODOS : ["admin", "secretario", "profesor"];
        break;
      case "sesiones":
        roles = [];
        for (const u of await this.prisma.usuario.findMany({ where: { id: { in: ids.usuarioIds ?? [] }, estado: "activo" } })) {
          for (const rol of u.roles) alcances.push({ usuarioId: u.id, rol, alumnos: new Set(), cursos: new Set() });
        }
        break;
    }

    const pertenencias = await this.pertenencias(ids);
    const porCuenta = new Map<string, Alcance>();
    for (const a of alcances) {
      // Una misma cuenta que aparece por dos caminos (dos hijos en distintos cursos): se juntan sus alcances.
      const clave = `${a.usuarioId}|${a.rol}`;
      const previo = porCuenta.get(clave);
      if (!previo) porCuenta.set(clave, a);
      else {
        a.alumnos.forEach((x) => previo.alumnos.add(x));
        a.cursos.forEach((x) => previo.cursos.add(x));
      }
    }
    return {
      roles,
      cuentas: [...porCuenta.values()].map((a) => ({ usuarioId: a.usuarioId, rol: a.rol, ids: recortar(ids, a, pertenencias) })),
    };
  }

  // Familias de esos alumnos o de los alumnos activos de esos cursos, cada una con sus hijos y los cursos de sus hijos.
  private async padres({ alumnoIds = [], cursoIds = [] }: { alumnoIds?: string[]; cursoIds?: string[] }): Promise<Alcance[]> {
    if (alumnoIds.length === 0 && cursoIds.length === 0) return [];
    const padres = await this.prisma.padre.findMany({
      where: {
        usuario: activa("padre"),
        alumnos: { some: { OR: [{ id: { in: alumnoIds } }, { cursoId: { in: cursoIds }, estado: "activo" }] } },
      },
      select: { usuarioId: true, alumnos: { select: { id: true, cursoId: true } } },
    });
    return padres.map((p) => ({
      usuarioId: p.usuarioId as string,
      rol: "padre" as const,
      alumnos: new Set(p.alumnos.map((a) => a.id)),
      cursos: new Set(p.alumnos.map((a) => a.cursoId).filter((c): c is string => !!c)),
    }));
  }

  // Profesores de esos cursos, de los cursos de esos alumnos o nombrados en el cambio (en una reasignación, el
  // anterior y el nuevo), cada uno con sus cursos y sus alumnos. Al que el cambio nombra, el curso del cambio le
  // corresponde (es el que acaba de recibir o de perder).
  private async profesores({ cursoIds = [], alumnoIds = [], profesorIds = [] }: { cursoIds?: string[]; alumnoIds?: string[]; profesorIds?: string[] }): Promise<Alcance[]> {
    if (cursoIds.length === 0 && alumnoIds.length === 0 && profesorIds.length === 0) return [];
    const profesores = await this.prisma.profesor.findMany({
      where: {
        usuario: activa("profesor"),
        OR: [{ id: { in: profesorIds } }, { cursos: { some: { OR: [{ id: { in: cursoIds } }, { alumnos: { some: { id: { in: alumnoIds } } } }] } } }],
      },
      select: { id: true, usuarioId: true, cursos: { select: { id: true, alumnos: { select: { id: true } } } } },
    });
    return profesores.map((p) => {
      const nombrado = profesorIds.includes(p.id);
      return {
        usuarioId: p.usuarioId as string,
        rol: "profesor" as const,
        profesorId: p.id,
        cursos: new Set([...p.cursos.map((c) => c.id), ...(nombrado ? cursoIds : [])]),
        alumnos: new Set(p.cursos.flatMap((c) => c.alumnos.map((a) => a.id))),
      };
    });
  }

  private async pertenencias(ids: IdsDeCambio): Promise<Pertenencias> {
    const [cuotas, observaciones, evaluaciones] = await Promise.all([
      ids.cuotaIds?.length ? this.prisma.cuota.findMany({ where: { id: { in: ids.cuotaIds } }, select: { id: true, alumnoId: true } }) : [],
      ids.observacionIds?.length
        ? this.prisma.observacion.findMany({ where: { id: { in: ids.observacionIds } }, select: { id: true, alumnoId: true } })
        : [],
      ids.evaluacionIds?.length
        ? this.prisma.evaluacion.findMany({ where: { id: { in: ids.evaluacionIds } }, select: { id: true, cursoId: true } })
        : [],
    ]);
    return {
      alumnoDeCuota: new Map(cuotas.map((c) => [c.id, c.alumnoId])),
      alumnoDeObservacion: new Map(observaciones.map((o) => [o.id, o.alumnoId])),
      cursoDeEvaluacion: new Map(evaluaciones.map((e) => [e.id, e.cursoId])),
    };
  }
}
