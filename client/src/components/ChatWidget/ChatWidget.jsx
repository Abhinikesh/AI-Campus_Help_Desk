import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiService } from '../../services/ai.service';
import { useAuth } from '../../context/AuthContext';
import { X, Send } from 'lucide-react';
import './ChatWidget.css';

const agentDetails = {
  academic: { name: 'Academic Agent', desc: 'Timetable, Results, Exams', icon: '📚' },
  admin: { name: 'Admin Agent', desc: 'Fees, ID Card, Documents', icon: '🏛' },
  navigation: { name: 'Navigation Agent', desc: 'Find rooms & locations', icon: '🗺' },
  complaint: { name: 'Complaint Agent', desc: 'Raise & track issues', icon: '📝' }
};

const ChatWidget = () => {
  const { user } = useAuth() || { user: { role: 'student' } };
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', content: "Hi! I'm Campus AI. How can I help?", agent: 'academic' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleOpenFullChat = () => {
    setIsOpen(false);
    navigate(`/${user.role}/ai-help`);
  };

  const sendMessage = async () => {
    const text = inputValue.trim();
    if (!text) return;

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Just keep last 5 for mini widget
      const history = messages.slice(-5);
      const res = await aiService.chat({
        message: text,
        history,
        agent: null // auto-detect
      });

      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        role: 'ai', 
        content: res?.reply || "Sorry, an error occurred.", 
        agent: res?.agent || 'academic' 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: "Connection error.", agent: 'academic' }]);
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

  const currentAgent = messages[messages.length - 1]?.agent || 'academic';

  return (
    <div className="cw-container">
      {/* FLOATING BUTTON */}
      {!isOpen && (
        <button className="cw-fab" onClick={toggleOpen}>
          <span className="cw-robot">🤖</span>
          <span className="cw-dot"></span>
        </button>
      )}

      {/* MINI CHAT POPUP */}
      <div className={`cw-popup ${isOpen ? 'open' : ''}`}>
        <div className="cw-header">
          <div className="cw-h-left">
            <span className="cw-title">Campus AI Assistant</span>
            <span className="cw-subtitle">{agentDetails[currentAgent].name} {agentDetails[currentAgent].icon}</span>
          </div>
          <button className="cw-close" onClick={toggleOpen}><X size={20}/></button>
        </div>

        <div className="cw-open-full">
          <button onClick={handleOpenFullChat}>Open Full Chat ↗</button>
        </div>

        <div className="cw-messages">
          {messages.slice(-6).map(msg => (
            <div key={msg.id} className={`cw-bubble-wrap ${msg.role}`}>
              <div className={`cw-bubble ${msg.role}`}>
                <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="cw-bubble-wrap ai">
              <div className="cw-bubble ai thinking">
                <span className="dot"></span><span className="dot"></span><span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="cw-input-area">
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            className="cw-send-btn" 
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? <span className="cw-spinner"></span> : <Send size={16}/>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;
