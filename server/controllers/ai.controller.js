const Groq = require('groq-sdk');

let groq = null;
const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;

if (apiKey) {
  try {
    groq = new Groq({ apiKey });
    console.log("🤖 Groq AI service initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize Groq SDK:", err.message || err);
  }
} else {
  console.warn("⚠️ Warning: Neither GROQ_API_KEY nor GEMINI_API_KEY is defined in environment variables. AI Help Desk will run in demo fallback mode.");
}

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

    // If Groq is not initialized, return a simulated response from the appropriate agent
    if (!groq) {
      const mockReplies = {
        academic: `[Demo Mode] As the Academic Agent: Timetables, exams, and attendance are fully loaded on your dashboard. Mid-Semester Exams begin on April 12, 2026. If you want real AI interactions, please specify a GROQ_API_KEY or GEMINI_API_KEY in the server/.env file.`,
        admin: `[Demo Mode] As the Admin Agent: Admin offices are located in the Admin Block. You can pay fees directly online through the Finance section, or submit a request for physical document certificates at the main counter. Add your API key to server/.env for live AI help.`,
        navigation: `[Demo Mode] As the Navigation Agent: The campus main blocks are Main Gate -> Admin Block (left) -> Academic Block A (straight ahead) -> Academic Block B (right) -> Canteen (center). Set your API key in server/.env to get step-by-step navigation instructions.`,
        complaint: `[Demo Mode] As the Complaint Agent: You can raise, track and manage complaints through the Complaints portal. Once raised, issues are assigned to respective departments with standard 3-day turnaround. Add your API key to server/.env for live support.`
      };
      
      const reply = mockReplies[detectedAgent] || `[Demo Mode] Hello! I can assist with Academics, Administration, Navigation, and Complaints. Please configure GROQ_API_KEY or GEMINI_API_KEY in server/.env to enable live AI assistance.`;

      // Small delay to simulate response time
      await new Promise(resolve => setTimeout(resolve, 600));
      return res.json({ reply, agent: detectedAgent });
    }

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
