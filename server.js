import dotenv from "dotenv";
import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// app.use(cors());
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post("/api/gemini", async (req, res) => {
    const { input } = req.body;
    if (!input) return res.status(400).send({ error: "No input provided." });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(`
You are a geometry diagram assistant.

Given the following math problem:

"${input}"

Extract all drawable geometric elements (points, lines, circles) and return a JSON structure like this:

{
  "points": [ { "label": "A", "x": 100, "y": 100 }, ... ],
  "lines": [ { "from": "A", "to": "B" }, ... ],
  "circles": [ { "center": "O", "radius": 50 }, ... ]
}

If positions aren’t given, estimate them clearly. Do not explain anything. 
Just return JSON. And the result should be valid and can be parsed JSON.
dont need the markdown code block.

`);
        const text = result.response.text();
        // gemini are stupid , so we need to remove ```json and ``` before actually parsing it
        const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        console.log("Gemini response:", jsonText);
        res.send({ result: jsonText });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Gemini failed." });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
