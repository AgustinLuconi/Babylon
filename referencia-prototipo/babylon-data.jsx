// babylon-data.jsx — Data layer for Babylon English Institute prototype

// ── Brand tokens (mirror babylon-tokens.css for JS consumers) ───────────
const BRAND          = '#064E3B';   // Deep English green — institutional
const BRAND_HOVER    = '#075E47';
const BRAND_PRESSED  = '#053D2E';
const BRAND_SOFT     = '#ECFDF5';
const BRAND_BORDER   = '#D1E4DA';
const BRAND_DOT      = '#047857';

// Legacy aliases (kept so existing call-sites compile if any slipped through)
const PRIMARY        = BRAND;
const PRIMARY_DARK   = BRAND_HOVER;
const PRIMARY_LIGHT  = BRAND_SOFT;
const SIDEBAR_BG     = '#FFFFFF';
const ACCENT         = BRAND;

// Neutral scale (cool zinc)
const TEXT           = '#09090B';
const TEXT_MUTED     = '#52525B';
const TEXT_SUBTLE    = '#71717A';
const TEXT_FAINT     = '#A1A1AA';
const BORDER         = '#E4E4E7';
const BORDER_STRONG  = '#D4D4D8';
const BG_SUBTLE      = '#FAFAFA';
const BG_MUTED       = '#F4F4F5';

// Status (desaturated, professional)
const STATUS = {
  paid:    { fg: '#0F3D2E', bg: '#F0F4F2', dot: '#1B7A4F' },
  pending: { fg: '#854D0E', bg: '#FBF6EA', dot: '#B45309' },
  overdue: { fg: '#991B1B', bg: '#FBEEEE', dot: '#B91C1C' },
  present: { fg: '#0F3D2E', bg: '#F0F4F2', dot: '#1B7A4F' },
  late:    { fg: '#854D0E', bg: '#FBF6EA', dot: '#B45309' },
  absent:  { fg: '#991B1B', bg: '#FBEEEE', dot: '#B91C1C' },
};

// Nav with section groups (Linear/Mercury-style)
const NAV_ADMIN = [
  { group: 'General' },
  { id: 'dashboard',  label: 'Resumen',       icon: 'LayoutDashboard' },
  { group: 'Académico' },
  { id: 'students',   label: 'Alumnos',       icon: 'Users' },
  { id: 'professors', label: 'Profesores',    icon: 'GraduationCap' },
  { id: 'courses',    label: 'Cursos',        icon: 'BookOpen' },
  { group: 'Finanzas' },
  { id: 'payments',   label: 'Cuotas',        icon: 'Receipt' },
  { id: 'reports',    label: 'Reportes',      icon: 'BarChart3' },
  { group: 'Comunicación' },
  { id: 'chat',       label: 'Chats',         icon: 'MessageCircle', badge: () => unreadChatsForStaff() },
  { group: 'Sistema' },
  { id: 'users',      label: 'Usuarios',      icon: 'KeyRound' },
  { id: 'settings',   label: 'Configuración', icon: 'Settings' },
];
const NAV_TEACHER = [
  { group: 'Docencia' },
  { id: 'teacher-home', label: 'Mis cursos',    icon: 'BookOpen' },
  { id: 'attendance',   label: 'Asistencia',    icon: 'ClipboardCheck' },
  { id: 'grades',       label: 'Calificaciones',icon: 'FileText' },
  { id: 'observations', label: 'Observaciones', icon: 'MessageSquare' },
];
const NAV_PARENT = [
  { group: 'Mi familia' },
  { id: 'parent-home',       label: 'Resumen',        icon: 'Home' },
  { id: 'parent-grades',     label: 'Calificaciones', icon: 'FileText' },
  { id: 'parent-attendance', label: 'Asistencia',     icon: 'CalendarCheck' },
  { id: 'parent-fees',       label: 'Cuotas',         icon: 'Receipt' },
  { id: 'parent-docs',       label: 'Documentación',  icon: 'FolderCheck' },
  { id: 'parent-chat',       label: 'Mensajes',       icon: 'MessageCircle', badge: () => unreadChatsForParent(USER_PROFILES.parent.name) },
];
const NAV_SECRETARY = [
  { group: 'General' },
  { id: 'dashboard', label: 'Resumen', icon: 'LayoutDashboard' },
  { group: 'Gestión' },
  { id: 'students',  label: 'Alumnos', icon: 'Users' },
  { id: 'payments',  label: 'Cuotas',  icon: 'Receipt' },
  { id: 'chat',      label: 'Chats',   icon: 'MessageCircle', badge: () => unreadChatsForStaff() },
];

const COURSES = [
  { id:1, name:'Kids Inicial',   teacher:'Ana Laura Vega',   tid:5, schedule:'Lun/Mié 16:00', level:'Kids',      count:18, room:'Aula 1' },
  { id:2, name:'Kids Básico',    teacher:'Ana Laura Vega',   tid:5, schedule:'Mar/Jue 17:00', level:'Kids',      count:15, room:'Aula 1' },
  { id:3, name:'Teens A1',       teacher:'Carlos Andrade',   tid:2, schedule:'Lun/Mié 18:00', level:'Teens',     count:22, room:'Aula 2' },
  { id:4, name:'Teens A2',       teacher:'Carlos Andrade',   tid:2, schedule:'Mar/Jue 18:30', level:'Teens',     count:19, room:'Aula 2' },
  { id:5, name:'Adults B1',      teacher:'María Belén Ríos', tid:1, schedule:'Lun/Mié 20:00', level:'Adults',    count:24, room:'Aula 3' },
  { id:6, name:'Adults B2',      teacher:'Diego Herrera',    tid:4, schedule:'Mar/Jue 19:30', level:'Adults',    count:20, room:'Aula 3' },
  { id:7, name:'Cambridge Prep', teacher:'Diego Herrera',    tid:4, schedule:'Sáb 10:00',     level:'Cambridge', count:12, room:'Aula 2' },
];

const STUDENTS = [
  { id:1,  first:'Valentina', last:'Rodríguez', dni:'45.123.456', cid:4, parent:'Roberto Rodríguez',  phone:'2622-456789', email:'r.rodriguez@gmail.com', feeStatus:'paid',    sib:false },
  { id:2,  first:'Tomás',     last:'González',  dni:'46.234.567', cid:5, parent:'Graciela González',  phone:'2622-567890', email:'g.gonzalez@gmail.com',  feeStatus:'overdue', sib:false },
  { id:3,  first:'Sofía',     last:'Martínez',  dni:'47.345.678', cid:1, parent:'Analía Martínez',    phone:'2622-678901', email:'a.martinez@gmail.com',  feeStatus:'pending', sib:true  },
  { id:4,  first:'Lucas',     last:'Fernández', dni:'44.456.789', cid:3, parent:'Horacio Fernández',  phone:'2622-789012', email:'h.fernandez@gmail.com', feeStatus:'paid',    sib:false },
  { id:5,  first:'Camila',    last:'López',     dni:'48.567.890', cid:6, parent:'Marcela López',      phone:'2622-890123', email:'m.lopez@gmail.com',     feeStatus:'paid',    sib:false },
  { id:6,  first:'Ignacio',   last:'Díaz',      dni:'45.678.901', cid:7, parent:'Cristina Díaz',      phone:'2622-901234', email:'c.diaz@gmail.com',      feeStatus:'overdue', sib:false },
  { id:7,  first:'Florencia', last:'Martínez',  dni:'46.789.012', cid:2, parent:'Analía Martínez',    phone:'2622-678901', email:'a.martinez@gmail.com',  feeStatus:'pending', sib:true  },
  { id:8,  first:'Matías',    last:'Pérez',     dni:'47.890.123', cid:5, parent:'Jorge Pérez',        phone:'2622-012345', email:'j.perez@gmail.com',     feeStatus:'paid',    sib:false },
  { id:9,  first:'Luciana',   last:'Sánchez',   dni:'44.901.234', cid:3, parent:'Patricia Sánchez',   phone:'2622-123456', email:'p.sanchez@gmail.com',   feeStatus:'overdue', sib:false },
  { id:10, first:'Agustín',   last:'Morales',   dni:'48.012.345', cid:4, parent:'Daniela Morales',    phone:'2622-234567', email:'d.morales@gmail.com',   feeStatus:'paid',    sib:false },
  { id:11, first:'Bianca',    last:'Torres',    dni:'45.123.890', cid:6, parent:'Fabiana Torres',     phone:'2622-345678', email:'f.torres@gmail.com',    feeStatus:'paid',    sib:false },
  { id:12, first:'Nicolás',   last:'Herrera',   dni:'46.234.901', cid:7, parent:'Eduardo Herrera',    phone:'2622-456890', email:'e.herrera@gmail.com',   feeStatus:'pending', sib:false },
];

const FEES = [
  { id:1,  sid:2,  month:'Abril 2026',  amount:35000, due:'10/04/2026', status:'overdue', paid:null,         method:null },
  { id:2,  sid:2,  month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'overdue', paid:null,         method:null },
  { id:3,  sid:6,  month:'Abril 2026',  amount:35000, due:'10/04/2026', status:'overdue', paid:null,         method:null },
  { id:4,  sid:6,  month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'overdue', paid:null,         method:null },
  { id:5,  sid:9,  month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'overdue', paid:null,         method:null },
  { id:6,  sid:3,  month:'Mayo 2026',   amount:31500, due:'10/05/2026', status:'pending', paid:null,         method:null },
  { id:7,  sid:7,  month:'Mayo 2026',   amount:31500, due:'10/05/2026', status:'pending', paid:null,         method:null },
  { id:8,  sid:12, month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'pending', paid:null,         method:null },
  { id:9,  sid:1,  month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'paid',    paid:'07/05/2026', method:'Transferencia' },
  { id:10, sid:4,  month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'paid',    paid:'05/05/2026', method:'Efectivo' },
  { id:11, sid:5,  month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'paid',    paid:'02/05/2026', method:'Mercado Pago' },
  { id:12, sid:8,  month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'paid',    paid:'08/05/2026', method:'Transferencia' },
  { id:13, sid:10, month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'paid',    paid:'06/05/2026', method:'Efectivo' },
  { id:14, sid:11, month:'Mayo 2026',   amount:35000, due:'10/05/2026', status:'paid',    paid:'04/05/2026', method:'Mercado Pago' },
];

// Students for Teacher's Teens A1 class attendance
const CLASS_STUDENTS = [
  { id:4,  name:'Lucas Fernández',   absences:0 },
  { id:9,  name:'Luciana Sánchez',   absences:3 },
  { id:13, name:'Valentina Ibáñez',  absences:0 },
  { id:14, name:'Rodrigo Bustos',    absences:1 },
  { id:15, name:'Marina Acosta',     absences:0 },
  { id:16, name:'Ezequiel Romero',   absences:0 },
  { id:17, name:'Brenda Castillo',   absences:2 },
  { id:18, name:'Facundo Vidal',     absences:0 },
  { id:19, name:'Micaela Ramos',     absences:0 },
  { id:20, name:'Sebastián Torres',  absences:0 },
];

// Grades for Teacher's Teens A2 class
const CLASS_GRADES = [
  { sid:1,  name:'Valentina Rodríguez', scores:{ 'Reading Comprehension':8.5, 'Listening Test':7.0, 'Oral Presentation':9.0, 'Grammar Midterm':null } },
  { sid:10, name:'Agustín Morales',     scores:{ 'Reading Comprehension':7.0, 'Listening Test':8.0, 'Oral Presentation':7.5, 'Grammar Midterm':null } },
  { sid:21, name:'Romina Cabrera',      scores:{ 'Reading Comprehension':9.0, 'Listening Test':8.5, 'Oral Presentation':8.0, 'Grammar Midterm':null } },
  { sid:22, name:'Hernán Gutiérrez',    scores:{ 'Reading Comprehension':6.5, 'Listening Test':7.0, 'Oral Presentation':6.0, 'Grammar Midterm':null } },
  { sid:23, name:'Soledad Navarro',     scores:{ 'Reading Comprehension':8.0, 'Listening Test':9.0, 'Oral Presentation':8.5, 'Grammar Midterm':null } },
];

const EVALUATIONS = [
  { name:'Reading Comprehension', type:'Examen',           date:'15/03/2026', published:true },
  { name:'Listening Test',        type:'Examen',           date:'29/03/2026', published:true },
  { name:'Oral Presentation',     type:'Oral',             date:'12/04/2026', published:true },
  { name:'Grammar Midterm',       type:'Examen',           date:'10/05/2026', published:false },
];

// Parent view: Analía Martínez — 2 kids
const PARENT_KIDS = [
  {
    id:3, name:'Sofía Martínez', age:8, course:'Kids Inicial', teacher:'Ana Laura Vega',
    attPct:85, avgGrade:8.5,
    cal:[
      {d:5,s:'P'},{d:7,s:'A'},{d:8,s:'P'},{d:12,s:'T'},{d:14,s:'P'},
      {d:15,s:'P'},{d:19,s:'P'},{d:21,s:'P'},{d:22,s:'A'},{d:26,s:'P'},
      {d:28,s:'P'},{d:29,s:'P'},
    ],
    grades:[
      { name:'Colors & Numbers',  type:'TP',    date:'20/03/2026', score:9.0, obs:'¡Excelente trabajo!' },
      { name:'Animals Vocabulary',type:'Oral',  date:'10/04/2026', score:8.0, obs:'Muy participativa.' },
      { name:'Songs & Rhymes',    type:'TP',    date:'02/05/2026', score:8.5, obs:null },
    ],
    fees:[
      { month:'Marzo 2026', amount:35000, due:'10/03/2026', status:'paid',    paid:'08/03/2026' },
      { month:'Abril 2026', amount:35000, due:'10/04/2026', status:'paid',    paid:'09/04/2026' },
      { month:'Mayo 2026',  amount:35000, due:'10/05/2026', status:'pending', paid:null },
    ],
    obs:[
      { date:'15/04/2026', teacher:'Ana Laura Vega', text:'Sofía muestra gran entusiasmo. Participa activamente y memoriza vocabulario con facilidad. Recomiendo reforzar el vocabulario de números en casa.' },
    ],
  },
  {
    id:7, name:'Florencia Martínez', age:12, course:'Kids Básico', teacher:'Ana Laura Vega',
    attPct:92, avgGrade:7.8,
    cal:[
      {d:5,s:'P'},{d:7,s:'P'},{d:8,s:'T'},{d:12,s:'P'},{d:14,s:'P'},
      {d:15,s:'A'},{d:19,s:'P'},{d:21,s:'P'},{d:26,s:'P'},{d:28,s:'P'},{d:29,s:'P'},
    ],
    grades:[
      { name:'Unit 1 Test',      type:'Examen', date:'22/03/2026', score:7.5, obs:null },
      { name:'Speaking Activity',type:'Oral',   date:'12/04/2026', score:8.0, obs:'Buen desempeño oral.' },
    ],
    fees:[
      { month:'Marzo 2026', amount:31500, due:'10/03/2026', status:'paid',    paid:'08/03/2026' },
      { month:'Abril 2026', amount:31500, due:'10/04/2026', status:'paid',    paid:'09/04/2026' },
      { month:'Mayo 2026',  amount:31500, due:'10/05/2026', status:'pending', paid:null },
    ],
    obs:[],
  },
];

const USER_PROFILES = {
  admin:     { name:'Silvana Linares',  initials:'SL', role:'Administradora' },
  secretary: { name:'Lucía Peralta',    initials:'LP', role:'Secretaria' },
  teacher:   { name:'Carlos Andrade',   initials:'CA', role:'Profesor' },
  parent:    { name:'Analía Martínez',  initials:'AM', role:'Madre/Tutora' },
};

// Upcoming evaluations
const UPCOMING_EVALS = [
  { course:'Adults B1',      teacher:'María Belén Ríos',  type:'Examen Parcial',    date:'12/05/2026' },
  { course:'Cambridge Prep', teacher:'Diego Herrera',      type:'Speaking Test',     date:'14/05/2026' },
  { course:'Teens A1',       teacher:'Carlos Andrade',     type:'Grammar Test',      date:'15/05/2026' },
  { course:'Kids Básico',    teacher:'Ana Laura Vega',     type:'Trabajo Práctico',  date:'16/05/2026' },
  { course:'Adults B2',      teacher:'Diego Herrera',      type:'Writing Task',      date:'19/05/2026' },
];

// Recent activity feed — type drives styling, no per-row color
const RECENT_ACTIVITY = [
  { type:'attendance', actor:'Carlos Andrade',     verb:'registró asistencia de',  target:'Teens A1',          time:'hace 5 min' },
  { type:'enrollment', actor:'Sistema',            verb:'inscribió a',              target:'Mateo Rodríguez en Kids Inicial', time:'hace 23 min' },
  { type:'payment',    actor:'Silvana Linares',    verb:'registró pago de',         target:'Valentina Rodríguez · Mayo 2026', time:'hace 1 hora' },
  { type:'grades',     actor:'Diego Herrera',      verb:'publicó notas de',         target:'Cambridge Prep',     time:'hace 2 hs' },
  { type:'observation',actor:'María Belén Ríos',     verb:'envió observación sobre',  target:'Tomás González',      time:'hace 3 hs' },
];

// Extended overdue fees for dashboard (most urgent first)
const OVERDUE_DASHBOARD = [
  { id:20, sid:6,  name:'Ignacio Díaz',     course:'Cambridge Prep', month:'Marzo 2026', days:59, amount:35000 },
  { id:21, sid:2,  name:'Tomás González',   course:'Adults B1',      month:'Marzo 2026', days:59, amount:35000 },
  { id:3,  sid:6,  name:'Ignacio Díaz',     course:'Cambridge Prep', month:'Abril 2026', days:29, amount:35000 },
  { id:1,  sid:2,  name:'Tomás González',   course:'Adults B1',      month:'Abril 2026', days:29, amount:35000 },
  { id:5,  sid:9,  name:'Luciana Sánchez',  course:'Teens A1',       month:'Abril 2026', days:29, amount:35000 },
];

// System users
const SYSTEM_USERS = [
  { id:1,  name:'Silvana Linares',   email:'silvana@babylon.edu',     role:'admin',     status:'active',   created:'01/03/2026' },
  { id:9,  name:'Lucía Peralta',     email:'lucia@babylon.edu',       role:'secretary', status:'active',   created:'05/03/2026' },
  { id:2,  name:'Gustavo Sánchez',   email:'g.sanchez@babylon.edu',   role:'teacher',   status:'active',   created:'01/03/2026' },
  { id:3,  name:'María Belén Ríos',  email:'mb.rios@babylon.edu',     role:'teacher',   status:'active',   created:'01/03/2026' },
  { id:4,  name:'Carlos Andrade',    email:'c.andrade@babylon.edu',   role:'teacher',   status:'active',   created:'01/03/2026' },
  { id:5,  name:'Diego Herrera',     email:'d.herrera@babylon.edu',   role:'teacher',   status:'active',   created:'15/03/2026' },
  { id:6,  name:'Ana Laura Vega',    email:'a.vega@babylon.edu',      role:'teacher',   status:'active',   created:'15/03/2026' },
  { id:7,  name:'Roberto Rodríguez', email:'r.rodriguez@gmail.com',   role:'parent',    status:'active',   created:'10/03/2026' },
  { id:8,  name:'Analía Martínez',   email:'a.martinez@gmail.com',    role:'parent',    status:'active',   created:'10/03/2026' },
  { id:10, name:'Ignacio Flores',    email:'i.flores@gmail.com',      role:'parent',    status:'inactive', created:'20/03/2026' },
];

// Role labels — neutral, mono palette
const ROLE_LABELS = {
  admin:     { label:'Administrador', color:'#09090B', bg:'#F4F4F5', dot:'#0F3D2E' },
  secretary: { label:'Secretario',    color:'#09090B', bg:'#F4F4F5', dot:'#71717A' },
  teacher:   { label:'Profesor',      color:'#0F3D2E', bg:'#F0F4F2', dot:'#1B7A4F' },
  parent:    { label:'Padre/Tutor',   color:'#52525B', bg:'#FAFAFA', dot:'#A1A1AA' },
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGAJO — Extended data model (student detail, documents, schedules, helpers)
// ═══════════════════════════════════════════════════════════════════════════

// Alumno — campos extendidos (foto, obs_medicas, direccion, fecha_nac, etc.)
const STUDENT_EXT = {
  1:  { birth:'14/03/2011', addr:'Av. Illia 234, San Luis',    paddr:'Av. Illia 234, San Luis',    med:null,                         enrolled:'02/03/2023', vinculo:'padre', pdni:'28.456.123', sEmail:'valen.rodriguez@gmail.com', sPhone:'2664-456789' },
  2:  { birth:'22/07/2010', addr:'Pringles 1450, San Luis',    paddr:'Pringles 1450, San Luis',    med:'Asma leve — usa inhalador',  enrolled:'05/03/2022', vinculo:'madre', pdni:'30.112.788', sEmail:null,                        sPhone:'2664-567890' },
  3:  { birth:'09/05/2017', addr:'Junín 880, San Luis',        paddr:'Junín 880, San Luis',        med:'Alergia a la penicilina',    enrolled:'01/03/2024', vinculo:'madre', pdni:'29.876.540', sEmail:null,                        sPhone:'2664-678901' },
  4:  { birth:'30/11/2010', addr:'Lavalle 512, San Luis',      paddr:'Lavalle 512, San Luis',      med:null,                         enrolled:'04/03/2021', vinculo:'padre', pdni:'27.334.901', sEmail:'lucas.fernandez@gmail.com', sPhone:'2664-789012' },
  5:  { birth:'18/02/2004', addr:'Colón 1622, San Luis',       paddr:'Colón 1622, San Luis',       med:null,                         enrolled:'03/03/2025', vinculo:'madre', pdni:'31.220.455', sEmail:'cami.lopez@gmail.com',      sPhone:'2664-890123' },
  6:  { birth:'25/08/2012', addr:'Rivadavia 300, San Luis',    paddr:'Rivadavia 300, San Luis',    med:null,                         enrolled:'06/03/2023', vinculo:'madre', pdni:'30.998.117', sEmail:null,                        sPhone:'2664-901234' },
  7:  { birth:'12/01/2014', addr:'Junín 880, San Luis',        paddr:'Junín 880, San Luis',        med:null,                         enrolled:'01/03/2024', vinculo:'madre', pdni:'29.876.540', sEmail:null,                        sPhone:'2664-678901' },
  8:  { birth:'07/09/2003', addr:'Belgrano 745, San Luis',     paddr:'Belgrano 745, San Luis',     med:'Diabetes tipo 1',            enrolled:'02/03/2025', vinculo:'padre', pdni:'26.541.880', sEmail:'matias.perez@gmail.com',   sPhone:'2664-012345' },
  9:  { birth:'03/06/2011', addr:'San Martín 1290, San Luis',  paddr:'San Martín 1290, San Luis',  med:null,                         enrolled:'05/03/2022', vinculo:'madre', pdni:'30.667.342', sEmail:null,                        sPhone:'2664-123456' },
  10: { birth:'29/04/2005', addr:'Maipú 410, San Luis',        paddr:'Belgrano 90, San Luis',       med:null,                         enrolled:'03/03/2024', vinculo:'tutor', pdni:'25.998.701', sEmail:'agus.morales@gmail.com',   sPhone:'2664-234567' },
  11: { birth:'16/10/2002', addr:'Chacabuco 980, San Luis',    paddr:'Chacabuco 980, San Luis',    med:null,                         enrolled:'04/03/2025', vinculo:'madre', pdni:'31.445.220', sEmail:'bianca.torres@gmail.com',  sPhone:'2664-345678' },
  12: { birth:'21/12/2013', addr:'Ayacucho 165, San Luis',     paddr:'Ayacucho 165, San Luis',     med:'Alergia estacional',         enrolled:'06/03/2023', vinculo:'padre', pdni:'28.770.654', sEmail:null,                        sPhone:'2664-456890' },
};

// Date helpers (relative to ciclo lectivo 2026)
const _today2026 = new Date(2026, 5, 21);
const _parseDMY = (str) => { const [d,m,y] = str.split('/').map(Number); return new Date(y, m-1, d); };
const _yearsSince = (dmy) => {
  const dt = _parseDMY(dmy); let a = _today2026.getFullYear() - dt.getFullYear();
  const mm = _today2026.getMonth() - dt.getMonth();
  if (mm < 0 || (mm === 0 && _today2026.getDate() < dt.getDate())) a--;
  return a;
};
const VINCULO_LABEL = { padre:'Padre', madre:'Madre', tutor:'Tutor/a' };

// Merge a student with its extended fields + computed age / antigüedad / parent split
const studentFull = (s) => {
  const e = STUDENT_EXT[s.id] || {};
  const parts = (s.parent || '').trim().split(' ');
  return {
    ...s, ...e,
    parentFirst: parts.slice(0, -1).join(' ') || s.parent,
    parentLast:  parts.slice(-1)[0] || '',
    age:        e.birth ? _yearsSince(e.birth) : null,
    antiguedad: e.enrolled ? _yearsSince(e.enrolled) : null,
  };
};
// Hermanos: mismo padre/tutor, distinto alumno (relación uno-a-muchos)
const siblingsOf = (s) => STUDENTS.filter(o => o.id !== s.id && o.parent === s.parent);

// Documento — entidad nueva (formulario / DNI / autorización de imagen)
// La autorización de imagen es DIGITAL: el padre la acepta con un click
// (autorizado_por, fecha_autorizacion, tipo_autorizacion digital/manual).
const DOC_TYPES = [
  { key:'formulario_inscripcion', label:'Formulario de inscripción' },
  { key:'copia_dni',              label:'Copia de DNI' },
  { key:'autorizacion_imagen',    label:'Autorización de imagen' },
];

// Overrides mutables (el prototipo muta estado: padre autoriza, secretario revoca)
const DOC_OVERRIDES = {};
const setDocOverride = (sid, tipo, patch) => {
  DOC_OVERRIDES[sid] = DOC_OVERRIDES[sid] || {};
  DOC_OVERRIDES[sid][tipo] = { ...(DOC_OVERRIDES[sid][tipo] || {}), ...patch };
};

const docsFor = (sid) => DOC_TYPES.map((d, i) => {
  const isAuth = d.key === 'autorizacion_imagen';
  const student = STUDENTS.find(s => s.id === sid);
  let doc;
  if (isAuth) {
    // Autorización digital: algunos padres ya aceptaron, otros pendientes
    const autorizada = sid % 3 !== 0;
    doc = autorizada
      ? { id: sid*10+i, alumno_id: sid, tipo: d.key, label: d.label,
          estado: 'autorizada',
          autorizado_por: student ? student.parent : 'Tutor',
          fecha_autorizacion: `${String((sid % 9) + 1).padStart(2,'0')}/03/2026`,
          hora_autorizacion: `${18 + (sid % 4)}:${String((sid * 7) % 60).padStart(2,'0')}`,
          tipo_autorizacion: sid % 4 === 1 ? 'manual' : 'digital' }
      : { id: sid*10+i, alumno_id: sid, tipo: d.key, label: d.label,
          estado: 'pendiente', autorizado_por: null, fecha_autorizacion: null,
          hora_autorizacion: null, tipo_autorizacion: null };
  } else {
    const pendiente = ((sid + i) % 5 === 0);
    doc = {
      id: sid * 10 + i, alumno_id: sid, tipo: d.key, label: d.label,
      estado: pendiente ? 'pendiente' : 'cargado',
      url_archivo: pendiente ? null : `/docs/${sid}_${d.key}.pdf`,
      fecha_carga: pendiente ? null : `${String(((sid + i) % 9) + 1).padStart(2,'0')}/03/2026`,
    };
  }
  const ov = (DOC_OVERRIDES[sid] || {})[d.key];
  return ov ? { ...doc, ...ov } : doc;
});

// ¿El alumno tiene documentación incompleta?
const hasPendingDocs = (sid) => docsFor(sid).some(d => d.estado === 'pendiente');

// Horario — entidad nueva (un curso puede tener varios horarios)
const SCHEDULES = [
  { id:1,  curso_id:1, dia:'Lunes',     ini:'16:00', fin:'17:30' },
  { id:2,  curso_id:1, dia:'Miércoles', ini:'16:00', fin:'17:30' },
  { id:3,  curso_id:2, dia:'Martes',    ini:'17:00', fin:'18:30' },
  { id:4,  curso_id:2, dia:'Jueves',    ini:'17:00', fin:'18:30' },
  { id:5,  curso_id:3, dia:'Lunes',     ini:'18:00', fin:'19:30' },
  { id:6,  curso_id:3, dia:'Miércoles', ini:'18:00', fin:'19:30' },
  { id:7,  curso_id:4, dia:'Martes',    ini:'18:30', fin:'20:00' },
  { id:8,  curso_id:4, dia:'Jueves',    ini:'18:30', fin:'20:00' },
  { id:9,  curso_id:5, dia:'Lunes',     ini:'20:00', fin:'21:30' },
  { id:10, curso_id:5, dia:'Miércoles', ini:'20:00', fin:'21:30' },
  { id:11, curso_id:6, dia:'Martes',    ini:'19:30', fin:'21:00' },
  { id:12, curso_id:6, dia:'Jueves',    ini:'19:30', fin:'21:00' },
  { id:13, curso_id:7, dia:'Sábado',    ini:'10:00', fin:'12:00' },
];
const schedulesFor = (cid) => SCHEDULES.filter(h => h.curso_id === cid);

// ── Historical attendance sessions ──────────────────────────────────────────
// La asistencia muchas veces no se carga en el momento; el profesor puede
// entrar a una clase anterior y cargarla o corregirla despu\u00e9s.
const ATTENDANCE_SESSION_STORE = {}; // key `${courseId}__${iso}` -> records[] (persist edits in-session)
const DIA_TO_JSDOW = { 'Lunes':1,'Martes':2,'Mi\u00e9rcoles':3,'Jueves':4,'Viernes':5,'S\u00e1bado':6 };
const ATTENDANCE_TODAY = new Date(2026, 4, 9); // Viernes 9 de mayo de 2026 (fecha ancla del prototipo)

const _isoSession = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const _strHash = (s) => { let h = 0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

// \u00daltimas `count` clases del curso seg\u00fan sus horarios semanales, m\u00e1s reciente primero (index 0 = hoy/pr\u00f3xima)
const pastSessionsFor = (courseId, count = 8) => {
  const sched = schedulesFor(courseId);
  const dows = [...new Set(sched.map(h => DIA_TO_JSDOW[h.dia]).filter(d => d != null))];
  if (!dows.length) return [];
  const out = [];
  let cursor = new Date(ATTENDANCE_TODAY);
  let guard = 0;
  while (out.length < count && guard < 120) {
    if (dows.includes(cursor.getDay())) out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
    guard++;
  }
  return out;
};

const fmtSessionShort = (d) => {
  const dias = ['Dom','Lun','Mar','Mi\u00e9','Jue','Vie','S\u00e1b'];
  return `${dias[d.getDay()]} ${d.getDate()}`;
};
const fmtSessionFull = (d) => {
  const dias = ['domingo','lunes','martes','mi\u00e9rcoles','jueves','viernes','s\u00e1bado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const s = `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isSameSession = (a, b) => _isoSession(a) === _isoSession(b);
const isTodaySession = (d) => isSameSession(d, ATTENDANCE_TODAY);

// Registros de una clase espec\u00edfica: hoy siempre vac\u00eda (a cargar);
// ~1 de cada 4 clases pasadas queda deliberadamente sin cargar (realista: se carga despu\u00e9s);
// el resto trae datos ya guardados, determin\u00edsticos por fecha.
const attendanceForSession = (courseId, dateObj) => {
  const iso = _isoSession(dateObj);
  const key = `${courseId}__${iso}`;
  if (ATTENDANCE_SESSION_STORE[key]) return ATTENDANCE_SESSION_STORE[key];
  const isToday = isTodaySession(dateObj);
  const forcedPending = !isToday && (_strHash(key) % 4 === 0);
  if (isToday || forcedPending) {
    return CLASS_STUDENTS.map(s => ({ ...s, status: null, minutes:'', reason:'' }));
  }
  const seed = _strHash(key);
  return CLASS_STUDENTS.map(s => {
    const roll = (seed + s.id * 7) % 10;
    const status = roll < 7 ? 'P' : roll < 9 ? 'A' : 'T';
    return {
      ...s, status,
      minutes: status === 'T' ? String(5 + ((seed + s.id) % 15)) : '',
      reason: status === 'A' && (seed + s.id) % 3 === 0 ? 'Aviso de la familia' : '',
    };
  });
};
const saveAttendanceSession = (courseId, dateObj, records) => {
  ATTENDANCE_SESSION_STORE[`${courseId}__${_isoSession(dateObj)}`] = records;
};
const sessionIsComplete = (courseId, dateObj) =>
  attendanceForSession(courseId, dateObj).every(r => r.status !== null);

// Cuota — listado mensual del ciclo por alumno (con descuento hermano)
const FEE_MONTHS = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre'];
const feesFor = (s) => {
  const base = 35000, desc = s.sib ? 3500 : 0, final = base - desc;
  return FEE_MONTHS.map((m, i) => {
    let status;
    if (i <= 2)       status = (s.feeStatus === 'overdue' && i >= 1) ? 'overdue' : 'paid';
    else if (i === 3) status = s.feeStatus === 'paid' ? 'paid' : (s.feeStatus === 'overdue' ? 'overdue' : 'pending');
    else              status = 'pending';
    const mm = String(i + 3).padStart(2, '0');
    const paid = status === 'paid'
      ? `${String(((s.id + i) % 7) + 1).padStart(2,'0')}/${mm}/2026`
      : null;
    const method = status === 'paid' ? ['Efectivo','Transferencia','Mercado Pago'][(s.id + i) % 3] : null;
    return { month:`${m} 2026`, base, desc, amount:final, due:`10/${mm}/2026`, status, paid, method };
  });
};

// Calificación por período (1° cierre Julio / 2° cierre Noviembre)
const ACADEMIC_EVALS = [
  { name:'Reading Comprehension', type:'Examen' },
  { name:'Listening Test',        type:'Examen' },
  { name:'Oral Presentation',     type:'Oral' },
  { name:'Written Assignment',    type:'TP' },
];
const academicFor = (s, period) => {
  if (period === 'noviembre') {
    return { evals: [], avg: null, note: 'El 2° cierre (Noviembre) aún no tiene evaluaciones cargadas.' };
  }
  const evals = ACADEMIC_EVALS.map((n, i) => {
    const raw = 6 + ((s.id * 7 + i * 3) % 40) / 10;          // 6.0 … 9.9
    const score = Math.round(raw * 2) / 2;                    // step 0.5
    return {
      ...n,
      date: `${String(12 + (i % 2)).padStart(2,'0')}/0${4 + i}/2026`,
      score,
      obs: i === 0 ? 'Buen desempeño general en la consigna.'
         : i === 2 ? 'Se expresa con seguridad, buena pronunciación.'
         : null,
    };
  });
  const avg = (evals.reduce((a, e) => a + e.score, 0) / evals.length).toFixed(1);
  return { evals, avg, note: null };
};

// Asistencia por alumno (mes de muestra)
const attendanceFor = (s) => {
  const pct = 78 + ((s.id * 13) % 20);
  const days = [5, 7, 8, 12, 14, 15, 19, 21, 22, 26, 28, 29];
  const cal = days.map((d, i) => {
    const r = (s.id * 3 + i * 7) % 10;
    return { d, s: r < 8 ? 'P' : r < 9 ? 'T' : 'A' };
  });
  return { pct, cal };
};

// Observación — feed por alumno con categoría + emisor con rol
const OBS_CATS = {
  academico:     { label:'Académico',      color:'var(--level-teens)' },
  comportamiento:{ label:'Comportamiento', color:'var(--warning)' },
  felicitacion:  { label:'Felicitación',   color:'var(--brand)' },
  administrativo:{ label:'Administrativo', color:'var(--info)' },
};
const obsFor = (s) => {
  const t = (COURSES.find(c => c.id === s.cid) || {}).teacher || 'Equipo docente';
  const base = [
    { date:'15/04/2026', author:t, role:'teacher', teacher:t, category:'academico',    text:'Muestra buen progreso en comprensión lectora. Recomiendo reforzar vocabulario en casa.' },
    { date:'02/05/2026', author:t, role:'teacher', teacher:t, category:'felicitacion', text:'Excelente participación y compromiso durante todo el mes.' },
  ];
  if (s.id % 3 === 0) base.push({ date:'20/05/2026', author:t, role:'teacher', teacher:t, category:'comportamiento', text:'Conversa durante las explicaciones; trabajamos en sostener la atención.' });
  // Observaciones de secretaría (documentación / avisos administrativos)
  if (hasPendingDocs(s.id)) base.push({
    date:'10/06/2026', author:'Lucía Peralta', role:'secretary', teacher:'Lucía Peralta', category:'administrativo',
    text:'Recordatorio: falta completar documentación del legajo. Podés cargarla desde tu cuenta en la sección Documentación.',
  });
  if (s.id % 4 === 2) base.push({
    date:'18/06/2026', author:'Lucía Peralta', role:'secretary', teacher:'Lucía Peralta', category:'administrativo',
    text:'Aviso: a partir de agosto el horario de atención de secretaría será de 9:00 a 13:00 y de 16:00 a 20:00.',
  });
  return base.sort((a, b) => _parseDMY(b.date) - _parseDMY(a.date));
};

// Emisor formateado según rol
const obsAuthorLabel = (o) =>
  o.role === 'secretary' ? `Secretaría — ${o.author}`
  : o.role === 'admin'   ? `Dirección — ${o.author}`
  : `Prof. ${o.author}`;

// ── Nota de cierre — nota final del período definida por el profesor ──────
// Entidad: { alumno_id, curso_id, periodo, nota, observacion, estado }
const notaCierreFor = (s, period = 'julio') => {
  if (period === 'noviembre') return null; // 2° cierre aún sin cargar
  const nota = Math.round((6.5 + ((s.id * 11) % 30) / 10) * 2) / 2;  // 6.5 … 9.5
  const estado = s.id % 5 === 0 ? 'borrador' : 'publicada';
  const obs = s.id % 2 === 0
    ? 'Cierre muy sólido. Se recomienda sostener el ritmo de lectura durante el receso.'
    : null;
  return { alumno_id: s.id, curso_id: s.cid, periodo: period, nota, observacion: obs, estado };
};

// ── Chat — consultas del padre/tutor con secretaría/administración ────────
// Un hilo por familia (parentName). Padre ve solo el suyo; secretaría/admin ven todos.
const CHAT_THREADS = [
  { id:1,  parentName:'Roberto Rodríguez', students:['Valentina Rodríguez'], phone:'2622-456789', unreadStaff:0, unreadParent:0, messages:[] },
  { id:2,  parentName:'Graciela González', students:['Tomás González'],     phone:'2622-567890', unreadStaff:1, unreadParent:0, messages:[
    { from:'parent', author:'Graciela González', text:'Buenas tardes, quería consultar por la cuota de Tomás, tuve un problema con la transferencia. ¿Podemos coordinar un pago en efectivo esta semana?', date:'24/07/2026', time:'09:14', ts:8 },
  ]},
  { id:3,  parentName:'Analía Martínez',   students:['Sofía Martínez','Florencia Martínez'], phone:'2622-678901', unreadStaff:0, unreadParent:1, messages:[
    { from:'parent', author:'Analía Martínez', text:'Hola, quería consultar si puedo abonar las dos cuotas de mis hijas juntas este mes.', date:'20/07/2026', time:'14:05', ts:5 },
    { from:'staff',  author:'Lucía Peralta', roleLabel:'Secretaría', text:'¡Hola Analía! Sí, podés abonar ambas cuotas juntas en secretaría, recordá que ya tenés el 10% de descuento por hermanas aplicado.', date:'20/07/2026', time:'15:30', ts:6 },
    { from:'staff',  author:'Lucía Peralta', roleLabel:'Secretaría', text:'Te confirmo que quedó todo registrado correctamente, cualquier consulta estamos a disposición.', date:'25/07/2026', time:'09:15', ts:9 },
  ]},
  { id:4,  parentName:'Horacio Fernández', students:['Lucas Fernández'],    phone:'2622-789012', unreadStaff:0, unreadParent:0, messages:[
    { from:'parent', author:'Horacio Fernández', text:'Buenas, Lucas va a faltar el jueves por un turno médico, ¿le toman igual la asistencia como justificada?', date:'15/07/2026', time:'10:02', ts:3 },
    { from:'staff',  author:'Lucía Peralta', roleLabel:'Secretaría', text:'Hola Horacio, sí, quedó registrada como ausencia justificada. ¡Gracias por avisar!', date:'15/07/2026', time:'11:20', ts:4 },
  ]},
  { id:5,  parentName:'Marcela López',     students:['Camila López'],       phone:'2622-890123', unreadStaff:0, unreadParent:0, messages:[] },
  { id:6,  parentName:'Cristina Díaz',     students:['Ignacio Díaz'],       phone:'2622-901234', unreadStaff:1, unreadParent:0, messages:[
    { from:'parent', author:'Cristina Díaz', text:'Hola, disculpen la demora con el pago de Ignacio. Tuvimos un tema familiar, en cuanto pueda me acerco a arreglar la deuda. Gracias por la paciencia.', date:'23/07/2026', time:'18:42', ts:7 },
  ]},
  { id:7,  parentName:'Jorge Pérez',       students:['Matías Pérez'],       phone:'2622-012345', unreadStaff:0, unreadParent:0, messages:[] },
  { id:8,  parentName:'Patricia Sánchez',  students:['Luciana Sánchez'],    phone:'2622-123456', unreadStaff:0, unreadParent:0, messages:[
    { from:'parent', author:'Patricia Sánchez', text:'Hola, ¿el instituto tiene actividad el 9 de julio por el feriado?', date:'05/07/2026', time:'16:10', ts:1 },
    { from:'staff',  author:'Silvana Linares', roleLabel:'Dirección', text:'¡Hola Patricia! No, el 9 de julio no hay clases por el feriado nacional. Retomamos el 10.', date:'05/07/2026', time:'16:44', ts:2 },
  ]},
  { id:9,  parentName:'Daniela Morales',   students:['Agustín Morales'],    phone:'2622-234567', unreadStaff:0, unreadParent:0, messages:[] },
  { id:10, parentName:'Fabiana Torres',    students:['Bianca Torres'],      phone:'2622-345678', unreadStaff:0, unreadParent:0, messages:[] },
  { id:11, parentName:'Eduardo Herrera',   students:['Nicolás Herrera'],    phone:'2622-456890', unreadStaff:0, unreadParent:0, messages:[] },
];
let _chatTsCounter = 100;
const lastChatMessage = (t) => t.messages.length ? t.messages[t.messages.length - 1] : null;
const sortedChatThreads = () => [...CHAT_THREADS].sort((a, b) => {
  const la = lastChatMessage(a), lb = lastChatMessage(b);
  return (lb ? lb.ts : -1) - (la ? la.ts : -1);
});
const chatThreadForParent = (name) => CHAT_THREADS.find(t => t.parentName === name);
const unreadChatsForStaff = () => CHAT_THREADS.reduce((n, t) => n + (t.unreadStaff > 0 ? 1 : 0), 0);
const unreadChatsForParent = (name) => { const t = chatThreadForParent(name); return t ? t.unreadParent : 0; };
const sendChatMessage = (threadId, { from, author, roleLabel, text }) => {
  const t = CHAT_THREADS.find(x => x.id === threadId);
  if (!t || !text.trim()) return;
  const now = new Date();
  t.messages.push({
    from, author, roleLabel, text: text.trim(),
    date: now.toLocaleDateString('es-AR'),
    time: now.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }),
    ts: ++_chatTsCounter,
  });
  if (from === 'parent') { t.unreadStaff += 1; t.unreadParent = 0; }
  else { t.unreadParent += 1; t.unreadStaff = 0; }
};
const markChatRead = (threadId, side) => {
  const t = CHAT_THREADS.find(x => x.id === threadId);
  if (!t) return;
  if (side === 'staff') t.unreadStaff = 0; else t.unreadParent = 0;
};

Object.assign(window, {
  BRAND, BRAND_HOVER, BRAND_PRESSED, BRAND_SOFT, BRAND_BORDER, BRAND_DOT,
  PRIMARY, PRIMARY_DARK, PRIMARY_LIGHT, SIDEBAR_BG, ACCENT,
  TEXT, TEXT_MUTED, TEXT_SUBTLE, TEXT_FAINT, BORDER, BORDER_STRONG, BG_SUBTLE, BG_MUTED,
  STATUS,
  NAV_ADMIN, NAV_TEACHER, NAV_PARENT, NAV_SECRETARY,
  COURSES, STUDENTS, FEES,
  CLASS_STUDENTS, CLASS_GRADES, EVALUATIONS,
  PARENT_KIDS, USER_PROFILES,
  UPCOMING_EVALS, RECENT_ACTIVITY, OVERDUE_DASHBOARD,
  SYSTEM_USERS, ROLE_LABELS,
  STUDENT_EXT, studentFull, siblingsOf, VINCULO_LABEL,
  DOC_TYPES, docsFor, SCHEDULES, schedulesFor, setDocOverride, hasPendingDocs,
  feesFor, FEE_MONTHS, academicFor, attendanceFor, obsFor, OBS_CATS, obsAuthorLabel,
  notaCierreFor,
  pastSessionsFor, attendanceForSession, saveAttendanceSession, sessionIsComplete,
  fmtSessionShort, fmtSessionFull, isTodaySession,
  CHAT_THREADS, sortedChatThreads, chatThreadForParent, unreadChatsForStaff, unreadChatsForParent,
  sendChatMessage, markChatRead,
});
