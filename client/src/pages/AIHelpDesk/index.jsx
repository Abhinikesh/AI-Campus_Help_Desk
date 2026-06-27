import { useState, useRef, useEffect } from 'react';
import { aiService } from '../../services/ai.service';
import {
  Send, Trash2, Plus, BookOpen, Building2, Map, Flag, Cpu
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './AIHelpDesk.css';

/* ── Agent registry ──────────────────────────────────────── */
const AGENTS = {
  auto:      { label: 'Auto',           Icon: Cpu,       desc: 'Smart routing'             },
  academic:  { label: 'Academic Agent', Icon: BookOpen,  desc: 'Timetable, Results, Exams' },
  admin:     { label: 'Admin Agent',    Icon: Building2, desc: 'Fees, ID Card, Documents'  },
  navigation:{ label: 'Navigation Agent',Icon: Map,      desc: 'Find rooms & locations'    },
  complaint: { label: 'Complaint Agent',Icon: Flag,      desc: 'Raise & track issues'      },
};

const SUGGESTIONS = [
  'Check my attendance',
  'Upcoming exam schedule',
  'Raise a complaint',
  'How to pay fees?',
  'Where is the library?',
];

/* ── Empty-state SVG ──────────────────────────────────────── */
const EmptyChatSVG = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="14" width="56" height="38" rx="8" stroke="#D1D5DB" strokeWidth="2" fill="none"/>
    <circle cx="22" cy="33" r="4" fill="#D1D5DB"/>
    <circle cx="36" cy="33" r="4" fill="#D1D5DB"/>
    <circle cx="50" cy="33" r="4" fill="#D1D5DB"/>
    <path d="M28 52l4 6 4-6" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

/* ── Dot typing indicator ─────────────────────────────────── */
const TypingDots = () => (
  <div className="ai-typing">
    <span /><span /><span />
  </div>
);

/* ════════════════════════════════════════════════════════════
   Main component
════════════════════════════════════════════════════════════ */
const AIHelpDesk = () => {
  /* chat sessions: [{ id, agentKey, messages[] }] */
  const [sessions,    setSessions]    = useState([]);
  const [activeId,    setActiveId]    = useState(null);
  const [agentKey,    setAgentKey]    = useState('auto');
  const [autoDetect,  setAutoDetect]  = useState(true);
  const [inputVal,    setInputVal]    = useState('');
  const [isLoading,   setIsLoading]   = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  const emptyMessagesRef = useRef([]);
  const activeSession = sessions.find(s => s.id === activeId) || null;
  const messages = activeSession?.messages || emptyMessagesRef.current;

  /* Scroll to bottom when messages change */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  /* New chat */
  const newChat = () => {
    const id = Date.now();
    setSessions(prev => [{
      id,
      agentKey,
      messages: [{
        id: 1, role: 'ai', agentKey,
        content: "Hello! I'm your Campus AI Assistant. Ask me anything about academics, administration, campus navigation, or complaints.",
        ts: now(),
      }]
    }, ...prev]);
    setActiveId(id);
    setInputVal('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  /* Clear current chat */
  const clearChat = () => {
    if (!activeId) return;
    setSessions(prev => prev.map(s => s.id !== activeId ? s : {
      ...s,
      messages: [{
        id: Date.now(), role: 'ai', agentKey,
        content: 'Chat cleared. How can I help you?',
        ts: now(),
      }]
    }));
  };

  /* Send */
  const sendMessage = async (textOverride) => {
    const text = (textOverride || inputVal).trim();
    if (!text || isLoading) return;

    // If no session exists, create one
    let sid = activeId;
    if (!sid) {
      sid = Date.now();
      setSessions(prev => [{
        id: sid, agentKey,
        messages: [{
          id: 1, role: 'ai', agentKey,
          content: "Hello! I'm your Campus AI Assistant.",
          ts: now(),
        }]
      }, ...prev]);
      setActiveId(sid);
    }

    const userMsg = { id: Date.now(), role: 'user', content: text, ts: now() };
    setSessions(prev => prev.map(s => s.id !== sid ? s : { ...s, messages: [...s.messages, userMsg] }));
    setInputVal('');
    setIsLoading(true);

    try {
      const history = (sessions.find(s => s.id === sid)?.messages || []).slice(-10);
      const res = await aiService.chat({ message: text, history, agent: autoDetect ? null : agentKey });
      const respondingAgent = res?.agent || agentKey;
      if (res?.agent && autoDetect) setAgentKey(res.agent);

      const aiMsg = {
        id: Date.now() + 1, role: 'ai', agentKey: respondingAgent,
        content: res?.reply || "Sorry, I couldn't connect. Please try again.",
        ts: now(),
      };
      setSessions(prev => prev.map(s => s.id !== sid ? s : { ...s, messages: [...s.messages, aiMsg] }));
    } catch {
      setSessions(prev => prev.map(s => s.id !== sid ? s : {
        ...s,
        messages: [...s.messages, {
          id: Date.now() + 1, role: 'ai', agentKey,
          content: "Sorry, I couldn't connect. Please try again.",
          ts: now(),
        }]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const preview = (msgs) => {
    const last = [...msgs].reverse().find(m => m.role === 'user');
    return last?.content?.slice(0, 42) || 'New conversation';
  };

  return (
    <div className="ai-page">

      {/* ── LEFT: Session history ── */}
      <aside className="ai-history-panel">
        <div className="ai-history-header">
          <span className="ai-history-title">Recent Chats</span>
        </div>

        <div className="ai-history-list">
          {sessions.length === 0 ? (
            <div className="ai-history-empty">No conversations yet</div>
          ) : sessions.map(s => (
            <button
              key={s.id}
              className={`ai-history-item${s.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(s.id)}
            >
              <div className="ai-history-preview">{preview(s.messages)}</div>
              <div className="ai-history-ts">
                {new Date(s.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </button>
          ))}
        </div>

        <div className="ai-history-footer">
          <button className="ds-btn outline full" onClick={newChat}>
            <Plus size={14} /> New Chat
          </button>
        </div>
      </aside>

      {/* ── RIGHT: Chat window ── */}
      <div className="ai-chat-panel">

        {/* Chat header */}
        <div className="ai-chat-header">
          <span className="ai-chat-title">AI Help Desk</span>
          <div className="ai-chat-controls">
            <select
              className="ai-agent-select"
              value={agentKey}
              onChange={e => { setAgentKey(e.target.value); setAutoDetect(e.target.value === 'auto'); }}
            >
              {Object.entries(AGENTS).map(([k, a]) => (
                <option key={k} value={k}>{a.label}</option>
              ))}
            </select>
            {activeSession && (
              <button className="ds-btn ghost sm" onClick={clearChat} title="Clear chat">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {!activeSession ? (
            /* Empty state */
            <div className="ai-empty-state">
              <EmptyChatSVG />
              <h3 className="ai-empty-title">How can we help you today?</h3>
              <p className="ai-empty-sub">Ask anything about your courses, campus, or administration.</p>
              <div className="ai-chips">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="ai-chip" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => {
                const agInfo = AGENTS[msg.agentKey] || AGENTS.academic;
                return (
                  <div key={msg.id} className={`ai-msg-row ${msg.role}`}>
                    {msg.role === 'ai' && (
                      <div className="ai-msg-avatar">
                        <agInfo.Icon size={14} strokeWidth={1.75} color="#1A56DB" />
                      </div>
                    )}
                    <div className="ai-msg-col">
                      {msg.role === 'ai' && (
                        <div className="ai-agent-label">{agInfo.label}</div>
                      )}
                      <div className={`ai-bubble ${msg.role}`}
                        dangerouslySetInnerHTML={{
                          __html: msg.content
                            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                      <div className="ai-msg-ts">{msg.ts}</div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="ai-msg-row ai">
                  <div className="ai-msg-avatar">
                    <Cpu size={14} strokeWidth={1.75} color="#1A56DB" />
                  </div>
                  <div className="ai-msg-col">
                    <div className="ai-agent-label">{AGENTS[agentKey]?.label}</div>
                    <div className="ai-bubble ai"><TypingDots /></div>
                    <div className="ai-msg-ts">typing…</div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="ai-input-bar">
          <div className="ai-input-wrap">
            <textarea
              ref={inputRef}
              className="ai-textarea"
              rows={1}
              placeholder="Ask anything about academics, admin, campus…"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKey}
            />
            <button
              className="ai-send-btn"
              onClick={() => sendMessage()}
              disabled={!inputVal.trim() || isLoading}
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="ai-powered">Powered by Gemini AI</div>
        </div>
      </div>
    </div>
  );
};

export default AIHelpDesk;
