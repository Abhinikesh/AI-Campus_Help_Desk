import React from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { Award, Briefcase, Users, FileText, CheckCircle, Clock } from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import './Admission.css';

const AdmissionDashboard = () => {
  return (
    <div className="admission-layout">
      <Navbar />

      <main className="admission-content">
        {/* HERO BANNER */}
        <section className="adm-hero">
          <div className="adm-hero-left">
            <h1 className="adm-hero-title">Welcome to CampusSphere! 🎉</h1>
            <p className="adm-hero-subtitle">Begin your admission journey</p>
            <div className="adm-hero-actions">
              <button className="btn btn-primary">Ask Admission AI</button>
              <button className="btn btn-outline">Virtual Campus Tour</button>
            </div>
          </div>
          <div className="adm-hero-right">
            {/* 🖼️ REPLACE: put 'admission-hero.jpg' in client/public/assets/images/ */}
            <div className="image-fallback adm-fallback">
              <span className="fallback-emoji">🎓</span>
              <span className="fallback-text">Campus</span>
            </div>
            <img 
              src={`/assets/images/admission-hero.jpg`} 
              alt="Campus" 
              className="adm-hero-img"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.previousSibling.style.display = 'flex';
              }}
            />
          </div>
        </section>

        {/* PROGRAMS OFFERED */}
        <section className="adm-programs-sec">
          <h2 className="section-title">Programs Offered</h2>
          <div className="adm-programs-grid">
            {[
              { name: 'B.Tech Computer Science', dur: '4 Years', seats: '60 Seats', fee: '₹1,20,000/yr' },
              { name: 'B.Tech AI & ML', dur: '4 Years', seats: '60 Seats', fee: '₹1,30,000/yr' },
              { name: 'B.Tech Electronics', dur: '4 Years', seats: '60 Seats', fee: '₹1,10,000/yr' },
              { name: 'MBA', dur: '2 Years', seats: '40 Seats', fee: '₹90,000/yr' },
              { name: 'BBA', dur: '3 Years', seats: '60 Seats', fee: '₹70,000/yr' },
              { name: 'B.Sc Data Science', dur: '3 Years', seats: '40 Seats', fee: '₹80,000/yr' },
              { name: 'M.Tech', dur: '2 Years', seats: '20 Seats', fee: '₹1,40,000/yr' },
              { name: 'Ph.D Programs', dur: '3-5 Yrs', seats: '10 Seats', fee: '₹60,000/yr' }
            ].map((prog, i) => (
              <div className="adm-prog-card" key={i}>
                <div className="prog-top">
                  <h3 className="prog-name">{prog.name}</h3>
                  <span className="prog-dur">{prog.dur}</span>
                </div>
                <div className="prog-bot">
                  <span className="prog-seats"><Users size={14}/> {prog.seats}</span>
                  <span className="prog-fee">{prog.fee}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PROCESS STEPS */}
        <section className="adm-process-sec">
          <div className="adm-card">
            <h2 className="section-title">How to Apply</h2>
            <div className="adm-stepper">
              <div className="step done">
                <div className="step-circle"><CheckCircle size={20}/></div>
                <div className="step-content">
                  <div className="step-title">Register Online</div>
                  <div className="step-desc">Create your student account.</div>
                </div>
              </div>
              <div className="step-line active-line"></div>
              <div className="step active">
                <div className="step-circle">2</div>
                <div className="step-content">
                  <div className="step-title text-blue">Fill Application Form</div>
                  <div className="step-desc">Provide academic details.</div>
                </div>
              </div>
              <div className="step-line"></div>
              <div className="step future">
                <div className="step-circle">3</div>
                <div className="step-content">
                  <div className="step-title">Upload Documents</div>
                  <div className="step-desc">10th, 12th, and ID proof.</div>
                </div>
              </div>
              <div className="step-line"></div>
              <div className="step future">
                <div className="step-circle">4</div>
                <div className="step-content">
                  <div className="step-title">Pay Application Fee</div>
                  <div className="step-desc">₹1,000 online payment.</div>
                </div>
              </div>
              <div className="step-line"></div>
              <div className="step future">
                <div className="step-circle">5</div>
                <div className="step-content">
                  <div className="step-title">Await Confirmation</div>
                  <div className="step-desc">Track status here.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TWO COLUMNS */}
        <section className="adm-two-col">
          {/* Important Dates */}
          <div className="adm-card">
            <h2 className="section-title">Important Dates</h2>
            <div className="adm-timeline">
              <div className="adm-t-item">
                <div className="adm-t-date fw-bold text-green">Mar 15</div>
                <div className="adm-t-text">Application Opens</div>
              </div>
              <div className="adm-t-item">
                <div className="adm-t-date fw-bold text-gold">Apr 20</div>
                <div className="adm-t-text">Last Date for Applications</div>
              </div>
              <div className="adm-t-item">
                <div className="adm-t-date text-gray">May 5</div>
                <div className="adm-t-text text-gray">Merit List Published</div>
              </div>
              <div className="adm-t-item">
                <div className="adm-t-date text-gray">May 15</div>
                <div className="adm-t-text text-gray">Document Verification</div>
              </div>
              <div className="adm-t-item">
                <div className="adm-t-date text-gray">Jun 1</div>
                <div className="adm-t-text text-gray">Classes Begin</div>
              </div>
            </div>
          </div>

          {/* FAQs */}
          <div className="adm-card">
            <h2 className="section-title">Eligibility & FAQs</h2>
            <div className="adm-faq-list">
              <details className="adm-faq">
                <summary className="faq-q">What is the eligibility for B.Tech?</summary>
                <div className="faq-a">10+2 with Physics, Chemistry, Math. Minimum 60% marks.</div>
              </details>
              <details className="adm-faq">
                <summary className="faq-q">Is there an entrance exam?</summary>
                <div className="faq-a">Yes, we accept JEE Main scores or our own campus test.</div>
              </details>
              <details className="adm-faq">
                <summary className="faq-q">What documents are required?</summary>
                <div className="faq-a">10th & 12th marksheets, ID proof, passport photo, category certificate.</div>
              </details>
              <details className="adm-faq">
                <summary className="faq-q">When does the session start?</summary>
                <div className="faq-a">Academic session begins June 1, 2026.</div>
              </details>
            </div>
          </div>
        </section>

        {/* HIGHLIGHTS */}
        <section className="adm-highlights-grid">
          <div className="adm-high-card">
            <Award size={32} color="#3b82f6" />
            <div className="adm-high-title">25+ Years of Excellence</div>
          </div>
          <div className="adm-high-card">
            <CheckCircle size={32} color="#22c55e" />
            <div className="adm-high-title">NAAC A+ Accreditation</div>
          </div>
          <div className="adm-high-card">
            <Users size={32} color="#a78bfa" />
            <div className="adm-high-title">10,000+ Alumni Network</div>
          </div>
          <div className="adm-high-card">
            <Briefcase size={32} color="#f59e0b" />
            <div className="adm-high-title">180+ Placement Companies</div>
          </div>
        </section>

      </main>
      <ChatWidget />
    </div>
  );
};

export default AdmissionDashboard;
