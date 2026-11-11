import { etiquetaDeAutor } from "../../client/src/features/observaciones/autor";
import { ok } from "./_check";

ok("secretaría", etiquetaDeAutor("Lucía Peralta", "secretario"), "Lucía Peralta · Secretaría");
ok("administración", etiquetaDeAutor("Silvana Linares", "admin"), "Silvana Linares · Administración");
ok("docente", etiquetaDeAutor("Martín Sosa", "profesor"), "Martín Sosa · Docente");
