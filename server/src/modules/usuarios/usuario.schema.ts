import { z } from "zod";
import { emailSchema, passwordNueva, textoRequerido } from "../../core/validacion";
import { datosDeFichaSchema } from "../padres/padre.schema";
import { crearProfesorSchema } from "../profesores/profesor.schema";

const rolSchema = z.enum(["admin", "secretario", "profesor", "padre"]);

// Email sin espacios y en minúsculas antes de validarlo: " Admin@Babylon.test "
// es la misma cuenta que "admin@babylon.test".
const emailNormalizado = z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("Email inválido"));

export const credencialesSchema = z.object({
  email: emailNormalizado,
  password: z.string().min(1, "La contraseña es requerida"),
  // Solo se necesita cuando la cuenta tiene más de un rol habilitado y ya se
  // sabe con cuál se quiere entrar (segundo paso del login).
  rolElegido: rolSchema.optional(),
});

export type CredencialesInput = z.infer<typeof credencialesSchema>;

export const cambiarEstadoUsuarioSchema = z.object({
  estado: z.enum(["activo", "inactivo"]),
});
export type CambiarEstadoUsuarioInput = z.infer<typeof cambiarEstadoUsuarioSchema>;

// Una ficha para la cuenta: una que ya existe (sin cuenta) o una nueva, cuyos datos se cargan ahí mismo. El email de la ficha es
// siempre el de la cuenta, así que la ficha nueva no lo trae.
const fichaDePadre = z.union([z.object({ fichaId: z.string().min(1) }).strict(), z.object({ nueva: datosDeFichaSchema.omit({ email: true }) }).strict()]);
const fichaDeProfesor = z.union([z.object({ fichaId: z.string().min(1) }).strict(), z.object({ nueva: crearProfesorSchema.omit({ email: true }) }).strict()]);
export type FichaDePadreInput = z.infer<typeof fichaDePadre>;
export type FichaDeProfesorInput = z.infer<typeof fichaDeProfesor>;

// Crear una cuenta (solo el administrador). Si el email ya es de una cuenta, la ficha se vincula a esa cuenta (sin tocar su
// contraseña) y se le agrega el rol; si no, se crea la cuenta y la contraseña es obligatoria. `padre` y `profesor` van si y
// solo si el rol está en `roles`; `nombre` hace falta cuando no hay ficha de la que tomarlo.
export const crearCuentaSchema = z
  .object({
    email: emailSchema,
    password: passwordNueva.optional(),
    nombre: textoRequerido("El nombre", 60).optional(),
    roles: z.array(rolSchema).min(1, "Elegí al menos un rol"),
    padre: fichaDePadre.optional(),
    profesor: fichaDeProfesor.optional(),
  })
  .strict()
  .refine((d) => new Set(d.roles).size === d.roles.length, { message: "Hay roles repetidos", path: ["roles"] })
  .refine((d) => d.roles.includes("padre") === (d.padre !== undefined), { message: "Elegí la ficha del responsable", path: ["padre"] })
  .refine((d) => d.roles.includes("profesor") === (d.profesor !== undefined), { message: "Elegí la ficha del profesor", path: ["profesor"] })
  .refine((d) => d.padre !== undefined || d.profesor !== undefined || d.nombre !== undefined, { message: "El nombre es requerido", path: ["nombre"] });
export type CrearCuentaInput = z.infer<typeof crearCuentaSchema>;

export const porEmailSchema = z.object({ email: emailSchema });

// Editar una cuenta (solo el administrador). Todo opcional; `password` vacío no existe (se omite para no tocarla). `roles` es
// la lista final: los roles `padre`/`profesor` que se agregan traen la ficha que se vincula (`padre`/`profesor`).
export const actualizarCuentaSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60).optional(),
    email: emailSchema.optional(),
    password: passwordNueva.optional(),
    roles: z.array(rolSchema).min(1, "Elegí al menos un rol").optional(),
    padre: fichaDePadre.optional(),
    profesor: fichaDeProfesor.optional(),
  })
  .strict()
  .refine((d) => d.roles === undefined || new Set(d.roles).size === d.roles.length, { message: "Hay roles repetidos", path: ["roles"] });
export type ActualizarCuentaInput = z.infer<typeof actualizarCuentaSchema>;
