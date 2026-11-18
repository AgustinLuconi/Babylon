// API del panel de Automatizaciones: solo administración; listar, cambiar interruptor y número, historial. Requiere la API en :4000.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
type Cuenta = "admin" | "secre" | "profe" | "padre";
const tokens = {} as Record<Cuenta, string>;
async function pedir(metodo: string, ruta: string, cuenta: Cuenta, cuerpo?: unknown): Promise<{ status: number; d: any }> {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[cuenta]}` }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const t = await r.text();
  return { status: r.status, d: t ? JSON.parse(t) : null };
}
const regla = async (id: string) => ((await pedir("GET", "/api/automatizaciones", "admin")).d as any[]).find((x) => x.id === id);
const primeraPagina = async (id: string) => (await pedir("GET", `/api/automatizaciones/${id}/alertas`, "admin")).d;
const deHijo2 = (pagina: any) => (pagina.alertas as any[]).filter((a) => a.alumnoId === `${P}-hijo2`);

(async () => {
  const inicio = new Date();
  const m = await crearMundo(prisma);
  try {
    for (const c of ["admin", "secre", "profe", "padre"] as Cuenta[]) {
      const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(c), password: CLAVE }) });
      tokens[c] = ((await r.json()) as { token: string }).token;
    }
    await prisma.automatizacion.upsert({ where: { regla: "deuda_cuotas" }, update: { activa: true, umbral: 2 }, create: { regla: "deuda_cuotas", activa: true, umbral: 2 } });
    await prisma.automatizacion.upsert({ where: { regla: "inasistencias_seguidas" }, update: { activa: true, umbral: 3 }, create: { regla: "inasistencias_seguidas", activa: true, umbral: 3 } });

    // Permisos
    const lista = await pedir("GET", "/api/automatizaciones", "admin");
    ok("administración: lista las cuatro reglas", `${lista.status} ${lista.d.map((r: any) => r.id).join(",")}`, "200 deuda_cuotas,inasistencias_seguidas,evaluacion_sin_notas,alumno_en_riesgo");
    const deuda = lista.d.find((r: any) => r.id === "deuda_cuotas");
    ok("la regla de deuda trae su catálogo y su estado", `${deuda.nombre}|${deuda.unidad}|${deuda.umbralMinimo}-${deuda.umbralMaximo}|${deuda.activa}|${deuda.umbral}|${typeof deuda.enAlerta}`, "Alumno con deuda|cuotas vencidas|1-12|true|2|number");
    for (const cuenta of ["secre", "profe", "padre"] as Cuenta[]) {
      const estados = [(await pedir("GET", "/api/automatizaciones", cuenta)).status, (await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", cuenta, { activa: true })).status, (await pedir("GET", "/api/automatizaciones/deuda_cuotas/alertas", cuenta)).status];
      ok(`${cuenta}: 403 en las tres rutas`, estados.join(","), "403,403,403");
    }

    // Una alerta de prueba: dos cuotas vencidas de hijo2
    for (const mes of [1, 2]) await prisma.cuota.create({ data: { id: `${P}-q${mes}`, alumnoId: m.hijo2, mes, anio: 2080, montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2080-03-10T00:00:00Z"), estado: "vencida" } });
    const antes = (await regla("deuda_cuotas")).enAlerta as number;
    const mismoNumero = await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", "admin", { umbral: 2 });
    ok("guardar revisa la regla: una alerta más en el panel", `${mismoNumero.status} ${mismoNumero.d.enAlerta === antes + 1}`, "200 true");
    ok("la regla guarda la última revisión", !!(await regla("deuda_cuotas")).ultimaRevisionEn, true);

    // Apagar y volver a prender
    const apagada = await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", "admin", { activa: false });
    ok("apagar: nadie queda en alerta", `${apagada.status} ${apagada.d.activa} ${apagada.d.enAlerta}`, "200 false 0");
    const cerrada = deHijo2(await primeraPagina("deuda_cuotas"));
    ok("el historial muestra la alerta cerrada por regla apagada, con nombre del alumno y sin curso", `${cerrada[0]?.motivoCierre} ${cerrada[0]?.alumnoNombre} ${cerrada[0]?.cursoNombre} ${!!cerrada[0]?.resueltaEn}`, "regla-apagada Lunaav Pruebaav null true");
    const prendida = await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", "admin", { activa: true });
    ok("prender de nuevo vuelve a abrir (fila nueva)", `${prendida.d.enAlerta === antes + 1} ${deHijo2(await primeraPagina("deuda_cuotas")).length}`, "true 2");

    // Cambiar el número
    const subido = await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", "admin", { umbral: 3 });
    ok("subir el número a 3 saca a quien tiene 2", `${subido.d.umbral} ${(await regla("deuda_cuotas")).enAlerta < antes + 1}`, "3 true");
    ok("el historial lo muestra cerrado por cambio de número", deHijo2(await primeraPagina("deuda_cuotas")).some((a: any) => a.motivoCierre === "cambio-de-numero"), true);
    await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", "admin", { umbral: 2 });

    // Validaciones
    for (const umbral of [0, 13, 1.5, "x"]) ok(`umbral ${JSON.stringify(umbral)} fuera de lo permitido → 400`, (await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", "admin", { umbral })).status, 400);
    ok("inasistencias: 1 queda fuera de su rango (2–10) → 400", (await pedir("PATCH", "/api/automatizaciones/inasistencias_seguidas", "admin", { umbral: 1 })).status, 400);
    ok("cuerpo vacío → 400", (await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", "admin", {})).status, 400);
    ok("campo desconocido → 400", (await pedir("PATCH", "/api/automatizaciones/deuda_cuotas", "admin", { foo: 1 })).status, 400);
    ok("regla inexistente (PATCH) → 404", (await pedir("PATCH", "/api/automatizaciones/no-existe", "admin", { activa: true })).status, 404);
    ok("regla inexistente (historial) → 404", (await pedir("GET", "/api/automatizaciones/no-existe/alertas", "admin")).status, 404);

    // Historial paginado
    const pagina = await primeraPagina("deuda_cuotas");
    ok("el historial pagina de a 20 y trae el total", `${pagina.porPagina} ${pagina.alertas.length <= 20} ${pagina.total >= 2}`, "20 true true");
    ok("una página inexistente devuelve la lista vacía", `${(await pedir("GET", "/api/automatizaciones/deuda_cuotas/alertas?pagina=9999", "admin")).d.alertas.length}`, "0");
    ok("pagina inválida → 400", (await pedir("GET", "/api/automatizaciones/deuda_cuotas/alertas?pagina=0", "admin")).status, 400);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.alertaAutomatica.deleteMany({ where: { abiertaEn: { gte: inicio } } });
    await prisma.alertaAutomatica.updateMany({ where: { resueltaEn: { gte: inicio } }, data: { resueltaEn: null, motivoCierre: null } });
    await prisma.automatizacion.upsert({ where: { regla: "deuda_cuotas" }, update: { activa: true, umbral: 2 }, create: { regla: "deuda_cuotas", activa: true, umbral: 2 } });
    await prisma.automatizacion.upsert({ where: { regla: "inasistencias_seguidas" }, update: { activa: true, umbral: 3 }, create: { regla: "inasistencias_seguidas", activa: true, umbral: 3 } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(["deuda_cuotas", "inasistencias_seguidas"], tx));
    await prisma.$disconnect();
    process.exit(0);
  }
})();
