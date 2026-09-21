import { importarProfesor, cerrarConexion, type ProfesorImportConfig } from "./importar";

// Mapeo confirmado por cruce de nombres reales entre dos fuentes
// independientes (roster del maestro "Ciclo 2025_.xlsx" vs. nombres de
// archivo en "Seguimiento de estudiantes 2025/Silvana/Detalle de
// estudiantes/") — no es una suposición por texto descriptivo, los 7
// grupos coinciden 100% en la nómina de alumnos entre ambas fuentes.
const config: ProfesorImportConfig = {
  profesorNombre: "Silvana",
  profesorApellido: "Linares",
  cursos: [
    {
      sheetName: "SILVANA 1 (NIÑOS 1011 años) Pre",
      nombre: "PreA1 (Niños 10-11 años)",
      nivel: "kids",
      horarios: [
        { diaSemana: "lunes", horaInicio: "10:30", horaFin: "12:00" },
        { diaSemana: "jueves", horaInicio: "09:00", horaFin: "10:30" },
      ],
    },
    {
      sheetName: "SILVANA 2 (Pre Adolescentes) A2",
      nombre: "A2 (Pre Adolescentes)",
      nivel: "teens_a2",
      horarios: [
        { diaSemana: "lunes", horaInicio: "16:30", horaFin: "18:00" },
        { diaSemana: "miercoles", horaInicio: "16:30", horaFin: "18:00" },
      ],
    },
    {
      sheetName: "SILVANA 3 (NIÑOS 10 años) A1+",
      nombre: "A1+ (Niños 10 años)",
      nivel: "kids",
      horarios: [
        { diaSemana: "martes", horaInicio: "09:00", horaFin: "10:30" },
        { diaSemana: "viernes", horaInicio: "09:00", horaFin: "10:30" },
      ],
    },
    {
      sheetName: "SILVANA 4 (NIÑOS 7 años) PreA1",
      nombre: "PreA1 (Niños 7 años)",
      nivel: "kids",
      horarios: [
        { diaSemana: "martes", horaInicio: "10:30", horaFin: "12:00" },
        { diaSemana: "viernes", horaInicio: "10:30", horaFin: "12:00" },
      ],
    },
    {
      sheetName: "SILVANA 5 (Adolescentes) A2",
      nombre: "A2 (Adolescentes) — Lunes y Miércoles 15:00",
      nivel: "teens_a2",
      horarios: [
        { diaSemana: "lunes", horaInicio: "15:00", horaFin: "16:30" },
        { diaSemana: "miercoles", horaInicio: "15:00", horaFin: "16:30" },
      ],
    },
    {
      sheetName: "SILVANA 6 (Adolescentes) A2",
      nombre: "A2 (Adolescentes) — Martes y Jueves 16:50",
      nivel: "teens_a2",
      horarios: [
        { diaSemana: "martes", horaInicio: "16:50", horaFin: "18:20" },
        { diaSemana: "jueves", horaInicio: "16:50", horaFin: "18:20" },
      ],
    },
    {
      sheetName: "SILVANA 7 (89años)  A1",
      nombre: "A1 (8-9 años)",
      nivel: "kids",
      horarios: [
        { diaSemana: "martes", horaInicio: "18:30", horaFin: "20:00" },
        { diaSemana: "jueves", horaInicio: "18:30", horaFin: "20:00" },
      ],
    },
  ],
};

importarProfesor(config)
  .then((resumen) => {
    console.log(JSON.stringify(resumen, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarConexion());
