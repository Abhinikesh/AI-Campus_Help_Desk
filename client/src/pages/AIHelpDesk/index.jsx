import React, { useState, useEffect, useRef } from 'react';
import { aiService } from '../../services/ai.service';
import Navbar from '../../components/Navbar/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Send, Trash2, Globe } from 'lucide-react';
import './AIHelpDesk.css';

const agentDetails = {
  academic: { name: 'Academic Agent', desc: 'Timetable, Results, Exams', icon: '📚' },
  admin: { name: 'Admin Agent', desc: 'Fees, ID Card, Documents', icon: '🏛' },
  navigation: { name: 'Navigation Agent', desc: 'Find rooms & locations', icon: '🗺' },
  complaint: { name: 'Complaint Agent', desc: 'Raise & track issues', icon: '📝' }
};

const AIHelpDesk = () => {
  const { user } = useAuth() || { user: { role: 'student', name: 'User' } };
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', content: "👋 Hello! I'm your Campus AI Assistant. I can help you with academics, administration, navigation, and complaints. How can I help you today?", agent: 'academic', timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [currentAgent, setCurrentAgent] = useState('academic');
  const [isLoading, setIsLoading] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true);
  const [language, setLanguage] = useState('EN');
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const switchAgent = (agent) => {
    setCurrentAgent(agent);
    setAutoDetect(false);
  };

  const clearChat = () => {
    setMessages([
      { id: Date.now(), role: 'ai', content: language === 'HI' ? "👋 नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?" : "👋 Hello! How can I help you today?", agent: currentAgent, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
    ]);
  };

  const handleQuickAsk = (question) => {
    setInputValue(question);
    sendMessage(question);
  };

  const sendMessage = async (textOverride) => {
    const text = textOverride || inputValue.trim();
    if (!text) return;

    const newMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Keep only last 10 messages for context
      const history = messages.slice(-10);
      
      const payload = {
        message: text,
        history,
        agent: autoDetect ? null : currentAgent
      };

      const res = await aiService.chat(payload);

      if (res?.agent && autoDetect) {
        setCurrentAgent(res.agent);
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        content: res?.reply || "Sorry, I couldn't connect. Please try again.",
        agent: res?.agent || currentAgent,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        content: "Sorry, I couldn't connect. Please try again.",
        agent: currentAgent,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const placeholderText = language === 'HI' ? "अपना संदेश यहाँ टाइप करें..." : "Type your message here...";

  // Format markdown-like text (bold)
  const formatText = (text) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}
        <br />
      </span>
    ));
  };

  return (
    <div className="ai-layout">
      <Navbar />
      <div className="ai-container">
        
        {/* LEFT SIDEBAR */}
        <aside className="ai-sidebar">
          <div className="ai-sidebar-top">
            <h3 className="ai-sidebar-heading">Select Agent</h3>
            <div className="ai-agent-list">
              {Object.entries(agentDetails).map(([key, details]) => (
                <button 
                  key={key}
                  className={`agent-btn ${currentAgent === key ? 'active' : ''}`}
                  onClick={() => switchAgent(key)}
                >
                  <span className="agent-icon">{details.icon}</span>
                  <div className="agent-info">
                    <span className="agent-name">{details.name}</span>
                    <span className="agent-desc">{details.desc}</span>
                  </div>
                  {currentAgent === key && <span className="agent-active-dot"></span>}
                </button>
              ))}
            </div>

            <div className="ai-lang-toggle">
              <button 
                className={`lang-btn ${language === 'EN' ? 'active' : ''}`}
                onClick={() => setLanguage('EN')}
              >EN</button>
              <button 
                className={`lang-btn ${language === 'HI' ? 'active' : ''}`}
                onClick={() => setLanguage('HI')}
              >HI</button>
            </div>

            <div className="ai-auto-detect">
              <span className="ai-sidebar-heading" style={{margin: 0}}>Auto-detect Agent</span>
              <label className="switch">
                <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          <div className="ai-sidebar-bottom">
            <h3 className="ai-sidebar-heading">Quick Ask</h3>
            <div className="ai-quick-links">
              {['What is my attendance?', 'When is my next exam?', 'How to pay fees?', 'Where is the library?', 'Raise a complaint', 'What is my CGPA?'].map((q, i) => (
                <button key={i} className="quick-pill" onClick={() => handleQuickAsk(q)}>{q}</button>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT CHAT AREA */}
        <main className="ai-chat-area">
          <div className="chat-top-bar">
            <div className="chat-tb-left">
              <span className="tb-icon">{agentDetails[currentAgent].icon}</span>
              <span className="tb-name">{agentDetails[currentAgent].name}</span>
              <span className="tb-online"></span>
            </div>
            <div className="chat-tb-center">
              <span className="tb-lang-badge"><Globe size={14}/> {language}</span>
            </div>
            <div className="chat-tb-right">
              <button className="tb-clear-btn" onClick={clearChat} title="Clear Chat">
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble-wrapper ${msg.role}`}>
                {msg.role === 'ai' && (
                  <div className="chat-avatar">{agentDetails[msg.agent || currentAgent].icon}</div>
                )}
                <div className="chat-content-wrap">
                  {msg.role === 'ai' && <div className="chat-agent-name">{agentDetails[msg.agent || currentAgent].name}</div>}
                  <div className={`chat-bubble ${msg.role === 'ai' ? 'ai-bg' : 'user-bg'} ${msg.content.includes("Sorry, I couldn't connect") ? 'error-bg' : ''}`}>
                    <div className="chat-text" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
                  </div>
                  <div className="chat-timestamp">{msg.timestamp}</div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="chat-bubble-wrapper ai">
                <div className="chat-avatar">{agentDetails[currentAgent].icon}</div>
                <div className="chat-content-wrap">
                  <div className="chat-bubble ai-bg thinking-bubble">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                  <div className="chat-timestamp">{agentDetails[currentAgent].name} is thinking...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-bar">
            <textarea
              className="chat-textarea"
              placeholder={placeholderText}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button 
              className={`chat-send-btn ${!inputValue.trim() || isLoading ? 'disabled' : ''}`} 
              onClick={() => sendMessage()}
              disabled={!inputValue.trim() || isLoading}
            >
              {isLoading ? <div className="spinner-small"></div> : <Send size={20} />}
            </button>
          </div>
        </main>

      </div>
    </div>
  );
}

export default AIHelpDesk;
