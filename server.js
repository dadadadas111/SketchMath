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

Be sure to draw like the description. Do not explain anything. 
Just return JSON. And the result should be valid and can be parsed JSON.
dont need the markdown code block. and the diagram drawn from response should be nicely formatted.

`);
        const text = result.response.text();
        // gemini are stupid , so we need to remove ```json and ``` before actually parsing it
        // let jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let jsonText = `{
  "points": [
    { "label": "A", "x": 100, "y": 300 },
    { "label": "B", "x": 100, "y": 200 },
    { "label": "C", "x": 250, "y": 300 },
    { "label": "H", "x": 175, "y": 250 },
    { "label": "D", "x": 100, "y": 120 },
    { "label": "E", "x": 230, "y": 300 },
    { "label": "F", "x": 200, "y": 250 }
  ],
  "lines": [
    { "from": "A", "to": "B" },
    { "from": "A", "to": "C" },
    { "from": "B", "to": "C" },
    { "from": "A", "to": "H" },
    { "from": "D", "to": "E" },
    { "from": "E", "to": "F" },
    { "from": "D", "to": "F" }
  ],
  "circles": []
}
`

        try {
            // Validate the JSON is parseable
            JSON.parse(jsonText);
        } catch (jsonError) {
            console.error("Invalid JSON response:", jsonText);
            return res.status(500).send({ error: "Invalid response format from AI model." });
        }

        // console.log("Gemini response:", jsonText);
        res.send({ result: jsonText });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "AI processing failed. Please try again or simplify your input." });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
