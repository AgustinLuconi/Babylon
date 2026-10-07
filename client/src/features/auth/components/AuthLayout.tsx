import type { ReactNode } from "react";
import logoTintaBlanca from "@/assets/babylon-logo-tinta-blanca.png";

// Armazón de las pantallas públicas de acceso (login y recuperación de
// contraseña): panel institucional verde a la izquierda y el contenido centrado
// a la derecha; en móvil, una franja verde con el logo arriba.
function BrandPanel() {
  return (
    <div
      className="relative hidden flex-col lg:flex lg:w-[44%] xl:w-[46%]"
      style={{ background: "#0F3D2E" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative px-14 pt-12 xl:px-20">
        <div className="flex items-center gap-3">
          <img src={logoTintaBlanca} alt="Babylon English Institute" style={{ width: 38, height: 38, objectFit: "contain" }} />
          <div className="leading-none">
            <div className="text-white" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em" }}>
              Babylon
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 5 }}>
              English Institute
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-14 xl:px-20">
        <img
          src={logoTintaBlanca}
          alt="Babylon English Institute"
          className="relative mb-12"
          style={{ width: 96, height: 96, objectFit: "contain" }}
        />

        <p className="text-white" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.55, marginBottom: 14 }}>
          Sistema de gestión académica
        </p>
        <h1 className="leading-none text-white" style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.025em" }}>
          Babylon
        </h1>
        <p className="mt-3" style={{ fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.005em" }}>
          English Institute
        </p>

        <div className="mb-8 mt-12" style={{ width: 36, height: 1, background: "rgba(255,255,255,0.35)" }} />

        <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.82)", maxWidth: 360, lineHeight: 1.65, letterSpacing: "-0.005em" }}>
          Una plataforma única para administrativos, profesores y familias. Asistencia, calificaciones y cuotas en un
          solo lugar.
        </p>
      </div>

      <div className="relative flex items-center justify-between px-14 pb-10 xl:px-20">
        <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
          BABYLON ENGLISH INSTITUTE
        </span>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <BrandPanel />

      <div className="flex min-h-screen flex-1 flex-col bg-white lg:min-h-0">
        <div className="px-6 py-6 lg:hidden" style={{ background: "#0F3D2E" }}>
          <div className="flex items-center gap-3">
            <img src={logoTintaBlanca} alt="Babylon English Institute" style={{ width: 34, height: 34, objectFit: "contain" }} />
            <div className="leading-none">
              <div className="text-white" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em" }}>
                Babylon
              </div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>
                English Institute
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>

        <div className="hidden items-center justify-between px-12 pb-8 lg:flex" style={{ fontSize: 11, color: "var(--text-faint)" }}>
          <span>© 2026 Babylon English Institute</span>
        </div>
      </div>
    </div>
  );
}
