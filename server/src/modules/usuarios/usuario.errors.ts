import { ValidationError } from "../../core/errors";

// "La contraseña actual no es correcta" al cambiarla desde Mi cuenta. Sigue siendo un 400 como cualquier ValidationError;
// existe como clase propia para que el límite de intentos (core/middlewares/limitesDePedidos.ts) pueda contar solo estos
// fallos —alguien adivinando la contraseña— y no los errores de validación de la nueva contraseña.
export class PasswordActualIncorrectaError extends ValidationError {}
