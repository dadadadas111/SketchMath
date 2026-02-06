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

🧠 CRITICAL THINKING PROCESS (DO THIS FIRST - KEEP IT INTERNAL):

Before generating ANY code, you MUST complete this full analysis. DO NOT SKIP ANY STEP.

**Step 1: Extract EVERY Element from User Input**

Create a complete inventory by filling out this checklist:

PRIMARY ELEMENTS (must draw these):
□ Points: List ALL point names mentioned (A, B, C, D, E, F, H, M, N, P, O, etc.)
□ Lines/Segments: List ALL (AB, BC, AD, BE, CF, etc.)
□ Circles: List ALL circles mentioned with their centers
□ Triangles/Polygons: List ALL shapes

GEOMETRIC RELATIONSHIPS (must satisfy these):
□ "nội tiếp" / "inscribed": Which shape is inscribed in which circle?
□ "đường cao" / "altitude": Which lines are altitudes? From which vertex to which side?
□ "cắt nhau tại" / "intersect at": Which lines intersect at which point?
□ "cắt đường tròn tại" / "intersects circle at": Which line meets which circle at which point?
□ "đường tròn (O)" / "circle (O)" / "circle O": A circle is mentioned with center O - O MUST be drawn as a labeled point!

CRITICAL LOGIC CHECK:
□ If user mentions "circle (O)" or "circle O", point O MUST appear in the diagram!
  - Create the circumcircle first: const circle = board.create('circumcircle', [A, B, C], {...})
  - Then get its center: const O = circle.center
  - Make O visible and labeled: O.setAttribute({name: 'O', visible: true, size: 3, fillColor: '#9c27b0'})
  
□ If altitude AD "cuts circle at M" and A is ON the circle, then:
  - The altitude LINE passes through A (already on circle)
  - The altitude continues through D (foot, inside triangle)  
  - The altitude exits the circle at M (on OPPOSITE side from A)
  - Therefore: M ≠ A (they are DIFFERENT points on opposite arcs)
  
□ If user says "altitudes AD, BE, CF intersect at H", then:
  - H is the ORTHOCENTER (inside the triangle)
  - H is NOT on any side of the triangle
  - H is NOT on the circle
  - D, E, F are the FEET (on the sides)

**Step 2: Create Construction Plan with EXACT coordinates**

Now plan EXACTLY what to create, in order, with actual reasoning:

CONSTRUCTION SEQUENCE (each item must list its dependencies):

1. Independent base points:
   - Which points can I place freely? (Usually A, B, C for a triangle)
   - Example: A=[0,0], B=[6,0], C=[3,5] (general triangle, NOT special)

2. Circles containing base points:
   - If "triangle ABC inscribed in circle O", the circle passes through A, B, C
   - CRITICAL: If user mentions "circle O" or "circle (O)", point O MUST be visible!
   
   CORRECT approach when O is mentioned:
   const circle = board.create('circumcircle', [A, B, C], {strokeColor: '#9c27b0', strokeWidth: 2, center: {visible: true}});
   const O = circle.center;
   O.setName('O');
   O.setAttribute({size: 3, fillColor: '#9c27b0', withLabel: true});
   
   - This makes O appear as a labeled point at the actual center of the circle
   - setName('O') sets the label text
   - withLabel: true ensures the label is displayed
   - Note: A, B, C are ALREADY on the circle

3. Primary lines (from base points):
   - Create invisible lines for construction: lineAB, lineBC, lineCA
   
4. Derived points from intersections/perpendiculars:
   - Altitude foot D: perpendicular from A to lineBC
   - Altitude foot E: perpendicular from B to lineCA
   - Altitude foot F: perpendicular from C to lineAB
   - Note: D, E, F are INSIDE the triangle (on the sides)

5. Altitude LINES (infinite, not segments):
   - altAD: infinite line through A and D
   - altBE: infinite line through B and E
   - altCF: infinite line through C and F
   - WHY infinite? Because we need them to intersect the circle and find H

6. Orthocenter H:
   - H = intersection of altAD and altBE (any two altitudes)
   - H is INSIDE the triangle
   
7. Circle re-intersection points (CRITICAL - JSXGraph quirk):
   - M = where altAD intersects circle AGAIN (not at A)
   - PROBLEM: JSXGraph's intersection() is unreliable when line passes through a vertex already on circle
   - SOLUTION: Use 'otherintersection' instead of 'intersection'!
   
   ❌ WRONG (unreliable):
   const M = board.create('intersection', [altAD, circle, 1], {...});  // May still give A!
   
   ✅ CORRECT (reliable):
   const M = board.create('otherintersection', [altAD, circle, A], {name: 'M', ...});
   
   This tells JSXGraph: "Find the intersection of altAD and circle that is NOT point A"
   
   CONCRETE CODE:
   const M = board.create('otherintersection', [altAD, circle, A], {name: 'M', label: {offset: [-15, 10]}, size: 2, fillColor: '#ff9800'});
   const N = board.create('otherintersection', [altBE, circle, B], {name: 'N', label: {offset: [10, -10]}, size: 2, fillColor: '#ff9800'});
   const P = board.create('otherintersection', [altCF, circle, C], {name: 'P', label: {offset: [0, 15]}, size: 2, fillColor: '#ff9800'});
   
   WHY this works: 'otherintersection' explicitly excludes the specified point (A, B, or C)

8. Visual segments (for display):
   - Now you can draw segments AD, BE, CF, or altitudes extended to M, N, P

**Step 3: Verify Your Plan**
Before writing code, verify:

DEPENDENCY CHECK:
□ Every variable is declared before it's used in the code sequence
□ No forward references (using D before creating D)

INTERSECTION INDEX CHECK (MOST COMMON ERROR):
□ When a LINE passes through a point that's ALREADY on a circle, use index 1 for the OTHER intersection
□ Example: altAD passes through A (on circle) → M is at index 1, NOT 0
□ If M ends up at same position as A in your mental image, you're using wrong index!

COMPLETENESS CHECK:
□ Every point mentioned in user input has a corresponding board.create statement
□ Every relationship mentioned is satisfied geometrically

GEOMETRY SENSE CHECK:
□ If triangle is inscribed, are A, B, C on the circle? ✓
□ If H is orthocenter, is H inside the triangle? ✓
□ If M is where altitude exits circle, is M opposite to vertex A? ✓
□ Are D, E, F on the sides of the triangle (not outside)? ✓

**IMPORTANT**: This thinking process is for YOUR internal planning only. Your final response must ONLY contain the executable JavaScript code - no explanations, no comments, no step descriptions.

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

2. **Labels** (MUST be draggable for user convenience):
   - ALWAYS make labels draggable by setting label attributes
   - Format: {name: 'A', label: {offset: [-15, -15], useMathJax: false, anchorX: 'middle', anchorY: 'middle'}}
   - Note: JSXGraph labels with anchorX/anchorY set are automatically draggable
   - This allows users to reposition labels if they overlap or need adjustment
   
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
- board.create('otherintersection', [obj1, obj2, existingPoint], {name: 'M'}) - OTHER intersection (NOT existingPoint) ⭐
- board.create('perpendicularpoint', [point, line], {name: 'H'}) - Foot of perpendicular ✅
- board.create('orthogonalprojection', [point, line], {name: 'H'}) - Same as perpendicularpoint ✅

WHEN TO USE 'otherintersection' vs 'intersection':
✅ Use 'otherintersection' when: Line passes through a point already on the circle, and you want the OTHER intersection
   Example: altAD passes through A (on circle) → M = board.create('otherintersection', [altAD, circle, A], {...})
❌ Use 'intersection' with index when: Both intersection points are unknown
   Example: Two circles intersecting → P = board.create('intersection', [circle1, circle2, 0], {...})

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

🔧 CRITICAL CONSTRUCTION PATTERNS:

**Pattern 1: Orthocenter (Intersection of Altitudes)**
NEVER create segments AD, BE, CF before D, E, F exist!
Order: Triangle sides → Invisible lines → Perpendicular feet → Altitude lines → Find H → Draw segments

**Pattern 2: Altitude Extended to Circle (CRITICAL - USE OTHERINTERSECTION)**
When triangle ABC is inscribed in circle, and altitude from A meets circle at M:

❌ WRONG APPROACH (unreliable):
const altAD = board.create('line', [A, D], {...});
const M = board.create('intersection', [altAD, circle, 1], {...});  // May still return A!

✅ CORRECT APPROACH (reliable):
const altAD = board.create('line', [A, D], {...});
const M = board.create('otherintersection', [altAD, circle, A], {...});  // Explicitly excludes A!

WHY: 'otherintersection' tells JSXGraph "find the intersection that is NOT point A"
This guarantees M will be on the opposite side of the circle from A.

**Pattern 3: Circumcircle with Named Center**
If center O is mentioned, the circumcircle doesn't automatically place it!
Option A: Create O first, make it the actual center (harder)
Option B: Create circumcircle, hide auto-center, create labeled O nearby (easier for visualization)

**Pattern 4: Choosing Between 'intersection' vs 'otherintersection'**

USE 'otherintersection' when:
- One intersection point is already known/exists
- Example: Line through point A on circle → M = otherintersection([line, circle, A])

USE 'intersection' when:
- Both intersection points are unknown
- Example: Two circles intersecting → P = intersection([circle1, circle2, 0])
- index = 0: first point, index = 1: second point

📚 EXAMPLES:

Example 1 - Simple Triangle ABC (general, not special):
const A = board.create('point', [0, 0], {name: 'A', label: {offset: [-15, -15], cssClass: 'draggable-label'}, size: 3});
const B = board.create('point', [6, 0], {name: 'B', label: {offset: [10, -15], cssClass: 'draggable-label'}, size: 3});
const C = board.create('point', [3, 5], {name: 'C', label: {offset: [5, 10], cssClass: 'draggable-label'}, size: 3});
const AB = board.create('segment', [A, B], {strokeColor: '#2196f3', strokeWidth: 2});
const BC = board.create('segment', [B, C], {strokeColor: '#2196f3', strokeWidth: 2});
const CA = board.create('segment', [C, A], {strokeColor: '#2196f3', strokeWidth: 2});

Example 2 - Triangle ABC inscribed in circle O (O must be visible as labeled center!):
const A = board.create('point', [0, 0], {name: 'A', label: {offset: [-15, -15]}, size: 3});
const B = board.create('point', [6, 0], {name: 'B', label: {offset: [10, -15]}, size: 3});
const C = board.create('point', [3, 5], {name: 'C', label: {offset: [5, 10]}, size: 3});
const circle = board.create('circumcircle', [A, B, C], {strokeColor: '#9c27b0', strokeWidth: 2, fillColor: '#f3e5f5', fillOpacity: 0.1, center: {visible: true}});
const O = circle.center;
O.setName('O');
O.setAttribute({size: 3, fillColor: '#9c27b0', withLabel: true});
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

Example 5 - Triangle ABC with THREE altitudes meeting at orthocenter H (CORRECT CONSTRUCTION ORDER):
// Step 1: Create triangle vertices
const A = board.create('point', [0, 0], {name: 'A', label: {offset: [-15, -15]}, size: 3});
const B = board.create('point', [6, 0], {name: 'B', label: {offset: [10, -15]}, size: 3});
const C = board.create('point', [3, 5], {name: 'C', label: {offset: [5, 10]}, size: 3});

// Step 2: Draw triangle sides
const AB = board.create('segment', [A, B], {strokeColor: '#2196f3', strokeWidth: 2});
const BC = board.create('segment', [B, C], {strokeColor: '#2196f3', strokeWidth: 2});
const CA = board.create('segment', [C, A], {strokeColor: '#2196f3', strokeWidth: 2});

// Step 3: Create invisible lines for altitude construction
const lineAB = board.create('line', [A, B], {visible: false});
const lineBC = board.create('line', [B, C], {visible: false});
const lineCA = board.create('line', [C, A], {visible: false});

// Step 4: Create feet of altitudes (perpendicular points)
const D = board.create('perpendicularpoint', [A, lineBC], {name: 'D', label: {offset: [5, -15]}, size: 2, fillColor: '#ff5722'});
const E = board.create('perpendicularpoint', [B, lineCA], {name: 'E', label: {offset: [10, 5]}, size: 2, fillColor: '#ff5722'});
const F = board.create('perpendicularpoint', [C, lineAB], {name: 'F', label: {offset: [0, -15]}, size: 2, fillColor: '#ff5722'});

// Step 5: Create altitude LINES (not segments) for finding H
const altAD = board.create('line', [A, D], {visible: false});
const altBE = board.create('line', [B, E], {visible: false});

// Step 6: Find orthocenter H (intersection of two altitudes)
const H = board.create('intersection', [altAD, altBE, 0], {name: 'H', label: {offset: [8, 8]}, size: 3, fillColor: '#e91e63'});

// Step 7: Draw altitude segments
const segAD = board.create('segment', [A, D], {strokeColor: '#4caf50', strokeWidth: 2, dash: 2});
const segBE = board.create('segment', [B, E], {strokeColor: '#4caf50', strokeWidth: 2, dash: 2});
const segCF = board.create('segment', [C, F], {strokeColor: '#4caf50', strokeWidth: 2, dash: 2});

Example 6 - Triangle inscribed in circle, altitudes extended to M, N, P (PROPER intersection indices):
// Step 1: Create triangle vertices
const A = board.create('point', [0, 0], {name: 'A', label: {offset: [-15, -15]}, size: 3});
const B = board.create('point', [6, 0], {name: 'B', label: {offset: [10, -15]}, size: 3});
const C = board.create('point', [3, 5], {name: 'C', label: {offset: [5, 10]}, size: 3});

// Step 2: Create circumcircle (A, B, C are ON the circle)
const circle = board.create('circumcircle', [A, B, C], {strokeColor: '#9c27b0', strokeWidth: 2, fillColor: '#f3e5f5', fillOpacity: 0.1});

// Step 3: Draw triangle
const triangle = board.create('polygon', [A, B, C], {strokeColor: '#2196f3', strokeWidth: 2, fillColor: 'transparent'});

// Step 4: Create invisible lines for altitude construction
const lineAB = board.create('line', [A, B], {visible: false});
const lineBC = board.create('line', [B, C], {visible: false});
const lineCA = board.create('line', [C, A], {visible: false});

// Step 5: Create feet of altitudes
const D = board.create('perpendicularpoint', [A, lineBC], {name: 'D', label: {offset: [0, -15]}, size: 2, fillColor: '#ff5722'});
const E = board.create('perpendicularpoint', [B, lineCA], {name: 'E', label: {offset: [10, 5]}, size: 2, fillColor: '#ff5722'});
const F = board.create('perpendicularpoint', [C, lineAB], {name: 'F', label: {offset: [0, -15]}, size: 2, fillColor: '#ff5722'});

// Step 6: Create altitude LINES (infinite, for finding H and M, N, P)
const altAD = board.create('line', [A, D], {strokeColor: '#4caf50', strokeWidth: 1, dash: 2});
const altBE = board.create('line', [B, E], {strokeColor: '#4caf50', strokeWidth: 1, dash: 2});
const altCF = board.create('line', [C, F], {strokeColor: '#4caf50', strokeWidth: 1, dash: 2});

// Step 7: Find orthocenter H
const H = board.create('intersection', [altAD, altBE, 0], {name: 'H', label: {offset: [8, 8]}, size: 3, fillColor: '#e91e63'});

// Step 8: Find M, N, P where altitudes re-intersect the circle
// CRITICAL: Use 'otherintersection' to explicitly exclude the vertices A, B, C
const M = board.create('otherintersection', [altAD, circle, A], {name: 'M', label: {offset: [-15, 10]}, size: 2, fillColor: '#ff9800'});
const N = board.create('otherintersection', [altBE, circle, B], {name: 'N', label: {offset: [10, -10]}, size: 2, fillColor: '#ff9800'});
const P = board.create('otherintersection', [altCF, circle, C], {name: 'P', label: {offset: [0, 15]}, size: 2, fillColor: '#ff9800'});

// This guarantees M ≠ A, N ≠ B, P ≠ C (they will be on opposite sides of the circle)

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
