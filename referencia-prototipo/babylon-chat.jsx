// babylon-chat.jsx — Chat: familia ⇄ secretaría/administración
// Staff (admin/secretaria) ve todas las conversaciones; el padre solo la suya.

const { useState: useStateCh, useRef: useRefCh, useEffect: useEffectCh } = React;

const chatPreviewText = (t) => {
  const last = t.messages[t.messages.length - 1];
  if (!last) return 'Sin mensajes todavía';
  return (last.from === 'staff' ? 'Vos: ' : '') + last.text;
};

const ChatBubble = ({ m, mine }) => (
  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
    <div style={{
      maxWidth: '78%', padding: '9px 12px',
      borderRadius: mine ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
      background: mine ? 'var(--brand)' : 'var(--bg-muted)',
      color: mine ? '#fff' : 'var(--text)',
    }}>
      {!mine && (m.roleLabel || m.author) && (
        <p className="text-[10.5px] font-semibold mb-1" style={{ color: 'var(--text-faint)' }}>
          {m.roleLabel ? `${m.roleLabel} — ${m.author}` : m.author}
        </p>
      )}
      <p className="text-[13px] leading-relaxed">{m.text}</p>
      <p className="text-[10px] mt-1" style={{ textAlign: 'right', opacity: mine ? 0.75 : 0.55 }}>{m.time}</p>
    </div>
  </div>
);

const ChatComposer = ({ onSend, placeholder }) => {
  const [draft, setDraft] = useStateCh('');
  const send = () => { if (!draft.trim()) return; onSend(draft); setDraft(''); };
  return (
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
      <input value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder={placeholder} className="input flex-1" style={{ padding: '9px 12px', fontSize: 13 }} />
      <button onClick={send} disabled={!draft.trim()} className="btn btn-primary flex-shrink-0"
        style={{ opacity: draft.trim() ? 1 : 0.5, padding: '9px 12px' }}>
        <Icon name="Send" size={14} />
      </button>
    </div>
  );
};

// ── Vista Secretaría / Administración — lista de todas las familias ─────────
const StaffChat = ({ role }) => {
  const [, bump] = useStateCh(0);
  const refresh = () => bump(n => n + 1);
  const threads = sortedChatThreads();
  const [selectedId, setSelectedId] = useStateCh(threads[0] ? threads[0].id : null);
  const [mobileView, setMobileView] = useStateCh('list');
  const isMobile = useIsMobile();
  const thread = CHAT_THREADS.find(t => t.id === selectedId);
  const scrollRef = useRefCh(null);

  useEffectCh(() => {
    if (selectedId != null) markChatRead(selectedId, 'staff');
  }, [selectedId]);

  useEffectCh(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread && thread.messages.length, selectedId]);

  const openThread = (id) => { setSelectedId(id); setMobileView('thread'); refresh(); };

  const send = (text) => {
    if (!thread) return;
    const author = USER_PROFILES[role] ? USER_PROFILES[role].name : 'Administración';
    sendChatMessage(thread.id, { from: 'staff', author, roleLabel: role === 'admin' ? 'Dirección' : 'Secretaría', text });
    refresh();
  };

  return (
    <Card className="overflow-hidden flex" style={{ height: 'calc(100vh - 168px)', minHeight: 460 }}>
      {(!isMobile || mobileView === 'list') && (
        <div className="flex-1 md:flex-none md:w-[290px] flex flex-col" style={{ borderRight: isMobile ? 'none' : '1px solid var(--border)' }}>
          <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-[13px] font-semibold" style={{ letterSpacing: '-0.01em' }}>Conversaciones</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{threads.length} familias</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.map(t => (
              <div key={t.id} onClick={() => openThread(t.id)}
                className="flex items-start gap-2.5 px-4 py-3 cursor-pointer"
                style={{ borderBottom: '1px solid var(--border)', background: (!isMobile && selectedId === t.id) ? 'var(--bg-subtle)' : 'transparent' }}>
                <Avatar name={t.parentName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-medium truncate">{t.parentName}</p>
                    {lastChatMessage(t) && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{lastChatMessage(t).time}</span>}
                  </div>
                  <p className="text-[10.5px] truncate mt-0.5" style={{ color: 'var(--text-faint)' }}>{t.students.join(' · ')}</p>
                  <p className="text-[12px] truncate mt-1" style={{ color: t.unreadStaff > 0 ? 'var(--text)' : 'var(--text-muted)', fontWeight: t.unreadStaff > 0 ? 600 : 400 }}>{chatPreviewText(t)}</p>
                </div>
                {t.unreadStaff > 0 && (
                  <span style={{ background: 'var(--brand)', color: '#fff', fontSize: 10.5, fontWeight: 600, minWidth: 17, height: 17, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>{t.unreadStaff}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {(!isMobile || mobileView === 'thread') && (
        thread ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              {isMobile && (
                <button onClick={() => setMobileView('list')} className="p-1 -ml-1" style={{ color: 'var(--text-muted)' }}>
                  <Icon name="ChevronLeft" size={18} />
                </button>
              )}
              <Avatar name={thread.parentName} size="sm" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{thread.parentName}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>{thread.students.join(' · ')}{thread.phone ? ` · ${thread.phone}` : ''}</p>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" style={{ background: 'var(--bg-subtle)' }}>
              {thread.messages.length === 0 && (
                <p className="text-[12.5px] text-center py-8" style={{ color: 'var(--text-faint)' }}>Todavía no hay mensajes con esta familia.</p>
              )}
              {thread.messages.map((m, i) => <ChatBubble key={i} m={m} mine={m.from === 'staff'} />)}
            </div>
            <ChatComposer placeholder="Escribir un mensaje…" onSend={send} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-faint)' }}>
            <p className="text-[13px]">Seleccioná una conversación</p>
          </div>
        )
      )}
    </Card>
  );
};

// ── Vista Padre/Tutor — su propia conversación con administración ──────────
const ParentChat = () => {
  const [, bump] = useStateCh(0);
  const parentName = USER_PROFILES.parent.name;
  const thread = chatThreadForParent(parentName);
  const scrollRef = useRefCh(null);

  useEffectCh(() => { if (thread) markChatRead(thread.id, 'parent'); }, []);
  useEffectCh(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread && thread.messages.length]);

  if (!thread) return null;

  const send = (text) => {
    sendChatMessage(thread.id, { from: 'parent', author: parentName, text });
    bump(n => n + 1);
  };

  return (
    <Card className="overflow-hidden flex flex-col max-w-3xl" style={{ height: 'calc(100vh - 300px)', minHeight: 420 }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="eyebrow mb-1">Mensajes</p>
        <h3 className="text-[14px] font-semibold" style={{ letterSpacing: '-0.01em' }}>Conversación con Administración</h3>
        <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-faint)' }}>Secretaría y dirección del instituto</p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" style={{ background: 'var(--bg-subtle)' }}>
        {thread.messages.length === 0 && (
          <p className="text-[12.5px] text-center py-8" style={{ color: 'var(--text-faint)' }}>
            Escribinos si necesitás consultar algo con administración.
          </p>
        )}
        {thread.messages.map((m, i) => <ChatBubble key={i} m={m} mine={m.from === 'parent'} />)}
      </div>
      <ChatComposer placeholder="Escribí tu consulta…" onSend={send} />
    </Card>
  );
};

Object.assign(window, { StaffChat, ParentChat });
