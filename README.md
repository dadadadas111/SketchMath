# SketchMath v2

AI-powered interactive geometry diagram generator. Describe a geometry problem in natural language (Vietnamese or English) and get an interactive GeoGebra construction.

## How it works

```
User describes geometry problem (natural language)
  → Claude AI generates declarative GeoGebra commands
    → Client-side compiler validates & executes commands
      → GeoGebra renders interactive diagram (drag, zoom, measure)
```

The key insight: the AI only declares **what** to construct (e.g., `C = Intersect(circle1, circle2, 1)`), and GeoGebra's constraint solver figures out **where** everything goes. No manual coordinate computation for derived points.

## Features

- **Natural language input** — Vietnamese and English
- **GeoGebra rendering** — interactive diagrams with drag, zoom, constraint preservation
- **Auto-retry** — if construction fails, AI gets error feedback and retries (up to 3×)
- **Rerender** — reset canvas and re-execute last commands cleanly
- **Continue mode** — build on previous constructions in conversation
- **Export PNG** — download diagram as image
- **Dark/light theme**
- **i18n** — Vietnamese and English UI

## Quick start

```bash
# Clone
git clone https://github.com/dadadadas111/sketchmath-v2.git
cd sketchmath-v2

# Configure
cp .env.example .env
# Edit .env with your AI proxy credentials

# Install & run
npm install
npm start
# Open http://localhost:3000
```

## Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `AI_BASE_URL` | OpenAI-compatible API base URL | `https://api.openai.com/v1` |
| `AI_API_KEY` | API key | `sk-...` |
| `AI_MODEL` | Model identifier | `claude-sonnet-4-5-20250929` |
| `PORT` | Server port (optional) | `3000` |

Any OpenAI-compatible proxy works (LiteLLM, OpenRouter, etc).

## Architecture

```
sketchmath-v2/
├── server.js                    # Express server + AI endpoint
├── public/
│   ├── index.html               # GeoGebra embed + chat UI
│   ├── style.css                # Dark-first responsive theme
│   ├── script.js                # Frontend: chat, retry, rerender, export
│   ├── construction-compiler.js # Validate, execute, verify GeoGebra commands
│   └── lang.json                # i18n strings (vi + en)
├── .env.example
└── package.json
```

**Zero dependencies beyond Express + OpenAI SDK.** No build step, no database, no bundler.

## Example

Input:
> Cho đường tròn (O) đường kính AB = 6cm. Lấy điểm C trên đường tròn sao cho AC = 3cm.

AI output:
```
A = (0, 0)
B = (6, 0)
O = Midpoint(A, B)
c1 = Circle(O, A)
c2 = Circle(A, 3)
C = Intersect(c1, c2, 1)
Segment(A, B)
Segment(A, C)
Segment(B, C)
```

Result: Interactive GeoGebra diagram with all points draggable while maintaining constraints.

## License

MIT
