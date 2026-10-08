import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/core/store/sessionStore";
import { authService } from "../authService";
import type { CredencialesInput } from "../types";

export function useLogin() {
  const iniciarSesion = useSessionStore((s) => s.iniciarSesion);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credenciales: CredencialesInput) => authService.login(credenciales),
    onSuccess: (resultado, credenciales) => {
      // Si la cuenta tiene más de un rol y todavía no se eligió ninguno, el
      // backend no manda token — hay que esperar a que el usuario elija.
      if (resultado.requiereSeleccionRol) return;

      // La caché de consultas es del navegador, no del usuario: se vacía para que nadie vea, ni por un
      // instante, datos de la sesión anterior (avisos, listados de otra familia, etc.).
      queryClient.clear();
      iniciarSesion(resultado.token, resultado.usuario, credenciales.recordarme ?? false);
      navigate("/dashboard", { replace: true });
    },
  });
}

export function useAuth() {
  const usuario = useSessionStore((s) => s.usuario);
  const token = useSessionStore((s) => s.token);
  const cerrarSesion = useSessionStore((s) => s.cerrarSesion);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logout = () => {
    // El pedido sale con el token actual (apiClient lo lee antes de que se borre la sesión local).
    void authService.logout().catch(() => {});
    cerrarSesion();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return { usuario, estaAutenticado: !!token, logout };
}
