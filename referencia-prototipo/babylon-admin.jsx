// babylon-admin.jsx — Resumen, Alumnos, Profesores, Cursos, Cuotas, Reportes, Usuarios, Configuración
// Visual system: Mercury × Linear · single brand color · hairline borders · sharp 4-6px radii.

const { useState, useMemo } = React;

// Text normalizer: strips diacritics + lowercases (search without tilde/case sensitivity)
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

// ── KPI Card — Mercury-style large number ──────────────────────────────────
const KpiCard = ({ label, value, sub, delta, deltaTone = 'positive', onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`card-hl block w-full text-left ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        padding: '18px 18px 16px',
        transition: 'border-color 150ms ease',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = 'var(--border-strong)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div className="eyebrow">{label}</div>
      <div className="num-display mt-2.5" style={{ fontSize: 30, lineHeight: '1', color: 'var(--text)' }}>
        {value}
      </div>
      {(delta || sub) && (
        <div className="flex items-center gap-2 mt-3">
          {delta && (
            <span className="text-[12px] font-medium tnum" style={{
              color: deltaTone === 'positive' ? 'var(--brand)' : deltaTone === 'negative' ? 'var(--danger)' : 'var(--text-muted)',
            }}>
              {delta}
            </span>
          )}
          {sub && <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>{sub}</span>}
        </div>
      )}
    </Tag>
  );
};

// ── Sparkline (simple SVG, monochrome) ────────────────────────────────────
const Sparkline = ({ data, width = 120, height = 32, color = 'var(--brand)' }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / Math.max(1, max - min)) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  );
};

// ── Bar chart — minimal, horizontal columns ──────────────────────────────
const MiniBars = ({ data, labels, colors, height = 80 }) => {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((v, i) => {
        const h = (v / max) * 100;
        const c = colors && colors[i];
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full relative" style={{ height: '100%' }}>
              <div className="absolute bottom-0 left-0 right-0"
                style={{
                  height: `${h}%`,
                  background: c ? `${c}1f` : 'var(--brand-soft)',
                  borderTop: c ? `2px solid ${c}` : '2px solid var(--brand)',
                }} />
            </div>
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Donut % (ring) — thin monochrome ──────────────────────────────────────
const Ring = ({ value, size = 64, stroke = 4, color = 'var(--brand)', track = 'var(--bg-muted)' }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${c}`} strokeDashoffset={c/4} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
};

// Activity row marker (dot + thin vertical line stays only via the avatar)
const ACTIVITY_ICON = {
  attendance:  'ClipboardCheck',
  enrollment:  'UserPlus',
  payment:     'Receipt',
  grades:      'FileText',
  observation: 'MessageSquare',
};

// ── Admin Dashboard ────────────────────────────────────────────────────────
const AdminDashboard = ({ onNavigate }) => {
  const isMobile = useIsMobile();
  const totalDebt = OVERDUE_DASHBOARD.reduce((a, f) => a + f.amount, 0);

  return (
    <div className="space-y-7">

      {/* Heading row */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Viernes · 9 de mayo de 2026</p>
          <h2 className="font-semibold leading-tight" style={{ fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Buenos días, Silvana
          </h2>
          <p className="text-[13.5px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Cinco cuotas vencidas suman {fmt$(totalDebt)}. La asistencia promedio del mes es del 92 %.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('students')} className="btn btn-secondary">
            <Icon name="UserPlus" size={14} /> Inscribir alumno
          </button>
          <button onClick={() => onNavigate('payments')} className="btn btn-primary">
            <Icon name="Receipt" size={14} /> Registrar pago
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        <KpiCard label="Alumnos activos" value="130"
          delta="+5" deltaTone="positive" sub="este mes"
          onClick={() => onNavigate('students')} />
        <KpiCard label="Cuotas al día" value="78%"
          delta="+4 pp" deltaTone="positive" sub="vs abril"
          onClick={() => onNavigate('payments')} />
        <KpiCard label="Asistencia promedio" value="92%"
          delta="−1 pp" deltaTone="negative" sub="vs abril" />
        <KpiCard label="Cursos activos" value="12"
          sub="5 docentes · 3 niveles"
          onClick={() => onNavigate('courses')} />
      </div>

      {/* Two columns */}
      <div className={`grid gap-5 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-5'}`}>

        {/* Overdue fees */}
        <div className="lg:col-span-3">
          <Panel
            title="Cuotas vencidas"
            action={
              <div className="flex items-center gap-3">
                <span className="text-[12px] tnum font-medium" style={{ color: 'var(--danger)' }}>{fmt$(totalDebt)}</span>
                <button onClick={() => onNavigate('payments')} className="text-[12px] font-medium hover:underline"
                  style={{ color: 'var(--brand)' }}>Ver todas →</button>
              </div>
            }>
            {/* Desktop table */}
            <table className={`tbl ${isMobile ? 'hidden' : 'hidden md:table'}`}>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Curso</th>
                  <th>Mes</th>
                  <th style={{ textAlign: 'right' }}>Atraso</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {OVERDUE_DASHBOARD.map((f, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={f.name} size="xs" />
                        <span className="font-medium">{f.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      <LevelBadge level={levelOf(f.course) || ''}>{f.course}</LevelBadge>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{f.month}</td>
                    <td className="tnum" style={{ textAlign: 'right', color: f.days >= 30 ? 'var(--danger)' : 'var(--warning)' }}>
                      {f.days} d.
                    </td>
                    <td className="tnum font-medium" style={{ textAlign: 'right' }}>{fmt$(f.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => onNavigate('payments')} className="btn btn-secondary btn-sm">Cobrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className={isMobile ? '' : 'md:hidden'}>
              {OVERDUE_DASHBOARD.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: i < OVERDUE_DASHBOARD.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <Avatar name={f.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{f.name}</p>
                    <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>{f.course} · {f.month}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] tnum font-medium">{fmt$(f.amount)}</p>
                    <p className="text-[11px] tnum" style={{ color: f.days >= 30 ? 'var(--danger)' : 'var(--warning)' }}>{f.days} d. atraso</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Upcoming evaluations */}
        <div className="lg:col-span-2">
          <Panel title="Próximas evaluaciones">
            <div>
              {UPCOMING_EVALS.map((e, i) => (
                <div key={i} className="flex items-start gap-4 px-5 py-3"
                  style={{ borderBottom: i < UPCOMING_EVALS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex-shrink-0 text-center" style={{ width: 38 }}>
                    <p className="text-[13px] tnum font-semibold leading-none" style={{ color: 'var(--text)' }}>
                      {e.date.slice(0, 2)}
                    </p>
                    <p className="text-[10px] mt-1.5 uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>may</p>
                  </div>
                  <div className="flex-1 min-w-0 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
                    <LevelBadge level={levelOf(e.course) || ''}>{e.course}</LevelBadge>
                    <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{e.type}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{e.teacher}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Composition + activity */}
      <div className={`grid gap-5 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-5'}`}>
        <div className="lg:col-span-2">
          <Panel title="Composición por nivel">
            <div className="px-5 py-5">
              <MiniBars
                data={[33, 37, 44, 12]}
                labels={['Kids','Teens','Adults','Camb.']}
                colors={['#0EA5E9','#7C3AED','#C2410C','#B45309']}
                height={100} />
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
                {[
                  ['Kids', 33, '#0EA5E9'],
                  ['Teens', 37, '#7C3AED'],
                  ['Adults', 44, '#C2410C'],
                  ['Cambridge', 12, '#B45309'],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                      {l}
                    </span>
                    <span className="tnum font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-3">
          <Panel title="Actividad reciente">
            <div>
              {RECENT_ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: i < RECENT_ACTIVITY.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 26, height: 26, borderRadius: 3, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                    <Icon name={ACTIVITY_ICON[a.type] || 'Circle'} size={13} />
                  </div>
                  <div className="flex-1 min-w-0 text-[12.5px]" style={{ color: 'var(--text)' }}>
                    <span className="font-medium">{a.actor}</span>{' '}
                    <span style={{ color: 'var(--text-muted)' }}>{a.verb}</span>{' '}
                    <span className="font-medium">{a.target}</span>
                  </div>
                  <span className="text-[11px] flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>{a.time}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

// ── Inscription Form — 4-step wizard ────────────────────────────────────────
const INS_STEPS = [
  { n:1, label:'Alumno' }, { n:2, label:'Tutor' },
  { n:3, label:'Curso' },  { n:4, label:'Confirmar' },
];

const InscriptionForm = ({ onClose }) => {
  const isMobile = useIsMobile();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nombre:'', apellido:'', dni:'', fechaNac:'', calleNum:'', ciudad:'San Luis',
    tel:'', email:'', medNotes:'',
    parentMode:null, parentId:null,
    parentNombre:'', parentApellido:'', parentDNI:'',
    parentTel:'', parentEmail:'', parentVinculo:'madre', parentAddr:'',
    cursoId:'', docs:{ formulario:false, copia_dni:false, autorizacion:false },
  });
  const [errors, setErrors] = useState({});
  const [parentSearch, setParentSearch] = useState('');
  const [toast, setToast] = useState('');

  const upd = (k,v) => setForm(f => ({ ...f, [k]:v }));

  // Unique parents from existing student data
  const existingParents = useMemo(() => {
    const map = {};
    STUDENTS.forEach(s => {
      const key = norm(s.parent);
      if (!map[key]) map[key] = { name:s.parent, email:s.email, phone:s.phone, addr:studentFull(s).paddr, kids:[] };
      map[key].kids.push(`${s.first} ${s.last}`);
    });
    return Object.values(map);
  }, []);

  const filteredParents = useMemo(() =>
    existingParents.filter(p =>
      !parentSearch || norm(p.name).includes(norm(parentSearch)) || norm(p.email||'').includes(norm(parentSearch))
    ), [parentSearch]);

  const selectedParent = form.parentId != null ? existingParents[form.parentId] : null;
  const selectedCourse = form.cursoId ? COURSES.find(c => String(c.id) === String(form.cursoId)) : null;
  const courseSchedules = selectedCourse ? schedulesFor(selectedCourse.id) : [];
  const hasSibling = selectedParent && selectedParent.kids.length > 0;
  const monthlyBase = 35000;
  const monthlyFinal = hasSibling ? Math.round(monthlyBase * 0.9) : monthlyBase;

  const calcAge = (iso) => {
    if (!iso) return null;
    try {
      const [y,m,d] = iso.split('-').map(Number);
      const t = new Date(2026,5,23); let a = t.getFullYear()-y;
      if (t.getMonth() < m-1 || (t.getMonth()===m-1 && t.getDate()<d)) a--;
      return a >= 0 ? a : null;
    } catch { return null; }
  };
  const age = calcAge(form.fechaNac);

  const validate = (s) => {
    const e = {};
    if (s===1) {
      if (!form.nombre.trim()) e.nombre='Requerido';
      if (!form.apellido.trim()) e.apellido='Requerido';
      if (!/^\d{7,8}$/.test(form.dni.replace(/\./g,''))) e.dni='DNI inválido (7-8 dígitos)';
      if (!form.fechaNac) e.fechaNac='Requerida';
      if (!form.calleNum.trim()) e.calleNum='Requerida';
      if (!form.ciudad.trim()) e.ciudad='Requerida';
    }
    if (s===2) {
      if (!form.parentMode) e.parentMode='Seleccioná una opción';
      if (form.parentMode==='existing' && form.parentId==null) e.parentId='Seleccioná un padre/tutor';
      if (form.parentMode==='new') {
        if (!form.parentNombre.trim()) e.parentNombre='Requerido';
        if (!form.parentApellido.trim()) e.parentApellido='Requerido';
        if (!/^\d{7,8}$/.test(form.parentDNI.replace(/\./g,''))) e.parentDNI='DNI inválido';
        if (!form.parentTel.trim()) e.parentTel='Requerido';
        if (!form.parentAddr.trim()) e.parentAddr='Requerido';
        if (!form.parentEmail.includes('@')) e.parentEmail='Email inválido';
      }
    }
    if (s===3) { if (!form.cursoId) e.cursoId='Seleccioná un curso'; }
    return e;
  };

  const goNext = () => {
    const e = validate(step); setErrors(e);
    if (!Object.keys(e).length) setStep(s => s+1);
  };

  const FE = ({ id }) => errors[id]
    ? <p className="text-[11.5px] mt-1" style={{ color:'var(--danger)' }}>{errors[id]}</p> : null;

  const IF = ({ label, id, value, onChange, type='text', placeholder='', optional=false, readOnly=false, hint=null }) => (
    <div>
      <label className="label">{label}{optional && <span style={{ color:'var(--text-faint)',fontWeight:400 }}> · opcional</span>}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
        className="input" style={{ background:readOnly?'var(--bg-subtle)':'var(--bg)', borderColor:errors[id]?'var(--danger)':'var(--border)' }}/>
      {hint && !errors[id] && <p className="text-[11px] mt-1" style={{ color:'var(--text-faint)' }}>{hint}</p>}
      <FE id={id}/>
    </div>
  );

  const StepBar = () => (
    <div className="flex items-center">
      {INS_STEPS.map((s,i) => (
        <React.Fragment key={s.n}>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center text-[11.5px] font-semibold"
              style={{ width:26,height:26,borderRadius:13,
                background: step>=s.n ? 'var(--brand)' : 'var(--bg-muted)',
                color: step>=s.n ? '#fff' : 'var(--text-faint)' }}>
              {step>s.n ? <Icon name="Check" size={12} strokeWidth={2.5} style={{ color:'#fff' }}/> : s.n}
            </div>
            <span className="text-[12px] font-medium hidden sm:inline"
              style={{ color:step===s.n?'var(--text)':'var(--text-faint)' }}>{s.label}</span>
          </div>
          {i < INS_STEPS.length-1 && (
            <div className="flex-1 mx-2" style={{ height:1, background:step>s.n?'var(--brand)':'var(--border)', minWidth:12 }}/>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="btn btn-ghost" style={{ padding:'7px 9px' }}>
          <Icon name="ArrowLeft" size={16}/>
        </button>
        <div>
          <p className="eyebrow">Nuevo ingreso</p>
          <h2 className="font-semibold" style={{ fontSize:22,letterSpacing:'-0.02em',color:'var(--text)' }}>Inscribir alumno</h2>
        </div>
      </div>

      <Card className="p-4"><StepBar/></Card>

      {/* Step 1 */}
      {step===1 && (
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold mb-4">Datos del alumno</h3>
          <div className={`grid gap-3.5 ${isMobile?'grid-cols-1':'grid-cols-2'}`}>
            <IF label="Nombre" id="nombre" value={form.nombre} onChange={v=>upd('nombre',v)} placeholder="Valentina"/>
            <IF label="Apellido" id="apellido" value={form.apellido} onChange={v=>upd('apellido',v)} placeholder="Rodríguez"/>
            <IF label="DNI" id="dni" value={form.dni} onChange={v=>upd('dni',v)} placeholder="45123456" hint="Solo números, sin puntos"/>
            <div>
              <IF label="Fecha de nacimiento" id="fechaNac" value={form.fechaNac} onChange={v=>upd('fechaNac',v)} type="date"/>
              {age!==null && <p className="text-[12px] mt-1 font-medium" style={{ color:'var(--brand)' }}>Edad calculada: {age} años</p>}
            </div>
            <div className={isMobile?'':'col-span-2'}>
              <IF label="Calle y número" id="calleNum" value={form.calleNum} onChange={v=>upd('calleNum',v)} placeholder="Av. Illia 234"/>
            </div>
            <IF label="Ciudad" id="ciudad" value={form.ciudad} onChange={v=>upd('ciudad',v)}/>
            <IF label="Teléfono" id="tel" value={form.tel} onChange={v=>upd('tel',v)} placeholder="2664-123456" optional/>
            <IF label="Email" id="email" value={form.email} onChange={v=>upd('email',v)} type="email" optional/>
            <div className={isMobile?'':'col-span-2'}>
              <label className="label">Observaciones médicas / alergias <span style={{ color:'var(--text-faint)',fontWeight:400 }}>· opcional</span></label>
              <textarea value={form.medNotes} onChange={e=>upd('medNotes',e.target.value)} rows={3}
                placeholder="Ej: alergia a la penicilina, asma, diabetes…"
                className="input" style={{ resize:'none',padding:10,lineHeight:1.55 }}/>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2 */}
      {step===2 && (
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold mb-4">Datos del padre / tutor</h3>
          <div className="mb-5">
            <label className="label">¿El padre o tutor ya tiene cuenta en el sistema?</label>
            <div className="flex gap-2">
              {[['existing','Sí, ya existe'],['new','No, crear nuevo']].map(([val,lbl]) => (
                <button key={val} onClick={() => { upd('parentMode',val); upd('parentId',null); setErrors({}); }}
                  className="flex-1 py-2.5 text-[13px] font-medium transition-all"
                  style={{ border:`1px solid ${form.parentMode===val?'var(--brand)':'var(--border)'}`,
                    background:form.parentMode===val?'var(--brand-soft)':'var(--bg)',
                    color:form.parentMode===val?'var(--brand)':'var(--text)', borderRadius:4 }}>
                  {lbl}
                </button>
              ))}
            </div>
            <FE id="parentMode"/>
          </div>

          {form.parentMode==='existing' && (
            <div className="space-y-3">
              <div>
                <label className="label">Buscar padre / tutor</label>
                <div className="relative">
                  <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-faint)' }}/>
                  <input value={parentSearch} onChange={e=>setParentSearch(e.target.value)}
                    placeholder="Nombre o email…" className="input" style={{ paddingLeft:28 }}/>
                </div>
              </div>
              <div style={{ maxHeight:200,overflowY:'auto',border:'1px solid var(--border)',borderRadius:4 }}>
                {filteredParents.map((p,i) => {
                  const sel = form.parentId===i;
                  return (
                    <button key={i} onClick={() => { upd('parentId',i); setErrors({}); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
                      style={{ background:sel?'var(--brand-soft)':i%2===0?'var(--bg)':'var(--bg-subtle)', border:'none' }}>
                      <Avatar name={p.name} size="xs" tone={sel?'brand':'neutral'}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium" style={{ color:sel?'var(--brand)':'var(--text)' }}>{p.name}</p>
                        <p className="text-[11px]" style={{ color:'var(--text-faint)' }}>{p.kids.length} hijo{p.kids.length!==1?'s':''} inscripto{p.kids.length!==1?'s':''}</p>
                      </div>
                      {sel && <Icon name="Check" size={13} style={{ color:'var(--brand)',flexShrink:0 }}/>}
                    </button>
                  );
                })}
                {!filteredParents.length && <p className="text-[12.5px] px-4 py-4 text-center" style={{ color:'var(--text-faint)' }}>Sin resultados</p>}
              </div>
              <FE id="parentId"/>
              {selectedParent && selectedParent.kids.length>0 && (
                <div className="flex items-start gap-2 px-3.5 py-3"
                  style={{ background:'var(--brand-soft)',border:'1px solid var(--brand-border)',borderRadius:4 }}>
                  <Icon name="Tag" size={13} style={{ color:'var(--brand)',flexShrink:0,marginTop:1 }}/>
                  <p className="text-[12.5px]" style={{ color:'var(--brand)' }}>
                    Este tutor ya tiene {selectedParent.kids.length} hijo{selectedParent.kids.length!==1?'s':''} inscripto{selectedParent.kids.length!==1?'s':''}
                    ({selectedParent.kids.join(', ')}). Se aplicará <strong>descuento del 10%</strong> sobre la cuota de este alumno.
                  </p>
                </div>
              )}
            </div>
          )}

          {form.parentMode==='new' && (
            <div className={`grid gap-3.5 ${isMobile?'grid-cols-1':'grid-cols-2'}`}>
              <IF label="Nombre" id="parentNombre" value={form.parentNombre} onChange={v=>upd('parentNombre',v)}/>
              <IF label="Apellido" id="parentApellido" value={form.parentApellido} onChange={v=>upd('parentApellido',v)}/>
              <IF label="DNI" id="parentDNI" value={form.parentDNI} onChange={v=>upd('parentDNI',v)} placeholder="28456123" hint="7-8 dígitos"/>
              <div>
                <label className="label">Vínculo</label>
                <select value={form.parentVinculo} onChange={e=>upd('parentVinculo',e.target.value)} className="select">
                  <option value="padre">Padre</option>
                  <option value="madre">Madre</option>
                  <option value="tutor">Tutor/a</option>
                </select>
              </div>
              <IF label="Teléfono" id="parentTel" value={form.parentTel} onChange={v=>upd('parentTel',v)} placeholder="2664-456789"/>
              <IF label="Email (login del sistema)" id="parentEmail" value={form.parentEmail} onChange={v=>upd('parentEmail',v)} type="email" hint="Será el usuario de acceso al sistema"/>
              <div className={isMobile?'':'col-span-2'}>
                <IF label="Dirección del padre/madre/tutor" id="parentAddr" value={form.parentAddr} onChange={v=>upd('parentAddr',v)} placeholder="Calle 1234, San Luis" hint="Puede diferir de la del alumno"/>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Step 3 */}
      {step===3 && (
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold mb-4">Curso y cuota</h3>
          <div>
            <label className="label">Curso</label>
            <select value={form.cursoId} onChange={e=>upd('cursoId',e.target.value)} className="select"
              style={{ borderColor:errors.cursoId?'var(--danger)':'var(--border)' }}>
              <option value="">Seleccioná un curso…</option>
              {COURSES.map(c => <option key={c.id} value={c.id}>{c.name} — {c.level} — {c.room}</option>)}
            </select>
            <FE id="cursoId"/>
          </div>
          {selectedCourse && (
            <div className="mt-5 space-y-3">
              <div className="p-4" style={{ background:'var(--bg-subtle)',border:'1px solid var(--border)',borderRadius:4 }}>
                <div className="flex items-center gap-2 mb-2">
                  <LevelBadge level={selectedCourse.level}>{selectedCourse.level}</LevelBadge>
                  <span className="text-[13px] font-semibold">{selectedCourse.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
                  <div><span style={{ color:'var(--text-faint)' }}>Profesor </span><span>{selectedCourse.teacher}</span></div>
                  <div><span style={{ color:'var(--text-faint)' }}>Aula </span><span>{selectedCourse.room}</span></div>
                  <div><span style={{ color:'var(--text-faint)' }}>Alumnos </span><span className="tnum">{selectedCourse.count}/30</span></div>
                </div>
                <div className="mt-2.5 space-y-1">
                  {courseSchedules.map((h,i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px]" style={{ color:'var(--text-muted)' }}>
                      <Icon name="Clock" size={11} style={{ color:'var(--text-faint)' }}/>
                      <span>{h.dia}</span><span className="tnum">{h.ini} – {h.fin}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ background:'var(--bg-subtle)',border:'1px solid var(--border)',borderRadius:4 }}>
                <div>
                  <p className="eyebrow">Cuota mensual</p>
                  {hasSibling && <p className="text-[11.5px] mt-1" style={{ color:'var(--brand)' }}>Descuento hermano (−10%) aplicado</p>}
                </div>
                <div className="text-right">
                  {hasSibling && <p className="tnum text-[12px] line-through" style={{ color:'var(--text-faint)' }}>{fmt$(monthlyBase)}</p>}
                  <p className="num-display tnum" style={{ fontSize:22,color:hasSibling?'var(--brand)':'var(--text)' }}>{fmt$(monthlyFinal)}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Step 4 */}
      {step===4 && (
        <div className="space-y-4">
          <Panel title="Documentación">
            <div>
              {[['formulario','Formulario de inscripción'],['copia_dni','Copia de DNI'],['autorizacion','Autorización de imagen']].map(([k,lbl],i,arr) => (
                <div key={k} className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom:i<arr.length-1?'1px solid var(--border)':'none' }}>
                  <Icon name="FileText" size={14} style={{ color:'var(--text-faint)',flexShrink:0 }}/>
                  <p className="flex-1 text-[13px]">{lbl}</p>
                  {form.docs[k]
                    ? <span className="status paid">Cargado</span>
                    : <>
                        <span className="status pending">Pendiente</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => upd('docs',{...form.docs,[k]:true})}>
                          <Icon name="Upload" size={12}/> Subir
                        </button>
                      </>}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Resumen">
            <div className={`grid gap-3 p-5 ${isMobile?'grid-cols-1':'grid-cols-2'}`}>
              {[[
                'Alumno', `${form.nombre} ${form.apellido}`, `DNI ${form.dni}${age!=null?' · '+age+' años':''}`,
              ],[
                'Padre / Tutor',
                form.parentMode==='existing'&&selectedParent ? selectedParent.name : `${form.parentNombre} ${form.parentApellido}`,
                form.parentMode==='existing'&&selectedParent ? selectedParent.email : form.parentEmail,
              ],[
                'Dirección del tutor', form.parentMode==='existing'&&selectedParent ? (selectedParent.addr||'—') : (form.parentAddr||'—'), '',
              ],[
                'Curso', selectedCourse?.name||'—', selectedCourse?.teacher||'',
              ],[
                'Cuota mensual', fmt$(monthlyFinal), hasSibling?'Incluye −10% hermano':'',
              ]].map(([t,v,s]) => (
                <div key={t} className="p-3" style={{ background:'var(--bg-subtle)',border:'1px solid var(--border)',borderRadius:4 }}>
                  <p className="eyebrow mb-1.5">{t}</p>
                  <p className="text-[13.5px] font-medium">{v}</p>
                  {s && <p className="text-[12px]" style={{ color:t==='Cuota mensual'&&hasSibling?'var(--brand)':'var(--text-muted)' }}>{s}</p>}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className="flex gap-2">
        {step>1 && <button onClick={() => setStep(s=>s-1)} className="btn btn-secondary"><Icon name="ChevronLeft" size={14}/> Volver</button>}
        {step<4
          ? <button onClick={goNext} className="btn btn-primary flex-1 justify-center">Siguiente <Icon name="ChevronRight" size={14}/></button>
          : <button onClick={() => { setToast('Alumno inscripto correctamente'); setTimeout(onClose,1600); }} className="btn btn-primary flex-1 justify-center">
              <Icon name="UserPlus" size={14}/> Confirmar inscripción
            </button>
        }
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5"
          style={{ background:'var(--text)',color:'#fff',borderRadius:4,fontSize:13,fontWeight:500 }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--brand-dot)' }}/> {toast}
        </div>
      )}
    </div>
  );
};

// ── Admin Students ─────────────────────────────────────────────────────────

const LevelBadge = ({ course, level, children }) => {
  const lv = level || (course && course.level) || '';
  const cls = String(lv).toLowerCase();
  return <span className={`level-pill ${cls}`}>{children || (course && course.name) || lv}</span>;
};

// Extract level from a free-text course name like "Adults B1 Intensivo"
const levelOf = (name) => {
  const n = (name || '').toLowerCase();
  if (n.startsWith('kids'))      return 'Kids';
  if (n.startsWith('teens'))     return 'Teens';
  if (n.startsWith('adults'))    return 'Adults';
  if (n.startsWith('cambridge')) return 'Cambridge';
  return null;
};

const AdminStudents = ({ searchQuery = '', role = 'admin' }) => {
  const isMobile = useIsMobile();
  const [filterFee, setFilterFee] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [legajo, setLegajo] = useState(null);
  const PER_PAGE = 8;

  React.useEffect(() => { setPage(1); }, [searchQuery]);

  const filtered = useMemo(() => STUDENTS.filter(s => {
    const name = norm(`${s.first} ${s.last}`);
    const matchQ = !searchQuery || name.includes(norm(searchQuery)) || s.dni.includes(searchQuery);
    const matchFee = filterFee === 'all' || s.feeStatus === filterFee;
    const matchCourse = filterCourse === 'all' || String(s.cid) === filterCourse;
    return matchQ && matchFee && matchCourse;
  }), [searchQuery, filterFee, filterCourse]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (legajo) return <StudentLegajo student={legajo} role={role} onBack={() => setLegajo(null)} />;
  if (showNew) return <InscriptionForm onClose={() => setShowNew(false)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          {searchQuery && (
            <span className="text-[12px] flex items-center gap-1.5 px-2.5 py-1"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)', border: '1px solid var(--brand-border)', borderRadius: 3 }}>
              <Icon name="Search" size={11} /> "{searchQuery}"
            </span>
          )}
          <select value={filterFee} onChange={e => { setFilterFee(e.target.value); setPage(1); }} className="select" style={{ width: 'auto' }}>
            <option value="all">Todas las cuotas</option>
            <option value="paid">Al día</option>
            <option value="pending">Pendiente</option>
            <option value="overdue">Vencida</option>
          </select>
          <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setPage(1); }} className="select" style={{ width: 'auto' }}>
            <option value="all">Todos los cursos</option>
            {COURSES.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <span className="text-[12px] ml-2" style={{ color: 'var(--text-faint)' }}>
            {filtered.length} alumno{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={() => setShowNew(true)} className="btn btn-primary">
          <Icon name="UserPlus" size={14} /> Nuevo alumno
        </button>
      </div>

      {/* Desktop table */}
      <Card className={`${isMobile ? 'hidden' : 'hidden md:block'} overflow-hidden`}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>DNI</th>
              <th>Curso</th>
              <th>Padre / Tutor</th>
              <th>Teléfono</th>
              <th>Cuota</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(s => {
              const course = COURSES.find(c => c.id === s.cid);
              return (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${s.first} ${s.last}`} size="xs" />
                      <div>
                        <div className="font-medium">{s.first} {s.last}</div>
                        {s.sib && <div className="text-[11px]" style={{ color: 'var(--brand)' }}>Hermano inscripto</div>}
                      </div>
                    </div>
                  </td>
                  <td className="tnum" style={{ color: 'var(--text-muted)' }}>{s.dni}</td>
                  <td>{course && <LevelBadge course={course} />}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.parent}</td>
                  <td className="tnum" style={{ color: 'var(--text-muted)' }}>{s.phone}</td>
                  <td><Badge variant={feeVariant(s.feeStatus)}>{feeLabel(s.feeStatus)}</Badge></td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setLegajo(s)} className="p-1.5 rounded hover:bg-zinc-100" style={{ color: 'var(--text-muted)' }} title="Ver legajo">
                        <Icon name="Eye" size={14} />
                      </button>
                      <button onClick={() => setLegajo(s)} className="p-1.5 rounded hover:bg-zinc-100" style={{ color: 'var(--text-muted)' }} title="Editar">
                        <Icon name="Pencil" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Página {page} de {pages}</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm" style={{ opacity: page === 1 ? 0.45 : 1 }}>← Anterior</button>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm" style={{ opacity: page === pages ? 0.45 : 1 }}>Siguiente →</button>
          </div>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className={`${isMobile ? '' : 'md:hidden'} space-y-2.5`}>
        {paginated.map(s => {
          const course = COURSES.find(c => c.id === s.cid);
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={`${s.first} ${s.last}`} size="md" />
                  <div>
                    <p className="font-medium text-[14px]">{s.first} {s.last}</p>
                    <p className="text-[11.5px] tnum" style={{ color: 'var(--text-faint)' }}>{s.dni}</p>
                  </div>
                </div>
                <Badge variant={feeVariant(s.feeStatus)}>{feeLabel(s.feeStatus)}</Badge>
              </div>
              <div className="mt-3 pt-3 grid grid-cols-2 gap-y-1.5 text-[12px]" style={{ borderTop: '1px solid var(--border)' }}>
                <div>{course && <LevelBadge course={course} />}</div>
                <div><span style={{ color: 'var(--text-faint)' }}>Tutor </span><span>{s.parent}</span></div>
                <div className="col-span-2"><span style={{ color: 'var(--text-faint)' }}>Tel </span><span className="tnum">{s.phone}</span></div>
              </div>
              <button onClick={() => setLegajo(s)} className="btn btn-secondary w-full mt-3 justify-center">
                <Icon name="Eye" size={14} /> Ver legajo
              </button>
            </Card>
          );
        })}
      </div>

    </div>
  );
};


// ── Admin Payments — multi-fee ───────────────────────────────────────────────
const AdminPayments = ({ searchQuery = '' }) => {
  const isMobile = useIsMobile();
  const [fees, setFees] = useState(FEES);
  const [filter, setFilter] = useState('overdue');
  // Multi-fee modal state
  const [modalOpen, setModalOpen]       = useState(false);
  const [payStudentSearch, setPayStudentSearch] = useState('');
  const [payStudentId, setPayStudentId] = useState(null);
  const [selectedFeeIds, setSelectedFeeIds] = useState([]);
  const [payMethod, setPayMethod] = useState('Efectivo');
  const [payDate, setPayDate]     = useState('23/06/2026');
  const [payNotes, setPayNotes]   = useState('');
  const [toast, setToast] = useState('');

  // Normalize search for table
  const filtered = fees.filter(f => {
    const matchStatus = filter === 'all' || f.status === filter;
    if (!matchStatus) return false;
    if (searchQuery) {
      const s = STUDENTS.find(st => st.id === f.sid);
      const name = s ? norm(`${s.first} ${s.last}`) : '';
      return name.includes(norm(searchQuery));
    }
    return true;
  });

  // Open modal — optionally pre-select a student and/or a fee
  const openPay = (preStudentId = null, preFeeId = null) => {
    setPayStudentSearch('');
    setPayStudentId(preStudentId);
    setSelectedFeeIds(preFeeId ? [preFeeId] : []);
    setPayMethod('Efectivo'); setPayDate('23/06/2026'); setPayNotes('');
    setModalOpen(true);
  };

  // Fees available for selected student (pending + overdue)
  const studentFees = payStudentId
    ? fees.filter(f => f.sid === payStudentId && f.status !== 'paid')
    : [];
  const multiTotal = fees
    .filter(f => selectedFeeIds.includes(f.id))
    .reduce((a, f) => a + f.amount, 0);

  const confirmPay = () => {
    setFees(prev => prev.map(f =>
      selectedFeeIds.includes(f.id)
        ? { ...f, status: 'paid', paid: payDate, method: payMethod }
        : f
    ));
    setModalOpen(false);
    setToast(`${selectedFeeIds.length} cuota${selectedFeeIds.length !== 1 ? 's' : ''} registrada${selectedFeeIds.length !== 1 ? 's' : ''} correctamente`);
    setTimeout(() => setToast(''), 2800);
  };

  const methods = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Otro'];
  const tabs = [
    { id:'overdue', label:'Vencidas',   count: fees.filter(f=>f.status==='overdue').length },
    { id:'pending', label:'Pendientes', count: fees.filter(f=>f.status==='pending').length },
    { id:'paid',    label:'Cobradas',   count: fees.filter(f=>f.status==='paid').length },
    { id:'all',     label:'Todas',      count: fees.length },
  ];
  const tableTotal = filtered.reduce((a,f) => a + f.amount, 0);

  // Student search for modal
  const studentResults = STUDENTS.filter(s => {
    const q = norm(payStudentSearch);
    return !q || norm(`${s.first} ${s.last}`).includes(q) || s.dni.includes(payStudentSearch);
  }).slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className={`grid gap-3 ${isMobile?'grid-cols-2':'grid-cols-2 md:grid-cols-4'}`}>
        <KpiCard label="Cobrado en mayo" value={fmt$(fees.filter(f=>f.status==='paid').reduce((a,f)=>a+f.amount,0))} sub={`${fees.filter(f=>f.status==='paid').length} cuotas`}/>
        <KpiCard label="Deuda total" value={fmt$(fees.filter(f=>f.status==='overdue').reduce((a,f)=>a+f.amount,0))} sub={`${fees.filter(f=>f.status==='overdue').length} cuotas`} delta="urgente" deltaTone="negative"/>
        <KpiCard label="Pendientes" value={fees.filter(f=>f.status==='pending').length.toString()} sub="por vencer"/>
        <KpiCard label="Tasa cobranza" value="78%" delta="+4 pp" deltaTone="positive" sub="vs abril"/>
      </div>

      {/* Toolbar: tabs + Registrar pago button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1"
          style={{background:'var(--bg-muted)',borderRadius:4,border:'1px solid var(--border)',width:'fit-content'}}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={()=>setFilter(tab.id)}
              className="px-3 py-1.5 text-[12.5px] font-medium transition-all flex items-center gap-1.5"
              style={{background:filter===tab.id?'var(--bg)':'transparent',color:filter===tab.id?'var(--text)':'var(--text-muted)',borderRadius:3,boxShadow:filter===tab.id?'0 0 0 1px var(--border)':'none'}}>
              {tab.label} <span className="tnum text-[11px]" style={{color:'var(--text-faint)'}}>{tab.count}</span>
            </button>
          ))}
        </div>
        <button onClick={()=>openPay()} className="btn btn-primary">
          <Icon name="DollarSign" size={14}/> Registrar pago
        </button>
      </div>

      {/* Desktop table */}
      <Card className={`${isMobile?'hidden':'hidden md:block'} overflow-hidden`}>
        <table className="tbl">
          <thead><tr><th>Alumno</th><th>Curso</th><th>Mes</th><th style={{textAlign:'right'}}>Monto</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filtered.map(f => {
              const s = STUDENTS.find(st => st.id === f.sid);
              const course = s ? COURSES.find(c => c.id === s.cid) : null;
              if (!s) return null;
              return (
                <tr key={f.id}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={`${s.first} ${s.last}`} size="xs"/><span className="font-medium">{s.first} {s.last}</span></div></td>
                  <td style={{color:'var(--text-muted)'}}>{course?.name}</td>
                  <td>{f.month}</td>
                  <td className="tnum font-medium" style={{textAlign:'right'}}>{fmt$(f.amount)}</td>
                  <td className="tnum" style={{color:'var(--text-muted)'}}>{f.due}</td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <Badge variant={feeVariant(f.status)}>{feeLabel(f.status)}</Badge>
                      {f.paid && <span className="text-[11px]" style={{color:'var(--text-faint)'}}>{f.paid} · {f.method}</span>}
                    </div>
                  </td>
                  <td style={{textAlign:'right'}}>
                    {f.status !== 'paid' && (
                      <button onClick={()=>openPay(f.sid, f.id)} className="btn btn-primary btn-sm">Cobrar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-5 py-3" style={{borderTop:'1px solid var(--border)'}}>
          <span className="text-[12px]" style={{color:'var(--text-faint)'}}>{filtered.length} registro{filtered.length!==1?'s':''}</span>
          {filter!=='paid' && <span className="text-[12.5px] tnum font-medium">Total: {fmt$(tableTotal)}</span>}
        </div>
      </Card>

      {/* Mobile cards */}
      <div className={`${isMobile?'':'md:hidden'} space-y-2.5`}>
        {filtered.map(f => {
          const s = STUDENTS.find(st=>st.id===f.sid);
          if (!s) return null;
          return (
            <Card key={f.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={`${s.first} ${s.last}`} size="md"/>
                  <div className="min-w-0">
                    <p className="font-medium text-[14px] truncate">{s.first} {s.last}</p>
                    <p className="text-[11.5px]" style={{color:'var(--text-faint)'}}>{f.month}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="tnum font-medium text-[14px]">{fmt$(f.amount)}</p>
                  <Badge variant={feeVariant(f.status)}>{feeLabel(f.status)}</Badge>
                </div>
              </div>
              {f.status !== 'paid' && (
                <button onClick={()=>openPay(f.sid, f.id)} className="btn btn-primary w-full mt-3 justify-center">Registrar pago</button>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Multi-fee payment modal ── */}
      {modalOpen && (
        <div className="overlay">
          <div className="card-hl w-full max-w-md flex flex-col" style={{background:'var(--bg)',maxHeight:'90vh',boxShadow:'0 8px 24px rgba(0,0,0,0.08)'}}>
            <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:'1px solid var(--border)'}}>
              <h3 className="text-[14px] font-semibold">Registrar pago</h3>
              <button onClick={()=>setModalOpen(false)} className="p-1 rounded hover:bg-zinc-100" style={{color:'var(--text-muted)'}}><Icon name="X" size={16}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Step 1: Student search */}
              <div>
                <label className="label">Alumno</label>
                <div className="relative mb-2">
                  <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{color:'var(--text-faint)'}}/>
                  <input value={payStudentSearch} onChange={e=>{setPayStudentSearch(e.target.value);setPayStudentId(null);setSelectedFeeIds([]);}}
                    placeholder="Nombre o DNI del alumno…" className="input" style={{paddingLeft:28}}/>
                </div>
                {/* Results dropdown */}
                {payStudentSearch && !payStudentId && (
                  <div style={{border:'1px solid var(--border)',borderRadius:4,overflow:'hidden'}}>
                    {studentResults.map(s => (
                      <button key={s.id} onClick={()=>{setPayStudentId(s.id);setPayStudentSearch(`${s.first} ${s.last}`);setSelectedFeeIds([]);}}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors"
                        style={{border:'none',borderBottom:'1px solid var(--border)'}}>
                        <Avatar name={`${s.first} ${s.last}`} size="xs"/>
                        <div><p className="text-[13px] font-medium">{s.first} {s.last}</p>
                          <p className="text-[11px] tnum" style={{color:'var(--text-faint)'}}>{s.dni}</p></div>
                        <Badge variant={feeVariant(s.feeStatus)}>{feeLabel(s.feeStatus)}</Badge>
                      </button>
                    ))}
                    {!studentResults.length && <p className="text-[12.5px] px-4 py-3" style={{color:'var(--text-faint)'}}>Sin resultados</p>}
                  </div>
                )}
                {payStudentId && (() => {
                  const ps = STUDENTS.find(s=>s.id===payStudentId);
                  return ps ? (
                    <div className="flex items-center gap-2 px-3 py-2" style={{background:'var(--brand-soft)',border:'1px solid var(--brand-border)',borderRadius:4}}>
                      <Avatar name={`${ps.first} ${ps.last}`} size="xs" tone="brand"/>
                      <span className="text-[13px] font-medium flex-1">{ps.first} {ps.last}</span>
                      <button onClick={()=>{setPayStudentId(null);setPayStudentSearch('');setSelectedFeeIds([]);}} style={{color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer'}}>
                        <Icon name="X" size={13}/>
                      </button>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Step 2: Fee checkboxes */}
              {payStudentId && (
                <div>
                  <label className="label">Cuotas pendientes / vencidas</label>
                  {studentFees.length === 0 ? (
                    <p className="text-[12.5px]" style={{color:'var(--text-faint)'}}>Este alumno no tiene cuotas pendientes.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {studentFees.map(f => {
                        const checked = selectedFeeIds.includes(f.id);
                        const s = STUDENTS.find(st=>st.id===f.sid);
                        return (
                          <button key={f.id} onClick={()=>setSelectedFeeIds(prev=>checked?prev.filter(x=>x!==f.id):[...prev,f.id])}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
                            style={{border:`1px solid ${checked?'var(--brand)':'var(--border)'}`,background:checked?'var(--brand-soft)':'var(--bg)',borderRadius:4}}>
                            <div className="flex items-center justify-center flex-shrink-0"
                              style={{width:16,height:16,border:`1px solid ${checked?'var(--brand)':'var(--border-strong)'}`,background:checked?'var(--brand)':'var(--bg)',borderRadius:2}}>
                              {checked&&<Icon name="Check" size={11} strokeWidth={2.5} style={{color:'#fff'}}/>}
                            </div>
                            <span className="flex-1 text-[13px] font-medium">{f.month}</span>
                            <Badge variant={feeVariant(f.status)}>{feeLabel(f.status)}</Badge>
                            <span className="tnum text-[13px] font-semibold" style={{color:checked?'var(--brand)':'var(--text)'}}>{fmt$(f.amount)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Total */}
              {selectedFeeIds.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3"
                  style={{background:'var(--bg-subtle)',border:'1px solid var(--border)',borderRadius:4}}>
                  <div>
                    <p className="eyebrow">Total a cobrar</p>
                    <p className="text-[11.5px] mt-0.5" style={{color:'var(--text-faint)'}}>{selectedFeeIds.length} cuota{selectedFeeIds.length!==1?'s':''} seleccionada{selectedFeeIds.length!==1?'s':''}</p>
                  </div>
                  <p className="num-display tnum" style={{fontSize:22,color:'var(--brand)'}}>{fmt$(multiTotal)}</p>
                </div>
              )}

              {/* Method */}
              <div>
                <label className="label">Método de pago</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {methods.map(m=>(
                    <button key={m} onClick={()=>setPayMethod(m)}
                      className="py-2 px-3 text-[12.5px] font-medium transition-all"
                      style={{border:`1px solid ${payMethod===m?'var(--brand)':'var(--border)'}`,background:payMethod===m?'var(--brand-soft)':'var(--bg)',color:payMethod===m?'var(--brand)':'var(--text)',borderRadius:4}}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Fecha de pago</label>
                <input value={payDate} onChange={e=>setPayDate(e.target.value)} className="input"/>
              </div>

              <div>
                <label className="label">Notas <span style={{color:'var(--text-faint)',fontWeight:400}}>· opcional</span></label>
                <textarea value={payNotes} onChange={e=>setPayNotes(e.target.value)} rows={2} placeholder="Ej: pago parcial acordado con la familia"
                  className="input" style={{resize:'none',padding:10,lineHeight:1.5}}/>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4" style={{borderTop:'1px solid var(--border)'}}>
              <button onClick={()=>setModalOpen(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmPay}
                disabled={!selectedFeeIds.length}
                className="btn btn-primary flex-1"
                style={{opacity:selectedFeeIds.length?1:0.45}}>
                Confirmar {selectedFeeIds.length > 0 ? `(${selectedFeeIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5"
          style={{background:'var(--text)',color:'#fff',borderRadius:4,fontSize:13,fontWeight:500}}>
          <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--brand-dot)'}}/> {toast}
        </div>
      )}
    </div>
  );
};

// ── Admin Courses ───────────────────────────────────────────────────────────
// ── Admin Courses — full ABM ─────────────────────────────────────────────
const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const AdminCourses = () => {
  const isMobile = useIsMobile();
  const [courses, setCourses] = useState(() =>
    COURSES.map(c => ({ ...c, status:'active', cupo:30, schedules:schedulesFor(c.id) }))
  );
  const [search, setSearch]       = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterProf, setFilterProf]   = useState('');
  const [modal, setModal]         = useState(null);
  const [viewStudents, setViewStudents] = useState(null);
  const [form, setForm]           = useState({});
  const [horarios, setHorarios]   = useState([{dia:'Lunes',ini:'18:00',fin:'19:30'}]);
  const [toast, setToast]         = useState('');

  const professors = [...new Set(COURSES.map(c => c.teacher))];
  const levels = ['Kids','Teens','Adults','Cambridge'];

  const openNew = () => {
    setForm({name:'',level:'Kids',teacher:professors[0],room:'',cupo:30,status:'active'});
    setHorarios([{dia:'Lunes',ini:'18:00',fin:'19:30'}]);
    setModal({mode:'new'});
  };
  const openEdit = c => {
    setForm({...c});
    setHorarios(c.schedules?.length ? c.schedules.map(h=>({...h})) : [{dia:'Lunes',ini:'18:00',fin:'19:30'}]);
    setModal({mode:'edit',course:c});
  };
  const saveModal = () => {
    if (modal.mode==='new') setCourses(prev=>[...prev,{...form,id:Date.now(),count:0,schedules:horarios}]);
    else setCourses(prev=>prev.map(c=>c.id===modal.course.id?{...c,...form,schedules:horarios}:c));
    setToast(modal.mode==='new'?'Curso creado correctamente':'Cambios guardados');
    setModal(null); setTimeout(()=>setToast(''),2500);
  };
  const toggleStatus = id => setCourses(prev=>prev.map(c=>c.id===id?{...c,status:c.status==='active'?'inactive':'active'}:c));

  const filtered = courses.filter(c=>{
    const q=norm(search);
    return (!q||norm(c.name).includes(q)||norm(c.teacher).includes(q))
      &&(!filterLevel||c.level===filterLevel)&&(!filterProf||c.teacher===filterProf);
  });

  if (viewStudents) {
    const studs = STUDENTS.filter(s=>s.cid===viewStudents.id);
    return (
      <div className="space-y-4">
        <button onClick={()=>setViewStudents(null)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{color:'var(--text-subtle)',background:'none',border:'none',cursor:'pointer'}}>
          <Icon name="ChevronLeft" size={14}/> Cursos
          <span style={{color:'var(--text-faint)'}}>/</span>
          <span style={{color:'var(--text)'}}>{viewStudents.name}</span>
        </button>
        <Panel title={`Alumnos inscriptos — ${viewStudents.name}`}
          action={<span className="text-[12px] tnum" style={{color:'var(--text-faint)'}}>{studs.length}/{viewStudents.cupo||30} alumnos</span>}>
          <table className="tbl">
            <thead><tr><th>Alumno</th><th>Cuota</th><th>Asistencia</th></tr></thead>
            <tbody>
              {studs.map(s=>{const att=attendanceFor(s);return(
                <tr key={s.id}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={`${s.first} ${s.last}`} size="xs"/><span className="font-medium">{s.first} {s.last}</span></div></td>
                  <td><Badge variant={feeVariant(s.feeStatus)}>{feeLabel(s.feeStatus)}</Badge></td>
                  <td><div className="flex items-center gap-2"><div className="bar-track" style={{width:56}}><div className="bar-fill" style={{width:att.pct+'%'}}/></div><span className="tnum text-[12px]">{att.pct}%</span></div></td>
                </tr>
              );})}
              {!studs.length&&<tr><td colSpan={3} className="text-center" style={{color:'var(--text-faint)',padding:'24px'}}>Sin alumnos inscriptos</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="relative">
            <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{color:'var(--text-faint)'}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar curso o profesor…" className="input" style={{paddingLeft:28,minWidth:180}}/>
          </div>
          <select value={filterLevel} onChange={e=>setFilterLevel(e.target.value)} className="select" style={{width:'auto'}}>
            <option value="">Todos los niveles</option>
            {levels.map(l=><option key={l} value={l}>{l}</option>)}
          </select>
          <select value={filterProf} onChange={e=>setFilterProf(e.target.value)} className="select" style={{width:'auto'}}>
            <option value="">Todos los profesores</option>
            {professors.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button onClick={openNew} className="btn btn-primary"><Icon name="Plus" size={14}/> Nuevo curso</button>
      </div>

      <Card className={`overflow-hidden ${isMobile?'hidden':'hidden md:block'}`}>
        <table className="tbl">
          <thead><tr><th>Nombre</th><th>Nivel</th><th>Profesor</th><th>Horarios</th><th>Alumnos</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filtered.map(c=>(
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td><LevelBadge level={c.level}>{c.level}</LevelBadge></td>
                <td style={{color:'var(--text-muted)'}}>{c.teacher}</td>
                <td>{(c.schedules||[]).map((h,i)=><div key={i} className="text-[12px] tnum" style={{color:'var(--text-muted)'}}>{h.dia} {h.ini}</div>)}</td>
                <td className="tnum">{c.count}/{c.cupo||30}</td>
                <td><span className={`status ${c.status==='active'?'paid':''}`} style={c.status!=='active'?{background:'var(--bg-muted)',color:'var(--text-muted)'}:{}}>{c.status==='active'?'Activo':'Inactivo'}</span></td>
                <td style={{textAlign:'right'}}>
                  <div className="flex items-center gap-1 justify-end">
                    <button className="p-1.5 rounded hover:bg-zinc-100" style={{color:'var(--text-muted)'}} onClick={()=>openEdit(c)} title="Editar"><Icon name="Pencil" size={14}/></button>
                    <button className="p-1.5 rounded hover:bg-zinc-100" style={{color:'var(--text-muted)'}} onClick={()=>setViewStudents(c)} title="Ver alumnos"><Icon name="Users" size={14}/></button>
                    <button className="p-1.5 rounded hover:bg-zinc-100" style={{color:'var(--text-muted)'}} onClick={()=>toggleStatus(c.id)}><Icon name={c.status==='active'?'ToggleRight':'ToggleLeft'} size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className={`${isMobile?'':'md:hidden'} space-y-2.5`}>
        {filtered.map(c=>(
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div><LevelBadge level={c.level}>{c.level}</LevelBadge>
                <p className="text-[14px] font-semibold mt-1">{c.name}</p>
                <p className="text-[12px]" style={{color:'var(--text-muted)'}}>{c.teacher}</p>
              </div>
              <span className={`status ${c.status==='active'?'paid':''}`}>{c.status==='active'?'Activo':'Inactivo'}</span>
            </div>
            <div className="flex gap-2 pt-3" style={{borderTop:'1px solid var(--border)'}}>
              <button onClick={()=>openEdit(c)} className="btn btn-secondary flex-1 justify-center btn-sm"><Icon name="Pencil" size={13}/> Editar</button>
              <button onClick={()=>setViewStudents(c)} className="btn btn-secondary flex-1 justify-center btn-sm"><Icon name="Users" size={13}/> Alumnos</button>
            </div>
          </Card>
        ))}
      </div>

      {modal&&(
        <div className="overlay">
          <div className="card-hl w-full max-w-lg flex flex-col" style={{background:'var(--bg)',maxHeight:'90vh',boxShadow:'0 8px 24px rgba(0,0,0,0.08)'}}>
            <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:'1px solid var(--border)'}}>
              <h3 className="text-[14px] font-semibold">{modal.mode==='new'?'Nuevo curso':'Editar curso'}</h3>
              <button onClick={()=>setModal(null)} className="p-1 rounded hover:bg-zinc-100" style={{color:'var(--text-muted)'}}><Icon name="X" size={16}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid gap-3.5 grid-cols-2">
                <div className="col-span-2"><label className="label">Nombre del curso</label><input value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ej: Teens A2 - Turno Tarde" className="input"/></div>
                <div><label className="label">Nivel</label><select value={form.level||'Kids'} onChange={e=>setForm(f=>({...f,level:e.target.value}))} className="select">{levels.map(l=><option key={l}>{l}</option>)}</select></div>
                <div><label className="label">Aula</label><input value={form.room||''} onChange={e=>setForm(f=>({...f,room:e.target.value}))} placeholder="Aula 1" className="input"/></div>
                <div><label className="label">Profesor asignado</label><select value={form.teacher||professors[0]} onChange={e=>setForm(f=>({...f,teacher:e.target.value}))} className="select">{professors.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="label">Cupo máximo</label><input type="number" min="1" max="60" value={form.cupo||30} onChange={e=>setForm(f=>({...f,cupo:Number(e.target.value)}))} className="input"/></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label" style={{marginBottom:0}}>Horarios de clase</label>
                  <button onClick={()=>setHorarios(h=>[...h,{dia:'Lunes',ini:'18:00',fin:'19:30'}])} className="btn btn-ghost btn-sm"><Icon name="Plus" size={12}/> Agregar</button>
                </div>
                <div className="space-y-2">
                  {horarios.map((h,i)=>(
                    <div key={i} className="flex items-center gap-2">
                      <select value={h.dia} onChange={e=>setHorarios(hs=>hs.map((x,j)=>j===i?{...x,dia:e.target.value}:x))} className="select" style={{flex:2}}>{DIAS.map(d=><option key={d} value={d}>{d}</option>)}</select>
                      <input value={h.ini} onChange={e=>setHorarios(hs=>hs.map((x,j)=>j===i?{...x,ini:e.target.value}:x))} className="input" style={{flex:1}} placeholder="18:00"/>
                      <span style={{color:'var(--text-faint)',fontSize:12}}>–</span>
                      <input value={h.fin} onChange={e=>setHorarios(hs=>hs.map((x,j)=>j===i?{...x,fin:e.target.value}:x))} className="input" style={{flex:1}} placeholder="19:30"/>
                      {horarios.length>1&&<button onClick={()=>setHorarios(hs=>hs.filter((_,j)=>j!==i))} className="p-1.5 rounded hover:bg-zinc-100" style={{color:'var(--danger)',flexShrink:0}}><Icon name="Trash2" size={13}/></button>}
                    </div>
                  ))}
                </div>
              </div>
              <div><label className="label">Estado</label>
                <div className="flex gap-2">
                  {[['active','Activo'],['inactive','Inactivo']].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,status:v}))} className="flex-1 py-2 text-[12.5px] font-medium transition-all"
                      style={{border:`1px solid ${(form.status||'active')===v?'var(--brand)':'var(--border)'}`,background:(form.status||'active')===v?'var(--brand-soft)':'var(--bg)',color:(form.status||'active')===v?'var(--brand)':'var(--text)',borderRadius:4}}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4" style={{borderTop:'1px solid var(--border)'}}>
              <button onClick={()=>setModal(null)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={saveModal} className="btn btn-primary flex-1">{modal.mode==='new'?'Crear curso':'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}
      {toast&&(<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5"
        style={{background:'var(--text)',color:'#fff',borderRadius:4,fontSize:13,fontWeight:500}}>
        <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--brand-dot)'}}/> {toast}
      </div>)}
    </div>
  );
};
// ── Admin Professors — full ABM ─────────────────────────────────────────────
const PROF_INIT = [
  {id:1,name:'María Belén Ríos', dni:'28.334.001',tel:'2664-111001',email:'mb.rios@babylon.edu',  courses:['Adults B1'],                status:'active'},
  {id:2,name:'Carlos Andrade',   dni:'30.112.002',tel:'2664-111002',email:'c.andrade@babylon.edu',courses:['Teens A1','Teens A2'],       status:'active'},
  {id:3,name:'Diego Herrera',    dni:'27.556.003',tel:'2664-111003',email:'d.herrera@babylon.edu',courses:['Adults B2','Cambridge Prep'],status:'active'},
  {id:4,name:'Ana Laura Vega',   dni:'31.998.004',tel:'2664-111004',email:'a.vega@babylon.edu',   courses:['Kids Inicial','Kids Básico'],status:'active'},
  {id:5,name:'Gustavo Sánchez',  dni:'26.441.005',tel:'2664-111005',email:'g.sanchez@babylon.edu',courses:['Adults B1 Intensivo'],       status:'active'},
];
const AdminProfessors = () => {
  const isMobile = useIsMobile();
  const [profs, setProfs] = useState(PROF_INIT);
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [selCourses, setSelCourses] = useState([]);
  const [tempPwd, setTempPwd] = useState('');
  const [toast, setToast]   = useState('');

  const filtered = profs.filter(p=>{const q=norm(search);return!q||norm(p.name).includes(q)||norm(p.email).includes(q)||p.dni.includes(q);});
  const genPwd = ()=>{const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';return Array.from({length:12},()=>c[Math.floor(Math.random()*c.length)]).join('');};
  const openNew = ()=>{setForm({nombre:'',apellido:'',dni:'',tel:'',email:'',status:'active'});setSelCourses([]);setTempPwd(genPwd());setModal({mode:'new'});};
  const openEdit = p=>{const parts=p.name.split(' ');setForm({nombre:parts[0],apellido:parts.slice(1).join(' '),dni:p.dni,tel:p.tel,email:p.email,status:p.status});setSelCourses([...(p.courses||[])]);setTempPwd('');setModal({mode:'edit',prof:p});};
  const saveModal = ()=>{
    if(modal.mode==='new') setProfs(prev=>[...prev,{id:Date.now(),name:`${form.nombre} ${form.apellido}`.trim(),dni:form.dni,tel:form.tel,email:form.email,courses:selCourses,status:form.status||'active'}]);
    else setProfs(prev=>prev.map(p=>p.id===modal.prof.id?{...p,name:`${form.nombre} ${form.apellido}`.trim(),dni:form.dni,tel:form.tel,email:form.email,courses:selCourses,status:form.status}:p));
    setToast(modal.mode==='new'?`Usuario ${form.email} creado · contraseña temporal notificada`:'Cambios guardados correctamente');
    setModal(null); setTimeout(()=>setToast(''),3200);
  };
  const toggleStatus = id=>setProfs(prev=>prev.map(p=>p.id===id?{...p,status:p.status==='active'?'inactive':'active'}:p));
  const totalStudents = p=>p.courses.reduce((sum,name)=>{const c=COURSES.find(c=>c.name===name);return sum+(c?c.count:0);},0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative">
          <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{color:'var(--text-faint)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, DNI o email…" className="input" style={{paddingLeft:28,minWidth:220}}/>
        </div>
        <button onClick={openNew} className="btn btn-primary"><Icon name="UserPlus" size={14}/> Nuevo profesor</button>
      </div>

      <Card className={`overflow-hidden ${isMobile?'hidden':'hidden md:block'}`}>
        <table className="tbl">
          <thead><tr><th>Profesor</th><th>DNI</th><th>Teléfono</th><th>Cursos asignados</th><th>Alumnos</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filtered.map(p=>(
              <tr key={p.id} style={{opacity:p.status==='inactive'?0.55:1}}>
                <td><div className="flex items-center gap-2.5"><Avatar name={p.name} size="xs" tone="brand"/>
                  <div><p className="font-medium">{p.name}</p><p className="text-[11px] mono" style={{color:'var(--text-faint)'}}>{p.email}</p></div></div></td>
                <td className="mono tnum" style={{color:'var(--text-muted)'}}>{p.dni}</td>
                <td className="tnum" style={{color:'var(--text-muted)'}}>{p.tel}</td>
                <td><div className="flex flex-wrap gap-1">{p.courses.map(c=>{const lv=levelOf(c);return lv?<LevelBadge key={c} level={lv}>{c}</LevelBadge>:<Tag key={c}>{c}</Tag>;})}</div></td>
                <td className="tnum">{totalStudents(p)}</td>
                <td><span className={`status ${p.status==='active'?'paid':''}`} style={p.status!=='active'?{background:'var(--bg-muted)',color:'var(--text-muted)'}:{}}>{p.status==='active'?'Activo':'Inactivo'}</span></td>
                <td style={{textAlign:'right'}}><div className="flex items-center gap-1 justify-end">
                  <button className="p-1.5 rounded hover:bg-zinc-100" style={{color:'var(--text-muted)'}} onClick={()=>openEdit(p)}><Icon name="Pencil" size={14}/></button>
                  <button className="p-1.5 rounded hover:bg-zinc-100" style={{color:'var(--text-muted)'}} onClick={()=>toggleStatus(p.id)}><Icon name={p.status==='active'?'ToggleRight':'ToggleLeft'} size={16}/></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className={`${isMobile?'':'md:hidden'} space-y-2.5`}>
        {filtered.map(p=>(
          <Card key={p.id} className="p-4" style={{opacity:p.status==='inactive'?0.55:1}}>
            <div className="flex items-center gap-3">
              <Avatar name={p.name} size="md" tone="brand"/>
              <div className="flex-1 min-w-0"><p className="font-medium text-[14px]">{p.name}</p><p className="text-[11.5px] mono" style={{color:'var(--text-faint)'}}>{p.email}</p></div>
              <button onClick={()=>openEdit(p)} className="btn btn-ghost p-2"><Icon name="Pencil" size={15}/></button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{borderTop:'1px solid var(--border)'}}>
              {p.courses.map(c=>{const lv=levelOf(c);return lv?<LevelBadge key={c} level={lv}>{c}</LevelBadge>:<Tag key={c}>{c}</Tag>;})}
            </div>
          </Card>
        ))}
      </div>

      {modal&&(
        <div className="overlay">
          <div className="card-hl w-full max-w-md flex flex-col" style={{background:'var(--bg)',maxHeight:'90vh',boxShadow:'0 8px 24px rgba(0,0,0,0.08)'}}>
            <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:'1px solid var(--border)'}}>
              <h3 className="text-[14px] font-semibold">{modal.mode==='new'?'Nuevo profesor':'Editar profesor'}</h3>
              <button onClick={()=>setModal(null)} className="p-1 rounded hover:bg-zinc-100" style={{color:'var(--text-muted)'}}><Icon name="X" size={16}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Nombre</label><input value={form.nombre||''} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} className="input"/></div>
                <div><label className="label">Apellido</label><input value={form.apellido||''} onChange={e=>setForm(f=>({...f,apellido:e.target.value}))} className="input"/></div>
                <div><label className="label">DNI</label><input value={form.dni||''} onChange={e=>setForm(f=>({...f,dni:e.target.value}))} className="input mono"/></div>
                <div><label className="label">Teléfono</label><input value={form.tel||''} onChange={e=>setForm(f=>({...f,tel:e.target.value}))} className="input"/></div>
                <div className="col-span-2"><label className="label">Email (login del sistema)</label><input type="email" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="input mono"/></div>
              </div>
              {modal.mode==='new'&&tempPwd&&(
                <div className="px-3.5 py-3" style={{background:'var(--brand-soft)',border:'1px solid var(--brand-border)',borderRadius:4}}>
                  <p className="text-[12px] font-medium" style={{color:'var(--brand)'}}>Contraseña temporal generada automáticamente:</p>
                  <p className="mono text-[13px] font-semibold mt-1" style={{color:'var(--text)'}}>{tempPwd}</p>
                  <p className="text-[11px] mt-1" style={{color:'var(--text-muted)'}}>El profesor deberá cambiarla en su primer ingreso.</p>
                </div>
              )}
              <div><label className="label">Cursos asignados</label>
                <div className="flex flex-wrap gap-1.5">
                  {COURSES.map(c=>{const active=selCourses.includes(c.name);return(
                    <button key={c.id} onClick={()=>setSelCourses(prev=>active?prev.filter(x=>x!==c.name):[...prev,c.name])}
                      className="px-2.5 py-1 text-[12px] font-medium transition-all"
                      style={{border:`1px solid ${active?'var(--brand)':'var(--border)'}`,background:active?'var(--brand-soft)':'var(--bg)',color:active?'var(--brand)':'var(--text)',borderRadius:3}}>{c.name}</button>
                  );})}
                </div>
              </div>
              <div><label className="label">Estado</label>
                <div className="flex gap-2">
                  {[['active','Activo'],['inactive','Inactivo']].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,status:v}))} className="flex-1 py-2 text-[12.5px] font-medium transition-all"
                      style={{border:`1px solid ${(form.status||'active')===v?'var(--brand)':'var(--border)'}`,background:(form.status||'active')===v?'var(--brand-soft)':'var(--bg)',color:(form.status||'active')===v?'var(--brand)':'var(--text)',borderRadius:4}}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4" style={{borderTop:'1px solid var(--border)'}}>
              <button onClick={()=>setModal(null)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={saveModal} className="btn btn-primary flex-1">{modal.mode==='new'?'Crear profesor':'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}
      {toast&&(<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 text-center"
        style={{background:'var(--text)',color:'#fff',borderRadius:4,fontSize:12.5,fontWeight:500,maxWidth:320}}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:'var(--brand-dot)'}}/> {toast}
      </div>)}
    </div>
  );
};
// ── Admin Reports — real data + CSV/PDF export ───────────────────────────
const AdminReports = () => {
  const isMobile = useIsMobile();
  const [report, setReport]   = useState('cierre');
  const [cierre, setCierre]   = useState('julio');
  const [toast, setToast]     = useState('');

  // ── helper: get all student rows with computed stats ──
  const rows = STUDENTS.map(s => {
    const acad  = academicFor(s, cierre);
    const acad2 = academicFor(s, 'noviembre');
    const att   = attendanceFor(s);
    const fees  = feesFor(s);
    const course = COURSES.find(c => c.id === s.cid);
    const overdueCount = fees.filter(f => f.status === 'overdue').length;
    const paidCount    = fees.filter(f => f.status === 'paid').length;
    const pendingCount = fees.filter(f => f.status === 'pending').length;
    const debtAmt      = fees.filter(f => f.status !== 'paid').reduce((a,f)=>a+f.amount,0);
    const lastPaid     = fees.filter(f=>f.paid).map(f=>f.month).slice(-1)[0] || '—';
    const avg1 = parseFloat(acad.avg)||0;
    const avg2 = parseFloat(acad2.avg)||0;
    const avgAnual = avg1&&avg2 ? ((avg1+avg2)/2).toFixed(1) : (avg1||avg2||0).toFixed(1);
    // Notas de cierre (definidas por el profesor) — la promoción se basa en ellas
    const nc1 = notaCierreFor(s,'julio');
    const nc2 = notaCierreFor(s,'noviembre');
    const n1 = nc1 && nc1.estado==='publicada' ? nc1.nota : null;
    const n2 = nc2 && nc2.estado==='publicada' ? nc2.nota : null;
    const promotes = (n1!=null&&n2!=null) ? ((n1>=6&&n2>=6&&att.pct>=75)?'si':(n1<5||n2<5||att.pct<60)?'no':'evaluar')
      : n1!=null ? ((n1>=6&&att.pct>=75)?'si':(n1<5||att.pct<60)?'no':'evaluar')
      : 'evaluar';
    return { s, course, acad, att, fees, overdueCount, paidCount, pendingCount, debtAmt, lastPaid, avg1, avg2, avgAnual, nc1, nc2, n1, n2, promotes };
  });

  const ntone = v => v>=7?'var(--brand)':v>=5?'var(--warning)':'var(--danger)';

  // ── CSV export ──
  const downloadCSV = (headers, rowsData, filename) => {
    const lines = [headers.join(','), ...rowsData.map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(','))];
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename+'.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF via print ──
  const printReport = () => {
    window.print();
  };

  // ── Export buttons ──
  const ExportBar = ({onCSV}) => (
    <div className="flex items-center gap-2">
      <button onClick={printReport} className="btn btn-secondary btn-sm">
        <Icon name="Printer" size={13}/> PDF
      </button>
      <button onClick={onCSV} className="btn btn-secondary btn-sm">
        <Icon name="Download" size={13}/> Excel / CSV
      </button>
    </div>
  );

  // ── Report tabs ──
  const TABS = [
    {id:'cierre', label:'Cierre académico'},
    {id:'anual',  label:'Anual'},
    {id:'financiero', label:'Financiero'},
  ];

  // ── General stats for cierre ──
  const numericAvgs = rows.map(r=>r.avg1).filter(v=>v>0);
  const instAvg = numericAvgs.length ? (numericAvgs.reduce((a,v)=>a+v,0)/numericAvgs.length).toFixed(1) : '—';
  const pctAprobados = numericAvgs.length ? Math.round(numericAvgs.filter(v=>v>=7).length/numericAvgs.length*100) : 0;
  const attAvg = Math.round(rows.reduce((a,r)=>a+r.att.pct,0)/rows.length);
  const morosos = rows.filter(r=>r.overdueCount>0).length;

  const csvCierre = () => downloadCSV(
    ['Alumno','Curso','Promedio','Nota de cierre','Asistencia %','Estado cuota','Obs'],
    rows.map(r=>[
      `${r.s.first} ${r.s.last}`, r.course?.name||'—',
      r.avg1||'—', (cierre==='julio'?r.n1:r.n2) ?? '—', r.att.pct+'%',
      r.overdueCount>0?`Adeuda ${r.overdueCount} cuota/s`:'Al día', '—'
    ]), `Cierre_${cierre}_${new Date().toLocaleDateString('es-AR')}`
  );
  const csvAnual = () => downloadCSV(
    ['Alumno','Curso','Cierre 1°','Cierre 2°','Prom Anual','Asistencia','Estado financiero','Promociona'],
    rows.map(r=>[
      `${r.s.first} ${r.s.last}`, r.course?.name||'—',
      r.n1 ?? '—', r.n2 ?? '—', r.avgAnual,
      r.att.pct+'%',
      r.overdueCount>0?`Adeuda ${r.overdueCount}`:'Al día',
      r.promotes==='si'?'Sí':r.promotes==='no'?'No':'A evaluar'
    ]), `Reporte_Anual_${new Date().toLocaleDateString('es-AR')}`
  );
  const csvFinanciero = () => downloadCSV(
    ['Alumno','Curso','Cuotas pagas','Pendientes','Vencidas','Total adeudado','Último pago'],
    rows.map(r=>[
      `${r.s.first} ${r.s.last}`, r.course?.name||'—',
      r.paidCount, r.pendingCount, r.overdueCount, fmt$(r.debtAmt), r.lastPaid
    ]), `Reporte_Financiero_${new Date().toLocaleDateString('es-AR')}`
  );

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          .no-print { display:none !important; }
          .print-only { display:block !important; }
          body * { visibility:hidden; }
          #report-content, #report-content * { visibility:visible; }
          #report-content { position:absolute;left:0;top:0;width:100%; }
        }
        .print-only { display:none; }
      `}</style>

      {/* Tab selector */}
      <div className="flex items-center gap-1 p-1 no-print"
        style={{background:'var(--bg-muted)',borderRadius:4,border:'1px solid var(--border)',width:'fit-content'}}>
        {TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setReport(tab.id)}
            className="px-3 py-1.5 text-[12.5px] font-medium transition-all"
            style={{background:report===tab.id?'var(--bg)':'transparent',color:report===tab.id?'var(--text)':'var(--text-muted)',borderRadius:3,boxShadow:report===tab.id?'0 0 0 1px var(--border)':'none'}}>
            {tab.label}
          </button>
        ))}
      </div>

      <div id="report-content">
        <p className="print-only text-[11px] mb-4" style={{color:'var(--text-faint)'}}>Instituto Babylon — Reporte generado el {new Date().toLocaleDateString('es-AR')}</p>

        {/* ── Cierre Académico ── */}
        {report==='cierre'&&(
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 no-print">
              <div className="flex items-center gap-2">
                <span className="eyebrow mr-1">Cierre:</span>
                {[['julio','1° Cierre (Julio)'],['noviembre','2° Cierre (Noviembre)']].map(([id,lbl])=>(
                  <button key={id} onClick={()=>setCierre(id)}
                    className="px-3 py-1.5 text-[12.5px] font-medium transition-all"
                    style={{background:cierre===id?'var(--brand)':'var(--bg)',color:cierre===id?'#fff':'var(--text)',border:`1px solid ${cierre===id?'var(--brand)':'var(--border)'}`,borderRadius:4}}>
                    {lbl}
                  </button>
                ))}
              </div>
              <ExportBar onCSV={csvCierre}/>
            </div>
            <div className={`grid gap-3 ${isMobile?'grid-cols-2':'grid-cols-2 md:grid-cols-4'}`}>
              <KpiCard label="Promedio instituto" value={instAvg}/>
              <KpiCard label="Aprobados (≥7)" value={pctAprobados+'%'}/>
              <KpiCard label="Asistencia prom." value={attAvg+'%'}/>
              <KpiCard label="Alumnos morosos" value={morosos.toString()} delta={morosos>5?'revisar':undefined} deltaTone="negative"/>
            </div>
            <Card className="overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Alumno</th><th>Curso</th><th>Promedio</th><th>Nota de cierre</th><th>Asistencia</th><th>Cuotas</th><th>Obs.</th></tr></thead>
                <tbody>
                  {rows.map(({s,course,acad,att,overdueCount,n1,n2,nc1},i)=>{
                    const nc = cierre==='julio' ? n1 : n2;
                    const isDraft = cierre==='julio' && nc1 && nc1.estado==='borrador';
                    return (
                    <tr key={s.id}>
                      <td><div className="flex items-center gap-2.5"><Avatar name={`${s.first} ${s.last}`} size="xs"/><span className="font-medium">{s.first} {s.last}</span></div></td>
                      <td style={{color:'var(--text-muted)'}}>{course?.name||'—'}</td>
                      <td>
                        {acad.avg
                          ? <span className="tnum font-semibold" style={{color:ntone(parseFloat(acad.avg))}}>{acad.avg}</span>
                          : <span style={{color:'var(--text-faint)'}}>—</span>}
                      </td>
                      <td>
                        {nc!=null
                          ? <span className="tnum font-semibold" style={{color:ntone(nc)}}>{nc}</span>
                          : isDraft
                          ? <span className="status pending">Borrador</span>
                          : <span style={{color:'var(--text-faint)'}}>—</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="bar-track" style={{width:48}}><div className="bar-fill" style={{width:att.pct+'%'}}/></div>
                          <span className="tnum text-[12px]">{att.pct}%</span>
                        </div>
                      </td>
                      <td>
                        {overdueCount>0
                          ? <span className="status overdue">Adeuda {overdueCount}</span>
                          : <span className="status paid">Al día</span>}
                      </td>
                      <td style={{color:'var(--text-faint)'}}>—</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ── Anual ── */}
        {report==='anual'&&(
          <div className="space-y-4">
            <div className="flex justify-end no-print"><ExportBar onCSV={csvAnual}/></div>
            <Card className="overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Alumno</th><th>Curso</th><th>Cierre 1°</th><th>Cierre 2°</th><th>Prom Anual</th><th>Asistencia</th><th>Financiero</th><th>Promociona</th></tr></thead>
                <tbody>
                  {rows.map(({s,course,att,overdueCount,avg1,avg2,avgAnual,promotes,n1,n2})=>(
                    <tr key={s.id}>
                      <td><div className="flex items-center gap-2.5"><Avatar name={`${s.first} ${s.last}`} size="xs"/><span className="font-medium">{s.first} {s.last}</span></div></td>
                      <td style={{color:'var(--text-muted)'}}>{course?.name||'—'}</td>
                      <td className="tnum font-semibold" style={{color:n1!=null?ntone(n1):'var(--text-faint)'}}>{n1 ?? '—'}</td>
                      <td className="tnum font-semibold" style={{color:n2!=null?ntone(n2):'var(--text-faint)'}}>{n2 ?? '—'}</td>
                      <td><span className="tnum" style={{color:ntone(parseFloat(avgAnual))}}>{avgAnual}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="bar-track" style={{width:48}}><div className="bar-fill" style={{width:att.pct+'%'}}/></div>
                          <span className="tnum text-[12px]">{att.pct}%</span>
                        </div>
                      </td>
                      <td>{overdueCount>0?<span className="status overdue">Adeuda {overdueCount}</span>:<span className="status paid">Al día</span>}</td>
                      <td>
                        {promotes==='si'&&<span className="status paid">Sí</span>}
                        {promotes==='no'&&<span className="status overdue">No</span>}
                        {promotes==='evaluar'&&<span className="status pending">A evaluar</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ── Financiero ── */}
        {report==='financiero'&&(
          <div className="space-y-4">
            <div className="flex justify-end no-print"><ExportBar onCSV={csvFinanciero}/></div>
            <div className={`grid gap-3 ${isMobile?'grid-cols-2':'grid-cols-2 md:grid-cols-4'}`}>
              <KpiCard label="Recaudado (año)" value={fmt$(rows.reduce((a,r)=>a+r.paidCount*35000,0))} sub={rows.reduce((a,r)=>a+r.paidCount,0)+' cuotas'}/>
              <KpiCard label="Total adeudado" value={fmt$(rows.reduce((a,r)=>a+r.debtAmt,0))} deltaTone="negative"/>
              <KpiCard label="Al día" value={rows.filter(r=>r.overdueCount===0).length.toString()} sub="alumnos"/>
              <KpiCard label="Morosos" value={morosos.toString()} sub="alumnos"/>
            </div>
            <Card className="overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Alumno</th><th>Curso</th><th>Pagas</th><th>Pendientes</th><th>Vencidas</th><th>Adeuda</th><th>Último pago</th></tr></thead>
                <tbody>
                  {rows.map(({s,course,paidCount,pendingCount,overdueCount,debtAmt,lastPaid})=>(
                    <tr key={s.id}>
                      <td><div className="flex items-center gap-2.5"><Avatar name={`${s.first} ${s.last}`} size="xs"/><span className="font-medium">{s.first} {s.last}</span></div></td>
                      <td style={{color:'var(--text-muted)'}}>{course?.name||'—'}</td>
                      <td className="tnum" style={{color:'var(--brand)'}}>{paidCount}</td>
                      <td className="tnum" style={{color:'var(--warning)'}}>{pendingCount}</td>
                      <td className="tnum" style={{color:overdueCount?'var(--danger)':'var(--text-faint)'}}>{overdueCount}</td>
                      <td className="tnum font-medium" style={{color:debtAmt?'var(--danger)':'var(--text)'}}>{debtAmt?fmt$(debtAmt):'—'}</td>
                      <td style={{color:'var(--text-muted)'}}>{lastPaid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Admin Settings (stub) ───────────────────────────────────────────────────
const AdminSettings = () => (
  <Card className="max-w-xl p-8">
    <p className="eyebrow">Configuración</p>
    <h3 className="text-[18px] font-semibold mt-2" style={{ color: 'var(--text)', letterSpacing: '-0.015em' }}>
      Parámetros del sistema
    </h3>
    <p className="text-[13.5px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
      Cuota base, ciclo lectivo, niveles, descuentos por hermano, métodos de pago aceptados y preferencias generales.
    </p>
    <p className="text-[12px] mt-4" style={{ color: 'var(--text-faint)' }}>Esta sección está en desarrollo.</p>
  </Card>
);

// ── Admin Users ────────────────────────────────────────────────────────────
const AdminUsers = () => {
  const isMobile = useIsMobile();
  const [users, setUsers] = useState(SYSTEM_USERS);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'teacher', courses:[], students:[] });

  const toggleStatus = id =>
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u));

  const generatePassword = () => {
    const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    setForm(f => ({ ...f, password: Array.from({length:12},()=>c[Math.floor(Math.random()*c.length)]).join('') }));
  };

  const ROLE_DESC = {
    admin:     'Acceso total al sistema, incluyendo configuración y datos sensibles.',
    secretary: 'Puede gestionar legajos y registrar pagos. Sin acceso a reportes ni configuración.',
    teacher:   'Accede solo a sus cursos asignados. No ve información de pagos.',
    parent:    'Solo puede ver la información de sus hijos vinculados.',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--text)' }}>{users.filter(u=>u.status==='active').length}</span> usuarios activos
          <span style={{ color: 'var(--text-faint)' }}> · {users.length} en total</span>
        </p>
        <button onClick={() => { setForm({name:'',email:'',password:'',role:'teacher',courses:[],students:[]}); setShowCreate(true); }}
          className="btn btn-primary">
          <Icon name="UserPlus" size={14} /> Crear usuario
        </button>
      </div>

      {/* Desktop table */}
      <Card className={`${isMobile ? 'hidden' : 'hidden md:block'} overflow-hidden`}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Creado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const rl = ROLE_LABELS[u.role] || ROLE_LABELS.parent;
              return (
                <tr key={u.id} style={{ opacity: u.status === 'inactive' ? 0.5 : 1 }}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} size="xs" />
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="mono text-[12px]" style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11.5px] font-medium"
                      style={{ background: rl.bg, color: rl.color, borderRadius: 2 }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: rl.dot }} />
                      {rl.label}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => toggleStatus(u.id)}
                      className="relative inline-flex items-center"
                      style={{ width: 30, height: 18, background: u.status === 'active' ? 'var(--brand)' : 'var(--bg-active, #D4D4D8)', borderRadius: 999, transition: 'background 150ms ease' }}>
                      <span className="absolute" style={{
                        width: 12, height: 12, background: '#fff', borderRadius: 999,
                        left: u.status === 'active' ? 15 : 3,
                        transition: 'left 150ms ease',
                      }} />
                    </button>
                  </td>
                  <td className="tnum" style={{ color: 'var(--text-faint)' }}>{u.created}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="p-1.5 rounded hover:bg-zinc-100" style={{ color: 'var(--text-muted)' }}>
                      <Icon name="MoreHorizontal" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className={`${isMobile ? '' : 'md:hidden'} space-y-2.5`}>
        {users.map(u => {
          const rl = ROLE_LABELS[u.role] || ROLE_LABELS.parent;
          return (
            <Card key={u.id} className="p-4" style={{ opacity: u.status === 'inactive' ? 0.5 : 1 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={u.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium truncate">{u.name}</p>
                    <p className="text-[11.5px] mono truncate" style={{ color: 'var(--text-faint)' }}>{u.email}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium flex-shrink-0"
                  style={{ background: rl.bg, color: rl.color, borderRadius: 2 }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: rl.dot }} />
                  {rl.label}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="overlay">
          <div className="card-hl w-full max-w-md flex flex-col" style={{ background: 'var(--bg)', maxHeight: '90vh', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-[14px] font-semibold">Crear usuario</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-zinc-100" style={{ color: 'var(--text-muted)' }}>
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {[['Nombre completo','text','name'],['Email (usuario de acceso)','email','email']].map(([lbl,type,field]) => (
                <div key={field}>
                  <label className="label">{lbl}</label>
                  <input type={type} value={form[field]} onChange={e => setForm(f=>({...f,[field]:e.target.value}))} className="input" />
                </div>
              ))}
              <div>
                <label className="label">Contraseña temporal</label>
                <div className="flex gap-2">
                  <input value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))}
                    placeholder="Ingresá o generá" className="input mono" />
                  <button onClick={generatePassword} className="btn btn-secondary flex-shrink-0">Generar</button>
                </div>
              </div>

              <div>
                <label className="label">Rol</label>
                <div className="space-y-1.5">
                  {[['admin','Administrador'],['secretary','Secretario'],['teacher','Profesor'],['parent','Padre / Tutor']].map(([val,lbl]) => {
                    const sel = form.role === val;
                    return (
                      <button key={val} onClick={() => setForm(f=>({...f,role:val,courses:[],students:[]}))}
                        className="w-full text-left px-3.5 py-3 transition-all"
                        style={{
                          border: `1px solid ${sel ? 'var(--brand)' : 'var(--border)'}`,
                          background: sel ? 'var(--brand-soft)' : 'var(--bg)',
                          borderRadius: 4,
                        }}>
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center justify-center flex-shrink-0"
                            style={{ width: 14, height: 14, border: `1px solid ${sel ? 'var(--brand)' : 'var(--border-strong)'}`, background: sel ? 'var(--brand)' : 'var(--bg)', borderRadius: 999 }}>
                            {sel && <span style={{ width: 4, height: 4, background: '#fff', borderRadius: 999 }} />}
                          </span>
                          <span className="text-[13px] font-medium" style={{ color: sel ? 'var(--brand)' : 'var(--text)' }}>{lbl}</span>
                        </div>
                        <p className="text-[11.5px] mt-1.5" style={{ marginLeft: 22, color: sel ? 'var(--brand)' : 'var(--text-muted)', opacity: sel ? 0.85 : 1 }}>{ROLE_DESC[val]}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.role === 'admin' && (
                <div className="flex items-start gap-2 px-3.5 py-3"
                  style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 4 }}>
                  <Icon name="AlertTriangle" size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                  <p className="text-[12px]" style={{ color: 'var(--danger)' }}>
                    Acceso total al sistema. Asignar únicamente a personal de máxima confianza.
                  </p>
                </div>
              )}

              {form.role === 'teacher' && (
                <div>
                  <label className="label">Cursos asignados</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COURSES.map(c => {
                      const active = form.courses.includes(c.id);
                      return (
                        <button key={c.id}
                          onClick={() => setForm(f=>({...f,courses:active?f.courses.filter(x=>x!==c.id):[...f.courses,c.id]}))}
                          className="px-2.5 py-1 text-[12px] font-medium transition-all"
                          style={{
                            border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                            background: active ? 'var(--brand-soft)' : 'var(--bg)',
                            color: active ? 'var(--brand)' : 'var(--text)',
                            borderRadius: 3,
                          }}>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.role === 'parent' && (
                <div>
                  <label className="label">Hijos vinculados</label>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {STUDENTS.map(s => {
                      const active = form.students.includes(s.id);
                      const course = COURSES.find(c => c.id === s.cid);
                      const isSecond = active && form.students.indexOf(s.id) > 0;
                      return (
                        <button key={s.id}
                          onClick={() => setForm(f=>({...f,students:active?f.students.filter(x=>x!==s.id):[...f.students,s.id]}))}
                          className="w-full flex items-center gap-3 px-3 py-2 transition-all text-left"
                          style={{
                            border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                            background: active ? 'var(--brand-soft)' : 'var(--bg)',
                            borderRadius: 4,
                          }}>
                          <Avatar name={`${s.first} ${s.last}`} size="xs" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium">{s.first} {s.last}</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{course?.name}</p>
                          </div>
                          {isSecond && (
                            <span className="text-[10.5px] font-medium flex-shrink-0" style={{ color: 'var(--brand)' }}>−10 %</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {form.students.length > 1 && (
                    <p className="text-[11.5px] mt-2" style={{ color: 'var(--brand)' }}>
                      Descuento del 10 % aplicado a partir del segundo hijo.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowCreate(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={() => setShowCreate(false)} className="btn btn-primary flex-1">Crear usuario</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Student Legajo (detail) — reused by Admin & Secretario ──────────────────
const LegajoField = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
    <span className="text-[12px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{label}</span>
    <span className={`text-[13px] text-right ${mono ? 'mono tnum' : ''}`} style={{ color: 'var(--text)' }}>
      {value || <span style={{ color: 'var(--text-faint)' }}>—</span>}
    </span>
  </div>
);

const StudentLegajo = ({ student, role = 'admin', onBack }) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('info');
  const [period, setPeriod] = useState('julio');
  const [fees, setFees] = useState(() => feesFor(student));
  const [toast, setToast] = useState('');
  const canManage = role === 'admin';   // Generar reporte / Desactivar — solo Admin

  const s = studentFull(student);
  const course = COURSES.find(c => c.id === s.cid);
  const sibs = siblingsOf(student);
  const docs = docsFor(student.id);
  const horarios = course ? schedulesFor(course.id) : [];
  const acad = academicFor(student, period);
  const att = attendanceFor(student);
  const [obsList, setObsList] = useState(() => obsFor(student));
  const [obsFilter, setObsFilter] = useState('all');
  const [showNewObs, setShowNewObs] = useState(false);
  const [obsForm, setObsForm] = useState({ category:'administrativo', text:'' });
  const obs = obsList;

  const payFee = (idx) => {
    setFees(prev => prev.map((f, i) => i === idx ? { ...f, status:'paid', paid:'21/06/2026', method:'Efectivo' } : f));
    setToast('Pago registrado correctamente');
    setTimeout(() => setToast(''), 2600);
  };

  const tabs = [
    { id:'info',          label:'Información' },
    { id:'academico',     label:'Académico' },
    { id:'asistencia',    label:'Asistencia' },
    { id:'cuotas',        label:'Cuotas' },
    { id:'observaciones', label:'Observaciones' },
  ];

  return (
    <div className="space-y-5">

      {/* Breadcrumb */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color:'var(--text-subtle)', background:'none', border:'none', cursor:'pointer' }}>
        <Icon name="ChevronLeft" size={14} /> Alumnos
        <span style={{ color:'var(--text-faint)' }}>/</span>
        <span style={{ color:'var(--text)' }}>{s.first} {s.last}</span>
      </button>

      {/* Header card */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={`${s.first} ${s.last}`} size="lg" tone="brand" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold leading-tight" style={{ fontSize: 22, letterSpacing:'-0.02em', color:'var(--text)' }}>
              {s.first} {s.last}
            </h2>
            <p className="text-[12.5px] mono tnum mt-1" style={{ color:'var(--text-muted)' }}>DNI {s.dni}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {course && <LevelBadge course={course} />}
              <Badge variant={feeVariant(s.feeStatus)}>{feeLabel(s.feeStatus)}</Badge>
              <span className="status" style={{ background:'var(--brand-soft)', color:'var(--brand)' }}>
                <span style={{ width:5, height:5, borderRadius:999, background:'var(--brand-dot)' }} /> Activo
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <button className="btn btn-secondary" onClick={() => setToast('Edición de legajo (demo)')}>
              <Icon name="Pencil" size={14} /> Editar datos
            </button>
            {canManage && (
              <>
                <button className="btn btn-secondary" onClick={() => setToast('Generando reporte… (demo)')}>
                  <Icon name="FileText" size={14} /> Generar reporte
                </button>
                <button className="btn btn-danger" onClick={() => setToast('Alumno desactivado (demo)')}>
                  <Icon name="UserX" size={14} /> Desactivar alumno
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 overflow-x-auto"
        style={{ background:'var(--bg-muted)', borderRadius:4, border:'1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3 py-1.5 text-[12.5px] font-medium transition-all whitespace-nowrap"
            style={{
              background: tab === t.id ? 'var(--bg)' : 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              borderRadius:3, flex: isMobile ? '1 0 auto' : '0 0 auto',
              boxShadow: tab === t.id ? '0 0 0 1px var(--border)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Información personal ── */}
      {tab === 'info' && (
        <div className="space-y-4">
          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {/* Alumno */}
            <Panel title="Datos del alumno">
              <div className="p-5 pt-1">
                <LegajoField label="Nombre" value={`${s.first} ${s.last}`} />
                <LegajoField label="DNI" value={s.dni} mono />
                <LegajoField label="Fecha de nacimiento" value={s.birth ? `${s.birth} · ${s.age} años` : null} />
                <LegajoField label="Dirección" value={s.addr} />
                <LegajoField label="Teléfono" value={s.sPhone} mono />
                <LegajoField label="Email" value={s.sEmail} />
                <LegajoField label="Obs. médicas / alergias"
                  value={s.med
                    ? <span style={{ color:'var(--warning)' }}>{s.med}</span>
                    : <span style={{ color:'var(--text-faint)' }}>Ninguna registrada</span>} />
                <div className="flex items-center justify-between gap-4 pt-3">
                  <span className="text-[12px]" style={{ color:'var(--text-faint)' }}>Inscripción</span>
                  <span className="text-[13px]" style={{ color:'var(--text)' }}>
                    {s.enrolled} <span style={{ color:'var(--text-faint)' }}>· {s.antiguedad} {s.antiguedad === 1 ? 'año' : 'años'} de antigüedad</span>
                  </span>
                </div>
              </div>
            </Panel>

            {/* Padre/Tutor */}
            <Panel title="Datos del padre / tutor">
              <div className="p-5 pt-1">
                <LegajoField label="Nombre" value={s.parent} />
                <LegajoField label="DNI" value={s.pdni} mono />
                <LegajoField label="Vínculo" value={VINCULO_LABEL[s.vinculo] || '—'} />
                <LegajoField label="Dirección" value={s.paddr} />
                <LegajoField label="Teléfono" value={s.phone} mono />
                <LegajoField label="Email" value={s.email} />
                {sibs.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2"
                    style={{ background:'var(--brand-soft)', border:'1px solid var(--brand-border)', borderRadius:4 }}>
                    <Icon name="Users" size={13} style={{ color:'var(--brand)' }} />
                    <span className="text-[12px]" style={{ color:'var(--brand)' }}>
                      Tiene {sibs.length} hermano{sibs.length > 1 ? 's' : ''} inscripto{sibs.length > 1 ? 's' : ''}: {sibs.map(x => x.first).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Documentación — supervisión (la carga inicial la hace el padre) */}
          <Panel title="Documentación"
            action={<span className="text-[11px]" style={{ color:'var(--text-faint)' }}>La carga inicial la realiza el padre desde su cuenta</span>}>
            <div>
              {docs.map((d, i) => {
                const isAuth = d.tipo === 'autorizacion_imagen';
                return (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3 flex-wrap"
                    style={{ borderBottom: i < docs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <Icon name={isAuth ? 'FileSignature' : 'FileText'} size={15} style={{ color:'var(--text-faint)', flexShrink:0 }} />
                    <div className="flex-1 min-w-0" style={{ minWidth:160 }}>
                      <p className="text-[13px] font-medium" style={{ color:'var(--text)' }}>{d.label}</p>
                      {d.estado === 'autorizada' ? (
                        <p className="text-[11px]" style={{ color:'var(--brand)' }}>
                          Autorizada por {d.autorizado_por} el <span className="tnum">{d.fecha_autorizacion}</span>
                          {d.hora_autorizacion ? <> a las <span className="tnum">{d.hora_autorizacion}</span></> : null}
                          {d.tipo_autorizacion === 'manual' ? ' · firmada en papel' : ' · digital'}
                        </p>
                      ) : d.fecha_carga ? (
                        <p className="text-[11px] tnum" style={{ color:'var(--text-faint)' }}>Cargado el {d.fecha_carga}</p>
                      ) : null}
                    </div>
                    {isAuth ? (
                      d.estado === 'autorizada' ? (
                        <>
                          <span className="status paid">Autorizada</span>
                          <button className="btn btn-danger btn-sm"
                            onClick={() => { setDocOverride(student.id, d.tipo, { estado:'pendiente', autorizado_por:null, fecha_autorizacion:null, hora_autorizacion:null, tipo_autorizacion:null }); setToast('Autorización revocada — el padre deberá completarla nuevamente'); }}>
                            Revocar
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="status pending">Pendiente</span>
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => { setDocOverride(student.id, d.tipo, { estado:'autorizada', autorizado_por: student.parent, fecha_autorizacion:'05/07/2026', hora_autorizacion:'12:10', tipo_autorizacion:'manual' }); setToast('Autorización marcada como firmada en papel'); }}>
                            <Icon name="PenLine" size={13} /> Marcar firmada
                          </button>
                        </>
                      )
                    ) : d.estado === 'cargado' ? (
                      <>
                        <span className="status paid">Cargado</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setToast('Descargando ' + d.label + '…')}>
                          <Icon name="Download" size={13} /> Ver
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setDocOverride(student.id, d.tipo, { fecha_carga:'05/07/2026' }); setToast(d.label + ' reemplazado (demo)'); }}>
                          <Icon name="RefreshCw" size={13} /> Reemplazar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="status pending">Pendiente</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setDocOverride(student.id, d.tipo, { estado:'cargado', fecha_carga:'05/07/2026', url_archivo:`/docs/${student.id}_${d.tipo}.pdf` }); setToast(d.label + ' cargado manualmente'); }}>
                          <Icon name="Upload" size={13} /> Carga manual
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* ── Académico ── */}
      {tab === 'academico' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1 p-1 w-fit"
            style={{ background:'var(--bg-muted)', borderRadius:4, border:'1px solid var(--border)' }}>
            {[['julio','1° Cierre · Julio'],['noviembre','2° Cierre · Noviembre']].map(([id, lbl]) => (
              <button key={id} onClick={() => setPeriod(id)}
                className="px-3 py-1.5 text-[12.5px] font-medium transition-all whitespace-nowrap"
                style={{
                  background: period === id ? 'var(--bg)' : 'transparent',
                  color: period === id ? 'var(--text)' : 'var(--text-muted)',
                  borderRadius:3, boxShadow: period === id ? '0 0 0 1px var(--border)' : 'none',
                }}>
                {lbl}
              </button>
            ))}
          </div>

          {acad.note ? (
            <Card className="p-8 text-center">
              <Icon name="CalendarClock" size={22} style={{ color:'var(--text-faint)', margin:'0 auto' }} />
              <p className="text-[13px] mt-3" style={{ color:'var(--text-muted)' }}>{acad.note}</p>
            </Card>
          ) : (
            <Panel title={`Evaluaciones · 1° Cierre`}
              action={<span className="text-[12px]" style={{ color:'var(--text-muted)' }}>Promedio <span className="tnum font-semibold" style={{ color:'var(--brand)' }}>{acad.avg}</span></span>}>
              <div>
                {acad.evals.map((e, i) => {
                  const tone = e.score >= 7 ? 'var(--brand)' : e.score >= 5 ? 'var(--warning)' : 'var(--danger)';
                  return (
                    <div key={i} className="flex items-start gap-3 px-5 py-3.5"
                      style={{ borderBottom: i < acad.evals.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div className="flex items-center justify-center font-semibold tnum flex-shrink-0"
                        style={{ width:40, height:40, background:'var(--bg-muted)', color:tone, borderRadius:3, fontSize:15 }}>{e.score}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">{e.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Tag>{e.type}</Tag>
                          <span className="text-[11.5px] tnum" style={{ color:'var(--text-faint)' }}>{e.date}</span>
                        </div>
                        {e.obs && <p className="text-[12px] mt-1.5" style={{ color:'var(--text-muted)' }}>"{e.obs}"</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* Nota de cierre del período — visible para Admin/Secretario incluso en borrador */}
          {(() => {
            const nc = notaCierreFor(student, period);
            if (!nc) return null;
            const tone = nc.nota >= 7 ? 'var(--brand)' : nc.nota >= 5 ? 'var(--warning)' : 'var(--danger)';
            return (
              <Card className="p-5" style={{ borderColor:'var(--brand-border)', background: nc.estado==='publicada' ? 'var(--brand-soft)' : 'var(--bg-subtle)' }}>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center justify-center font-semibold tnum flex-shrink-0"
                    style={{ width:52, height:52, background:'var(--bg)', color:tone, borderRadius:3, fontSize:20, border:'1px solid var(--border)' }}>
                    {nc.nota}
                  </div>
                  <div className="flex-1 min-w-0" style={{ minWidth:180 }}>
                    <p className="eyebrow">Nota de cierre — {period === 'julio' ? '1° Cierre (Julio)' : '2° Cierre (Noviembre)'}</p>
                    <p className="text-[13.5px] font-semibold mt-1">Nota final del período definida por el profesor</p>
                    {nc.observacion && <p className="text-[12px] mt-1 leading-relaxed" style={{ color:'var(--text-muted)' }}>"{nc.observacion}"</p>}
                  </div>
                  {nc.estado === 'publicada'
                    ? <span className="status paid">Publicada</span>
                    : <span className="status pending">Borrador — no visible para el padre</span>}
                </div>
              </Card>
            );
          })()}
        </div>
      )}

      {/* ── Asistencia ── */}
      {tab === 'asistencia' && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="eyebrow">Asistencia</p>
              <h3 className="text-[15px] font-semibold mt-1.5" style={{ color:'var(--text)', letterSpacing:'-0.01em' }}>Mayo 2026</h3>
            </div>
            <div className="text-right">
              <p className="num-display tnum" style={{ fontSize:22, color:'var(--brand)' }}>{att.pct}%</p>
              <p className="text-[11px]" style={{ color:'var(--text-faint)' }}>presencia</p>
            </div>
          </div>
          <AttendanceCalendar cal={att.cal} />
          <div className="grid grid-cols-3 mt-5 pt-5" style={{ borderTop:'1px solid var(--border)' }}>
            {[
              { label:'Presentes', count: att.cal.filter(c=>c.s==='P').length, tone:'var(--brand)' },
              { label:'Tardanzas', count: att.cal.filter(c=>c.s==='T').length, tone:'var(--warning)' },
              { label:'Ausencias', count: att.cal.filter(c=>c.s==='A').length, tone:'var(--danger)' },
            ].map((x, i) => (
              <div key={x.label} style={{ borderLeft: i > 0 ? '1px solid var(--border)' : 'none', paddingLeft: i > 0 ? 14 : 0 }}>
                <p className="eyebrow">{x.label}</p>
                <p className="num-display tnum mt-1.5" style={{ fontSize:22, color:x.tone }}>{x.count}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Cuotas ── */}
      {tab === 'cuotas' && (
        <Panel title={`Cuotas ${student.sib ? '· 10% descuento hermano' : ''}`}>
          {/* Desktop */}
          <table className={`tbl ${isMobile ? 'hidden' : 'hidden md:table'}`}>
            <thead>
              <tr>
                <th>Mes</th>
                <th style={{ textAlign:'right' }}>Base</th>
                <th style={{ textAlign:'right' }}>Desc.</th>
                <th style={{ textAlign:'right' }}>Final</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f, i) => (
                <tr key={i}>
                  <td className="font-medium">{f.month}</td>
                  <td className="mono tnum" style={{ textAlign:'right', color:'var(--text-muted)' }}>{fmt$(f.base)}</td>
                  <td className="mono tnum" style={{ textAlign:'right', color: f.desc ? 'var(--brand)' : 'var(--text-faint)' }}>{f.desc ? '−'+fmt$(f.desc) : '—'}</td>
                  <td className="mono tnum font-semibold" style={{ textAlign:'right' }}>{fmt$(f.amount)}</td>
                  <td className="tnum" style={{ color: f.status==='overdue' ? 'var(--danger)' : 'var(--text-muted)' }}>{f.due}</td>
                  <td><Badge variant={feeVariant(f.status)}>{feeLabel(f.status)}</Badge></td>
                  <td style={{ textAlign:'right' }}>
                    {f.status !== 'paid' && <button onClick={() => payFee(i)} className="btn btn-primary btn-sm">Registrar pago</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile */}
          <div className={`${isMobile ? '' : 'md:hidden'} divide-y`} style={{ borderColor:'var(--border)' }}>
            {fees.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderBottom:'1px solid var(--border)' }}>
                <div>
                  <p className="text-[13px] font-medium">{f.month}</p>
                  <p className="text-[11px] tnum" style={{ color: f.status==='overdue' ? 'var(--danger)' : 'var(--text-faint)' }}>Vence {f.due}</p>
                </div>
                <div className="text-right">
                  <p className="mono tnum font-semibold text-[13px]">{fmt$(f.amount)}</p>
                  <Badge variant={feeVariant(f.status)}>{feeLabel(f.status)}</Badge>
                  {f.status !== 'paid' && <button onClick={() => payFee(i)} className="btn btn-primary btn-sm w-full mt-1.5">Cobrar</button>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Observaciones ── */}
      {tab === 'observaciones' && (() => {
        const visibleObs = obs.filter(o => obsFilter === 'all' || o.category === obsFilter);
        const senderName = role === 'secretary' ? USER_PROFILES.secretary?.name || 'Lucía Peralta' : USER_PROFILES.admin.name;
        const senderRole = role === 'secretary' ? 'secretary' : 'admin';
        return (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Filtro por categoría */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[['all','Todas'],...Object.entries(OBS_CATS).map(([k,v])=>[k,v.label])].map(([id,lbl]) => (
                <button key={id} onClick={() => setObsFilter(id)}
                  className="px-2.5 py-1 text-[12px] font-medium transition-all"
                  style={{ border:`1px solid ${obsFilter===id?'var(--brand)':'var(--border)'}`, background:obsFilter===id?'var(--brand-soft)':'var(--bg)', color:obsFilter===id?'var(--brand)':'var(--text-muted)', borderRadius:3 }}>
                  {lbl}
                </button>
              ))}
            </div>
            <button onClick={() => { setObsForm({ category: role==='secretary'?'administrativo':'academico', text:'' }); setShowNewObs(true); }}
              className="btn btn-primary btn-sm">
              <Icon name="Plus" size={13}/> Nueva observación
            </button>
          </div>

          {visibleObs.map((o, i) => {
            const cat = OBS_CATS[o.category] || OBS_CATS.academico;
            return (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={o.author || o.teacher} size="sm" tone={o.role==='secretary'?'neutral':'brand'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[13px] font-medium">{obsAuthorLabel(o)}</p>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5" style={{ border:`1px solid ${cat.color}`, color:cat.color, borderRadius:2 }}>
                          {cat.label}
                        </span>
                        <span className="text-[11.5px] tnum" style={{ color:'var(--text-faint)' }}>{o.date}</span>
                      </div>
                    </div>
                    <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color:'var(--text-muted)' }}>{o.text}</p>
                  </div>
                </div>
              </Card>
            );
          })}
          {!visibleObs.length && (
            <Card className="p-6 text-center">
              <p className="text-[12.5px]" style={{ color:'var(--text-faint)' }}>Sin observaciones en esta categoría.</p>
            </Card>
          )}

          {/* Modal nueva observación */}
          {showNewObs && (
            <div className="overlay">
              <div className="card-hl w-full max-w-sm p-5 space-y-4" style={{ background:'var(--bg)', boxShadow:'0 8px 24px rgba(0,0,0,0.08)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold">Nueva observación</h3>
                  <button onClick={() => setShowNewObs(false)} className="p-1 rounded hover:bg-zinc-100" style={{ color:'var(--text-muted)' }}><Icon name="X" size={16}/></button>
                </div>
                <p className="text-[12px]" style={{ color:'var(--text-faint)' }}>
                  Se enviará al tutor de <strong style={{ color:'var(--text)' }}>{student.first} {student.last}</strong> como {senderRole==='secretary'?'Secretaría':'Dirección'}.
                </p>
                <div>
                  <label className="label">Categoría</label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(OBS_CATS).map(([k,v]) => (
                      <button key={k} onClick={() => setObsForm(f=>({...f,category:k}))}
                        className="px-2.5 py-1 text-[12px] font-medium transition-all"
                        style={{ border:`1px solid ${obsForm.category===k?v.color:'var(--border)'}`, color:obsForm.category===k?v.color:'var(--text-muted)', background:'var(--bg)', borderRadius:3 }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Observación</label>
                  <textarea value={obsForm.text} onChange={e => e.target.value.length <= 500 && setObsForm(f=>({...f,text:e.target.value}))} rows={4}
                    placeholder="Escribí el mensaje para la familia…"
                    className="input" style={{ resize:'none', padding:10, lineHeight:1.55 }}/>
                  <p className="text-right text-[11px] tnum mt-1" style={{ color:'var(--text-faint)' }}>{obsForm.text.length}/500</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowNewObs(false)} className="btn btn-secondary flex-1">Cancelar</button>
                  <button disabled={!obsForm.text.trim()}
                    style={{ opacity: obsForm.text.trim() ? 1 : 0.45 }}
                    onClick={() => {
                      setObsList(prev => [{ date:'05/07/2026', author:senderName, role:senderRole, teacher:senderName, category:obsForm.category, text:obsForm.text }, ...prev]);
                      setShowNewObs(false);
                      setToast('Observación enviada al tutor');
                    }}
                    className="btn btn-primary flex-1">
                    <Icon name="Send" size={13}/> Enviar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5"
          style={{ background:'var(--text)', color:'#fff', borderRadius:4, fontSize:13, fontWeight:500 }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--brand-dot)' }} /> {toast}
        </div>
      )}
    </div>
  );
};

// ── Secretary Dashboard ─────────────────────────────────────────────────────
const SecretaryDashboard = ({ onNavigate }) => {
  const isMobile = useIsMobile();
  const overdue = FEES.filter(f => f.status === 'overdue');
  const pending = FEES.filter(f => f.status === 'pending');
  const overdueAmt = overdue.reduce((a, f) => a + f.amount, 0);
  const pendingAmt = pending.reduce((a, f) => a + f.amount, 0);

  return (
    <div className="space-y-7">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Domingo · 21 de junio de 2026</p>
          <h2 className="font-semibold leading-tight" style={{ fontSize:26, color:'var(--text)', letterSpacing:'-0.02em' }}>
            Buenos días, Lucía
          </h2>
          <p className="text-[13.5px] mt-1.5" style={{ color:'var(--text-muted)' }}>
            Hay {overdue.length} cuotas vencidas por {fmt$(overdueAmt)} para gestionar hoy.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('students')} className="btn btn-secondary">
            <Icon name="Search" size={14} /> Buscar alumno
          </button>
          <button onClick={() => onNavigate('payments')} className="btn btn-primary">
            <Icon name="DollarSign" size={14} /> Registrar pago
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}>
        <button onClick={() => onNavigate('payments')} className="card-hl text-left" style={{ padding:'18px 18px 16px' }}>
          <div className="flex items-center gap-2">
            <span className="eyebrow" style={{ flex:1 }}>Cuotas vencidas</span>
            <span className="w-2 h-2 rounded-full" style={{ background:'var(--danger-dot)' }} />
          </div>
          <div className="num-display mt-2.5" style={{ fontSize:26, color:'var(--danger)' }}>{fmt$(overdueAmt)}</div>
          <div className="text-[12px] mt-2" style={{ color:'var(--text-subtle)' }}>{overdue.length} cuotas · {new Set(overdue.map(f=>f.sid)).size} alumnos</div>
        </button>
        <button onClick={() => onNavigate('payments')} className="card-hl text-left" style={{ padding:'18px 18px 16px' }}>
          <div className="flex items-center gap-2">
            <span className="eyebrow" style={{ flex:1 }}>Cuotas pendientes</span>
            <span className="w-2 h-2 rounded-full" style={{ background:'var(--warning-dot)' }} />
          </div>
          <div className="num-display mt-2.5" style={{ fontSize:26, color:'var(--warning)' }}>{fmt$(pendingAmt)}</div>
          <div className="text-[12px] mt-2" style={{ color:'var(--text-subtle)' }}>{pending.length} cuotas por vencer</div>
        </button>
        <div className="card-hl" style={{ padding:'18px 18px 16px' }}>
          <div className="flex items-center gap-2">
            <span className="eyebrow" style={{ flex:1 }}>Cobros hoy</span>
            <span className="w-2 h-2 rounded-full" style={{ background:'var(--brand-dot)' }} />
          </div>
          <div className="num-display mt-2.5" style={{ fontSize:26, color:'var(--text)' }}>{fmt$(140000)}</div>
          <div className="text-[12px] mt-2" style={{ color:'var(--text-subtle)' }}>4 pagos registrados</div>
        </div>
        <button onClick={() => onNavigate('students')} className="card-hl text-left" style={{ padding:'18px 18px 16px' }}>
          <div className="flex items-center gap-2">
            <span className="eyebrow" style={{ flex:1 }}>Documentación pendiente</span>
            <span className="w-2 h-2 rounded-full" style={{ background:'var(--warning-dot)' }} />
          </div>
          <div className="num-display mt-2.5" style={{ fontSize:26, color:'var(--text)' }}>{STUDENTS.filter(s => hasPendingDocs(s.id)).length}</div>
          <div className="text-[12px] mt-2" style={{ color:'var(--text-subtle)' }}>alumnos con legajo incompleto</div>
        </button>
      </div>

      {/* Overdue urgent table */}
      <Panel title="Cuotas vencidas urgentes"
        action={<button onClick={() => onNavigate('payments')} className="text-[12px] font-medium hover:underline" style={{ color:'var(--brand)' }}>Ver todas →</button>}>
        {/* Desktop */}
        <table className={`tbl ${isMobile ? 'hidden' : 'hidden md:table'}`}>
          <thead>
            <tr><th>Alumno</th><th>Curso</th><th>Mes</th><th style={{ textAlign:'right' }}>Atraso</th><th style={{ textAlign:'right' }}>Monto</th><th></th></tr>
          </thead>
          <tbody>
            {OVERDUE_DASHBOARD.map((f, i) => (
              <tr key={i}>
                <td><div className="flex items-center gap-2.5"><Avatar name={f.name} size="xs" /><span className="font-medium">{f.name}</span></div></td>
                <td><LevelBadge level={levelOf(f.course) || ''}>{f.course}</LevelBadge></td>
                <td style={{ color:'var(--text-muted)' }}>{f.month}</td>
                <td className="tnum" style={{ textAlign:'right', color: f.days >= 30 ? 'var(--danger)' : 'var(--warning)' }}>{f.days} d.</td>
                <td className="tnum font-medium" style={{ textAlign:'right' }}>{fmt$(f.amount)}</td>
                <td style={{ textAlign:'right' }}><button onClick={() => onNavigate('payments')} className="btn btn-primary btn-sm">Registrar pago</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Mobile */}
        <div className={isMobile ? '' : 'md:hidden'}>
          {OVERDUE_DASHBOARD.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < OVERDUE_DASHBOARD.length-1 ? '1px solid var(--border)' : 'none' }}>
              <Avatar name={f.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{f.name}</p>
                <p className="text-[11.5px]" style={{ color:'var(--text-faint)' }}>{f.course} · {f.month}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[13px] tnum font-medium">{fmt$(f.amount)}</p>
                <button onClick={() => onNavigate('payments')} className="btn btn-primary btn-sm mt-1">Cobrar</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

Object.assign(window, {
  AdminDashboard, AdminStudents, AdminPayments, AdminCourses,
  AdminProfessors, AdminReports, AdminUsers, AdminSettings,
  StudentLegajo, SecretaryDashboard, InscriptionForm,
  KpiCard, Sparkline, MiniBars, Ring,
  LevelBadge, levelOf,
});
