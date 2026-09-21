// babylon-layout.jsx — Sidebar, Header, BottomNav, AppLayout
// Visual system: Premium fintech (Mercury × Linear) · single brand color · sharp corners · hairline borders.

const { useState, useEffect } = React;

// ── Icon — lucide UMD with thin default stroke ──────────────────────────────
const Icon = ({ name, size = 16, className = '', strokeWidth = 1.6, style = {} }) => {
  const lucide = window.lucide || {};
  const iconData = lucide[name];
  if (!iconData) return <span style={{ display: 'inline-block', width: size, height: size }} />;
  const [, , children] = iconData;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {(children || []).map(([tag, attrs], i) =>
        React.createElement(tag, { key: i, ...attrs })
      )}
    </svg>
  );
};

// Initials from a name (max 2)
const initials = (name = '') =>
  name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();

// Mobile context — allows forced mobile layout for preview simulation
const MobileCtx = React.createContext(false);
const useIsMobile = () => React.useContext(MobileCtx);

// Nav set for a role
const navFor = (role) =>
  role === 'admin'     ? NAV_ADMIN
  : role === 'teacher'   ? NAV_TEACHER
  : role === 'secretary' ? NAV_SECRETARY
  : NAV_PARENT;

const roleArea = (role) =>
  role === 'admin'     ? 'Administración'
  : role === 'secretary' ? 'Secretaría'
  : role === 'teacher'   ? 'Docente'
  : 'Familia';

// ── Avatar — monochrome, square w/ 2px corners ──────────────────────────────
const Avatar = ({ name, size = 'sm', tone = 'neutral' }) => {
  const sz = { xs: 22, sm: 28, md: 36, lg: 48 }[size] || 28;
  const fontSize = sz < 28 ? 10 : sz < 40 ? 11.5 : 14;
  const cls = tone === 'brand' ? 'avatar avatar-brand' : 'avatar';
  return (
    <div className={cls} style={{ width: sz, height: sz, fontSize, borderRadius: sz > 40 ? 3 : 2 }}>
      {initials(name)}
    </div>
  );
};

// ── Logo ────────────────────────────────────────────────────────────────────
const BabylonLogo = ({ size = 'md', dark = false }) => {
  const monoSize = size === 'lg' ? 38 : 30;
  const fontSize = size === 'lg' ? 18 : 15;
  const wordSize = size === 'lg' ? 17 : 15;
  const color    = dark ? '#FFFFFF' : 'var(--text)';
  const subColor = dark ? 'rgba(255,255,255,0.55)' : 'var(--text-faint)';
  const borderC  = dark ? 'rgba(255,255,255,0.45)' : 'currentColor';

  return (
    <div className="flex items-center gap-2.5 select-none" style={{ color }}>
      <div
        className="flex items-center justify-center font-semibold"
        style={{
          width: monoSize, height: monoSize, fontSize,
          borderRadius: 2,
          border: `1px solid ${borderC}`,
          letterSpacing: '-0.04em',
        }}>
        B
      </div>
      <div className="flex flex-col leading-none">
        <div style={{ fontSize: wordSize, fontWeight: 600, letterSpacing: '-0.015em' }}>Babylon</div>
        <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4, color: subColor }}>
          English Institute
        </div>
      </div>
    </div>
  );
};

// ── Sidebar (white, Linear-style) ───────────────────────────────────────────
const Sidebar = ({ role, screen, onNavigate, user, onLogout, isMobile = false }) => {
  if (isMobile) return null;
  const navItems = navFor(role);

  return (
    <aside
      className="hidden md:flex flex-col h-screen w-[244px] flex-shrink-0 fixed left-0 top-0 z-30"
      style={{ background: 'var(--sidebar-bg)' }}>

      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <BabylonLogo dark />
      </div>
      <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '0 20px' }} />

      {/* Role pill (minimal) */}
      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: 'var(--sidebar-text-muted)' }}>
          <span className="w-1 h-1 rounded-full" style={{ background: '#FFFFFF', opacity: 0.7 }} />
          <span style={{ letterSpacing: '0.02em' }}>
            {roleArea(role)}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1">
        {navItems.map((item, i) => {
          if (item.group) {
            return (
              <div key={`g-${i}`} className="nav-group">{item.group}</div>
            );
          }
          const active = screen === item.id;
          const count = item.badge ? item.badge() : 0;
          return (
            <div key={item.id} className={`nav-link ${active ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
              <Icon name={item.icon} size={15} strokeWidth={active ? 1.8 : 1.6} />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span style={{ background:'rgba(255,255,255,0.22)', color:'#fff', fontSize:10.5, fontWeight:600, minWidth:17, height:17, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', flexShrink:0 }}>{count}</span>
              )}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.10)', color: '#FFFFFF', borderRadius: 2,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.18)',
          }}>{initials(user.name)}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate" style={{ color: '#FFFFFF' }}>{user.name}</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-text-muted)' }}>{user.role}</div>
          </div>
          <button onClick={onLogout}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--sidebar-text-muted)', borderRadius: 3 }}
            onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--sidebar-text-muted)'}
            title="Cerrar sesión">
            <Icon name="LogOut" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};

// ── Header ───────────────────────────────────────────────────────────────────
const Header = ({ title, subtitle, user, onMenuOpen, searchQuery = '', onSearch, isMobile = false }) => {
  return (
    <header
      className="h-[60px] flex items-center gap-4 px-4 sm:px-7 sticky top-0 z-20"
      style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
      {/* Hamburger */}
      <button onClick={onMenuOpen}
        className={`p-1.5 -ml-1.5 flex-shrink-0 rounded ${isMobile ? '' : 'md:hidden'}`}
        style={{ color: 'var(--text-muted)' }}>
        <Icon name="Menu" size={20} />
      </button>

      {/* Title */}
      {!isMobile && (
        <div className="hidden md:flex flex-col flex-shrink-0">
          <h1 className="text-[15.5px] font-semibold leading-none" style={{ color: 'var(--text)', letterSpacing: '-0.015em' }}>{title}</h1>
          {subtitle && <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--text-faint)' }}>{subtitle}</p>}
        </div>
      )}

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto md:mx-0 md:ml-6 min-w-0">
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-faint)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch && onSearch(e.target.value)}
            placeholder="Buscar alumnos, cursos, cuotas…"
            className="input"
            style={{ paddingLeft: 32, paddingTop: 7, paddingBottom: 7, fontSize: 13, background: 'var(--bg-subtle)' }}
          />
          {searchQuery && (
            <button onClick={() => onSearch && onSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200 rounded"
              style={{ color: 'var(--text-faint)' }}>
              <Icon name="X" size={13} />
            </button>
          )}
          <kbd className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center px-1.5 h-[18px] text-[10px] font-medium pointer-events-none"
            style={{
              color: 'var(--text-faint)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              background: 'var(--bg)',
              display: searchQuery ? 'none' : '',
            }}>⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <button className="relative p-2 rounded hover:bg-zinc-100 transition-colors"
          style={{ color: 'var(--text-muted)', borderRadius: 4 }}>
          <Icon name="Bell" size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--danger-dot)' }} />
        </button>
        <div className="ml-1">
          <Avatar name={user.name} size="sm" tone="brand" />
        </div>
      </div>
    </header>
  );
};

// ── Mobile Drawer ────────────────────────────────────────────────────────────
const MobileDrawer = ({ open, onClose, role, screen, onNavigate, user }) => {
  const navItems = navFor(role);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0" style={{ background: 'rgba(9,9,11,0.4)' }} onClick={onClose} />
      <aside className="absolute left-0 top-0 bottom-0 w-[280px] flex flex-col"
        style={{ background: 'var(--sidebar-bg)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <BabylonLogo dark />
          <button onClick={onClose} className="p-1.5 rounded" style={{ color: 'var(--sidebar-text-muted)' }}>
            <Icon name="X" size={18} />
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '0 20px' }} />
        <nav className="flex-1 overflow-y-auto py-1">
          {navItems.map((item, i) => {
            if (item.group) return <div key={`g-${i}`} className="nav-group">{item.group}</div>;
            const active = screen === item.id;
            const count = item.badge ? item.badge() : 0;
            return (
              <div key={item.id} className={`nav-link ${active ? 'active' : ''}`}
                onClick={() => { onNavigate(item.id); onClose(); }}>
                <Icon name={item.icon} size={15} />
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span style={{ background:'rgba(255,255,255,0.22)', color:'#fff', fontSize:10.5, fontWeight:600, minWidth:17, height:17, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', flexShrink:0 }}>{count}</span>
                )}
              </div>
            );
          })}
        </nav>
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.10)', color: '#FFFFFF', borderRadius: 2,
              fontSize: 11, fontWeight: 600, border: '1px solid rgba(255,255,255,0.18)',
            }}>{initials(user.name)}</div>
            <div>
              <div className="text-[12.5px] font-medium" style={{ color: '#FFFFFF' }}>{user.name}</div>
              <div className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)' }}>{user.role}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

// ── Bottom Nav (mobile) ───────────────────────────────────────────────────────
const BottomNav = ({ role, screen, onNavigate, isMobile = false }) => {
  const allNav = navFor(role)
    .filter(n => !n.group)
    .slice(0, 5);
  return (
    <nav className={`bottom-nav fixed bottom-0 left-0 right-0 z-30 ${isMobile ? '' : 'md:hidden'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {allNav.map(item => {
          const active = screen === item.id;
          const count = item.badge ? item.badge() : 0;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              className={`bottom-nav-item ${active ? 'active' : ''}`}>
              <span className="relative inline-flex">
                <Icon name={item.icon} size={18} strokeWidth={active ? 1.9 : 1.6} />
                {count > 0 && (
                  <span style={{ position:'absolute', top:-4, right:-6, background:'var(--danger)', color:'#fff', fontSize:9, fontWeight:700, minWidth:14, height:14, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{count}</span>
                )}
              </span>
              <span>{item.label}</span>
              <span className="bn-dot" />
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// ── Screen titles ─────────────────────────────────────────────────────────────
const SCREEN_TITLES = {
  dashboard: { title: 'Resumen general',   sub: 'Estado actual del instituto' },
  students:  { title: 'Alumnos',            sub: 'Legajos, cursos y estado de cuota' },
  courses:   { title: 'Cursos',             sub: 'Comisiones del ciclo 2026' },
  payments:  { title: 'Cuotas',             sub: 'Cobranza y conciliación mensual' },
  reports:   { title: 'Reportes',           sub: 'Informes académicos y financieros' },
  professors:{ title: 'Profesores',         sub: 'Plantel docente y asignaciones' },
  users:     { title: 'Usuarios del sistema', sub: 'Acceso, roles y permisos' },
  settings:  { title: 'Configuración',      sub: 'Parámetros del sistema' },
  'teacher-home': { title: 'Mis cursos',    sub: 'Comisiones a cargo · Mayo 2026' },
  attendance:     { title: 'Asistencia',    sub: 'Registro de presentes, tardanzas y ausencias' },
  grades:         { title: 'Calificaciones', sub: 'Carga y publicación de evaluaciones' },
  observations:   { title: 'Observaciones', sub: 'Comunicaciones al tutor del alumno' },
  chat:           { title: 'Chats',         sub: 'Consultas de las familias con administración' },
  'parent-home':       { title: 'Resumen',        sub: 'Estado académico y de cuotas' },
  'parent-grades':     { title: 'Calificaciones', sub: '' },
  'parent-attendance': { title: 'Asistencia',     sub: '' },
  'parent-fees':       { title: 'Cuotas',         sub: '' },
  'parent-docs':       { title: 'Documentación',  sub: 'Legajo digital de tu hijo/a' },
  'parent-chat':       { title: 'Mensajes',       sub: 'Consultas con administración' },
};

// ── App Layout ────────────────────────────────────────────────────────────────
const AppLayout = ({ role, screen, onNavigate, title, children, onRoleChange, searchQuery = '', onSearch, isMobile = false }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = USER_PROFILES[role];
  const sc = SCREEN_TITLES[screen] || { title: title || '', sub: '' };

  return (
    <MobileCtx.Provider value={isMobile}>
      <div className="flex min-h-screen" style={{ background: 'var(--bg-subtle)' }}>
        <Sidebar role={role} screen={screen} onNavigate={onNavigate}
          user={user} onLogout={() => onRoleChange('admin')} isMobile={isMobile} />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
          role={role} screen={screen} onNavigate={onNavigate} user={user} />

        <div className={`flex-1 flex flex-col min-h-screen min-w-0 ${isMobile ? '' : 'md:ml-[244px]'}`}>
          <Header
            title={sc.title}
            subtitle={sc.sub}
            user={user}
            onMenuOpen={() => setDrawerOpen(true)}
            searchQuery={searchQuery}
            onSearch={onSearch}
            isMobile={isMobile} />
          <main className={`flex-1 overflow-y-auto overflow-x-hidden ${isMobile ? 'pb-24' : 'pb-8 md:pb-8'}`}
            style={{ background: 'var(--bg-subtle)' }}>
            <div className="px-4 md:px-7 py-5 md:py-7 max-w-[1400px] mx-auto">
              {children}
            </div>
          </main>
        </div>

        <BottomNav role={role} screen={screen} onNavigate={onNavigate} isMobile={isMobile} />
      </div>
    </MobileCtx.Provider>
  );
};

// ── Shared UI primitives ──────────────────────────────────────────────────────

// Status pill — dot + label, no icons, subtle bg
const Badge = ({ children, variant = 'default' }) => {
  return <span className={`status ${variant !== 'default' ? variant : ''}`}>{children}</span>;
};

// Level tag — neutral square label
const Tag = ({ children }) => (
  <span className="tag">{children}</span>
);

// Card — hairline, sharp corner
const Card = ({ children, className = '', style = {} }) => (
  <div className={`card-hl ${className}`} style={style}>
    {children}
  </div>
);

// Card with header (title row + body)
const Panel = ({ title, action, children, className = '', dense = false }) => (
  <Card className={`overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</h3>
        {action}
      </div>
    )}
    <div className={dense ? '' : ''}>
      {children}
    </div>
  </Card>
);

// Page section heading
const SectionHeading = ({ children, action }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-[13px] font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>{children}</h2>
    {action}
  </div>
);

// Access denied — shown when a role hits a screen outside its permissions
const AccessDenied = ({ onHome }) => (
  <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
    <Card className="p-8 max-w-md text-center">
      <div className="mx-auto flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 4, background: 'var(--danger-soft)', color: 'var(--danger)' }}>
        <Icon name="ShieldAlert" size={22} />
      </div>
      <h3 className="text-[16px] font-semibold mt-4" style={{ color: 'var(--text)', letterSpacing: '-0.015em' }}>Acceso denegado</h3>
      <p className="text-[13px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Tu rol no tiene permiso para acceder a esta sección. Si creés que es un error, comunicate con la administración del instituto.
      </p>
      {onHome && (
        <button onClick={onHome} className="btn btn-secondary mt-5 mx-auto">
          <Icon name="ArrowLeft" size={14} /> Volver al inicio
        </button>
      )}
    </Card>
  </div>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const feeVariant = s => s === 'paid' ? 'paid' : s === 'overdue' ? 'overdue' : 'pending';
const feeLabel   = s => s === 'paid' ? 'Al día' : s === 'overdue' ? 'Vencida' : 'Pendiente';
const levelBadge = l => l.toLowerCase();
const avatarColor = () => 'var(--bg-muted)'; // back-compat shim; new code uses <Avatar/>
const fmt$ = n => `$${n.toLocaleString('es-AR')}`;
const fmtDate = s => s; // dd/mm/yyyy already

// BADGE_ICONS kept for back-compat (unused in new code)
const BADGE_ICONS = {};

Object.assign(window, {
  Icon, BabylonLogo, Avatar, initials,
  Sidebar, Header, BottomNav, MobileDrawer, AppLayout,
  Badge, Tag, Card, Panel, SectionHeading, AccessDenied,
  feeVariant, feeLabel, levelBadge, fmt$, fmtDate, avatarColor, BADGE_ICONS,
  MobileCtx, useIsMobile, navFor, roleArea,
});
