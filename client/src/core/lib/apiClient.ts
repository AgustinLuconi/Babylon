import { useSessionStore } from "@/core/store/sessionStore";

export const API_URL = import.meta.env.VITE_API_URL;

// Varios pedidos pueden responder 401 a la vez: se redirige una sola vez.
let redirigiendoAlLogin = false;

// La sesión ya no vale (vencida o cerrada desde otro lado): se borra la sesión guardada sin tocar el estado en memoria
// (si se llamara a cerrarSesion(), ProtectedRoute redirigiría a /login antes y se perdería el aviso) y se recarga en
// el login con el motivo. Varias causas pueden llegar a la vez: se redirige una sola vez.
export function irAlLogin(motivo: string): void {
  if (redirigiendoAlLogin) return;
  redirigiendoAlLogin = true;
  useSessionStore.persist.clearStorage();
  window.location.replace(`/login?motivo=${encodeURIComponent(motivo)}`);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useSessionStore.getState().token;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    // Sesión vencida o invalidada en el server: se vuelve al login (ver irAlLogin).
    // Solo si había token (las pantallas públicas no redirigen) y no es el
    // propio login (credenciales incorrectas también responden 401) ni el cierre de sesión (si ya estaba vencida, da igual).
    // Tampoco si el pedido salió con una sesión que ya no es la actual (se cerró sesión o se entró con otra mientras
    // el pedido estaba en vuelo): ese 401 no habla de la sesión de ahora.
    const esLaSesionActual = useSessionStore.getState().token === token;
    if (res.status === 401 && token && esLaSesionActual && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/logout")) {
      irAlLogin("sesion-vencida");
    }
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Error ${res.status}`, res.status, body.details);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
};
