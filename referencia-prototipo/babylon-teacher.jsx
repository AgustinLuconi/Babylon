// babylon-teacher.jsx — Mis cursos, Asistencia, Calificaciones, Observaciones
// Visual: Mercury × Linear · sober, professional · mobile-first attendance.

const { useState: useStateT } = React;

// ── Teacher Home ───────────────────────────────────────────────────────────
const TeacherHome = ({ onNavigate }) => {
  const isMobile = useIsMobile();
  const myCourses = COURSES.filter(c => c.tid === 2);
  const totalStudents = myCourses.reduce((a, c) => a + c.count, 0);

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Viernes · 9 de mayo de 2026</p>
        <h2 className="font-semibold leading-tight" style={{ fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Buen día, Carlos
        </h2>
        <p className="text-[13.5px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
          Tenés <span className="font-medium" style={{ color: 'var(--text)' }}>4 clases</span> esta semana entre {myCourses.length} comisiones — {totalStudents} alumnos en total.
        </p>
      </div>

      <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <KpiCard label="Comisiones a cargo" value={myCourses.length.toString()} sub="Teens A1 · Teens A2" />
        <KpiCard label="Alumnos totales" value={totalStudents.toString()} sub="entre tus cursos" />
        <KpiCard label="Próxima clase" value="Lun" sub="18:00 · Aula 2" delta="Teens A1" />
      </div>

      <div>
        <SectionHeading>Mis cursos</SectionHeading>
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {myCourses.map(c => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <LevelBadge level={c.level}>{c.level}</LevelBadge>
                <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>{c.room}</span>
              </div>
              <h4 className="text-[15px] font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>{c.name}</h4>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {c.schedule} · <span className="tnum">{c.count}</span> alumnos
              </p>
              <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={() => onNavigate('attendance')} className="btn btn-primary flex-1">
                  <Icon name="ClipboardCheck" size={13} /> Asistencia
                </button>
                <button onClick={() => onNavigate('grades')} className="btn btn-secondary flex-1">
                  <Icon name="FileText" size={13} /> Notas
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Panel title="Próximas clases">
        <div>
          {[
            { date:'Lun 12/05', time:'18:00', course:'Teens A1', room:'Aula 2', count:22 },
            { date:'Lun 12/05', time:'18:30', course:'Teens A2', room:'Aula 2', count:19 },
            { date:'Mié 14/05', time:'18:00', course:'Teens A1', room:'Aula 2', count:22 },
          ].map((cl, i, arr) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="text-center" style={{ width: 56 }}>
                <p className="text-[13px] tnum font-semibold leading-none">{cl.time}</p>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>{cl.date}</p>
              </div>
              <div className="flex-1 min-w-0 pl-4" style={{ borderLeft: '1px solid var(--border)' }}>
                <p className="text-[13px] font-medium">{cl.course}</p>
                <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{cl.room} · <span className="tnum">{cl.count}</span> alumnos</p>
              </div>
              <button onClick={() => onNavigate('attendance')} className="btn btn-secondary btn-sm flex-shrink-0">Tomar asistencia</button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

// ── Teacher Attendance — mobile-first, con historial de clases ────────────
const TeacherAttendance = ({ searchQuery = '' }) => {
  const isMobile = useIsMobile();
  const myCourses = COURSES.filter(c => c.tid === 2);
  const [selectedCourse, setSelectedCourse] = useStateT(3);
  const sessions = pastSessionsFor(selectedCourse, 8);
  const [selectedDate, setSelectedDate] = useStateT(sessions[0] || new Date());
  const [records, setRecords] = useStateT(() => attendanceForSession(selectedCourse, sessions[0] || new Date()));
  const [saved, setSaved] = useStateT(true);
  const [saving, setSaving] = useStateT(false);

  const loadSession = (courseId, dateObj) => {
    const recs = attendanceForSession(courseId, dateObj);
    setRecords(recs);
    setSaved(recs.every(r => r.status !== null) && !isTodaySession(dateObj));
  };

  const changeCourse = (cid) => {
    setSelectedCourse(cid);
    const s = pastSessionsFor(cid, 8);
    const d = s[0] || new Date();
    setSelectedDate(d);
    loadSession(cid, d);
  };
  const changeDate = (d) => {
    setSelectedDate(d);
    loadSession(selectedCourse, d);
  };

  const marked = records.filter(r => r.status !== null).length;
  const total = records.length;
  const progress = total > 0 ? Math.round((marked / total) * 100) : 0;
  const isToday = isTodaySession(selectedDate);

  const setStatus = (id, status) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setSaved(false);
  };
  const setField = (id, field, val) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };
  const markAll = () => {
    setRecords(prev => prev.map(r => ({ ...r, status: 'P', minutes: '', reason: '' })));
    setSaved(false);
  };
  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveAttendanceSession(selectedCourse, selectedDate, records);
      setSaving(false); setSaved(true);
    }, 900);
  };

  const STATUS_CFG = {
    P: { label: 'Presente', tone: 'var(--brand)',   bg: 'var(--brand-soft)',   dot: 'var(--brand-dot)' },
    T: { label: 'Tarde',    tone: 'var(--warning)', bg: 'var(--warning-soft)', dot: 'var(--warning-dot)' },
    A: { label: 'Ausente',  tone: 'var(--danger)',  bg: 'var(--danger-soft)',  dot: 'var(--danger-dot)' },
  };

  const filtered = records.filter(r => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-4">

      {/* Course header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-1.5">{isToday ? 'Tomar asistencia' : 'Cargar asistencia atrasada'}</p>
            <select value={selectedCourse}
              onChange={e => changeCourse(Number(e.target.value))}
              className="text-[17px] font-semibold bg-transparent border-none focus:outline-none cursor-pointer p-0"
              style={{ color: 'var(--text)', letterSpacing: '-0.015em' }}>
              {myCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}>{fmtSessionFull(selectedDate)}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="num-display" style={{ fontSize: 22, color: 'var(--text)' }}>
              <span className="tnum">{marked}</span>
              <span className="text-[14px]" style={{ color: 'var(--text-faint)' }}>/{total}</span>
            </p>
            <p className="eyebrow mt-1">registrados</p>
          </div>
        </div>
        <div className="bar-track mt-4">
          <div className="bar-fill" style={{ width: progress + '%', background: progress === 100 ? 'var(--brand)' : 'var(--warning-dot)' }} />
        </div>
      </Card>

      {/* Session picker — clases anteriores para cargar/corregir asistencia */}
      <div>
        <p className="eyebrow mb-2">Clase</p>
        <div className="flex gap-1.5 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
          {sessions.map((d, i) => {
            const active = isSameSession(d, selectedDate);
            const todayReal = isTodaySession(d);
            const complete = sessionIsComplete(selectedCourse, d);
            return (
              <button key={i} onClick={() => changeDate(d)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2 transition-all"
                style={{
                  minWidth: 58,
                  border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                  background: active ? 'var(--brand-soft)' : 'var(--bg)',
                  borderRadius: 4,
                }}>
                <span className="text-[12px] font-medium" style={{ color: active ? 'var(--brand)' : 'var(--text)' }}>
                  {todayReal ? 'Hoy' : fmtSessionShort(d)}
                </span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: todayReal ? 'var(--text-faint)' : complete ? 'var(--brand-dot)' : 'var(--warning-dot)' }} />
              </button>
            );
          })}
        </div>
        {!isToday && (
          <p className="text-[11.5px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
            <Icon name="Info" size={11} />
            Estás viendo una clase anterior — podés cargarla o corregirla y guardar los cambios.
          </p>
        )}
      </div>

      {/* Mark all present */}
      <button onClick={markAll}
        className="btn btn-secondary w-full justify-center"
        style={{ padding: '12px', fontSize: 13.5 }}>
        <Icon name="CheckCheck" size={15} /> Marcar todos como presentes
      </button>

      {/* Student list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {filtered.map(r => {
          const hasAlert = r.absences >= 3;
          const cfg = r.status ? STATUS_CFG[r.status] : null;
          return (
            <Card key={r.id} className="overflow-hidden"
              style={{ borderColor: hasAlert ? 'var(--danger)' : 'var(--border)' }}>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={r.name} size="md" tone={r.status === 'P' ? 'brand' : 'neutral'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{r.name}</p>
                    {hasAlert ? (
                      <p className="text-[11.5px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--danger)' }}>
                        <Icon name="AlertTriangle" size={10} /> <span className="tnum">{r.absences}</span> ausencias consecutivas
                      </p>
                    ) : (
                      <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        <span className="tnum">{r.absences}</span> ausencias en el mes
                      </p>
                    )}
                  </div>
                  {cfg && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11.5px] font-medium flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.tone, borderRadius: 2 }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                      {cfg.label}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(['P', 'T', 'A']).map(st => {
                    const stCfg = STATUS_CFG[st];
                    const active = r.status === st;
                    return (
                      <button key={st} onClick={() => setStatus(r.id, st)}
                        className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium transition-all"
                        style={{
                          minHeight: 44,
                          padding: '10px 12px',
                          background: active ? stCfg.bg : 'var(--bg)',
                          color: active ? stCfg.tone : 'var(--text-muted)',
                          border: active ? `1px solid ${stCfg.tone}` : '1px solid var(--border)',
                          borderRadius: 4,
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? stCfg.dot : 'var(--text-faint)' }} />
                        {stCfg.label}
                      </button>
                    );
                  })}
                </div>

                {r.status === 'T' && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-[12px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Min. de retraso</label>
                    <input type="number" min="1" max="60" value={r.minutes}
                      onChange={e => setField(r.id, 'minutes', e.target.value)}
                      placeholder="ej. 15"
                      className="input tnum"
                      style={{ flex: 1, padding: '6px 10px', fontSize: 12.5 }} />
                  </div>
                )}
                {r.status === 'A' && (
                  <div className="mt-3">
                    <input value={r.reason}
                      onChange={e => setField(r.id, 'reason', e.target.value)}
                      placeholder="Motivo de ausencia (opcional)"
                      className="input"
                      style={{ padding: '6px 10px', fontSize: 12.5 }} />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="h-24" />

      {/* Sticky save */}
      <div className={`fixed bottom-0 left-0 right-0 z-20 ${isMobile ? '' : 'md:left-[244px]'}`}
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div className="px-4 pt-3">
          {saved ? (
            <div className="flex items-center justify-center gap-2 py-3"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)', border: '1px solid var(--brand)', borderRadius: 4, fontSize: 13.5, fontWeight: 500 }}>
              <Icon name="Check" size={15} /> {isToday ? 'Asistencia confirmada' : 'Asistencia guardada'} · {total} alumnos
            </div>
          ) : (
            <button onClick={handleSave} disabled={marked === 0 || saving}
              className="btn btn-primary w-full justify-center"
              style={{ padding: '12px', fontSize: 13.5, opacity: marked === 0 ? 0.5 : 1 }}>
              {saving
                ? <><Icon name="Loader2" size={15} className="animate-spin" /> Guardando…</>
                : marked < total
                ? <>Guardar borrador (<span className="tnum">{marked}</span>/<span className="tnum">{total}</span>)</>
                : <>{isToday ? 'Confirmar asistencia' : 'Guardar asistencia'} (<span className="tnum">{total}</span>/<span className="tnum">{total}</span>)</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Teacher Grades — período, escala, obs por alumno ─────────────────────
const TIPO_OPTIONS = ['Examen','Oral','Trabajo Práctico','Tarea','Participación'];
const ESCALA_OPTIONS = [
  { id:'numerica', label:'Numérica 1–10' },
  { id:'conceptual', label:'Conceptual (MB/B/R/M)' },
];
const CONCEPTUAL = [
  { val:'MB', label:'Muy Bueno',  tone:'var(--brand)',   bg:'var(--brand-soft)' },
  { val:'B',  label:'Bueno',      tone:'#16803D',        bg:'#DCFCE7' },
  { val:'R',  label:'Regular',    tone:'var(--warning)', bg:'var(--warning-soft)' },
  { val:'M',  label:'Malo',       tone:'var(--danger)',  bg:'var(--danger-soft)' },
];
const numTone = v => v===null||v===undefined ? 'var(--text-faint)'
  : v>=7 ? 'var(--brand)' : v>=5 ? 'var(--warning)' : 'var(--danger)';

// ── Notas de cierre — nota final del período por alumno ────────────────
const TeacherNotasCierre = () => {
  const [period, setPeriod] = useStateT('julio');
  const [estado, setEstado] = useStateT('borrador'); // estado del set de notas del período
  const [rows, setRows] = useStateT(() => CLASS_GRADES.map(g => {
    const ss = Object.values(g.scores).filter(v => v != null);
    const avg = ss.length ? (ss.reduce((a,v)=>a+v,0)/ss.length) : null;
    // Pre-carga determinística: nota de cierre sugerida cercana al promedio
    const pre = avg != null ? Math.round(avg * 2) / 2 : null;
    return { sid: g.sid, name: g.name, avg: avg != null ? avg.toFixed(1) : null, nota: pre, obs: '' };
  }));
  const [confirm, setConfirm] = useStateT(false);
  const [toast, setToast] = useStateT('');

  const setNota = (sid, val) => {
    const n = val === '' ? null : parseFloat(val);
    if (val === '' || (n >= 1 && n <= 10)) {
      setRows(prev => prev.map(r => r.sid === sid ? { ...r, nota: val === '' ? null : n } : r));
      setEstado('borrador');
    }
  };
  const setObs = (sid, val) => {
    if (val.length <= 200) setRows(prev => prev.map(r => r.sid === sid ? { ...r, obs: val } : r));
  };

  const complete = rows.filter(r => r.nota != null).length;
  const isNov = period === 'noviembre';

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="eyebrow mr-1">Período:</span>
        {[['julio','1° Cierre (Julio)'],['noviembre','2° Cierre (Noviembre)']].map(([id,lbl]) => (
          <button key={id} onClick={() => setPeriod(id)}
            className="px-3 py-1.5 text-[12.5px] font-medium transition-all"
            style={{ background:period===id?'var(--brand)':'var(--bg)', color:period===id?'#fff':'var(--text)', border:`1px solid ${period===id?'var(--brand)':'var(--border)'}`, borderRadius:4 }}>
            {lbl}
          </button>
        ))}
      </div>

      {isNov ? (
        <Card className="p-8 text-center">
          <Icon name="CalendarClock" size={22} style={{ color:'var(--text-faint)', margin:'0 auto' }}/>
          <p className="text-[13px] mt-3" style={{ color:'var(--text-muted)' }}>
            El 2° cierre (Noviembre) se habilita al finalizar el período de evaluaciones.
          </p>
        </Card>
      ) : (
        <>
          <Panel title="Notas de cierre — Teens A2 · 1° Cierre (Julio)"
            action={estado === 'publicada'
              ? <span className="status paid">Publicadas</span>
              : <span className="status pending">Borrador</span>}>
            <div>
              {rows.map((r, i) => {
                const tone = r.nota == null ? 'var(--text-faint)' : numTone(r.nota);
                return (
                  <div key={r.sid} className="px-5 py-3.5"
                    style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Avatar name={r.name} size="sm"/>
                      <div className="flex-1 min-w-0" style={{ minWidth:140 }}>
                        <p className="text-[13px] font-medium truncate">{r.name}</p>
                        <p className="text-[11.5px]" style={{ color:'var(--text-faint)' }}>
                          Promedio de evaluaciones: <span className="tnum font-medium" style={{ color:'var(--text-muted)' }}>{r.avg ?? '—'}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="eyebrow">Cierre</span>
                        <input type="number" min="1" max="10" step="0.5"
                          value={r.nota ?? ''}
                          onChange={e => setNota(r.sid, e.target.value)}
                          disabled={estado === 'publicada'}
                          placeholder="–"
                          className="input tnum"
                          style={{ width:64, textAlign:'center', fontWeight:600, fontSize:14, color:tone, padding:'6px 4px', borderColor: r.nota != null ? tone : 'var(--border)', opacity: estado==='publicada'?0.7:1 }}/>
                      </div>
                    </div>
                    <div className="mt-2" style={{ marginLeft:40 }}>
                      <input value={r.obs}
                        onChange={e => setObs(r.sid, e.target.value)}
                        disabled={estado === 'publicada'}
                        placeholder="Observación de cierre (opcional, máx. 200)"
                        className="input"
                        style={{ padding:'6px 10px', fontSize:12.5, opacity: estado==='publicada'?0.7:1 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {estado !== 'publicada' && (
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1"
                onClick={() => { setToast('Borrador guardado'); setTimeout(()=>setToast(''),2200); }}>
                Guardar borrador
              </button>
              <button className="btn btn-primary flex-1"
                disabled={complete < rows.length}
                style={{ opacity: complete < rows.length ? 0.5 : 1 }}
                onClick={() => setConfirm(true)}>
                <Icon name="Send" size={14}/> Publicar notas de cierre ({complete}/{rows.length})
              </button>
            </div>
          )}
          {estado === 'publicada' && (
            <p className="text-[12px] text-center" style={{ color:'var(--text-faint)' }}>
              Las notas de cierre publicadas ya son visibles para las familias.
            </p>
          )}
        </>
      )}

      {/* Confirmación de publicación */}
      {confirm && (
        <div className="overlay">
          <div className="card-hl w-full max-w-sm p-5 space-y-4" style={{ background:'var(--bg)', boxShadow:'0 8px 24px rgba(0,0,0,0.08)' }}>
            <h3 className="text-[14px] font-semibold">Publicar notas de cierre</h3>
            <p className="text-[13px] leading-relaxed" style={{ color:'var(--text-muted)' }}>
              Vas a publicar las notas de cierre del <strong>1° Cierre (Julio)</strong> para {rows.length} alumnos de Teens A2.
              Una vez publicadas, los padres podrán verlas de inmediato.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={() => { setEstado('publicada'); setConfirm(false); setToast('Notas de cierre publicadas'); setTimeout(()=>setToast(''),2500); }}
                className="btn btn-primary flex-1">Publicar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5"
          style={{ background:'var(--text)', color:'#fff', borderRadius:4, fontSize:13, fontWeight:500 }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--brand-dot)' }}/> {toast}
        </div>
      )}
    </div>
  );
};

const TeacherGrades = () => {
  const isMobile = useIsMobile();
  const [view, setView] = useStateT('evals'); // 'evals' | 'cierre'
  // Extend EVALUATIONS with period + scale
  const [evals, setEvals] = useStateT(EVALUATIONS.map((e,i)=>({
    ...e,
    period: i<2 ? 'julio' : i===2 ? 'julio' : 'noviembre',
    scale:  'numerica',
  })));
  const [grades, setGrades] = useStateT(
    CLASS_GRADES.map(g=>({...g, obs:{}}))
  );
  const [selectedEval, setSelectedEval] = useStateT(0);
  const [periodFilter, setPeriodFilter] = useStateT('all');
  const [showNewEval, setShowNewEval] = useStateT(false);
  const [newForm, setNewForm] = useStateT({name:'',tipo:'Examen',period:'julio',scale:'numerica',date:'24/06/2026'});
  const [toast, setToast] = useStateT('');

  const visibleEvals = evals.filter(e => periodFilter==='all' || e.period===periodFilter);
  const evalObj = visibleEvals[selectedEval] || visibleEvals[0];

  const setScore = (sid, val) => {
    if (!evalObj) return;
    setGrades(prev => prev.map(g =>
      g.sid===sid ? {...g, scores:{...g.scores,[evalObj.name]:val===''?null:evalObj.scale==='numerica'?parseFloat(val):val}} : g
    ));
  };
  const setObs = (sid, val) => {
    if (!evalObj) return;
    setGrades(prev => prev.map(g =>
      g.sid===sid ? {...g, obs:{...g.obs,[evalObj.name]:val}} : g
    ));
  };
  const handlePublish = () => {
    if (!evalObj) return;
    setEvals(prev=>prev.map(e=>e.name===evalObj.name?{...e,published:true}:e));
    setToast('Calificaciones publicadas. Los padres ya pueden verlas.');
    setTimeout(()=>setToast(''),2800);
  };

  // Stats for current eval
  const scores = evalObj ? grades.map(g=>g.scores[evalObj.name]).filter(s=>s!=null&&s!==undefined) : [];
  const numericScores = evalObj?.scale==='numerica' ? scores.map(Number).filter(n=>!isNaN(n)) : [];
  const avg = numericScores.length ? (numericScores.reduce((a,s)=>a+s,0)/numericScores.length).toFixed(1) : '—';
  const passing = numericScores.filter(s=>s>=7).length;

  // Period average (numeric only)
  const periodEvals = visibleEvals.filter(e=>e.scale==='numerica'&&e.published);
  const periodAvgs = periodEvals.map(e=>{
    const ss=grades.map(g=>Number(g.scores[e.name])).filter(n=>!isNaN(n)&&n>0);
    return ss.length ? ss.reduce((a,s)=>a+s,0)/ss.length : null;
  }).filter(x=>x!==null);
  const periodAvg = periodAvgs.length ? (periodAvgs.reduce((a,s)=>a+s,0)/periodAvgs.length).toFixed(1) : null;

  // When filter changes, reset selection to first visible eval
  React.useEffect(()=>{setSelectedEval(0);},[periodFilter]);

  return (
    <div className="space-y-5">
      {/* Vista: Evaluaciones / Notas de cierre */}
      <div className="flex items-center gap-1 p-1 w-fit"
        style={{ background:'var(--bg-muted)', borderRadius:4, border:'1px solid var(--border)' }}>
        {[['evals','Evaluaciones'],['cierre','Notas de cierre']].map(([id,lbl]) => (
          <button key={id} onClick={() => setView(id)}
            className="px-3.5 py-1.5 text-[12.5px] font-medium transition-all"
            style={{ background:view===id?'var(--bg)':'transparent', color:view===id?'var(--text)':'var(--text-muted)', borderRadius:3, boxShadow:view===id?'0 0 0 1px var(--border)':'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {view === 'cierre' ? <TeacherNotasCierre/> : (
      <div className="space-y-5">
      {/* Period filter + eval picker */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="eyebrow mr-1">Período:</span>
          {[['all','Todos'],['julio','1° Cierre (Julio)'],['noviembre','2° Cierre (Noviembre)']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setPeriodFilter(id)}
              className="px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{background:periodFilter===id?'var(--brand)':'var(--bg)',color:periodFilter===id?'#fff':'var(--text)',border:`1px solid ${periodFilter===id?'var(--brand)':'var(--border)'}`,borderRadius:4}}>
              {lbl}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {visibleEvals.map((e,i)=>(
            <button key={i} onClick={()=>setSelectedEval(i)}
              className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{background:selectedEval===i?'var(--brand)':'var(--bg)',color:selectedEval===i?'#fff':'var(--text)',border:`1px solid ${selectedEval===i?'var(--brand)':'var(--border)'}`,borderRadius:4}}>
              {e.name}
              {!e.published&&<span className="text-[10px] px-1 py-0.5 font-medium"
                style={{background:selectedEval===i?'rgba(255,255,255,0.2)':'var(--warning-soft)',color:selectedEval===i?'#fff':'var(--warning)',borderRadius:2}}>Borrador</span>}
            </button>
          ))}
          <button onClick={()=>setShowNewEval(true)}
            className="px-3 py-1.5 text-[12.5px] font-medium transition-all flex items-center gap-1"
            style={{border:'1px dashed var(--border-strong)',color:'var(--text-muted)',borderRadius:4}}>
            <Icon name="Plus" size={13}/> Nueva
          </button>
        </div>
      </div>

      {evalObj && (
        <>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-[15.5px] font-semibold" style={{color:'var(--text)',letterSpacing:'-0.01em'}}>{evalObj.name}</h3>
                <p className="text-[12px] mt-1" style={{color:'var(--text-muted)'}}>
                  {evalObj.tipo||evalObj.type} · <span className="tnum">{evalObj.date}</span>
                  {' · '}<span style={{color:'var(--brand)'}}>{evalObj.period==='julio'?'1° Cierre':'2° Cierre'}</span>
                  {' · '}{evalObj.scale==='numerica'?'Numérica 1–10':'Conceptual MB/B/R/M'}
                </p>
              </div>
              {!evalObj.published&&<Badge variant="pending">Borrador</Badge>}
            </div>
            {evalObj.scale==='numerica'&&(
              <div className="grid grid-cols-3 mt-5 pt-5" style={{borderTop:'1px solid var(--border)'}}>
                <div><p className="eyebrow">Promedio</p><p className="num-display mt-1.5 tnum" style={{fontSize:24,color:numTone(parseFloat(avg))}}>{avg}</p></div>
                <div style={{borderLeft:'1px solid var(--border)',paddingLeft:16}}><p className="eyebrow">Cargadas</p><p className="num-display mt-1.5 tnum" style={{fontSize:24}}>{scores.length}<span style={{fontSize:14,color:'var(--text-faint)'}}>/{grades.length}</span></p></div>
                <div style={{borderLeft:'1px solid var(--border)',paddingLeft:16}}><p className="eyebrow">≥7</p><p className="num-display mt-1.5 tnum" style={{fontSize:24,color:'var(--brand)'}}>{passing}</p></div>
              </div>
            )}
          </Card>

          <Panel title="Notas por alumno">
            <div>
              {grades.map((g,i)=>{
                const score = g.scores[evalObj.name];
                const obs   = (g.obs||{})[evalObj.name]||'';
                const has   = score!==null&&score!==undefined&&score!=='';
                const tone  = evalObj.scale==='numerica' ? numTone(has?Number(score):null) : (CONCEPTUAL.find(c=>c.val===score)||{}).tone||'var(--text-faint)';
                return (
                  <div key={g.sid} style={{borderBottom:i<grades.length-1?'1px solid var(--border)':'none'}}>
                    <div className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={g.name} size="sm"/>
                      <p className="flex-1 min-w-0 text-[13px] font-medium truncate">{g.name}</p>
                      {evalObj.scale==='numerica' ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input type="number" min="0" max="10" step="0.5"
                            value={has?score:''} onChange={e=>setScore(g.sid,e.target.value)}
                            placeholder="–" className="input tnum"
                            style={{width:64,textAlign:'center',fontWeight:600,fontSize:14,color:tone,padding:'6px 4px',borderColor:has?tone:'var(--border)'}}/>
                          <span className="text-[11.5px]" style={{color:'var(--text-faint)'}}>/10</span>
                        </div>
                      ) : (
                        <select value={score||''} onChange={e=>setScore(g.sid,e.target.value)}
                          className="input" style={{width:120,color:tone,fontWeight:600,fontSize:12.5,padding:'6px 8px',borderColor:has?tone:'var(--border)'}}>
                          <option value="">—</option>
                          {CONCEPTUAL.map(c=><option key={c.val} value={c.val}>{c.val} · {c.label}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="px-5 pb-3">
                      <input value={obs} onChange={e=>setObs(g.sid,e.target.value)} maxLength={200}
                        placeholder="Observación al padre (opcional, máx 200 car.)"
                        className="input" style={{fontSize:12,padding:'5px 10px',color:'var(--text-muted)'}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {!evalObj.published&&(
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1">Guardar borrador</button>
              <button onClick={handlePublish} className="btn btn-primary flex-1">
                <Icon name="Send" size={14}/> Publicar notas
              </button>
            </div>
          )}
        </>
      )}

      {/* Period average footer */}
      {periodAvg && periodFilter!=='all' && (
        <div className="flex items-center justify-between px-4 py-3" style={{background:'var(--bg-subtle)',border:'1px solid var(--border)',borderRadius:4}}>
          <p className="text-[12.5px] font-medium" style={{color:'var(--text-muted)'}}>Promedio del {periodFilter==='julio'?'1° Cierre':'2° Cierre'}</p>
          <p className="num-display tnum" style={{fontSize:20,color:numTone(parseFloat(periodAvg))}}>{periodAvg}</p>
        </div>
      )}

      {toast&&<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5"
        style={{background:'var(--text)',color:'#fff',borderRadius:4,fontSize:13,fontWeight:500}}>
        <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--brand-dot)'}}/> {toast}
      </div>}

      {showNewEval&&(
        <div className="overlay">
          <div className="card-hl w-full max-w-sm p-5 space-y-4" style={{background:'var(--bg)',boxShadow:'0 8px 24px rgba(0,0,0,0.08)'}}>
            <h3 className="text-[14px] font-semibold">Nueva evaluación</h3>
            <div><label className="label">Nombre</label>
              <input value={newForm.name} onChange={e=>setNewForm(f=>({...f,name:e.target.value}))} placeholder="ej. Speaking Test 2" className="input"/></div>
            <div><label className="label">Tipo</label>
              <select value={newForm.tipo} onChange={e=>setNewForm(f=>({...f,tipo:e.target.value}))} className="select">
                {TIPO_OPTIONS.map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div><label className="label">Período</label>
              <select value={newForm.period} onChange={e=>setNewForm(f=>({...f,period:e.target.value}))} className="select">
                <option value="julio">1° Cierre (Julio)</option>
                <option value="noviembre">2° Cierre (Noviembre)</option>
              </select></div>
            <div><label className="label">Escala de calificación</label>
              <select value={newForm.scale} onChange={e=>setNewForm(f=>({...f,scale:e.target.value}))} className="select">
                {ESCALA_OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
              </select></div>
            <div><label className="label">Fecha</label>
              <input value={newForm.date} onChange={e=>setNewForm(f=>({...f,date:e.target.value}))} className="input tnum"/></div>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setShowNewEval(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={()=>{
                if(newForm.name.trim()){
                  setEvals(prev=>[...prev,{name:newForm.name,tipo:newForm.tipo,type:newForm.tipo,period:newForm.period,scale:newForm.scale,date:newForm.date,published:false}]);
                }
                setShowNewEval(false);
              }} className="btn btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
};

// ── Teacher Observations — categoría, badge, filtro ──────────────────────
const OBS_CATEGORIES = [
  { id:'academico',     label:'Académico',     color:'var(--info,#1E3A8A)',  bg:'var(--info-soft,#EEF1F8)' },
  { id:'comportamiento',label:'Comportamiento',color:'var(--warning)',       bg:'var(--warning-soft)' },
  { id:'felicitacion',  label:'Felicitación',  color:'var(--brand)',         bg:'var(--brand-soft)' },
];
const OBS_INIT = [
  { id:1, student:'Luciana Sánchez', date:'15/04/2026', category:'academico',     text:'Presenta dificultades con la comprensión auditiva. Se recomienda practicar en casa con material adicional.' },
  { id:2, student:'Lucas Fernández', date:'22/04/2026', category:'felicitacion',  text:'Excelente progreso este mes. Muy participativo en las actividades orales.' },
];

const ObsCategoryBadge = ({ category }) => {
  const cat = OBS_CATEGORIES.find(c=>c.id===category)||OBS_CATEGORIES[0];
  return (
    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5"
      style={{color:cat.color,background:cat.bg,border:`1px solid ${cat.color}33`,borderRadius:2}}>
      {cat.label}
    </span>
  );
};

const TeacherObservations = () => {
  const [selected, setSelected]   = useStateT(null);
  const [text, setText]           = useStateT('');
  const [category, setCategory]   = useStateT('academico');
  const [catFilter, setCatFilter] = useStateT('all');
  const [sent, setSent]           = useStateT(OBS_INIT);

  const handleSend = () => {
    if (!selected || !text.trim()) return;
    setSent(prev=>[{id:Date.now(),student:selected.name,date:'24/06/2026',category,text},...prev]);
    setText(''); setSelected(null); setCategory('academico');
  };

  const visible = catFilter==='all' ? sent : sent.filter(o=>o.category===catFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
      <Panel title="Nueva observación">
        <div className="p-5 space-y-4">
          <div>
            <label className="label">Alumno</label>
            <select value={selected?.id||''} onChange={e=>setSelected(CLASS_STUDENTS.find(s=>String(s.id)===e.target.value)||null)} className="select">
              <option value="">Seleccionar…</option>
              {CLASS_STUDENTS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Categoría</label>
            <div className="flex gap-2 flex-wrap">
              {OBS_CATEGORIES.map(c=>(
                <button key={c.id} onClick={()=>setCategory(c.id)}
                  className="px-3 py-1.5 text-[12.5px] font-medium transition-all"
                  style={{background:category===c.id?c.bg:'var(--bg)',color:category===c.id?c.color:'var(--text-muted)',border:`1px solid ${category===c.id?c.color:'var(--border)'}`,borderRadius:4}}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Observación</label>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={4}
              placeholder="Describí brevemente la situación del alumno."
              className="input" style={{resize:'none',padding:12,fontSize:13.5,lineHeight:1.55}}/>
            <p className="text-right text-[11px] tnum mt-1" style={{color:'var(--text-faint)'}}>{text.length}/500</p>
          </div>
          <button onClick={handleSend} disabled={!selected||!text.trim()} className="btn btn-primary w-full justify-center"
            style={{opacity:(!selected||!text.trim())?0.5:1}}>
            <Icon name="Send" size={14}/> Enviar observación al tutor
          </button>
        </div>
      </Panel>

      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading>Observaciones enviadas</SectionHeading>
        </div>
        {/* Category filter */}
        <div className="flex gap-1 flex-wrap mb-4 p-1" style={{background:'var(--bg-muted)',borderRadius:4,border:'1px solid var(--border)',width:'fit-content'}}>
          {[{id:'all',label:'Todas'},...OBS_CATEGORIES].map(c=>(
            <button key={c.id} onClick={()=>setCatFilter(c.id)}
              className="px-3 py-1.5 text-[12px] font-medium transition-all"
              style={{background:catFilter===c.id?'var(--bg)':'transparent',color:catFilter===c.id?'var(--text)':'var(--text-muted)',borderRadius:3,boxShadow:catFilter===c.id?'0 0 0 1px var(--border)':'none'}}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {visible.map(o=>(
            <Card key={o.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={o.student} size="sm"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[13px] font-medium">{o.student}</p>
                    <div className="flex items-center gap-2">
                      <ObsCategoryBadge category={o.category}/>
                      <span className="text-[11.5px] tnum flex-shrink-0" style={{color:'var(--text-faint)'}}>{o.date}</span>
                    </div>
                  </div>
                  <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{color:'var(--text-muted)'}}>{o.text}</p>
                </div>
              </div>
            </Card>
          ))}
          {!visible.length&&<p className="text-[13px] text-center py-6" style={{color:'var(--text-faint)'}}>Sin observaciones para este filtro</p>}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  TeacherHome, TeacherAttendance, TeacherGrades, TeacherObservations, TeacherNotasCierre,
  ObsCategoryBadge, OBS_CATEGORIES, OBS_INIT,
  TIPO_OPTIONS, ESCALA_OPTIONS, CONCEPTUAL, numTone,
});
