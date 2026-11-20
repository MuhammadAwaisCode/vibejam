# AskSE - SE Department Help Desk (CodeQuest 2026 Vibe Jam)

AskSE is a help-desk chatbot that answers **only** from the department FAQ, cites the FAQ ids it used (e.g. `[FAQ-03]`), and says so when it cannot find an answer. It replies in English or Roman Urdu.

## Team
- **Entry ID:** YOUR-ENTRY-ID
- **Team name:** YOUR TEAM NAME
- **Members:** Muhammad Awais, Member 2

## How to run
1. Install Node.js 18 or newer.
2. `npm install`
3. Copy `.env.example` to `.env` and paste your API key (`GEMINI_API_KEY`, or set `LLM_PROVIDER=groq` and `GROQ_API_KEY`).
4. `npm start`
5. Open http://localhost:3000

The key is read from `.env` on every request, so you can change it without restarting. `.env` is listed in `.gitignore`.

## API and model
- LLM API: Google Gemini API (default). Groq and OpenAI-compatible APIs are also supported through `LLM_PROVIDER`.
- Model: `gemini-2.5-flash` (override with `GEMINI_MODEL`).

## Tools used
- Claude (Anthropic) - AI coding assistant used to plan, generate and fix the app.

## How it works
- `server.js` receives the question and the current FAQ list, builds the app's own AI prompt, calls the LLM, and checks the JSON reply (`found`, `answer`, `faq_ids`) in code. An unknown or empty id list is treated as not found.
- `public/app.js` keeps FAQs, chat history and stats in browser storage. Admin PIN: 2026.
- Prompt-injection requests get the not-found reply. AI failures show an "AI service unavailable" notice without losing the chat or typed text.
