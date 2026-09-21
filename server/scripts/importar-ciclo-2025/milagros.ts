import { importarProfesor, cerrarConexion, type ProfesorImportConfig } from "./importar";

// Solo hay 2 cursos y 2 archivos de horario en su carpeta — mapeo por
// eliminación (cantidad exacta 1 a 1), reforzado por la hoja "HORARIOS"
// del maestro que muestra "Grupo Taller de niños" en ambos bloques
// horarios (Lun/Mié y Mar/Jue, mismo horario 18:30-20:00 en las dos).
const config: ProfesorImportConfig = {
  profesorNombre: "Milagros",
  cursos: [
    {
      sheetName: "MILAGROS 1 (Taller de niños)",
      nombre: "Taller de niños — Lunes y Miércoles",
      nivel: "kids",
      horarios: [
        { diaSemana: "lunes", horaInicio: "18:30", horaFin: "20:00" },
        { diaSemana: "miercoles", horaInicio: "18:30", horaFin: "20:00" },
      ],
    },
    {
      sheetName: "MILAGROS 2 (Taller de niños 2)",
      nombre: "Taller de niños — Martes y Jueves",
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
