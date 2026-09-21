import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Tema = "light" | "dark";

interface ThemeState {
  tema: Tema;
  alternarTema: () => void;
}

function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute("data-theme", tema);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      tema: "light",
      alternarTema: () => {
        const nuevo: Tema = get().tema === "light" ? "dark" : "light";
        aplicarTema(nuevo);
        set({ tema: nuevo });
      },
    }),
    {
      name: "babylon-theme",
      onRehydrateStorage: () => (state) => {
        if (state) aplicarTema(state.tema);
      },
    },
  ),
);
