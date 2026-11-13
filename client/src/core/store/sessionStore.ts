import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Usuario } from "@/features/auth/types";

const CLAVE = "babylon-session";

// La sesión vive en sessionStorage: es de cada pestaña. Recargar la conserva; cerrar la pestaña la termina; otra pestaña
// (aunque sea del mismo navegador) tiene la suya y puede estar con otra cuenta. No hay "mantener sesión iniciada".
// Una sesión recordada por una versión anterior ya no sirve (el servidor la sigue validando, pero acá no se usa): se descarta.
try {
  localStorage.removeItem(CLAVE);
} catch {
  // sin acceso al almacenamiento: nada que limpiar
}

interface SessionState {
  token: string | null;
  usuario: Usuario | null;
  iniciarSesion: (token: string, usuario: Usuario) => void;
  cerrarSesion: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      iniciarSesion: (token, usuario) => set({ token, usuario }),
      cerrarSesion: () => set({ token: null, usuario: null }),
    }),
    { name: CLAVE, storage: createJSONStorage(() => sessionStorage) },
  ),
);
