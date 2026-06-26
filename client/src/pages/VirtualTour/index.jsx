import React, { useState } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { ArrowLeft, ArrowRight, BrainCircuit } from 'lucide-react';
import './VirtualTour.css';

const locations = [
  { id: 'gate', name: 'Main Gate', icon: '🏛', desc: 'Welcome to CampusSphere! The main gate is your entry point to our 25-acre campus. The Administration Block is to your left, Academic Block A is straight ahead.' },
  { id: 'library', name: 'Central Library', icon: '📚', desc: 'The Central Library houses over 50,000 books and journals. Open 8 AM to 10 PM. Digital resources available 24x7 with student login.' },
  { id: 'cs', name: 'Computer Science Dept', icon: '💻', desc: 'The Computer Science Department has 8 labs with 40 systems each, high-speed internet, and dedicated AI research lab.' },
  { id: 'admin', name: 'Administration Office', icon: '🏢', desc: 'Administrative services: Fee payment, ID cards, certificates, bonafide letters. Open Monday-Friday 9 AM to 5 PM.' },
  { id: 'hostel', name: 'Student Hostels', icon: '🏠', desc: 'Campus hostels accommodate 2000+ students. Separate blocks for boys and girls. Facilities: WiFi, laundry, mess, gym, indoor games.' },
  { id: 'auditorium', name: 'Main Auditorium', icon: '🎭', desc: 'Main Auditorium seats 1500. Used for convocations, cultural events, guest lectures, and competitions.' }
];

const VirtualTour = () => {
  const [activeLocIndex, setActiveLocIndex] = useState(-1); // -1 means none selected
  const [aiGuideOpen, setAiGuideOpen] = useState(false);

  const activeLoc = activeLocIndex >= 0 ? locations[activeLocIndex] : null;

  const goNext = () => {
    if (activeLocIndex < locations.length - 1) setActiveLocIndex(activeLocIndex + 1);
  };

  const goPrev = () => {
    if (activeLocIndex > 0) setActiveLocIndex(activeLocIndex - 1);
  };

  const getHotspots = (locId) => {
    switch(locId) {
      case 'gate': return [{label: '→ Admin Block', top: '50%', left: '20%'}, {label: '→ Academic Block', top: '50%', right: '20%'}];
      case 'library': return [{label: '→ Reading Hall', top: '40%', right: '30%'}, {label: '→ CS Dept', top: '60%', left: '30%'}];
      case 'cs': return [{label: '→ Lab 1', top: '30%', left: '20%'}, {label: '→ Lab 2', top: '50%', right: '20%'}, {label: '→ Library', bottom: '20%', left: '40%'}];
      case 'admin': return [{label: '→ Fee Counter', top: '40%', left: '40%'}, {label: '→ Main Gate', bottom: '20%', right: '30%'}];
      case 'hostel': return [{label: '→ Canteen', top: '50%', left: '30%'}, {label: '→ Sports Ground', top: '40%', right: '25%'}];
      case 'auditorium': return [{label: '→ Main Stage', top: '30%', left: '40%'}, {label: '→ Admin Block', bottom: '20%', right: '20%'}];
      default: return [];
    }
  };

  return (
    <div className="vt-layout">
      <Navbar />
      
      <div className="vt-container">
        {/* LEFT SIDEBAR */}
        <aside className="vt-sidebar">
          <div>
            <h2 className="vt-sidebar-title">🗺 Campus Locations</h2>
            <p className="vt-sidebar-subtitle">Click a location to explore</p>
          </div>
          
          <div className="vt-loc-list">
            {locations.map((loc, idx) => (
              <button 
                key={loc.id} 
                className={`vt-loc-btn ${activeLocIndex === idx ? 'active' : ''}`}
                onClick={() => { setActiveLocIndex(idx); setAiGuideOpen(true); }}
              >
                <span className="vt-loc-icon">{loc.icon}</span>
                <span className="vt-loc-name">{loc.name}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN VIEW AREA */}
        <main className="vt-main">
          {activeLocIndex === -1 ? (
            <div className="vt-placeholder">
              {/* 🖼️ REPLACE: put 'campus-map.jpg' in client/public/assets/images/ */}
              <div className="image-fallback vt-map-fallback">
                <span className="fallback-emoji">🏫</span>
                <span className="fallback-text">Campus Map</span>
              </div>
              <img 
                src={`/assets/images/campus-map.jpg`} 
                alt="Campus Map" 
                className="vt-map-img"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.previousSibling.style.display = 'flex';
                }}
              />
              <p className="vt-placeholder-text">Select a location from the left to explore</p>
            </div>
          ) : (
            <div className={`vt-scene-container theme-${activeLoc.id}`}>
              {/* Top Bar */}
              <div className="vt-scene-topbar">
                <div className="vt-scene-title-box">
                  <h3 className="vt-scene-title">{activeLoc.name}</h3>
                  <span className="vt-scene-subtitle">360° Virtual Tour</span>
                </div>
                <button 
                  className={`vt-ai-toggle ${aiGuideOpen ? 'open' : ''}`}
                  onClick={() => setAiGuideOpen(!aiGuideOpen)}
                >
                  <BrainCircuit size={18} /> {aiGuideOpen ? 'Close Guide' : 'AI Guide'}
                </button>
              </div>

              {/* CENTER SCENE */}
              <div className="vt-scene-view">
                {/* Scene Label inside the view */}
                <div className="vt-scene-label">{activeLoc.icon} {activeLoc.name}</div>
                
                {/* Animations and Particles based on location */}
                {activeLoc.id === 'gate' && <div className="scene-effect clouds"></div>}
                {activeLoc.id === 'library' && <div className="scene-effect books"></div>}
                {activeLoc.id === 'cs' && <div className="scene-effect code"></div>}

                {/* Hotspots */}
                {getHotspots(activeLoc.id).map((hs, i) => (
                  <button 
                    key={i} 
                    className="vt-hotspot"
                    style={{ top: hs.top, left: hs.left, right: hs.right, bottom: hs.bottom }}
                  >
                    {hs.label}
                  </button>
                ))}
              </div>

              {/* BOTTOM BAR */}
              <div className="vt-scene-bottombar">
                <button className="vt-nav-arrow" onClick={goPrev} disabled={activeLocIndex === 0}>
                  <ArrowLeft size={20} /> Previous
                </button>
                
                <div className="vt-dots">
                  {locations.map((_, i) => (
                    <span key={i} className={`vt-dot ${i === activeLocIndex ? 'active' : ''}`}></span>
                  ))}
                </div>

                <button className="vt-nav-arrow" onClick={goNext} disabled={activeLocIndex === locations.length - 1}>
                  Next <ArrowRight size={20} />
                </button>
              </div>

              {/* AI GUIDE PANEL */}
              <div className={`vt-ai-panel ${aiGuideOpen ? 'open' : ''}`}>
                <div className="vt-ai-header">
                  <BrainCircuit size={20} color="#3b82f6" />
                  <span className="fw-bold">Campus AI Guide</span>
                </div>
                <div className="vt-ai-body">
                  <p>{activeLoc.desc}</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default VirtualTour;
