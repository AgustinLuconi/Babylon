import { importarProfesor, cerrarConexion, type ProfesorImportConfig } from "./importar";

// Mapeo confirmado por cruce de nombres reales entre el roster del maestro
// y "Seguimiento de estudiantes 2025/Gustavo/<Nivel - Días Hora>/" — GUSTAVO 1
// y GUSTAVO 3 coinciden 100% por nombre; GUSTAVO 2 se asignó por
// eliminación (es el único curso-horario de Gustavo que queda sin
// asignar, y la cantidad de cursos/horarios coincide 1 a 1).
//
// Importante: el archivo "Cambridge 2025.xlsx" que aparece en la carpeta
// de Gustavo NO le pertenece a ninguno de sus 3 cursos — los nombres de
// ese archivo (Violeta, Emilia, Juan Pedro, Nazareno, Lautaro, Regina,
// Julieta) coinciden 100% con el roster de "HAYDEÉ 2 (Adol. 1417) B1", no
// con ningún curso de Gustavo. La asistencia real de Cambridge se importa
// junto con Haydeé, no acá.
const config: ProfesorImportConfig = {
  profesorNombre: "Gustavo",
  profesorApellido: "Sanchez",
  cursos: [
    {
      sheetName: "GUSTAVO 1 (Pre Adolescentes)  A",
      nombre: "A2 (Pre Adolescentes)",
      nivel: "teens_a2",
      horarios: [
        { diaSemana: "martes", horaInicio: "10:00", horaFin: "11:30" },
        { diaSemana: "jueves", horaInicio: "10:00", horaFin: "11:30" },
      ],
    },
    {
      sheetName: "GUSTAVO 2 (Adultos nuevos) 2024",
      nombre: "A2 (Adultos nuevos)",
      nivel: "adults_b1",
      horarios: [
        { diaSemana: "lunes", horaInicio: "20:00", horaFin: "21:30" },
        { diaSemana: "viernes", horaInicio: "20:00", horaFin: "21:30" },
      ],
    },
    {
      sheetName: "GUSTAVO 3 (Avanzados)",
      nombre: "PreB2 (Avanzados)",
      nivel: "adults_b2",
      horarios: [
        { diaSemana: "martes", horaInicio: "20:00", horaFin: "21:30" },
        { diaSemana: "jueves", horaInicio: "20:00", horaFin: "21:30" },
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
