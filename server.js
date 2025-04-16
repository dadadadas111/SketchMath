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
var A = board.create('point', [0, 0], {name: 'A'});
var B = board.create('point', [5, 0], {name: 'B'});
var C = board.create('point', [0, 4], {name: 'C'});

var AB = board.create('segment', [A, B]);
var AC = board.create('segment', [A, C]);
var BC = board.create('segment', [B, C]);

// Create a hidden full line BC for construction
var lineBC = board.create('line', [B, C], {visible: false});

// Construct the perpendicular from A to BC (hidden)
var perpAH = board.create('perpendicular', [lineBC, A], {visible: false});

// Intersection of perpendicular and BC gives point H
var H = board.create('intersection', [perpAH, BC], {name: 'H'});

// Only draw the actual height segment
var AH = board.create('segment', [A, H]);

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
