import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Usuario } from "@/features/auth/types";

const CLAVE = "babylon-session";

// Con "Mantener sesión iniciada" la sesión vive en localStorage (sobrevive al
// cierre del navegador); sin él, en sessionStorage (se borra al cerrarlo). Al
// recargar, la sesión está en el que corresponda a como se inició.
let recordarSesion = localStorage.getItem(CLAVE) !== null;

const almacenamientoSesion: StateStorage = {
  getItem: (nombre) => localStorage.getItem(nombre) ?? sessionStorage.getItem(nombre),
  setItem: (nombre, valor) => {
    (recordarSesion ? localStorage : sessionStorage).setItem(nombre, valor);
    (recordarSesion ? sessionStorage : localStorage).removeItem(nombre);
  },
  removeItem: (nombre) => {
    localStorage.removeItem(nombre);
    sessionStorage.removeItem(nombre);
  },
};

interface SessionState {
  token: string | null;
  usuario: Usuario | null;
  iniciarSesion: (token: string, usuario: Usuario, recordar: boolean) => void;
  cerrarSesion: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      iniciarSesion: (token, usuario, recordar) => {
        recordarSesion = recordar;
        set({ token, usuario });
      },
      cerrarSesion: () => set({ token: null, usuario: null }),
    }),
    { name: CLAVE, storage: createJSONStorage(() => almacenamientoSesion) },
  ),
);
