// Id de la sesión (claim `sid`) leído del token, sin verificarlo: eso lo hace el servidor. Sirve para coordinar las
// pestañas de una misma sesión. null si el token no tiene el formato esperado.
export function sidDelToken(token: string): string | null {
  try {
    const parte = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!parte) return null;
    const datos = JSON.parse(atob(parte + "=".repeat((4 - (parte.length % 4)) % 4))) as { sid?: unknown };
    return typeof datos.sid === "string" ? datos.sid : null;
  } catch {
    return null;
  }
}
