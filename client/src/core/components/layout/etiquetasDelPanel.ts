// Los textos del menú y de los títulos del panel de un responsable. Los define el feature de alumnos (`modoDelPanel`, según
// las cursadas de la cuenta) y el armazón los recibe ya resueltos, así que core/ no depende de ningún feature.
export interface EtiquetasDelPanel {
  // Título del grupo del menú lateral.
  grupo: string;
  menu: Record<"resumen" | "notas" | "asistencia" | "cuotas" | "documentacion" | "chat", string>;
  subtituloDocumentacion: string;
}
