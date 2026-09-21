import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/core/store/sessionStore";
import { authService } from "../authService";
import type { CredencialesInput } from "../types";

export function useLogin() {
  const iniciarSesion = useSessionStore((s) => s.iniciarSesion);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credenciales: CredencialesInput) => authService.login(credenciales),
    onSuccess: (resultado) => {
      // Si la cuenta tiene más de un rol y todavía no se eligió ninguno, el
      // backend no manda token — hay que esperar a que el usuario elija.
      if (resultado.requiereSeleccionRol) return;

      iniciarSesion(resultado.token, resultado.usuario);
      navigate("/dashboard", { replace: true });
    },
  });
}

export function useAuth() {
  const usuario = useSessionStore((s) => s.usuario);
  const token = useSessionStore((s) => s.token);
  const cerrarSesion = useSessionStore((s) => s.cerrarSesion);
  const navigate = useNavigate();

  const logout = () => {
    cerrarSesion();
    navigate("/login", { replace: true });
  };

  return { usuario, estaAutenticado: !!token, logout };
}
