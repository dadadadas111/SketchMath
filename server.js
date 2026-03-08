const path = require('path');
const express = require('express');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const AI_BASE_URL = process.env.AI_BASE_URL;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL;

if (!AI_BASE_URL || !AI_API_KEY || !AI_MODEL) {
  console.error('[Startup] Missing required environment variables.');
  console.error('Required: AI_BASE_URL, AI_API_KEY, AI_MODEL');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: AI_API_KEY,
  baseURL: AI_BASE_URL,
});

const SYSTEM_PROMPT = `You are SketchMath v2 Geometry Assistant.

You must solve or construct geometry problems from students. Users can write in Vietnamese or English.

GOAL
1) Analyze the geometry request.
2) Produce an explanation and GeoGebra commands for construction.

CRITICAL OUTPUT FORMAT
- Return ONLY valid JSON, no markdown, no extra text.
- JSON schema:
{
  "explanation": "step-by-step explanation in the SAME language as the user's input",
  "commands": ["GeoGebra command 1", "GeoGebra command 2", "..."]
}

LANGUAGE RULES
- If user writes Vietnamese, explanation MUST be Vietnamese.
- If user writes English, explanation MUST be English.
- Never mix unrelated languages.

GEOGEBRA CONSTRUCTION RULES (VERY IMPORTANT)
- Use valid GeoGebra commands such as:
  A = (0, 0)
  Segment(A, B)
  Circle(A, B)
  Line(A, B)
  Perpendicular(A, line)
  PerpendicularLine(A, line)
  Midpoint(A, B)
  Intersect(obj1, obj2)
  Angle(A, B, C)
  Polygon(A, B, C)
  Bisector(A, B, C)
  Tangent(pt, circle)
  ArcBetween(A, B, C)
  Circumcircle(A, B, C)
- Place initial free points at reasonable visible coordinates (non-degenerate shapes).
- Polygon(A, B, C) automatically creates the filled region AND its edges. Do NOT add separate Segment() calls for polygon sides — GeoGebra creates them automatically.
- Dependent constructions are mandatory:
  * Define base/free points first.
  * Construct all derived points/lines/circles from constraints.
  * NEVER manually compute coordinates for derived points.
  * Use Intersect, Midpoint, PerpendicularLine, Bisector, etc. so GeoGebra solves positions.
- Naming conventions:
  * Points use uppercase labels: A, B, C, H, M, O, I, ...
  * Lines/segments use lowercase labels where named: a, b, c, h, ...

CONTINUE MODE (history-aware)
- If conversation history exists, continue from existing construction.
- Do NOT redefine existing points/objects unless user explicitly asks to reset.
- Add only the new necessary commands to extend the figure.

EXAMPLES
1) "Tam giác ABC vuông tại A"
{
  "explanation": "Vẽ tam giác ABC vuông tại A bằng cách đặt A, B, C sao cho AB vuông góc AC.",
  "commands": [
    "A = (0, 0)",
    "B = (4, 0)",
    "C = (0, 3)",
    "Polygon(A, B, C)"
  ]
}

2) "Đường cao AH"
{
  "explanation": "Kẻ đường thẳng qua A vuông góc với BC, giao điểm với BC là H, rồi nối AH.",
  "commands": [
    "a = Line(B, C)",
    "h = PerpendicularLine(A, a)",
    "H = Intersect(h, a)",
    "Segment(A, H)"
  ]
}

3) "Đường tròn tâm O đường kính AB"
{
  "explanation": "Lấy trung điểm O của AB rồi vẽ đường tròn tâm O đi qua A.",
  "commands": [
    "O = Midpoint(A, B)",
    "Circle(O, A)"
  ]
}

4) "Đường phân giác góc A"
{
  "explanation": "Dựng đường phân giác của góc BAC.",
  "commands": [
    "Bisector(B, A, C)"
  ]
}

5) "Trung điểm M của BC"
{
  "explanation": "Lấy M là trung điểm của đoạn BC.",
  "commands": [
    "M = Midpoint(B, C)"
  ]
}

6) Circumscribed circle of triangle ABC
{
  "explanation": "Construct the circumcircle of triangle ABC.",
  "commands": [
    "Circumcircle(A, B, C)"
  ]
}
If Circumcircle is unavailable, construct perpendicular bisectors and use their intersection as center.

FINAL CHECK BEFORE YOU RESPOND
- Is output strict JSON only?
- Is explanation in user's language?
- Are commands valid GeoGebra commands?
- Did you avoid manual coordinates for derived points?
- In continue mode, did you avoid redefining existing objects?
- If you used Polygon(), did you avoid adding redundant Segment() for its edges?
`;

app.use(express.json({ limit: '1mb' }));

app.use(express.static(path.join(__dirname, 'public')));

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((msg) => msg && typeof msg === 'object')
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? ''),
    }))
    .filter((msg) => msg.content.trim().length > 0);
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          if (typeof part.text === 'string') return part.text;
          if (typeof part.content === 'string') return part.content;
        }
        return '';
      })
      .join('\n')
      .trim();
  }
  return '';
}

function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonFromResponse(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;

  const direct = tryParseJson(text);
  if (direct) return direct;

  const fencedBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedBlocks) {
    const maybe = tryParseJson((match[1] || '').trim());
    if (maybe) return maybe;
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const maybe = tryParseJson(text.slice(firstBrace, lastBrace + 1).trim());
    if (maybe) return maybe;
  }

  return null;
}

function isValidResultShape(data) {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.explanation === 'string' &&
    Array.isArray(data.commands) &&
    data.commands.every((cmd) => typeof cmd === 'string')
  );
}

app.post('/api/solve', async (req, res) => {
  const { prompt, history } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      error: 'Invalid input: "prompt" must be a non-empty string.',
    });
  }

  const sanitizedHistory = normalizeHistory(history);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...sanitizedHistory,
    { role: 'user', content: prompt.trim() },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      temperature: 0.2,
      messages,
    });

    const rawResponse = extractTextContent(completion?.choices?.[0]?.message?.content || '');
    const parsed = extractJsonFromResponse(rawResponse);

    if (!parsed || !isValidResultShape(parsed)) {
      return res.status(502).json({
        error: 'AI response is not valid JSON with { explanation, commands }.',
        rawResponse,
      });
    }

    return res.json({
      explanation: parsed.explanation,
      commands: parsed.commands,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const providerMessage =
      error?.response?.data?.error?.message ||
      error?.error?.message ||
      error?.message ||
      'Unknown AI provider error';

    console.error('[API /api/solve] Error:', {
      status,
      message: providerMessage,
    });

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: 'Failed to generate geometry solution.',
      details: providerMessage,
    });
  }
});

app.use((err, req, res, next) => {
  console.error('[Express Error]', err);
  if (res.headersSent) return next(err);
  return res.status(500).json({
    error: 'Internal server error.',
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
});

app.listen(PORT, () => {
  console.log(`[Startup] SketchMath v2 server is running on port ${PORT}`);
  console.log(`[Startup] Static files: ${path.join(__dirname, 'public')}`);
  console.log(`[Startup] AI base URL: ${AI_BASE_URL}`);
  console.log(`[Startup] AI model: ${AI_MODEL}`);
});
