import { hayNoLeidos, noLeidos, vistoDelUltimo } from "../../client/src/features/chats/visto";
import type { Mensaje } from "../../client/src/features/chats/types";
import { ok } from "./_check";

const m = (rolEmisor: "padre" | "secretario", vistoEn: string | null): Mensaje => ({ id: "x", chatId: "c", emisorId: "e", rolEmisor, texto: "t", fecha: "2026-10-16T10:00:00Z", vistoEn });
ok("conversación vacía: nada", vistoDelUltimo([], false), null);
ok("mi último sin ver: nada", vistoDelUltimo([m("padre", null)], false), null);
ok("mi último visto: la hora", vistoDelUltimo([m("padre", "2026-10-16T10:15:00Z")], false), "2026-10-16T10:15:00Z");
ok("el último es del otro: nada", vistoDelUltimo([m("padre", "2026-10-16T10:15:00Z"), m("secretario", null)], false), null);
ok("vuelvo a escribir y lo ven: en el nuevo", vistoDelUltimo([m("padre", "x"), m("secretario", "y"), m("padre", "z")], false), "z");
ok("del lado del instituto", vistoDelUltimo([m("padre", null), m("secretario", "w")], true), "w");
ok("hay no leídos del otro lado", hayNoLeidos([m("secretario", null)], false), true);
ok("los míos sin ver no cuentan", hayNoLeidos([m("padre", null)], false), false);
ok("cuáles sin ver del otro lado", noLeidos([m("secretario", null), m("padre", null), m("secretario", null), m("secretario", "x")], false).length, 2);
