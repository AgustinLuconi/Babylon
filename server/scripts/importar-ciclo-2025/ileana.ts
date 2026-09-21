import { importarProfesor, cerrarConexion, type ProfesorImportConfig } from "./importar";

// Mapeo confirmado cruzando la hoja "HORARIOS" del maestro (día/hora +
// descriptor de grupo, ej. "Grupo 10/11 años") contra el nombre de cada
// hoja de curso — no hay carpeta de detalle por alumno para Ileana como sí
// había para Silvana, así que la confianza acá es algo menor que en los
// perfiles anteriores (no hay solapamiento de nombres para verificar 1 a
// 1, solo coincidencia de día/hora/descriptor de edad).
const config: ProfesorImportConfig = {
  profesorNombre: "Ileana",
  cursos: [
    {
      sheetName: "ILEANA 1 (Niños) A2",
      nombre: "A2 (Niños, grupo 12-13/2019)",
      nivel: "kids",
      horarios: [
        { diaSemana: "lunes", horaInicio: "09:00", horaFin: "10:30" },
        { diaSemana: "miercoles", horaInicio: "09:00", horaFin: "10:30" },
      ],
    },
    {
      sheetName: " ILEANA 2  (grupo 78 años)  A1",
      nombre: "A1 (Niños 7-8 años)",
      nivel: "kids",
      horarios: [
        { diaSemana: "lunes", horaInicio: "10:30", horaFin: "12:00" },
        { diaSemana: "miercoles", horaInicio: "10:30", horaFin: "12:00" },
      ],
    },
    {
      sheetName: "ILEANA 3 (niños 1011años ) A2",
      nombre: "A2 (Niños 10-11 años)",
      nivel: "kids",
      horarios: [
        { diaSemana: "lunes", horaInicio: "18:30", horaFin: "20:00" },
        { diaSemana: "miercoles", horaInicio: "18:30", horaFin: "20:00" },
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
