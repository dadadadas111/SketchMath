import dotenv from "dotenv";
import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post("/api/gemini", async (req, res) => {
    const { input } = req.body;
    if (!input) return res.status(400).send({ error: "No input provided." });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(`
You are a geometry assistant.

Given a high school geometry problem, output **ONLY** valid JavaScript code that draws the diagram using the JSXGraph library.

## Rules to Follow:
- Do **NOT** initialize the board (assume it's already created as 'board')
- Use only:
  - board.create('point', [x, y], {name: 'A'})
  - board.create('segment', [A, B])
  - board.create('line', [A, B])
  - board.create('midpoint', [A, B], {name: 'M'})
  - board.create('perpendicular', [line, point])
  - board.create('intersection', [line1, line2], {name: 'X'})
- **Do not use** raw coordinates like [x1, y1, x2, y2] for lines
- **Do not** include global options like JXG.Options
- Do not add any comments, text, or explanations. Return only valid JavaScript code.
- Based on the problem Use segment Instead of line Where Appropriate. I prefer dont make the line longer than needed.

## Example Output:
// Basic points
var A = board.create('point', [0, 0], {name: 'A'});
var B = board.create('point', [6, 0], {name: 'B'});
var C = board.create('point', [2, 5], {name: 'C'});

// Triangle sides
var AB = board.create('segment', [A, B], {name: 'AB'});
var BC = board.create('segment', [B, C], {name: 'BC'});
var CA = board.create('segment', [C, A], {name: 'CA'});

// Full lines (for construction, hidden)
var lineBC = board.create('line', [B, C], {visible: false});
var lineAC = board.create('line', [A, C], {visible: false});
var lineAB = board.create('line', [A, B], {visible: false});

// Perpendicular from A to BC
var perpAH = board.create('perpendicular', [lineBC, A], {visible: false});
var H = board.create('intersection', [perpAH, lineBC, 0], {name: 'H'});
var heightAH = board.create('segment', [A, H], {color: 'blue', name: 'AH'});

// Midpoint of BC
var M = board.create('midpoint', [B, C], {name: 'M'});

// Circle centered at A passing through C
var circleAC = board.create('circle', [A, C], {name: 'CircleAC'});

// Intersection of circle with line AB (2 points)
var int1 = board.create('intersection', [circleAC, lineAB, 0], {name: 'D'});
var int2 = board.create('intersection', [circleAC, lineAB, 1], {name: 'E'});

// Tangents from external point P to a circle
var O = board.create('point', [-4, 0], {name: 'O'});
var P = board.create('point', [1, 5], {name: 'P'});
var circleO = board.create('circle', [O, 3]);

var OP = board.create('line', [O, P], {visible: false});
var midOP = board.create('midpoint', [O, P], {visible: false});
var circleAux = board.create('circle', [midOP, O], {visible: false});

var T1 = board.create('intersection', [circleO, circleAux, 0], {name: 'T1'});
var T2 = board.create('intersection', [circleO, circleAux, 1], {name: 'T2'});

var tangent1 = board.create('segment', [P, T1], {color: 'green'});
var tangent2 = board.create('segment', [P, T2], {color: 'green'});


Problem:
"${input}"

`);
        const text = result.response.text();
        console.log("Gemini response:", text);
        // gemini are stupid , so we need to remove ```json and ``` before actually parsing it
        let js = text.replace(/```(js|javascript)?|```/g, "").trim();
        res.send({ result: js });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "AI processing failed. Please try again or simplify your input." });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
