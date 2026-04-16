const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const Groq = require('groq-sdk');
const nodemailer = require('nodemailer');
const db = require('./db');
const PDFDocument = require('pdfkit');



const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Groq client using the API key from environment variables
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Database helper functions removed – using SQL directly in routes

function getZoneStats() {
   const stats = {
      'Zone A': { pct: 88, issues: 0 },
      'Zone B': { pct: 61, issues: 0 },
      'Zone C': { pct: 44, issues: 0 },
      'Zone D': { pct: 72, issues: 0 },
      'Zone E': { pct: 95, issues: 0 }
   };
   
   const issues = db.prepare("SELECT zone FROM issues WHERE status = 'open'").all();
   issues.forEach(i => {
      if (stats[i.zone]) {
          stats[i.zone].issues++;
      }
   });
   
   for (let z in stats) {
      if (stats[z].issues === 0) stats[z].color = '#00A388';       // teal
      else if (stats[z].issues === 1) stats[z].color = '#DE8B26';  // amber
      else stats[z].color = '#E65A5A';                              // red
   }
   return stats;
}

function getMetrics() {
  const issues = db.prepare("SELECT sevClass, tags FROM issues WHERE status = 'open'").all();
  const openCount = issues.length;
  
  const highCount = issues.filter(i => i.sevClass === 'high').length;
  const medCount  = issues.filter(i => i.sevClass === 'med').length;
  
  // Report lag: baseline 3.4h, goes up by 0.3h per open HIGH issue, 0.1h per open MED
  const reportLag  = Math.max(0.5, 3.4 + highCount * 0.3 + medCount * 0.1).toFixed(1);
  const lagTrend   = openCount <= 4 ? '▼ was 72h baseline' : `▲ High issues: ${highCount}`;
  const lagGood    = openCount <= 4;

  // Rework rate: baseline 6.1%, goes up 0.5% per unresolved high, 0.2% per med
  const reworkRate = Math.max(1.0, 6.1 + highCount * 0.5 + medCount * 0.2).toFixed(1);
  const reworkTrend = openCount <= 4 ? '▼ 25% reduction' : `▲ ${highCount} high-risk open`;
  const reworkGood  = openCount <= 4;

  const criticalCount = highCount;

  return { reportLag, lagTrend, lagGood, reworkRate, reworkTrend, reworkGood, criticalCount, openCount };
}

function getCategoryDistribution() {
  const allIssues = db.prepare("SELECT tags FROM issues").all();
  const counts = { Safety: 0, Structural: 0, MEP: 0, Civil: 0, Utilities: 0, Schedule: 0, Progress: 0, Uncategorized: 0 };
  allIssues.forEach(i => {
    if (i.tags && i.tags.trim() !== '') {
      const tags = i.tags.split(',').map(t => t.trim()).filter(t => t !== '');
      tags.forEach(t => {
        if (counts[t] !== undefined) counts[t]++;
        else counts['Uncategorized']++;
      });
    } else {
      counts['Uncategorized']++;
    }
  });
  // Filter out zero counts for a cleaner chart, but keep Uncategorized if it's the only one
  const result = Object.keys(counts)
    .filter(k => counts[k] > 0)
    .map(k => ({ name: k, value: counts[k] }));
    
  return result.length > 0 ? result : [{ name: 'No Data', value: 1 }];
}

// Temporary trends simulation (could also be moved to DB later)
const trends = [
  { day: 'M', logged: 5, resolved: 3 },
  { day: 'T', logged: 8, resolved: 6 },
  { day: 'W', logged: 12, resolved: 9 },
  { day: 'T', logged: 7, resolved: 10 },
  { day: 'F', logged: 15, resolved: 4 },
  { day: 'S', logged: 4, resolved: 8 },
  { day: 'S', logged: 2, resolved: 5 }
];

const teams = [
  { name: 'Priya M.', avatar: 'PM', efficiency: 94, resolved: 28 },
  { name: 'Ravi K.', avatar: 'RK', efficiency: 82, resolved: 19 },
  { name: 'Anjali R.', avatar: 'AR', efficiency: 88, resolved: 24 },
  { name: 'Vikram J.', avatar: 'VJ', efficiency: 76, resolved: 15 },
  { name: 'Sameer S.', avatar: 'SS', efficiency: 91, resolved: 31 }
];

// --- API ENDPOINTS ---

app.get('/api/dashboard', (req, res) => {
  const metrics = getMetrics();
  const issues = db.prepare("SELECT * FROM issues WHERE status = 'open' ORDER BY id DESC").all();
  const totalCaptured = db.prepare("SELECT value FROM system_stats WHERE key = 'total_captured'").get().value;
  const totalResolved = db.prepare("SELECT value FROM system_stats WHERE key = 'total_resolved'").get().value;
  
  res.json({
    kpis: {
      openCount: metrics.openCount,
      captured: totalCaptured,
      resolved: totalResolved,
      reportLag: metrics.reportLag,
      lagTrend: metrics.lagTrend,
      lagGood: metrics.lagGood,
      reworkRate: metrics.reworkRate,
      reworkTrend: metrics.reworkTrend,
      reworkGood: metrics.reworkGood,
      criticalCount: metrics.criticalCount
    },
    trends: trends,
    zoneStats: getZoneStats(),
    issues: issues
  });
});

app.post('/api/issues', (req, res) => {
  const { desc, severity, zone, tags, assignee } = req.body;
  if (!desc) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const sevClass = severity.startsWith('HIGH') ? 'high' : severity.startsWith('MED') ? 'med' : 'ok';
  const sevLabel = severity.startsWith('HIGH') ? 'HIGH' : severity.startsWith('MED') ? 'MED' : 'LOW';

  const newIssue = {
    id: Date.now(),
    desc,
    severity,
    sevClass,
    sevLabel,
    zone,
    author: 'You',
    timestamp: 'Now',
    tags: tags || '',
    assignee: assignee || 'Unassigned',
    image: req.body.image || null
  };

  db.prepare(`
    INSERT INTO issues (id, desc, severity, sevClass, sevLabel, zone, author, timestamp, tags, assignee, image)
    VALUES (@id, @desc, @severity, @sevClass, @sevLabel, @zone, @author, @timestamp, @tags, @assignee, @image)
  `).run(newIssue);

  db.prepare("UPDATE system_stats SET value = value + 1 WHERE key = 'total_captured'").run();
  
  // Also push to feed (keeping in-memory feed for simplicity if desired, or adding to DB)
  db.prepare('INSERT INTO feed (text, type, time) VALUES (?, ?, ?)').run(`${zone} — ${desc}`, 'red', 'Now');

  const m = getMetrics();
  const totalCaptured = db.prepare("SELECT value FROM system_stats WHERE key = 'total_captured'").get().value;
  const totalResolved = db.prepare("SELECT value FROM system_stats WHERE key = 'total_resolved'").get().value;

  // Trigger Automated WhatsApp Alert for High-Risk Issues
  let alertSent = false;
  if (sevClass === 'high') {
    alertSent = triggerWhatsAppAlert(newIssue);
  }

  res.status(201).json({ 
    newIssue, 
    kpis: { openCount: m.openCount, captured: totalCaptured, resolved: totalResolved, ...m }, 
    trends, 
    zoneStats: getZoneStats(),
    alertSent: alertSent
  });
});

// Simulated WhatsApp Alert Logic
function triggerWhatsAppAlert(issue) {
  const adminPhone = process.env.ADMIN_PHONE || '+1234567890'; // Placeholder
  const timestamp = new Date().toLocaleString();
  
  const payload = {
    to: adminPhone,
    message: `🚨 HIGH RISK ALERT: ${issue.zone}\n\nIssue detected: ${issue.desc.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 100)}\nTime: ${timestamp}\nSeverity: CRITICAL\n\nPlease review immediately in the AI Dashboard.`,
    channel: 'WHATSAPP_BUSINESS'
  };

  console.log('\n--- SIMULATED WHATSAPP ALERT SENT ---');
  console.log('To:', payload.to);
  console.log('Message:', payload.message);
  console.log('-------------------------------------\n');

  // In production, you would use:
  // await twilio.messages.create({ body: payload.message, from: 'whatsapp:+...', to: `whatsapp:${adminPhone}` });
  
  return true;
}

app.post('/api/issues/:id/resolve', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const resolved_at = new Date().toLocaleString();
  const result = db.prepare("UPDATE issues SET status = 'resolved', resolved_at = ? WHERE id = ?").run(resolved_at, id);
  
  if (result.changes > 0) {
    db.prepare("UPDATE system_stats SET value = value + 1 WHERE key = 'total_resolved'").run();
    const m = getMetrics();
    const totalCaptured = db.prepare("SELECT value FROM system_stats WHERE key = 'total_captured'").get().value;
    const totalResolved = db.prepare("SELECT value FROM system_stats WHERE key = 'total_resolved'").get().value;
    
    res.json({ success: true, openCount: m.openCount, captured: totalCaptured, resolved: totalResolved, trends, zoneStats: getZoneStats(), ...m });
  } else {
    res.status(404).json({ error: 'Issue not found' });
  }
});

app.delete('/api/issues/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = db.prepare('DELETE FROM issues WHERE id = ?').run(id);
  
  if (result.changes > 0) {
    db.prepare("UPDATE system_stats SET value = MAX(0, value - 1) WHERE key = 'total_captured'").run();
    const m = getMetrics();
    const totalCaptured = db.prepare("SELECT value FROM system_stats WHERE key = 'total_captured'").get().value;
    const totalResolved = db.prepare("SELECT value FROM system_stats WHERE key = 'total_resolved'").get().value;
    
    res.json({ success: true, openCount: m.openCount, captured: totalCaptured, resolved: totalResolved, trends, zoneStats: getZoneStats(), ...m });
  } else {
    res.status(404).json({ error: 'Issue not found' });
  }
});

app.put('/api/issues/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { desc } = req.body;
  const result = db.prepare('UPDATE issues SET desc = ? WHERE id = ?').run(desc, id);
  
  if (result.changes > 0) {
    const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
    res.json({ success: true, issue });
  } else {
    res.status(404).json({ error: 'Issue not found' });
  }
});

app.get('/api/bim', (req, res) => {
  // BIM Data could be moved to DB, but keeping static for now as requested
  const bimData = {
    A: { title: 'Zone A — Structural', id: 'STR-A-001', status: '<span class="c-green">On track</span>', comp: '88%', last: 'Today 07:10', issues: '0', assign: 'Priya M.' },
    B: { title: 'Zone B — East Bridge', id: 'MEP-B-CT-14', status: '<span class="c-red">Issue logged</span>', comp: '61%', last: 'Today 08:22', issues: '1 open', assign: 'Ravi K.' },
    C: { title: 'Zone C — West Bridge', id: 'CIV-C-003', status: '<span class="c-red">Behind schedule</span>', comp: '44%', last: 'Today 09:05', issues: '2 open', assign: 'Priya M.' },
    D: { title: 'Zone D — Structural', id: 'STR-D-002', status: '<span class="c-teal">On track</span>', comp: '72%', last: 'Today 07:54', issues: '0', assign: 'Auto-detected' },
    E: { title: 'Zone E — Utilities', id: 'UTIL-E-001', status: '<span class="c-amber">Pending inspection</span>', comp: '—', last: 'Yesterday', issues: '0', assign: 'Unassigned' },
    F: { title: 'Zone F — Structural Core', id: 'STR-F-001', status: '<span class="c-green">On track</span>', comp: '95%', last: 'Today 06:45', issues: '0', assign: 'Ravi K.' }
  };
  res.json(bimData);
});

app.get('/api/feed', (req, res) => {
  const feedItems = db.prepare('SELECT text, type, time FROM feed ORDER BY id DESC LIMIT 20').all();
  res.json(feedItems);
});

app.get('/api/analytics', (req, res) => {
  const m = getMetrics();
  
  // Predictive Trend Simulation (8 points: 7 historical + 1 forecast)
  const riskTrend = [
    { day: 'Mon', risk: 15 },
    { day: 'Tue', risk: 22 },
    { day: 'Wed', risk: 18 },
    { day: 'Thu', risk: 35 },
    { day: 'Fri', risk: 42 },
    { day: 'Sat', risk: 28 },
    { day: 'Sun', risk: 24, isForecast: false },
    { day: 'Tomorrow', risk: 45, isForecast: true, riskHigh: 55, riskLow: 35 }
  ];

  // Logic: Focus on zones with highest open issues or specific trends
  const riskDrivers = [
    { label: 'Zone E Mechanical Delay', impact: 'High', zone: 'Zone E' },
    { label: 'Zone C Rework Velocity', impact: 'Medium', zone: 'Zone C' },
    { label: 'Reporting Lag Spike', impact: 'Low', zone: 'All' }
  ];

  res.json({
    impactScore: 85,
    riskTrend,
    riskDrivers,
    categoryData: getCategoryDistribution(),
    teamPerformance: (typeof teams !== 'undefined') ? teams : []
  });
});

// --- AI REPORT ENDPOINT (Multimodal Vision) ---
app.post('/api/ai-report', async (req, res) => {
  try {
    const { description, image } = req.body;
    
    // Validate input
    if (!description && !image) {
      return res.status(400).json({ error: 'Either description or image is required.' });
    }

    let messages = [
      {
        role: "system",
        content: `You are a seasoned Senior Site Architect and Operations Lead. 
        Analyze the provided data (photo and/or description) with professional, descriptive insight. 
        Respond with a JSON object:
        1. "risk": Assess as "Low", "Medium", or "High".
        2. "summary": A professional, human-like observation of the issue (e.g., "Visual inspection confirms alignment drift in the primary cable trays..."). 
        3. "recommendation": A tactical, corrective action (e.g., "Re-calibrate the support brackets to spec before the next inspection cycle.").
        4. "tags": 1-3 categories from: [Safety, Structural, MEP, Civil, Utilities, Schedule, Progress].`
      }
    ];

    let userContent = [];
    if (description) userContent.push({ type: "text", text: `User Description: ${description}` });
    if (image) {
      userContent.push({ 
        type: "image_url", 
        image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } 
      });
    }

    if (image) {
      messages.push({ role: "user", content: userContent });
    } else {
      messages.push({ role: "user", content: `User Description: ${description}` });
    }

    const completion = await groq.chat.completions.create({
      model: image ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile",
      messages: messages,
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);
    res.status(200).json(aiResponse);

  } catch (error) {
    console.error('Error in AI Analysis:', error.message);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// --- DYNAMIC AI SITE SUMMARY ---
app.get('/api/reports/summary', async (req, res) => {
  try {
    const issues = db.prepare('SELECT zone, sevLabel, desc, status FROM issues ORDER BY id DESC LIMIT 50').all();
    const metrics = getMetrics();
    
    const context = `
    Current Site Status:
    - Open Issues: ${metrics.openCount}
    - Critical (High) Risks: ${metrics.criticalCount}
    - Rework Rate: ${metrics.reworkRate}%
    - Report Lag: ${metrics.reportLag}h
    
    Recent Issues Data:
    ${issues.map(i => `- [${i.sevLabel}] ${i.zone}: ${i.desc.substring(0, 100)} (${i.status})`).join('\n')}
    `;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a Veteran Project Director giving a morning site briefing. Summarize the overall site status in 2-3 professional, conversational sentences. Use phrases like 'Overall site health is strong,' or 'We're monitoring some drift in...' instead of just dry stats. Do not use bullet points or markdown bolding in the response string."
        },
        {
          role: "user",
          content: context
        }
      ],
      temperature: 0.5,
      max_tokens: 150
    });

    const summary = completion.choices[0].message.content.trim();
    res.json({ summary });
  } catch (error) {
    console.error('Summary Generation Error:', error);
    res.status(500).json({ summary: "Site data analysis currently unavailable. Zone C remains the primary area of observation due to recent alignment logs." });
  }
});


// --- WHISPER TRANSCRIPTION ENDPOINT ---
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    const originalPath = req.file.path;
    const webmPath = originalPath + '.webm';
    fs.renameSync(originalPath, webmPath);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(webmPath),
      model: "whisper-large-v3",
      response_format: "json",
      language: "en",
      prompt: "Construction site inspection report. Terms include: Zone A, Zone B, Zone C, Zone D, MEP, BIM, structural, rebar, concrete, pipe alignment, cable tray, safety hazard, defect, progress update, inspection.",
      temperature: 0,
    });

    // Cleanup local temp file
    fs.unlinkSync(webmPath);

    res.json({ text: transcription.text });
  } catch (error) {
    console.error('Transcription error:', error.message);
    if(req.file) {
      if(fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      if(fs.existsSync(req.file.path + '.webm')) fs.unlinkSync(req.file.path + '.webm');
    }
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

app.post('/api/capture', (req, res) => {
  const { image } = req.body || {};
  let text = 'Photo captured — GPS tagged, BIM auto-matching…';

  if (image) {
    try {
      const uploadsDir = path.join(__dirname, 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
      const filename = `capture-${Date.now()}.jpg`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, base64Data, 'base64');
      
      text += `<br><img src="/uploads/${filename}" style="width:100%; border-radius:6px; margin-top:8px; border:1px solid var(--border);">`;
      
      // Add capture feed event
      const newFeed = {
        text: text,
        type: 'blue',
        time: 'Now',
        filename: filename // Return filename so frontend can link it to an issue
      };
      db.prepare('INSERT INTO feed (text, type, time) VALUES (?, ?, ?)').run(text, 'blue', 'Now');
      return res.status(201).json(newFeed);
    } catch (e) {
      console.error('Error saving image:', e);
      return res.status(500).json({ error: 'Failed to save image' });
    }
  }

  res.status(400).json({ error: 'No image data provided' });
});

// EMAIL TRANSPORTER CONFIG
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.post('/api/demo-request', async (req, res) => {
  const { email } = req.body || {};
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const mailOptions = {
    from: `"AI Integrated Inspection" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL || 'reachsortyx@gmail.com',
    subject: 'New Demo Request',
    text: `A new demo request has been received from: ${email}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
        <h2 style="color: #00C9A7;">New Demo Request</h2>
        <p>A new user has requested a demo of the <strong>AI Integrated Inspection Platform</strong>.</p>
        <p><strong>Contact Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">This is an automated notification from your AI Inspection Platform.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Demo request email sent to admin for: ${email}`);
    res.status(200).json({ message: 'Demo request sent successfully' });
  } catch (error) {
    console.error('Error sending demo request email:', error);
    res.status(500).json({ error: 'Failed to send request. Please try again later.' });
  }
});

// --- EXPORT ROUTES ---

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const openIssues = db.prepare("SELECT zone, sevLabel, desc, status FROM issues WHERE status = 'open'").all();
    const metrics = getMetrics();
    const zoneStats = getZoneStats();

    const siteContext = `
    DASHBOARD CONTEXT:
    - Open Issues: ${metrics.openCount}
    - Critical Risks: ${metrics.criticalCount}
    - Rework Rate: ${metrics.reworkRate}%
    - Report Lag: ${metrics.reportLag}h
    - Current Zones Status: ${Object.keys(zoneStats).map(z => `${z}: ${zoneStats[z].pct}%`).join(', ')}

    DETAILED OPEN ISSUES:
    ${openIssues.map(i => `- [${i.sevLabel}] ${i.zone}: ${i.desc.replace(/<\/?[^>]+(>|$)/g, "")}`).join('\n')}
    `;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are the AI Site Partner for the 'AI Integrated Inspection Platform'. 
          You help project managers and engineers understand site progress and risks with professional, helpful insight. 
          Use the provided context to answer questions accurately and naturally. 
          Today is ${new Date().toLocaleDateString()}.`
        },
        { role: "user", content: `CONTEXT:\n${siteContext}\n\nUSER QUESTION: ${message}` }
      ],
      temperature: 0.7,
      max_tokens: 400
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('Chat AI Error:', error);
    res.status(500).json({ error: 'Assistant is currently offline.' });
  }
});

app.get('/api/export/pdf', (req, res) => {
  try {
    const { tag } = req.query;
    let query = 'SELECT * FROM issues';
    let params = [];
    if (tag) {
        query += ' WHERE tags LIKE ?';
        params.push(`%${tag}%`);
    }
    query += ' ORDER BY status ASC, id DESC';
    const issues = db.prepare(query).all(params);
    
    // Dynamic naming
    const reportTitle = tag ? `${tag.toUpperCase()} AUDIT & COMPLIANCE` : 'PROJECT FIELD INSPECTION REPORT';
    const filename = tag ? `AI_${tag}_Audit.pdf` : 'AI_Field_Inspection_Report.pdf';
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

    // Stream Error Handling - prevent server hangups
    doc.on('error', (err) => {
        console.error('PDFKit Stream Error:', err);
        if (!res.headersSent) res.status(500).send('Error generating PDF');
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="AI_Field_Inspection_Report.pdf"');

    doc.pipe(res);

    // BRANDED HEADER
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    doc.rect(0, 0, 612, 125).fill('#000000'); // Pure black to seamlessly merge with square logo
    
    // Add Logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 30, { width: 60 });
    }
    
    // Company & Platform Title (Left Side)
    doc.fontSize(18).fillColor('#00C9A7').font('Helvetica-Bold').text('AI INTEGRATED INSPECTION', 115, 38, { characterSpacing: 0.8 });
    doc.fontSize(10).fillColor('#FFFFFF').font('Helvetica-Bold').text('SORTYX VENTURES PRIVATE LIMITED', 117, 65);
    doc.fontSize(8).fillColor('#94A3B8').font('Helvetica').text('FIELD OPERATIONS & BIM INTEGRATION COMMAND', 117, 78);
    
    // Report Declaration (Right Side)
    const rightMarginX = 380;
    const pageWidth = 612;
    const contentWidth = pageWidth - 40 - rightMarginX;

    doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold').text(reportTitle, rightMarginX, 45, { width: contentWidth, align: 'right' });
    doc.fontSize(9).fillColor('#94A3B8').font('Helvetica').text(`REF: ${new Date().toISOString().slice(0, 10)}`, rightMarginX, 65, { width: contentWidth, align: 'right' });
    doc.fontSize(8).fillColor('#94A3B8').text(`SERIAL: ${Date.now().toString().slice(-6)}`, rightMarginX, 78, { width: contentWidth, align: 'right' });

    doc.y = 150; // Set starting Y for content below header

    // PROJECT SUMMARY
    const open = issues.filter(i => i.status === 'open').length;
    const resolved = issues.filter(i => i.status === 'resolved').length;
    
    doc.fontSize(14).fillColor('#1A2433').text('Project Snapshot', 40, doc.y);
    doc.moveTo(40, doc.y + 5).lineTo(550, doc.y + 5).strokeColor('#00C9A7').lineWidth(1.5).stroke();
    doc.moveDown(1);

    doc.fontSize(10).fillColor('#333');
    doc.text(`Total Observations Logged: ${issues.length}`, 45, doc.y);
    doc.text(`Active Site Risks: ${open}`, 250, doc.y);
    doc.text(`Resolved Issues: ${resolved}`, 420, doc.y);
    doc.moveDown(2);

    // SECTION 1: ACTIVE CRITICAL ISSUES
    doc.fontSize(14).fillColor('#E65A5A').text('Active Site Risks & Observations', 40, doc.y);
    doc.moveDown(0.5);

    const activeIssues = issues.filter(i => i.status === 'open');
    if (activeIssues.length === 0) {
      doc.fontSize(10).fillColor('#777').text('No active issues reported at this time.');
    } else {
      activeIssues.forEach((issue, idx) => {
        // Dynamic Page Management
        if (doc.y > 600) doc.addPage();
        
        const startY = doc.y;
        
        // Severity Color Mapping
        const sevColor = issue.sevClass === 'high' ? '#E65A5A' : issue.sevClass === 'med' ? '#DE8B26' : '#37A846';
        
        // Container Background
        doc.rect(40, startY, 515, 20).fill('#F0F4F8');
        
        // Header info
        doc.fillColor(sevColor).fontSize(10).font('Helvetica-Bold').text(`[${issue.sevLabel}]`, 50, startY + 5);
        doc.fillColor('#1A2433').fontSize(11).text(`${issue.zone} - Logged at ${issue.timestamp}`, 100, startY + 5);
        
        doc.moveDown(1.5);
        
        // Parse "AI Summary" and "Recommendation" if present in desc
        let summary = '';
        let recommendation = '';
        let originalDesc = issue.desc;
        
        const summaryMatch = issue.desc.match(/<strong>(.*?)<\/strong>/);
        const recMatch = issue.desc.match(/AI Recommendation: (.*?)<\/em>/);
        
        if (summaryMatch) summary = summaryMatch[1];
        if (recMatch) recommendation = recMatch[1];
        
        const cleanDesc = issue.desc.replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, ' ').replace(/AI Recommendation:.*$/, '');

        // Layout: Text on Left, Image on Right
        const textWidth = issue.image ? 300 : 480;
        const currentY = doc.y;

        doc.fillColor('#1A2433').font('Helvetica-Bold').fontSize(10).text('Assessment Summary:', 50, currentY);
        doc.font('Helvetica').fontSize(10).text(summary || cleanDesc, 50, doc.y + 2, { width: textWidth });
        
        if (recommendation) {
            doc.moveDown(0.5);
            doc.fillColor('#00A388').font('Helvetica-Bold').fontSize(9).text('AI CORRECTIVE ACTION:', 50, doc.y);
            doc.fillColor('#333').font('Helvetica').text(recommendation, 50, doc.y + 2, { width: textWidth });
        }

        // Add Image
        if (issue.image) {
            const imgPath = path.join(__dirname, 'public', 'uploads', issue.image);
            if (fs.existsSync(imgPath)) {
                try {
                    doc.image(imgPath, 370, currentY, { width: 170 });
                } catch(imgErr) {
                    console.error('PDF Image Embed Error:', imgErr);
                }
            }
        }

        doc.moveDown(4);
        doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#EEE').stroke();
        doc.moveDown(2);
    });
    }

    // SECTION 2: COMPLETED HISTORY
    doc.moveDown(2);
    doc.fontSize(14).fillColor('#00C9A7').text('Resolved History & Audit Trail', 40, doc.y);
    doc.moveDown(0.5);

    const historyIssues = issues.filter(i => i.status === 'resolved');
    if (historyIssues.length === 0) {
      doc.fontSize(10).fillColor('#777').text('No resolved history items found.');
    } else {
      // Small table layout for history
      doc.fontSize(9).fillColor('#999');
      doc.text('ID', 45, doc.y);
      doc.text('ZONE', 70, doc.y);
      doc.text('ISSUE DESCRIPTION', 130, doc.y);
      doc.text('RESOLVED AT', 400, doc.y);
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#EEE').stroke();
      doc.moveDown(0.5);

      historyIssues.slice(0, 50).forEach(issue => {
        doc.fillColor('#333');
        doc.text(issue.id.toString(), 45, doc.y, { width: 20 });
        doc.text(issue.zone, 70, doc.y, { width: 50 });
        const shortDesc = issue.desc.replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, ' ').substring(0, 50);
        doc.text(shortDesc, 130, doc.y, { width: 250 });
        doc.text(issue.resolved_at || 'Pre-migration', 400, doc.y);
        doc.moveDown(0.8);
        if (doc.y > 750) doc.addPage();
      });
    }

    // FOOTER
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#999').text(
            `Proprietary & Confidential - AI Integrated Inspection Platform - Page ${i + 1} of ${pages.count}`,
            40,
            doc.page.height - 30,
            { align: 'center' }
        );
    }

    doc.end();
  } catch (err) {
    console.error('PDF Export Error:', err);
    if (!res.headersSent) {
      res.status(500).send('Error generating PDF');
    }
  }
});

app.get('/api/export/csv', (req, res) => {
  try {
    const { tag } = req.query;
    let query = 'SELECT * FROM issues';
    let params = [];
    if (tag) {
        query += ' WHERE tags LIKE ?';
        params.push(`%${tag}%`);
    }
    query += ' ORDER BY status ASC, id DESC';
    const issues = db.prepare(query).all(params);

    const filename = tag ? `AI_${tag}_Log.csv` : 'AI_Inspection_Audit_Log.csv';
    
    // NEATLY ARRANGED COLUMNS FOR AUDIT
    const headers = [
      'Issue_ID',
      'Date_Logged',
      'Zone',
      'Severity',
      'Status',
      'AI_Risk_Summary',
      'AI_Recommendation',
      'Engineer_Notes',
      'Assignee',
      'Author',
      'Tags',
      'Image_Reference',
      'Resolved_At'
    ];
    
    let csv = headers.join(',') + '\n';
    
    issues.forEach(i => {
      // 1. Parse AI Data from bundled HTML desc
      let aiSummary = '';
      let aiRec = '';
      
      const summaryMatch = i.desc.match(/<strong>(.*?)<\/strong>/);
      const recMatch = i.desc.match(/AI Recommendation: (.*?)<\/em>/);
      
      if (summaryMatch) aiSummary = summaryMatch[1].replace(/<\/?[^>]+(>|$)/g, "");
      if (recMatch) aiRec = recMatch[1].replace(/<\/?[^>]+(>|$)/g, "");
      
      // 2. Extract Original/Clean Engineer Notes
      const cleanNotes = i.desc
        .replace(/<\/?[^>]+(>|$)/g, "") // Strip HTML
        .replace(/&nbsp;/g, ' ')
        .replace(/AI Recommendation:.*$/, '') // Remove AI Rec section
        .replace(aiSummary, '') // Remove AI Summary if it was at the start
        .trim();

      // 3. Helper to escape CSV values
      const esc = (val) => {
        if (val === null || val === undefined) return '""';
        let s = String(val).replace(/"/g, '""');
        return `"${s}"`;
      };

      const row = [
        i.id,
        esc(i.timestamp),
        esc(i.zone),
        esc(i.sevLabel),
        esc(i.status.toUpperCase()),
        esc(aiSummary),
        esc(aiRec),
        esc(cleanNotes),
        esc(i.assignee),
        esc(i.author),
        esc(i.tags),
        esc(i.image),
        esc(i.resolved_at)
      ];
      
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('CSV Export Error:', err);
    if (!res.headersSent) {
      res.status(500).send('Error generating CSV audit log');
    }
  }
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
