---
name: quiz
description: Generate an interactive, animated JLPT-style grammar quiz (HTML) from a note or grammar point found under notes/, and open it.
whenToUse: The user asks for quiz questions, practice, 考题, 出题, 测试, or invokes /quiz.
---

# Quiz

Turn a note (or a grammar point) under `notes/` into an interactive, animated
JLPT-style multiple-choice quiz, delivered as one self-contained HTML file.
The HTML template is fixed — the only thing that changes is the quiz JSON.

## Workflow

1. **Locate the note.** Resolve the topic the user named against `notes/**/*.md`.
   - Match by keyword in the filename or the note's title (e.g. `/quiz 动词ば形`
     → `notes/raw/n4/22.ば形.md`, whose `#` heading is 动词ば形).
   - If several notes match, pick the most specific and say which you used.
   - If none match, say what you looked for and ask the user to confirm the topic;
     do not invent a note path.
   - The folder (`n4` / `n5`) fixes the JLPT level: `n4` → N4, `n5` → N5.

2. **Read and summarize.** Read the matched note. Extract 4–7 knowledge points as
   one-line Chinese items for the `summary` array — the conjugation rules, the
   meanings, and the fixed patterns the note teaches.

3. **Write questions.** Produce 6 questions (4 for a very short note). Each follows
   the JLPT grammar-section shape: one sentence with a `＿＿＿` blank and four
   options. Rules:
   - One correct answer; distractor options must be the kind of mistake the note
     itself warns about (wrong conjugation, wrong particle, right form in the
     wrong context), not random Japanese.
   - Cover the note's core points first, then its sentence patterns (the
     「相关句型」/「句型」sections). Do not test trivia the note never mentions.
   - Level-appropriate: N4 questions use N4 vocabulary and N4 grammar, N5 uses N5.
   - `answer` is the zero-based index of the correct option.
   - `explain` is ONE Chinese sentence: the core knowledge point. `tip` is ONE
     optional sentence of test-taking skill. Keep both short — no deep detail.

4. **Self-review before building (required).** Re-read every question you wrote and
   check, one by one, that:
   - the marked answer is actually correct — re-derive the conjugation or usage
     against the note, don't trust your first pass;
   - every other option is genuinely wrong for the blank (no accidental second
     correct answer, no option that reads as a typo);
   - the blank sits where the tested point is, and the sentence stays natural
     without the blank;
   - `explain` names the same rule the `answer` uses, and `tip` does not
     contradict it;
   - the level matches the note's folder (n4→N4, n5→N5).
   Fix anything that fails before building; never ship a question you could not
   justify.

5. **Build the HTML.** Write the quiz JSON to a temp file (e.g. `quiz/_tmp.json`),
   then run the bundled script against the fixed template. Use the bundled Python:

   ```powershell
   $py = '<python>'; & $py "<skill-dir>\scripts\build-quiz.py" <quiz.json> <output.html>
   ```

   `<skill-dir>` is this skill's base directory; `<python>` is the bundled Python
   from `load_workspace_dependencies`. Output path: `quiz/<topic>.html`
   (topic = the note's title or the user's word, e.g. `quiz/动词ば形.html`).

6. **Report.** Give the output path as a link, the question count, and one line
   listing the knowledge points you tested. Do not open a server; the HTML is a
   single static file the user opens directly.

## Quiz JSON schema

```json
{
  "title": "动词ば形",
  "level": "N4",
  "subtitle": "基于笔记 notes/raw/n4/22.ば形.md",
  "summary": ["ば形：一类 う段→え段＋ば，二类 去る＋れば，三类 する→すれば／来る→くれば"],
  "questions": [
    {
      "stem": "春に＿＿＿、桜が咲きます。",
      "options": ["なれば", "なると", "なるたら", "なって"],
      "answer": 0,
      "explain": "一类动词なる的ば形是「う段→え段＋ば」，所以是なれば。",
      "tip": "看到「ば形」先想：一类变え段，二类去る加れば。"
    }
  ]
}
```

- `stem` uses `＿＿＿` (or `＿`) to mark the blank; the template renders it as an
  underlined gap.
- `options` is always exactly four strings.
- `explain` is required; `tip` is optional. `summary`, `subtitle` are optional
  top-level fields.

## Fixed template

The template lives at `assets/quiz-template.html` in this skill bundle. It is
self-contained (no network, no build step) and already implements: a knowledge
summary list, one question per card with staggered rise-in animation, option
click feedback (green correct / red wrong with a shake), the explanation reveal,
a progress bar, and a score ring at the end. **Do not edit the template for a
specific quiz** — all variation goes through the quiz JSON. Only touch the
template to fix the shared presentation.

## Rules

- Never invent a note or a grammar point that is not in the matched note. If the
  note is thin, write fewer questions instead of padding with off-topic items.
- Keep the whole quiz in the note's own language register: Chinese explanations,
  Japanese stems/options.
- Delete the temp JSON after a successful build so only the `.html` remains.
