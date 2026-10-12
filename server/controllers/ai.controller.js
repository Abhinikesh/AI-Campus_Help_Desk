/**
 * server/controllers/ai.controller.js
 * Campus AI Help Desk — powered by Groq SDK (llama-3.1-8b-instant).
 * Falls back to a polite demo response if GROQ_API_KEY is not set.
 */
'use strict';

const Groq = require('groq-sdk');
const asyncHandler = require('../utils/asyncHandler');
const { GROQ_API_KEY } = require('../config/env');

let groq = null;

if (GROQ_API_KEY) {
  try {
    groq = new Groq({ apiKey: GROQ_API_KEY });
    console.log('🤖 Groq AI service initialized.');
  } catch (err) {
    console.error('❌ Failed to initialize Groq SDK:', err.message);
  }
} else {
  console.warn('⚠️  GROQ_API_KEY not set — AI Help Desk running in demo mode.');
}

const detectAgent = (message) => {
  const msg = message.toLowerCase();
  const academic  = ['timetable', 'result', 'marks', 'attendance', 'exam', 'subject', 'course', 'syllabus', 'grade', 'cgpa', 'semester', 'lecture'];
  const admin     = ['fee', 'id card', 'certificate', 'document', 'hostel', 'bus', 'library', 'payment', 'receipt', 'card'];
  const nav       = ['where', 'location', 'room', 'building', 'department', 'lab', 'office', 'canteen', 'direction', 'find', 'map'];
  const complaint = ['complaint', 'issue', 'problem', 'broken', 'not working', 'report', 'raise', 'grievance'];

  if (complaint.some((k) => msg.includes(k))) return 'complaint';
  if (nav.some((k) => msg.includes(k)))       return 'navigation';
  if (admin.some((k) => msg.includes(k)))     return 'admin';
  if (academic.some((k) => msg.includes(k)))  return 'academic';
  return 'academic';
};

const getSystemPrompt = (agent, role, name) => {
  const base = `Current user role: ${role}. User name: ${name}.`;
  switch (agent) {
    case 'academic':
      return `You are the Academic Agent of CampusSphere ERP. Help students and faculty with timetables, results, attendance, exams, syllabus, CGPA, and courses. Be concise and use bullet points. ${base}`;
    case 'admin':
      return `You are the Admin Agent of CampusSphere ERP. Assist with fee payment, ID cards, certificates, documents, hostel, library, and general administration. Direct users to the right office when needed. ${base}`;
    case 'navigation':
      return `You are the Navigation Agent of CampusSphere ERP. Help users find locations on campus. Campus layout: Main Gate → Admin Block (left) → Academic Block A (straight) → Academic Block B (right) → Library (far right) → Labs (behind Academic A) → Canteen (center) → Hostels (back campus). ${base}`;
    case 'complaint':
      return `You are the Complaint Agent of CampusSphere ERP. Help users raise and track complaints. Categories: Academic, Administrative, Hostel, Infrastructure, Other. Be empathetic. ${base}`;
    default:
      return `You are CampusSphere ERP AI assistant. Help the user with campus-related queries. ${base}`;
  }
};

const DEMO_REPLIES = {
  academic:  '[Demo Mode] Timetables, exams, and results are on your dashboard. Configure GROQ_API_KEY in server/.env for live AI responses.',
  admin:     '[Demo Mode] Admin offices are in the Admin Block. Pay fees online through the Finance section. Configure GROQ_API_KEY for live support.',
  navigation:'[Demo Mode] Main Gate → Admin Block (left) → Academic Blocks → Canteen (center) → Hostels (back). Configure GROQ_API_KEY for step-by-step guidance.',
  complaint: '[Demo Mode] Raise and track complaints via the Complaints portal. Configure GROQ_API_KEY for live support.',
};

const chat = asyncHandler(async (req, res) => {
  const { message, history = [], agent } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'message is required' });
  }

  const user = req.user || { role: 'student', name: 'User' };
  const detectedAgent = agent || detectAgent(message);

  if (!groq) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return res.json({
      success: true,
      data: { reply: DEMO_REPLIES[detectedAgent] || DEMO_REPLIES.academic, agent: detectedAgent },
    });
  }

  const systemPrompt = getSystemPrompt(detectedAgent, user.role, user.name);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: message },
  ];

  const result = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages,
    max_tokens: 1000,
  });

  const reply = result.choices[0].message.content;
  return res.json({ success: true, data: { reply, agent: detectedAgent } });
});

module.exports = { chat };
