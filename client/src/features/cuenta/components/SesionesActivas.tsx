import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Panel } from "@/core/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/components/ui/table";
import { ApiError } from "@/core/lib/apiClient";
import { formatFechaHora } from "@/core/lib/utils";
import { useCerrarOtrasSesiones } from "../hooks/useCerrarOtrasSesiones";
import { useCerrarSesion } from "../hooks/useCerrarSesion";
import { useSesiones } from "../hooks/useSesiones";

export function SesionesActivas() {
  const { data: sesiones, isLoading, isError } = useSesiones();
  const cerrar = useCerrarSesion();
  const cerrarOtras = useCerrarOtrasSesiones();
  const hayOtras = (sesiones ?? []).some((s) => !s.actual);
  const error = cerrar.error ?? cerrarOtras.error;

  return (
    <Panel
      title="Sesiones activas"
      action={
        hayOtras ? (
          <Button variant="outline" size="sm" disabled={cerrarOtras.isPending} onClick={() => cerrarOtras.mutate()}>
            Cerrar todas las demás
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 p-5">
        <p className="text-[12.5px] text-muted-foreground">
          Son los dispositivos donde tu cuenta tiene la sesión abierta. Si no reconocés alguno, ciérralo y cambiá tu
          contraseña.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            No se pudieron cargar las sesiones. Probá de nuevo en unos minutos.
          </p>
        )}
        {error && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error instanceof ApiError ? error.message : "No se pudo cerrar la sesión"}
          </p>
        )}
        {sesiones && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Último uso (± 5 min)</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sesiones.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.dispositivo}</span>
                        {s.actual && <Badge variant="success">Esta sesión</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="tnum">{s.ip ?? "—"}</TableCell>
                    <TableCell className="tnum whitespace-nowrap">{formatFechaHora(s.creadaEn)}</TableCell>
                    <TableCell className="tnum whitespace-nowrap">{formatFechaHora(s.ultimoUsoEn)}</TableCell>
                    <TableCell className="text-right">
                      {!s.actual && (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Cerrar la sesión de ${s.dispositivo}`}
                          disabled={cerrar.isPending}
                          onClick={() => cerrar.mutate(s.id)}
                        >
                          Cerrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Panel>
  );
}
