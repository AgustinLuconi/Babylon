import { Panel } from "@/core/components/ui/panel";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ROL_LABELS } from "@/features/auth/types";
import { CambiarContrasena } from "../components/CambiarContrasena";
import { EmailSinVerificar } from "../components/EmailSinVerificar";
import { SesionesActivas } from "../components/SesionesActivas";

export default function MiCuentaPage() {
  const { usuario } = useAuth();
  if (!usuario) return null;

  const datos: [string, string][] = [
    ["Nombre", usuario.nombre],
    ["Email", usuario.email],
    ["Rol", ROL_LABELS[usuario.rol]],
  ];

  return (
    <div className="space-y-4">
      <EmailSinVerificar />
      <Panel title="Datos">
        <dl className="grid gap-4 p-5 sm:grid-cols-3">
          {datos.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="min-w-0">
              <dt className="eyebrow">{etiqueta}</dt>
              <dd className="mt-1 break-words text-[13.5px]">{valor}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <CambiarContrasena />
      <SesionesActivas />
    </div>
  );
}
