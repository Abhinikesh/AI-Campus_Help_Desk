const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GEMINI_API_KEY });

function detectAgent(message) {
  const msg = message.toLowerCase();
  const academic = ['timetable','result','marks','attendance','exam','subject','course','syllabus','grade','cgpa','semester','lecture'];
  const admin = ['fee','id card','certificate','document','hostel','bus','library','payment','receipt','admission','card'];
  const navigation = ['where','location','room','building','department','lab','office','canteen','direction','find','map','how to reach'];
  const complaint = ['complaint','issue','problem','broken','not working','report','raise','grievance','request','fix'];

  if (complaint.some(k => msg.includes(k))) return 'complaint';
  if (navigation.some(k => msg.includes(k))) return 'navigation';
  if (admin.some(k => msg.includes(k))) return 'admin';
  if (academic.some(k => msg.includes(k))) return 'academic';
  return 'academic';
}

const getSystemPrompt = (agent, role, name) => {
  const base = `Current user role: ${role}. User name: ${name}.`;
  switch(agent) {
    case 'academic':
      return `You are the Academic Agent of CampusSphere AI, a smart campus helpdesk. You help students and faculty with academic queries including timetables, results, attendance, exams, syllabus, CGPA, and course information. Always respond in a friendly, helpful, structured way. Use bullet points for lists. Keep responses concise and relevant to campus academics. ${base}`;
    case 'admin':
      return `You are the Admin Agent of CampusSphere AI. You assist with administrative queries including fee payment, ID cards, certificates, documents, hostel, library, bus pass, and general administration. Always respond helpfully and direct users to the right office when needed. ${base}`;
    case 'navigation':
      return `You are the Navigation Agent of CampusSphere AI. You help users find locations on campus including rooms, labs, departments, offices, canteen, library, hostels, and other facilities. Provide clear step-by-step directions. Campus layout: Main Gate -> Admin Block (left) -> Academic Block A (straight) -> Academic Block B (right) -> Library (far right) -> Labs (behind Academic A) -> Canteen (center) -> Hostels (back campus). ${base}`;
    case 'complaint':
      return `You are the Complaint Agent of CampusSphere AI. You help users raise, track and resolve complaints. Guide users through the complaint process, collect complaint details, and provide expected resolution timelines. Categories: Academic, Administrative, Hostel, Infrastructure, Other. Always be empathetic and professional. ${base}`;
    default:
      return `You are CampusSphere AI. Help the user. ${base}`;
  }
};

exports.chat = async (req, res) => {
  try {
    const { message, history = [], agent } = req.body;
    const user = req.user || { role: 'student', name: 'User' };

    const detectedAgent = agent || detectAgent(message);
    const systemPrompt = getSystemPrompt(detectedAgent, user.role, user.name);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
      { role: 'user', content: message }
    ];

    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: messages,
      max_tokens: 1000
    });

    const responseText = result.choices[0].message.content;
    res.json({ reply: responseText, agent: detectedAgent });

  } catch (error) {
    console.error("AI Chat Error:", error.message || error);
    res.status(500).json({ error: "Failed to process chat message." });
  }
};
