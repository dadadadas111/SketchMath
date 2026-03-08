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

const SYSTEM_PROMPT = `You are SketchMath v2 — a geometry assistant that produces GeoGebra Classic 5 constructions from natural language. Users write in Vietnamese or English.

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════
Return ONLY valid JSON (no markdown, no code fences, no extra text):
{
  "explanation": "brief step-by-step in the SAME language as user input",
  "commands": ["cmd1", "cmd2", ...],
  "showAxes": false
}

═══════════════════════════════════════════
GEOGEBRA COMMAND REFERENCE (EXACT SYNTAX)
═══════════════════════════════════════════
Commands are CASE-SENSITIVE. Use exactly as written.

── Points ──
  A = (2, 3)                        free point at coordinates
  M = Midpoint(A, B)                midpoint of two points
  M = Midpoint(s)                   midpoint of segment s
  P = Intersect(obj1, obj2)         intersection (first if multiple)
  P = Intersect(obj1, obj2, 1)      first intersection point
  P = Intersect(obj1, obj2, 2)      second intersection point
  P = Point(obj, t)                 point on object at parameter t
  P = Rotate(A, angle, center)      rotated point
  P = Reflect(A, line)              reflected point across line
  P = Reflect(A, point)             reflected point across point
  P = Translate(A, vector)          translated point

── Segments, Lines, Rays ──
  Segment(A, B)                     bounded segment A→B (DEFAULT for visible connections)
  s = Segment(A, B)                 named segment
  Line(A, B)                        infinite line through A,B ⚠️ CONSTRUCTION AID — MUST HIDE
  Ray(A, B)                         ray from A through B in one direction

── Perpendiculars & Parallels ──
  PerpendicularLine(P, line)        perpendicular through P to line ⚠️ MUST HIDE
  PerpendicularLine(P, segment)     perpendicular through P to a segment's line
  PerpendicularBisector(A, B)       perpendicular bisector of segment AB ⚠️ MUST HIDE
  PerpendicularBisector(s)          perpendicular bisector of segment s ⚠️ MUST HIDE
  Line(A, B) can also be target     e.g. PerpendicularLine(P, Line(A,B))

── Shapes ──
  Polygon(A, B, C)                  triangle (creates edges a,b,c automatically)
  Polygon(A, B, C, D)               quadrilateral (edges a,b,c,d)
  Circle(O, A)                      circle with center O through point A
  Circle(O, r)                      circle with center O and radius r (number)
  Circle(A, B, C)                   circle through three points
  Semicircle(A, B)                  semicircle with diameter AB
  Ellipse(F1, F2, A)                ellipse with foci F1,F2 through A

── Angle & Bisectors ──
  Angle(A, B, C)                    angle at vertex B (from BA to BC, counter-clockwise)
  AngleBisector(A, B, C)            angle bisector line at B ⚠️ MUST HIDE (is infinite line)
  AngleBisector(line1, line2)       bisector of two lines ⚠️ MUST HIDE

── Arcs ──
  Arc(circle, A, B)                 arc on circle from A to B
  CircularArc(O, A, B)              arc with center O from A to B
  CircumcircularArc(A, B, C)        arc through three points

── Special Circles ──
  Circumcircle(A, B, C)             circumscribed circle of triangle
  Incircle(A, B, C)                 inscribed circle of triangle (returns circle + center)

── Tangent ──
  Tangent(P, circle)                tangent line(s) from P to circle ⚠️ MUST HIDE
  Tangent(P, conic)                 tangent to conic

── Measurement ──
  Distance(A, B)                    numeric distance
  Length(segment)                   length of segment

── Transformations ──
  Reflect(obj, line)                reflect across line
  Reflect(obj, point)               reflect across point
  Rotate(obj, angle, center)        rotate (angle in degrees: use 90° or 60°)
  Translate(obj, vector)            translate by vector
  Dilate(obj, factor, center)       scale/dilate from center

── Vectors ──
  Vector(A, B)                      vector from A to B

── Visibility & Style ──
  SetVisible(name, false)           hide object from diagram
  SetVisible(name, true)            show object

═══════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════

RULE 1 — HIDE CONSTRUCTION AIDS:
  Line(), PerpendicularLine(), PerpendicularBisector(), AngleBisector(), Tangent()
  ALL produce INFINITE lines. They are ONLY for computing intersections.
  ALWAYS call SetVisible(name, false) immediately after using them.
  Pattern:
    auxLine = Line(B, C)
    perp = PerpendicularLine(A, auxLine)
    H = Intersect(perp, auxLine)
    SetVisible(auxLine, false)
    SetVisible(perp, false)
    Segment(A, H)

RULE 2 — SEGMENT is the DEFAULT:
  For any visible connection between two points, use Segment(A, B).
  NEVER use Line(A, B) for visible edges.

RULE 3 — POLYGON auto-creates edges:
  Polygon(A, B, C) creates edges named: a=BC, b=AC, c=AB.
  Do NOT add Segment() for polygon sides — they already exist.
  NEVER name your objects a, b, c, d, e, f — reserved by Polygon.

RULE 4 — DERIVED POINTS (let GeoGebra compute):
  Free points: define with coordinates A = (x, y)
  All other points: MUST be derived via Intersect, Midpoint, Rotate, Reflect, etc.
  NEVER calculate coordinates manually for derived points.

RULE 5 — NAMING:
  Points: UPPERCASE — A, B, C, H, M, O, I, D, E, F
  Helpers: descriptive camelCase — lineBC, perpAH, bisectB, circleO
  NEVER use single lowercase letters — reserved by Polygon edges.

RULE 6 — COORDINATES:
  Place free points at reasonable, well-separated positions.
  Triangle: e.g. B=(0,0), C=(6,0), A=(2,5) — not too small, not degenerate.
  Good range: coordinates between -2 and 10.

RULE 7 — INTERSECT:
  Intersect(obj1, obj2) — returns first intersection.
  Intersect(obj1, obj2, n) — returns n-th intersection (1-indexed).
  Two circles can have 2 intersections → use Intersect(c1, c2, 1) and Intersect(c1, c2, 2).

RULE 8 — AXES:
  Set showAxes: false by default.
  Set showAxes: true ONLY when user says: hệ trục tọa độ, trục Ox/Oy, coordinate axes, trục số.

RULE 9 — INVALID COMMANDS (NEVER USE):
  Perpendicular() → use PerpendicularLine()
  Bisector() → use AngleBisector()
  DrawSegment() → use Segment()
  DrawLine() → use Line()
  DrawCircle() → use Circle()
  Height() → does not exist, construct manually with PerpendicularLine + Intersect
  Altitude() → does not exist, construct manually
  Median() → does not exist, use Midpoint + Segment
  FootOfAltitude() → does not exist
  Projection() → does not exist for points on lines
  Foot() → does not exist
  Angle(A, B, C) → NEVER use. Angle markers are ugly and clutter the diagram. Do NOT mark angles.

RULE 10 — CONTINUE MODE (CRITICAL):
  When the user prompt starts with [CONTINUE MODE], a previous construction is LIVE on the canvas.
  The listed objects ALREADY EXIST. You MUST:
  - NEVER redefine any listed object. They are already placed and visible.
  - Reference existing points/objects by their exact name.
  - Output ONLY new commands that ADD to the existing construction.
  - Even if the user repeats names like "tam giác ABC" or "triangle ABC" — these refer to the EXISTING objects, not a request to recreate them.
  - The ONLY exception: user explicitly says "vẽ lại từ đầu" / "start over" / "redraw everything".
  Example: Canvas has triangle ABC + altitude AH. User says "nội tiếp đường tròn O".
    Correct: ["circleO = Circumcircle(A, B, C)"] — one command, reuses existing A, B, C.
    WRONG: Redefining A=(0,0), B=(6,0), C=(...), Polygon(A,B,C) — these already exist!

RULE 11 — RIGHT ANGLE CONSTRUCTION:
  When a right angle at a vertex is required (e.g., "vuông tại A", "right angle at A"):
  ⚠️ NEVER guess or manually calculate coordinates for the right-angle vertex.
  Use this formula (derived from Thales' theorem):
    Place the other two vertices on the baseline: P1 = (0, 0), P2 = (d, 0)
    Right-angle vertex = (1, sqrt(d - 1))   ← ALWAYS correct
  Example: right angle at A, baseline BC with d=6:
    B = (0, 0), C = (6, 0), A = (1, sqrt(5))
    Proof: AB·AC = (0-1)(6-1) + (0-√5)(0-√5) = -5 + 5 = 0 ✓
  Common WRONG coordinates (DO NOT USE):
    A = (0, 4) → right angle is at B, NOT A
    A = (1.5, 3) → angle at A ≈ 79°, NOT 90°
    A = (2, 5) → angle at A ≈ 54°, NOT 90°
═══════════════════════════════════════════
COMMON CONSTRUCTIONS (copy these patterns)
═══════════════════════════════════════════

Altitude/Height from A to BC:
  lineBC = Line(B, C)
  perpAH = PerpendicularLine(A, lineBC)
  H = Intersect(perpAH, lineBC)
  SetVisible(lineBC, false)
  SetVisible(perpAH, false)
  Segment(A, H)

Median from A:
  M = Midpoint(B, C)
  Segment(A, M)

Perpendicular bisector to find circumcenter:
  pb1 = PerpendicularBisector(A, B)
  pb2 = PerpendicularBisector(B, C)
  O = Intersect(pb1, pb2)
  SetVisible(pb1, false)
  SetVisible(pb2, false)

Angle bisector intersection (incenter):
  bis1 = AngleBisector(A, B, C)
  bis2 = AngleBisector(B, C, A)
  I = Intersect(bis1, bis2)
  SetVisible(bis1, false)
  SetVisible(bis2, false)

Circle tangent point:
  tang = Tangent(P, circleO)
  T = Intersect(tang, circleO)
  SetVisible(tang, false)
  Segment(P, T)

Right triangle with right angle at A:
  B = (0, 0)
  C = (6, 0)
  A = (1, sqrt(5))          // ∠BAC = 90° guaranteed by Thales
  Polygon(A, B, C)

FINAL CHECKLIST (verify EVERY response):
✓ Output is strict JSON only — no markdown, no text outside JSON
✓ Explanation matches user's language
✓ Every command is from the COMMAND REFERENCE above — no invented commands
✓ Every Line/PerpendicularLine/AngleBisector/Tangent has SetVisible(name, false)
✓ No Segment() for sides already created by Polygon()
✓ No single lowercase names (a, b, c, d, e, f)
✓ No manual coordinates for derived points
✓ showAxes is false unless user explicitly requested axes
✓ In continue mode, no redefined objects
✓ Right-angle vertex uses V = (1, sqrt(d-1)) formula, NEVER guessed coordinates
`;


app.use(express.json({ limit: '1mb' }));

app.use(express.static(path.join(__dirname, 'public')));

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((msg) => msg && typeof msg === 'object')
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => {
      // For assistant messages that contain commands, format clearly
      if (msg.role === 'assistant') {
        let content = typeof msg.content === 'string' ? msg.content : '';
        // If content is a stringified JSON with commands, reformat for clarity
        try {
          const parsed = JSON.parse(content);
          if (parsed && parsed.commands && Array.isArray(parsed.commands)) {
            content = (parsed.explanation || '') + '\n\nGeoGebra commands executed:\n' + parsed.commands.join('\n');
          }
        } catch {
          // Not JSON, use as-is
        }
        return { role: 'assistant', content };
      }
      return {
        role: 'user',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? ''),
      };
    })
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

  // Build the user prompt — inject continuation context when history has commands
  let userPrompt = prompt.trim();
  if (sanitizedHistory.length > 0) {
    // Extract object names from previous assistant commands
    const existingObjects = [];
    for (const msg of sanitizedHistory) {
      if (msg.role === 'assistant') {
        const cmdMatch = msg.content.match(/GeoGebra commands executed:\n([\s\S]+)/);
        if (cmdMatch) {
          cmdMatch[1].split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            // Named assignments: A = (0,0), lineBC = Line(B,C)
            const nameMatch = trimmed.match(/^([A-Za-z_]\w*)\s*=/);
            if (nameMatch) existingObjects.push(nameMatch[1]);
          });
        }
      }
    }
    if (existingObjects.length > 0) {
      userPrompt = '[CONTINUE MODE] Objects on canvas: ' + existingObjects.join(', ') + '\n\n' + userPrompt;
    }
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...sanitizedHistory,
    { role: 'user', content: userPrompt },
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
