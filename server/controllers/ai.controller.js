/**
 * server/controllers/ai.controller.js
 * CampusSphere AI Assistant — Secured Controller.
 * Powered by Groq SDK when configured.
 * Strictly requires verified authenticated user identity; removes static DEMO_REPLIES.
 * Returns HTTP 503 service unavailable when no provider is active or reachable.
 */
'use strict';

const Groq = require('groq-sdk');
const asyncHandler = require('../utils/asyncHandler');
const { GROQ_API_KEY } = require('../config/env');

let groq = null;

if (GROQ_API_KEY && GROQ_API_KEY.trim() !== '') {
  try {
    groq = new Groq({ apiKey: GROQ_API_KEY });
    console.log('🤖 Groq AI service initialized.');
  } catch (err) {
    console.error('❌ Failed to initialize Groq SDK:', err.message);
  }
}

/**
 * Test helper to inject or mock the AI client during automated testing.
 * @param {object|null} client - Mock Groq client or null to simulate unconfigured provider
 */
const setGroqClient = (client) => {
  groq = client;
};

const ALLOWED_AGENTS = ['academic', 'admin', 'navigation', 'complaint'];
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 20;

const detectAgent = (message = '') => {
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
  const base = `Authenticated user role: ${role}. Display name: ${name}.`;
  switch (agent) {
    case 'academic':
      return `You are the Academic Agent of CampusSphere ERP. Help authorized students and faculty with academic structure, course guidelines, and study resources. Only provide verified information. If information is not available, state clearly that it is not found. ${base}`;
    case 'admin':
      return `You are the Admin Agent of CampusSphere ERP. Assist with fee procedures, ID card requisitions, certificates, and general administrative guidance. Direct users to the relevant administrative office. ${base}`;
    case 'navigation':
      return `You are the Navigation Agent of CampusSphere ERP. Help users locate campus facilities. Campus layout: Main Gate → Admin Block (left) → Academic Block A (straight) → Academic Block B (right) → Library (far right) → Labs (behind Academic A) → Canteen (center) → Hostels (back campus). ${base}`;
    case 'complaint':
      return `You are the Complaint Agent of CampusSphere ERP. Guide users on raising grievances through the Complaints portal across Academic, Administrative, Hostel, and Infrastructure categories. ${base}`;
    default:
      return `You are CampusSphere AI Assistant. Assist authorized campus users with guidance. Do not speculate or invent academic, financial, or personal records. ${base}`;
  }
};

const chat = asyncHandler(async (req, res) => {
  // 1. Strict Authentication Check (enforced by authMiddleware, fail-closed safeguard)
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  // Identity is strictly bound to the authenticated JWT claims — never client input
  const user = {
    id: req.user.id || req.user.userId,
    role: req.user.role,
    name: req.user.name || 'Campus User',
  };

  // 2. Validate Request Payload
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Invalid request payload: JSON body is required.',
    });
  }

  const { message, history = [], agent } = req.body;

  // Validate message
  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation error: message is required and must be a non-empty string.',
    });
  }

  const sanitizedMessage = message.trim();
  if (sanitizedMessage.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Validation error: message exceeds maximum allowed length of ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  // Validate history
  if (!Array.isArray(history)) {
    return res.status(400).json({
      success: false,
      message: 'Validation error: history must be an array of messages.',
    });
  }

  if (history.length > MAX_HISTORY_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Validation error: history must contain at most ${MAX_HISTORY_LENGTH} messages.`,
    });
  }

  const sanitizedHistory = [];
  for (const item of history) {
    if (item && typeof item === 'object') {
      const role = item.role === 'user' ? 'user' : (item.role === 'assistant' || item.role === 'ai' ? 'assistant' : null);
      if (role && typeof item.content === 'string' && item.content.trim().length > 0) {
        sanitizedHistory.push({
          role,
          content: item.content.slice(0, MAX_MESSAGE_LENGTH),
        });
      }
    }
  }

  // Validate or auto-detect agent
  const detectedAgent = (agent && ALLOWED_AGENTS.includes(agent)) ? agent : detectAgent(sanitizedMessage);

  // 3. Provider Availability Check (No fake demo replies)
  if (!groq) {
    return res.status(503).json({
      success: false,
      message: 'AI Assistant service is currently unavailable. No active AI provider is configured.',
    });
  }

  // 4. Execute AI Completion
  try {
    const systemPrompt = getSystemPrompt(detectedAgent, user.role, user.name);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory,
      { role: 'user', content: sanitizedMessage },
    ];

    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      max_tokens: 1000,
    });

    const reply = result.choices?.[0]?.message?.content || 'No response generated.';

    return res.json({
      success: true,
      reply,
      agent: detectedAgent,
      data: { reply, agent: detectedAgent },
      message: 'AI response generated successfully',
    });
  } catch (err) {
    console.error('❌ AI Provider execution error:', err.message);
    return res.status(503).json({
      success: false,
      message: 'AI Assistant service is temporarily unavailable. Please try again later.',
    });
  }
});

module.exports = {
  chat,
  setGroqClient,
  detectAgent,
  getSystemPrompt,
  ALLOWED_AGENTS,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_LENGTH,
};
