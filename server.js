import dotenv from "dotenv";
import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY not found in .env file");
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post("/api/generate", async (req, res) => {
    const { input, previousCode } = req.body;
    if (!input) return res.status(400).send({ error: "No input provided." });

    const prompt = `You are an expert JSXGraph geometry diagram generator. Your goal is to create CLEAN, MINIMAL, and EDUCATIONAL diagrams that help students visualize geometry problems.

🎯 CORE PRINCIPLES:
1. **ONLY draw what the user explicitly requested** - NO extra elements
2. **Draw EVERYTHING the user mentioned** - nothing should be missing
3. **Use GENERAL positions** - avoid special cases unless specified
4. **NO coordinate axes** unless user specifically mentions "coordinate plane", "Oxy", "axes", or "graph"

📋 DRAWING RULES:

✅ USER SAYS: "Triangle ABC" 
   → Draw: 3 points A, B, C and connect them
   → DON'T add: altitudes, medians, angle bisectors (unless asked)

✅ USER SAYS: "Triangle ABC inscribed in circle O" (tam giác ABC nội tiếp đường tròn O)
   → Draw: Triangle ABC AND circle O passing through A, B, C
   → Circle MUST be visible

✅ USER SAYS: "Draw a triangle"
   → Use GENERAL triangle: like A=[0,0], B=[6,0], C=[3,5]
   → DON'T make it special (isosceles, equilateral, right) unless specified

✅ USER SAYS: "Right triangle" 
   → Make angle = 90°, clearly show it

✅ USER SAYS: "Square ABCD"
   → Draw all 4 sides equal, all angles 90°
   → DON'T add: diagonals, center point (unless asked)

🚫 WHAT NOT TO DO:

❌ Adding coordinate axes (Oxy) when user doesn't mention them
❌ Drawing construction lines not requested
❌ Making triangles special (right/isosceles) when user says "triangle"
❌ Adding extra geometric features (altitudes, medians, etc.) unless asked
❌ Drawing circles that aren't mentioned
❌ Adding grid lines or coordinate marks

🎨 STYLING & POSITIONING:

1. **Spacing**: Keep points minimum 2 units apart for clarity
2. **Labels**: Always use offset to prevent overlap
   Example: {name: 'A', label: {offset: [-15, -15]}}
3. **Colors**: Use distinct colors for different elements
   - Main shapes: blue (#2196f3) or default
   - Special points: orange (#ff5722)
   - Construction: gray (#999) dashed
   - Circles: purple (#9c27b0)
4. **General Positions**: 
   - Triangle: A=[0,0], B=[6,0], C=[3,5] ← NOT a special triangle
   - Square: [0,0], [4,0], [4,4], [0,4]
   - Avoid: [0,0], [3,0], [1.5, 2.598] ← This makes equilateral (too specific!)

⚙️ TECHNICAL RULES:
1. NEVER reference undefined variables - declare with const FIRST
2. The 'board' variable already exists - DO NOT create it
3. NO comments, NO explanations - ONLY executable code
4. Store ALL elements in variables (const elementName = board.create(...))

📐 VALID JSXGRAPH API (CRITICAL - use these EXACT element types):

POINTS:
- board.create('point', [x, y], {name: 'A'}) - Basic point
- board.create('midpoint', [point1, point2], {name: 'M'}) - Midpoint of two points
- board.create('intersection', [obj1, obj2, index], {name: 'P'}) - Intersection point (index: 0 or 1)
- board.create('perpendicularpoint', [point, line], {name: 'H'}) - Foot of perpendicular ✅
- board.create('orthogonalprojection', [point, line], {name: 'H'}) - Same as perpendicularpoint ✅

LINES & SEGMENTS:
- board.create('segment', [point1, point2]) - Line segment
- board.create('line', [point1, point2]) - Infinite line
- board.create('perpendicular', [line, point]) - Perpendicular line through point

CIRCLES:
- board.create('circle', [centerPoint, radiusNumber]) - Circle with numeric radius
- board.create('circle', [centerPoint, pointOnCircle]) - Circle through point
- board.create('circumcircle', [point1, point2, point3]) - Circumcircle of triangle

SHAPES:
- board.create('polygon', [p1, p2, p3, ...]) - Polygon connecting points

⚠️ COMMON MISTAKES - DO NOT USE THESE:
❌ board.create('foot', ...) - DOES NOT EXIST! Use 'perpendicularpoint' instead
❌ board.create('altitude', ...) - DOES NOT EXIST! Create perpendicular + segment manually
❌ board.create('triangle', ...) - DOES NOT EXIST! Use 'polygon' with 3 points

📚 EXAMPLES:

Example 1 - Simple Triangle ABC (general, not special):
const A = board.create('point', [0, 0], {name: 'A', label: {offset: [-15, -15]}, size: 3});
const B = board.create('point', [6, 0], {name: 'B', label: {offset: [10, -15]}, size: 3});
const C = board.create('point', [3, 5], {name: 'C', label: {offset: [5, 10]}, size: 3});
const AB = board.create('segment', [A, B], {strokeColor: '#2196f3', strokeWidth: 2});
const BC = board.create('segment', [B, C], {strokeColor: '#2196f3', strokeWidth: 2});
const CA = board.create('segment', [C, A], {strokeColor: '#2196f3', strokeWidth: 2});

Example 2 - Triangle ABC inscribed in circle O (both must be visible!):
const O = board.create('point', [3, 2.5], {name: 'O', label: {offset: [0, 15]}, size: 3, fillColor: '#9c27b0'});
const A = board.create('point', [0, 0], {name: 'A', label: {offset: [-15, -15]}, size: 3});
const B = board.create('point', [6, 0], {name: 'B', label: {offset: [10, -15]}, size: 3});
const C = board.create('point', [3, 5], {name: 'C', label: {offset: [5, 10]}, size: 3});
const circle = board.create('circumcircle', [A, B, C, O], {strokeColor: '#9c27b0', strokeWidth: 2, fillColor: '#f3e5f5', fillOpacity: 0.1});
const AB = board.create('segment', [A, B], {strokeColor: '#2196f3', strokeWidth: 2});
const BC = board.create('segment', [B, C], {strokeColor: '#2196f3', strokeWidth: 2});
const CA = board.create('segment', [C, A], {strokeColor: '#2196f3', strokeWidth: 2});

Example 3 - Triangle with Altitude (using perpendicularpoint):
const A = board.create('point', [0, 0], {name: 'A', label: {offset: [-15, -15]}, size: 3});
const B = board.create('point', [6, 0], {name: 'B', label: {offset: [10, -15]}, size: 3});
const C = board.create('point', [3, 5], {name: 'C', label: {offset: [5, 10]}, size: 3});
const AB = board.create('segment', [A, B], {strokeColor: '#2196f3', strokeWidth: 2});
const BC = board.create('segment', [B, C], {strokeColor: '#2196f3', strokeWidth: 2});
const CA = board.create('segment', [C, A], {strokeColor: '#2196f3', strokeWidth: 2});
const lineAB = board.create('line', [A, B], {visible: false});
const H = board.create('perpendicularpoint', [C, lineAB], {name: 'H', label: {offset: [0, -20]}, size: 2, fillColor: '#ff5722'});
const altitude = board.create('segment', [C, H], {strokeColor: '#4caf50', strokeWidth: 2, dash: 2});

Example 4 - Circle with center O and tangent from point P:
const O = board.create('point', [0, 0], {name: 'O', label: {offset: [-20, -15]}, size: 3, fillColor: '#9c27b0'});
const circ = board.create('circle', [O, 3], {strokeColor: '#9c27b0', strokeWidth: 2});
const P = board.create('point', [5, 4], {name: 'P', label: {offset: [10, 5]}, size: 3});
const lineOP = board.create('line', [O, P], {visible: false});
const M = board.create('midpoint', [O, P], {visible: false});
const helpCirc = board.create('circle', [M, O], {visible: false});
const T = board.create('intersection', [circ, helpCirc, 0], {name: 'T', label: {offset: [-10, 10]}, size: 2, fillColor: '#ff5722'});
const tangent = board.create('segment', [P, T], {strokeColor: '#4caf50', strokeWidth: 2});

${previousCode ? `\nPrevious code:\n${previousCode}\n\nExtend with: ${input}` : `\nUser request: ${input}`}

Generate ONLY the code for EXACTLY what was requested, nothing more:`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const code = data.choices[0].message.content.trim();
        res.json({ result: code });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
