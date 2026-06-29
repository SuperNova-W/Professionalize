# Gmail Reply Orb

Local MVP for a Grammarly-style Gmail reply assistant.

It adds a small floating orb in Gmail. Click it to open a compact response composer that reads the visible Gmail thread, lets you describe the reply you want, tunes tone with sliders, and generates a draft through a local LLM server.

## What Works

- Floating orb on `mail.google.com`
- Reads the currently visible Gmail thread from the page
- User instruction box, tone buttons, and sliders for:
  - Professional
  - Funny
  - Concise
  - Warm
- `Professionalize` quick mode
- Inserts generated text into the active Gmail compose/reply box
- Local Express server that calls OpenAI when `OPENAI_API_KEY` is set
- Mock fallback when no API key is present

## Run Locally

1. Start the local server:

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

2. Optional: add your OpenAI key to `server/.env`.

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
PORT=3789
```

3. Load the extension in Chrome:

- Open `chrome://extensions`
- Enable Developer mode
- Click `Load unpacked`
- Select the `extension` folder

4. Open Gmail, click the blue orb in the bottom-right corner, and generate a reply.

## Notes

This MVP reads only the Gmail DOM in the currently open tab. It does not use the Gmail API, store emails, or send messages. The local server receives the visible thread text and the instructions you type.


