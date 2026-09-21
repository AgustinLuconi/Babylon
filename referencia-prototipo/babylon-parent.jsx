// babylon-parent.jsx — Resumen, Calificaciones, Asistencia, Cuotas (vista del tutor)
// Visual: Mercury × Linear, sober, mobile-first, neutro + verde de marca.

const { useState: useStateP, useEffect: useEffectP } = React;

// ── Attendance calendar — sober mini grid ──────────────────────────────────
const AttendanceCalendar = ({ cal }) => {
  const allDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const calMap = {};
  cal.forEach(c => { calMap[c.d] = c.s; });
  const COLORS = {
    P: { bg: 'var(--brand-soft)',   fg: 'var(--brand)',   dot: 'var(--brand-dot)' },
    T: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning-dot)' },
    A: { bg: 'var(--danger-soft)',  fg: 'var(--danger)',  dot: 'var(--danger-dot)' },
  };

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-[11.5px]">
        {[
          ['P','Presente'],
          ['T','Tarde'],
          ['A','Ausente'],
        ].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[k].dot }} />
            {l}
          </span>
        ))}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold py-1.5 uppercase tracking-wider"
            style={{ color: 'var(--text-faint)' }}>{d}</div>
        ))}
        {Array.from({ length: 4 }, (_, i) => <div key={`e${i}`} />)}
        {allDays.map(d => {
          const s = calMap[d];
          const c = s ? COLORS[s] : null;
          return (
            <div key={d}
              className="aspect-square flex items-center justify-center text-[12px] font-medium tnum"
              style={{
                background: c ? c.bg : 'transparent',
                color: c ? c.fg : (d <= 9 ? 'var(--text)' : 'var(--text-faint)'),
                border: `1px solid ${c ? c.bg : 'var(--border)'}`,
                borderRadius: 3,
              }}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Autorización de imagen — contrato digital ──────────────────────
const AUTH_CONTRACT = `AUTORIZACIÓN DE USO DE IMAGEN — BABYLON ENGLISH INSTITUTE

En la ciudad de San Luis, quien suscribe, en carácter de padre, madre o tutor legal del alumno/a menor de edad, AUTORIZA expresamente al Instituto Babylon English Institute, CUIT 30-71234567-8, con domicilio en San Luis, Argentina, a:

1. CAPTAR imágenes y grabaciones audiovisuales del alumno/a durante las actividades académicas, recreativas e institucionales realizadas en el establecimiento o fuera de él (salidas educativas, actos, eventos y celebraciones).

2. UTILIZAR dichas imágenes exclusivamente con fines institucionales, educativos y de difusión de las actividades del instituto, en los siguientes medios:
   a) Redes sociales oficiales del instituto (Instagram, Facebook)
   b) Sitio web institucional
   c) Material impreso institucional (folletería, cartelería interna)
   d) Comunicaciones internas a las familias

3. La presente autorización se otorga a título GRATUITO, sin derecho a compensación económica alguna, y tendrá vigencia durante todo el ciclo lectivo en curso.

4. El instituto se compromete a: no utilizar las imágenes con fines comerciales ajenos a la institución; no ceder las imágenes a terceros; retirar cualquier imagen publicada a solicitud expresa del firmante dirigida a la administración.

5. Esta autorización puede completarse de forma digital a través de la plataforma de gestión del instituto, registrándose fecha, hora e identidad del firmante, con el mismo valor que la firma ológrafa del formulario en papel (Ley 25.506 de Firma Digital).

La presente autorización es voluntaria. La negativa a otorgarla no afecta en modo alguno la prestación del servicio educativo.`;

// ── Parent Docs — documentación del hijo (carga inicial + autorización digital)
const ParentDocs = ({ kid, onDocsChanged }) => {
  const [, forceRender] = useStateP(0);
  const [authOpen, setAuthOpen] = useStateP(false);
  const [accepted, setAccepted] = useStateP(false);
  const [toast, setToast] = useStateP('');
  const parentName = USER_PROFILES.parent.name;

  const docs = docsFor(kid.id);
  const auth = docs.find(d => d.tipo === 'autorizacion_imagen');

  const refresh = () => { forceRender(n => n + 1); onDocsChanged && onDocsChanged(); };

  const uploadDoc = (tipo) => {
    setDocOverride(kid.id, tipo, { estado:'cargado', url_archivo:`/docs/${kid.id}_${tipo}.pdf`, fecha_carga:'05/07/2026' });
    setToast('Archivo cargado correctamente');
    setTimeout(() => setToast(''), 2500);
    refresh();
  };

  const authorize = () => {
    setDocOverride(kid.id, 'autorizacion_imagen', {
      estado:'autorizada', autorizado_por: parentName,
      fecha_autorizacion:'05/07/2026', hora_autorizacion:'11:23', tipo_autorizacion:'digital',
    });
    setAuthOpen(false); setAccepted(false);
    setToast('Autorización registrada correctamente');
    setTimeout(() => setToast(''), 2500);
    refresh();
  };

  // ── Vista contrato de autorización ──
  if (authOpen) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setAuthOpen(false); setAccepted(false); }}
          className="flex items-center gap-1.5 text-[12.5px] font-medium"
          style={{ color:'var(--text-subtle)', background:'none', border:'none', cursor:'pointer' }}>
          <Icon name="ChevronLeft" size={14}/> Documentación
        </button>
        <Card className="overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
            <p className="eyebrow mb-1">Autorización digital</p>
            <h3 className="text-[15px] font-semibold" style={{ letterSpacing:'-0.01em' }}>Autorización de imagen — {kid.name}</h3>
          </div>
          <div className="px-5 py-4" style={{ maxHeight:340, overflowY:'auto', background:'var(--bg-subtle)' }}>
            <pre className="text-[12px] leading-relaxed" style={{ whiteSpace:'pre-wrap', fontFamily:'inherit', color:'var(--text-muted)' }}>{AUTH_CONTRACT}</pre>
          </div>
          <div className="px-5 py-4 space-y-3" style={{ borderTop:'1px solid var(--border)' }}>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <button type="button" onClick={() => setAccepted(v => !v)}
                className="flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ width:16, height:16, background:accepted?'var(--brand)':'var(--bg)', border:`1px solid ${accepted?'var(--brand)':'var(--border-strong)'}`, borderRadius:2 }}>
                {accepted && <Icon name="Check" size={11} strokeWidth={2.5} style={{ color:'#fff' }}/>}
              </button>
              <span className="text-[12.5px] leading-snug" style={{ color:'var(--text)' }} onClick={() => setAccepted(v => !v)}>
                He leído y acepto la autorización de imagen para <strong>{kid.name}</strong>
              </span>
            </label>
            <button onClick={authorize} disabled={!accepted}
              className="btn btn-primary w-full justify-center"
              style={{ opacity:accepted?1:0.45, padding:'11px' }}>
              <Icon name="CheckCircle" size={14}/> Autorizar
            </button>
            <p className="text-[11px] text-center leading-relaxed" style={{ color:'var(--text-faint)' }}>
              Se registrará tu nombre, fecha y hora de aceptación. Una vez autorizada,
              solo la administración del instituto puede modificarla.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ── Lista de documentos ──
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {docs.map(d => {
        const isAuth = d.tipo === 'autorizacion_imagen';
        const done = d.estado === 'cargado' || d.estado === 'autorizada';
        return (
          <Card key={d.tipo} className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center flex-shrink-0"
                style={{ width:34, height:34, borderRadius:3, background: done?'var(--brand-soft)':'var(--bg-muted)', color: done?'var(--brand)':'var(--text-faint)' }}>
                <Icon name={isAuth ? 'FileSignature' : 'FileText'} size={15}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium">{d.label}</p>
                {d.estado === 'autorizada' ? (
                  <p className="text-[11.5px] mt-0.5" style={{ color:'var(--brand)' }}>
                    Autorizada por {d.autorizado_por} el <span className="tnum">{d.fecha_autorizacion}</span>{d.hora_autorizacion ? <> a las <span className="tnum">{d.hora_autorizacion}</span></> : null}
                    {d.tipo_autorizacion === 'manual' && ' (firmada en papel)'}
                  </p>
                ) : d.estado === 'cargado' ? (
                  <p className="text-[11.5px] mt-0.5" style={{ color:'var(--text-faint)' }}>Cargado el <span className="tnum">{d.fecha_carga}</span></p>
                ) : (
                  <p className="text-[11.5px] mt-0.5" style={{ color:'var(--warning)' }}>Pendiente</p>
                )}
              </div>
              <div className="flex-shrink-0">
                {isAuth ? (
                  d.estado === 'autorizada'
                    ? <span className="status paid">Autorizada</span>
                    : <button onClick={() => setAuthOpen(true)} className="btn btn-primary btn-sm">
                        <Icon name="FileSignature" size={12}/> Completar
                      </button>
                ) : (
                  d.estado === 'cargado'
                    ? <button className="btn btn-secondary btn-sm"><Icon name="Eye" size={12}/> Ver</button>
                    : <button onClick={() => uploadDoc(d.tipo)} className="btn btn-primary btn-sm">
                        <Icon name="Upload" size={12}/> Subir archivo
                      </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
      </div>

      <p className="text-[11.5px] leading-relaxed px-1 pt-1" style={{ color:'var(--text-faint)' }}>
        Los documentos ya cargados solo pueden ser reemplazados por la administración del instituto.
        Si necesitás corregir un archivo, comunicate con secretaría.
      </p>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5"
          style={{ background:'var(--text)', color:'#fff', borderRadius:4, fontSize:13, fontWeight:500 }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--brand-dot)' }}/> {toast}
        </div>
      )}
    </div>
  );
};

// ── Parent Home (single screen with tabs) ──────────────────────────────────
const ParentHome = ({ initialTab = 'home' }) => {
  const [kidIdx, setKidIdx] = useStateP(0);
  const [tab, setTab] = useStateP(initialTab);
  const [, bump] = useStateP(0); // re-render tras cambios de documentación
  useEffectP(() => { setTab(initialTab); }, [initialTab]);
  const kid = PARENT_KIDS[kidIdx];
  const sRec = STUDENTS.find(s => s.id === kid.id);
  const obsFeed = sRec ? obsFor(sRec) : [];
  const cierre = sRec ? notaCierreFor(sRec, 'julio') : null;
  const cierreVisible = cierre && cierre.estado === 'publicada' ? cierre : null;
  const docsPending = hasPendingDocs(kid.id);

  const avgGrade = kid.grades.length > 0
    ? (kid.grades.reduce((a, g) => a + g.score, 0) / kid.grades.length).toFixed(1)
    : '—';
  const presentCount = kid.cal.filter(c => c.s === 'P').length;
  const totalMarked = kid.cal.length;

  const tabs = [
    { id: 'home',       label: 'Resumen' },
    { id: 'grades',     label: 'Notas' },
    { id: 'attendance', label: 'Asistencia' },
    { id: 'fees',       label: 'Cuotas' },
    { id: 'docs',       label: 'Docs' },
    { id: 'chat',       label: 'Mensajes' },
  ];

  const feeStatusLabels = { paid: 'Al día', pending: 'Pendiente', overdue: 'Vencida' };

  return (
    <div className="space-y-4">

      {/* Child selector — segmented control */}
      {tab !== 'chat' && PARENT_KIDS.length > 1 && (
        <div className="flex items-center gap-1 p-1"
          style={{ background: 'var(--bg-muted)', borderRadius: 4, border: '1px solid var(--border)' }}>
          {PARENT_KIDS.map((k, i) => (
            <button key={k.id} onClick={() => setKidIdx(i)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[12.5px] font-medium transition-all"
              style={{
                background: i === kidIdx ? 'var(--bg)' : 'transparent',
                color: i === kidIdx ? 'var(--text)' : 'var(--text-muted)',
                borderRadius: 3,
                boxShadow: i === kidIdx ? '0 0 0 1px var(--border)' : 'none',
              }}>
              <Avatar name={k.name} size="xs" tone={i === kidIdx ? 'brand' : 'neutral'} />
              <span className="truncate">{k.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Kid header card */}
      {tab !== 'chat' && (
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={kid.name} size="lg" tone="brand" />
          <div className="flex-1 min-w-0">
            <div className="mb-1.5"><LevelBadge level={levelOf(kid.course) || ''}>{kid.course}</LevelBadge></div>
            <h2 className="text-[18px] font-semibold leading-tight" style={{ color: 'var(--text)', letterSpacing: '-0.015em' }}>{kid.name}</h2>
            <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Prof. {kid.teacher} · <span className="tnum">{kid.age}</span> años
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Promedio',  val: avgGrade, sub: '/ 10' },
            { label: 'Asistencia', val: `${kid.attPct}%`, sub: `${presentCount}/${totalMarked} clases` },
            { label: 'Cuota mayo', val: feeStatusLabels[kid.fees[2]?.status] || '—', sub: 'estado', tone: kid.fees[2]?.status },
          ].map((s, i) => (
            <div key={s.label} style={{
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              paddingLeft: i > 0 ? 14 : 0,
            }}>
              <p className="eyebrow">{s.label}</p>
              <p className="num-display mt-1.5 tnum" style={{
                fontSize: 22,
                color: s.tone === 'paid' ? 'var(--brand)'
                  : s.tone === 'overdue' ? 'var(--danger)'
                  : s.tone === 'pending' ? 'var(--warning)'
                  : 'var(--text)',
              }}>
                {s.val}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1"
        style={{ background: 'var(--bg-muted)', borderRadius: 4, border: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center py-2 text-[12.5px] font-medium transition-all"
            style={{
              background: tab === t.id ? 'var(--bg)' : 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              borderRadius: 3,
              boxShadow: tab === t.id ? '0 0 0 1px var(--border)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Resumen ── */}
      {tab === 'home' && (
        <div className="space-y-4">
          {/* Aviso documentación pendiente */}
          {docsPending && (
            <Card className="px-4 py-3 max-w-3xl" style={{ borderColor:'var(--warning-dot)', background:'var(--warning-soft)' }}>
              <div className="flex items-center gap-3">
                <Icon name="AlertCircle" size={15} style={{ color:'var(--warning)', flexShrink:0 }}/>
                <p className="flex-1 text-[12.5px]" style={{ color:'var(--warning)' }}>
                  Tenés documentación pendiente de <strong>{kid.name.split(' ')[0]}</strong>.
                </p>
                <button onClick={() => setTab('docs')} className="btn btn-sm flex-shrink-0"
                  style={{ background:'var(--warning)', color:'#fff', border:'1px solid var(--warning)' }}>
                  Completar
                </button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {obsFeed.length > 0 && (
            <Card className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>Mensajes del instituto</h3>
                <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{obsFeed[0].date}</span>
              </div>
              <div className="space-y-2.5">
                {obsFeed.slice(0, 2).map((o, i) => {
                  const cat = OBS_CATS[o.category] || OBS_CATS.academico;
                  return (
                    <div key={i} className="px-4 py-3"
                      style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)', borderRadius: 4 }}>
                      <span className="inline-flex items-center text-[10.5px] font-medium px-1.5 py-0.5 mb-2"
                        style={{ border:`1px solid ${cat.color}`, color:cat.color, borderRadius:2 }}>{cat.label}</span>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text)' }}>{o.text}</p>
                      <p className="text-[11.5px] mt-2" style={{ color: 'var(--text-muted)' }}>— {obsAuthorLabel(o)}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Panel title="Últimas calificaciones"
            action={<button onClick={() => setTab('grades')} className="text-[12px] font-medium hover:underline" style={{ color: 'var(--brand)' }}>Ver todas →</button>}>
            <div>
              {kid.grades.slice(-3).reverse().map((g, i, arr) => {
                const tone = g.score >= 7 ? 'var(--brand)' : g.score >= 5 ? 'var(--warning)' : 'var(--danger)';
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div className="flex items-center justify-center font-semibold tnum"
                      style={{ width: 36, height: 36, background: 'var(--bg-muted)', color: tone, borderRadius: 3, fontSize: 14 }}>
                      {g.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{g.name}</p>
                      <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>{g.type} · <span className="tnum">{g.date}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          </div>
        </div>
      )}

      {/* ── Calificaciones ── */}
      {tab === 'grades' && (
        <div className={cierreVisible ? "grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start" : "space-y-4"}>
        <Panel title="Calificaciones"
          action={<span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Promedio: <span className="tnum font-medium" style={{ color: 'var(--brand)' }}>{avgGrade}</span></span>}>
          <div>
            {kid.grades.map((g, i) => {
              const tone = g.score >= 7 ? 'var(--brand)' : g.score >= 5 ? 'var(--warning)' : 'var(--danger)';
              return (
                <div key={i} className="px-5 py-4"
                  style={{ borderBottom: i < kid.grades.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center font-semibold tnum flex-shrink-0"
                      style={{ width: 44, height: 44, background: 'var(--bg-muted)', color: tone, borderRadius: 3, fontSize: 17 }}>
                      {g.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium">{g.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Tag>{g.type}</Tag>
                        <span className="text-[11.5px] tnum" style={{ color: 'var(--text-faint)' }}>{g.date}</span>
                      </div>
                      {g.obs && (
                        <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>"{g.obs}"</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Nota de cierre — solo publicada */}
        {cierreVisible && (
          <Card className="p-5" style={{ borderColor:'var(--brand-border)', background:'var(--brand-soft)' }}>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center font-semibold tnum flex-shrink-0"
                style={{ width:52, height:52, background:'var(--bg)', color:'var(--brand)', borderRadius:3, fontSize:20, border:'1px solid var(--brand-border)' }}>
                {cierreVisible.nota}
              </div>
              <div className="flex-1 min-w-0">
                <p className="eyebrow" style={{ color:'var(--brand)' }}>Nota de cierre — 1° Cierre (Julio)</p>
                <p className="text-[13.5px] font-semibold mt-1" style={{ color:'var(--brand)' }}>Nota final del período: {cierreVisible.nota} / 10</p>
                {cierreVisible.observacion && (
                  <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color:'var(--text-muted)' }}>"{cierreVisible.observacion}"</p>
                )}
              </div>
            </div>
          </Card>
        )}
        </div>
      )}
      {tab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 items-start">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="eyebrow">Asistencia</p>
                <h3 className="text-[15px] font-semibold mt-1.5" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>Mayo 2026</h3>
              </div>
              <div className="text-right">
                <p className="num-display tnum" style={{ fontSize: 22, color: 'var(--brand)' }}>{kid.attPct}%</p>
                <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>presencia</p>
              </div>
            </div>
            <AttendanceCalendar cal={kid.cal} />
          </Card>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:'Presentes', count: kid.cal.filter(c=>c.s==='P').length, tone:'var(--brand)' },
                { label:'Tardanzas', count: kid.cal.filter(c=>c.s==='T').length, tone:'var(--warning)' },
                { label:'Ausencias', count: kid.cal.filter(c=>c.s==='A').length, tone:'var(--danger)' },
              ].map(s => (
                <Card key={s.label} className="p-4">
                  <p className="eyebrow">{s.label}</p>
                  <p className="num-display tnum mt-1.5" style={{ fontSize: 24, color: s.tone }}>{s.count}</p>
                </Card>
              ))}
            </div>
            <Panel title="Detalle del mes">
              <div>
                {kid.cal.filter(c => c.s !== 'P').sort((a,b)=>a.d-b.d).map((c, i, arr) => (
                  <div key={c.d} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span className="text-[13px]" style={{ color:'var(--text)' }}>Día <span className="tnum">{c.d}</span> de mayo</span>
                    <Badge variant={c.s==='T'?'pending':'overdue'}>{c.s==='T'?'Tarde':'Ausente'}</Badge>
                  </div>
                ))}
                {kid.cal.every(c=>c.s==='P') && (
                  <p className="text-[12.5px] text-center py-6" style={{ color:'var(--text-faint)' }}>Sin tardanzas ni ausencias este mes.</p>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* ── Cuotas ── */}
      {tab === 'fees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {kid.fees.map((f, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium">{f.month}</p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    Vence: <span className="tnum">{f.due}</span>
                  </p>
                  {f.paid && (
                    <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--brand)' }}>
                      Pagada el <span className="tnum">{f.paid}</span>
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[14px] tnum font-medium">{fmt$(f.amount)}</p>
                  <div className="mt-1"><Badge variant={feeVariant(f.status)}>{feeLabel(f.status)}</Badge></div>
                </div>
              </div>
              {f.status === 'pending' && (
                <p className="text-[11.5px] mt-3 pt-3 flex items-start gap-2"
                  style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <Icon name="Info" size={12} style={{ color: 'var(--text-faint)', marginTop: 2, flexShrink: 0 }} />
                  El pago se realiza directamente en el instituto. Aceptamos efectivo, transferencia y Mercado Pago.
                </p>
              )}
            </Card>
          ))}
          {kidIdx > 0 && (
            <Card className="px-4 py-3 md:col-span-2"
              style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand-border)' }}>
              <p className="text-[12px] flex items-center gap-2" style={{ color: 'var(--brand)' }}>
                <Icon name="Tag" size={12} />
                Descuento del 10 % aplicado por hermano inscripto.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ── Documentación ── */}
      {tab === 'docs' && (
        <ParentDocs kid={kid} onDocsChanged={() => bump(n => n + 1)} />
      )}

      {/* ── Mensajes ── */}
      {tab === 'chat' && <ParentChat />}
    </div>
  );
};

Object.assign(window, { ParentHome, AttendanceCalendar, ParentDocs });
