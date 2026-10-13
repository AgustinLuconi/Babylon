export type ModoAcceso = "invitacion" | "contrasena";

const OPCIONES: { valor: ModoAcceso; titulo: string; descripcion: string }[] = [
  {
    valor: "invitacion",
    titulo: "Enviar invitación por email",
    descripcion: "Recibe un correo para elegir su contraseña. El enlace vale 7 días.",
  },
  {
    valor: "contrasena",
    titulo: "Asignar contraseña ahora",
    descripcion: "Le entregás la contraseña en persona. Su email queda sin verificar hasta que lo confirme desde Mi cuenta.",
  },
];

// "¿Cómo accede?": invitación por email (por defecto) o contraseña asignada en el momento.
export function ModoDeAcceso({
  valor,
  onCambiar,
  nombre = "modo-acceso",
}: {
  valor: ModoAcceso;
  onCambiar: (modo: ModoAcceso) => void;
  nombre?: string;
}) {
  return (
    <fieldset>
      <legend className="label">¿Cómo accede?</legend>
      <div className="space-y-1.5">
        {OPCIONES.map((o) => {
          const elegida = valor === o.valor;
          return (
            <label
              key={o.valor}
              className="flex cursor-pointer items-start gap-2.5 px-3.5 py-3"
              style={{
                border: `1px solid ${elegida ? "var(--brand)" : "var(--border-hex)"}`,
                background: elegida ? "var(--brand-soft)" : "var(--bg)",
                borderRadius: 4,
              }}
            >
              <input
                type="radio"
                name={nombre}
                value={o.valor}
                checked={elegida}
                onChange={() => onCambiar(o.valor)}
                className="mt-0.5"
                style={{ accentColor: "var(--brand)" }}
              />
              <span>
                <span className="block text-[13px] font-medium" style={{ color: elegida ? "var(--brand)" : "var(--text)" }}>
                  {o.titulo}
                </span>
                <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  {o.descripcion}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
