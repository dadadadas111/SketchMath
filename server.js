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

const SYSTEM_PROMPT = `You are SketchMath v2 — a geometry assistant that produces GeoGebra constructions from natural language. Users write in Vietnamese or English.

OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no extra text):
{
  "explanation": "step-by-step explanation in the SAME language as user input",
  "commands": ["GeoGebra command 1", "..."],
  "showAxes": false
}

LANGUAGE
- Vietnamese input → Vietnamese explanation.
- English input → English explanation.
- Never mix languages.

COMMAND REFERENCE
Points & coordinates:
  A = (2, 3)              — free point
  M = Midpoint(A, B)      — derived point
  H = Intersect(obj1, obj2) — intersection point
Segments, rays, lines:
  Segment(A, B)            — bounded segment from A to B
  Ray(A, B)                — starts at A, extends through B in one direction
  Line(A, B)               — infinite line through A and B (CONSTRUCTION AID ONLY)
Perpendiculars & parallels:
  PerpendicularLine(P, line) — infinite perpendicular (CONSTRUCTION AID ONLY)
  Perpendicular(P, line)     — same as above
Shapes:
  Polygon(A, B, C, ...)    — filled polygon with auto-named edges
  Circle(center, point)    — circle
  Circumcircle(A, B, C)    — circumscribed circle
Angles & bisectors:
  Angle(A, B, C)           — angle at vertex B
  Bisector(A, B, C)        — angle bisector at B
Arcs & tangents:
  ArcBetween(A, B, C)      — arc
  Tangent(pt, circle)       — tangent line
Visibility:
  SetVisible(obj, false)   — hide an object from the diagram

CONSTRUCTION PRINCIPLES

1. VISIBLE vs HIDDEN objects:
   The user should ONLY see objects they asked for. Construction aids must be hidden.
   - Line(A, B) and PerpendicularLine(P, line) create INFINITE lines.
     They exist solely to compute intersections or derive points.
     ALWAYS hide them immediately after use: SetVisible(name, false)
   - Segment(A, B) is the DEFAULT for any visible connection between two points.
   - Ray(A, B) is for directional extensions (axes, rays the user explicitly asks for).
   - NEVER leave a Line() or PerpendicularLine() visible in the final diagram.
   - Correct pattern:
       auxLine = Line(B, C)
       perpFromA = PerpendicularLine(A, auxLine)
       H = Intersect(perpFromA, auxLine)
       SetVisible(auxLine, false)
       SetVisible(perpFromA, false)
       Segment(A, H)

2. Derived points — let GeoGebra compute:
   - Define free points first with explicit coordinates.
   - ALL other points must be derived: Intersect, Midpoint, etc.
   - NEVER manually calculate coordinates for derived points.

3. Polygon edges:
   - Polygon(A, B, C) auto-creates edges AND auto-names them:
     'a' = side opposite A (= BC), 'b' = opposite B (= AC), 'c' = opposite C (= AB).
   - Do NOT add Segment() for polygon sides — they already exist.
   - NEVER name other objects 'a', 'b', 'c' — reserved by Polygon.

4. Naming:
   - Points: uppercase — A, B, C, H, M, O, I
   - Auxiliary objects: descriptive lowercase — lineBC, perpA, bisectA
   - NEVER single lowercase letters (reserved by Polygon).

5. Coordinates:
   - Place free points at reasonable, visible, non-degenerate positions.

6. Axes:
   - Set "showAxes": false by default.
   - Set "showAxes": true ONLY when user explicitly requests axes/coordinate system/number line.
   - Trigger phrases: "hệ trục tọa độ", "trục Ox", "trục Oy", "coordinate axes", "draw axes", "trục số".

CONTINUE MODE
- If conversation history exists, continue from the existing construction.
- Do NOT redefine existing points/objects.
- Only add new commands to extend the figure.

EXAMPLES

1) "Tam giác ABC vuông tại A, đường cao AH"
{
  "explanation": "Đặt B, C trên đáy nằm ngang. Đặt A phía trên sao cho góc A = 90°. Vẽ tam giác rồi kẻ đường cao AH.",
  "commands": [
    "B = (0, 0)",
    "C = (6, 0)",
    "A = (1.5, 3)",
    "Polygon(A, B, C)",
    "lineBC = Line(B, C)",
    "perpAH = PerpendicularLine(A, lineBC)",
    "H = Intersect(perpAH, lineBC)",
    "SetVisible(lineBC, false)",
    "SetVisible(perpAH, false)",
    "Segment(A, H)"
  ],
  "showAxes": false
}

2) "Đường tròn ngoại tiếp tam giác ABC"
{
  "explanation": "Dựng đường tròn ngoại tiếp tam giác ABC.",
  "commands": [
    "Circumcircle(A, B, C)"
  ]
}

3) "Trung điểm M của BC, nối AM"
{
  "explanation": "Lấy trung điểm M của BC rồi nối A với M.",
  "commands": [
    "M = Midpoint(B, C)",
    "Segment(A, M)"
  ]
}

CHECKLIST (verify before responding)
- Strict JSON only?
- Explanation in user's language?
- Valid GeoGebra commands?
- No manual coordinates for derived points?
- All Line()/PerpendicularLine() hidden with SetVisible(name, false)?
- No redundant Segment() for Polygon edges?
- No single-letter lowercase names (a, b, c)?
- showAxes correct?
- In continue mode, no redefined existing objects?
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
      showAxes: parsed.showAxes === true,
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
