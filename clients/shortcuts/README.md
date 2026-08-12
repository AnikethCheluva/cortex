# LLM Wiki — iPhone Shortcuts

Zero-code capture into the wiki from Siri, the Action Button, the Lock Screen,
and the Share Sheet — built on the same HTTP API as everything else
(`web/API.md`). Each shortcut is one **Get Contents of URL** action, so there's
nothing to install beyond Apple's built-in Shortcuts app.

> Replace `https://YOUR-APP.vercel.app` below with your deployed origin.
> If you've set `API_TOKEN` on the server, add the Authorization header shown;
> otherwise omit it (reads/writes are open by default).

---

## 1. "Jot to Wiki" — append a line to today's note

Shortcuts app → **+** → Add Action → search **Get Contents of URL**, then:

1. **URL:** `https://YOUR-APP.vercel.app/api/jot`
2. Tap **Show More** on the action:
   - **Method:** `POST`
   - **Headers:**
     - `Content-Type` = `application/json`
     - `Authorization` = `Bearer YOUR_API_TOKEN`  *(only if the server sets `API_TOKEN`)*
   - **Request Body:** `JSON`
     - add field — key `text`, type **Text**, value = **Shortcut Input**
       (tap the field → *Select Variable* → *Shortcut Input*).

That's the whole shortcut. Rename it **"Jot to Wiki"** and pick an icon/color.

**Make it accept text from anywhere** (top of the shortcut, the ⓘ settings):
- **Show in Share Sheet** → ON, Accepted Types: **Text**. Now selected text in
  any app → Share → *Jot to Wiki*.
- **Use with Siri / Add to Siri**: say *"Jot to Wiki"* → Siri asks for the text
  → it posts. (For a spoken prompt, add a **Ask for Input** action first and feed
  that into the body instead of Shortcut Input.)

---

## 2. "Add Wiki Task" — create a task

New shortcut → **Ask for Input** (Prompt: "Task?", type Text) → **Get Contents of URL**:

1. **URL:** `https://YOUR-APP.vercel.app/api/tasks`
2. **Method:** `POST`
3. **Headers:** same as above (`Content-Type`, and `Authorization` if used).
4. **Request Body:** `JSON`
   - `title` (Text) = **Provided Input** (the Ask-for-Input result)
   - `priority` (Text) = `medium`  *(optional; `high` / `medium` / `low`)*
   - `project` (Text) = `unsorted`  *(optional)*

Rename **"Add Wiki Task"**. Add to Siri for *"Add wiki task"*.

---

## 3. Wire it to hardware

Once the shortcuts exist, iOS surfaces them everywhere:

- **Action Button** (iPhone 15 Pro+): Settings → Action Button → **Shortcut** →
  *Jot to Wiki*. One press → capture.
- **Lock Screen / Home Screen**: long-press → Customize/Edit → add a
  **Shortcuts** widget → pick *Jot to Wiki*. One tap from the Lock Screen.
- **Back Tap**: Settings → Accessibility → Touch → Back Tap → Double Tap →
  *Jot to Wiki*.
- **Siri**: "Hey Siri, Jot to Wiki."

---

## Verify from the Mac first (optional)

```bash
curl -X POST https://YOUR-APP.vercel.app/api/jot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{"text":"hello from curl"}'
# → {"ok":true,"stem":"7-24-26"}
```

If that returns `ok`, the shortcut will too — it's the same request.
A `401` means `API_TOKEN` is set server-side and the header is missing/wrong.
