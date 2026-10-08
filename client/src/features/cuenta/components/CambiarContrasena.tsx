import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Panel } from "@/core/components/ui/panel";
import { ApiError } from "@/core/lib/apiClient";
import { passwordNueva } from "@/core/lib/validacion";
import { useCambiarContrasena } from "../hooks/useCambiarContrasena";

const schema = z
  .object({
    passwordActual: z.string().min(1, "Ingresá tu contraseña actual"),
    passwordNueva,
    repetir: z.string(),
  })
  .refine((d) => d.passwordNueva === d.repetir, { path: ["repetir"], message: "Las contraseñas no coinciden" })
  .refine((d) => d.passwordNueva !== d.passwordActual, {
    path: ["passwordNueva"],
    message: "La contraseña nueva debe ser distinta de la actual",
  });
type Formulario = z.infer<typeof schema>;

export function CambiarContrasena() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Formulario>({ resolver: zodResolver(schema) });
  const cambiar = useCambiarContrasena();
  const [aviso, setAviso] = useState<string | null>(null);

  const onSubmit = ({ passwordActual, passwordNueva }: Formulario) => {
    setAviso(null);
    cambiar.mutate(
      { passwordActual, passwordNueva },
      {
        onSuccess: () => {
          reset();
          setAviso("Contraseña actualizada. Se cerraron tus otras sesiones.");
        },
      },
    );
  };

  const campo = (id: "passwordActual" | "passwordNueva" | "repetir", etiqueta: string, autoComplete: string) => (
    <div>
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        {...register(id)}
      />
      {errors[id] && (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-destructive">
          {errors[id]?.message}
        </p>
      )}
    </div>
  );

  return (
    <Panel title="Cambiar contraseña">
      <form onSubmit={handleSubmit(onSubmit, () => setAviso(null))} className="max-w-md space-y-4 p-5" noValidate>
        {campo("passwordActual", "Contraseña actual", "current-password")}
        {campo("passwordNueva", "Contraseña nueva", "new-password")}
        {campo("repetir", "Repetir contraseña nueva", "new-password")}
        {cambiar.isError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {cambiar.error instanceof ApiError ? cambiar.error.message : "No se pudo cambiar la contraseña"}
          </p>
        )}
        {aviso && (
          <p role="status" className="text-[12.5px]" style={{ color: "var(--success)" }}>
            {aviso}
          </p>
        )}
        <Button type="submit" disabled={cambiar.isPending}>
          {cambiar.isPending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </Panel>
  );
}
