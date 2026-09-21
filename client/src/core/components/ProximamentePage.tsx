import { Construction } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";

export function ProximamentePage({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground">{descripcion}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Construction size={32} className="text-muted-foreground" />
          <p className="text-sm font-medium">Próximamente</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Esta sección todavía no está disponible.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
