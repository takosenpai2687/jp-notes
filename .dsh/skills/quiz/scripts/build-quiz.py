#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build a JLPT quiz HTML page from quiz JSON + the fixed template.

The quiz JSON is the source of truth. The LLM only ever writes JSON; this
script deterministically interpolates it into the fixed template, so no HTML
is edited by hand and no tokens are spent re-emitting markup.

Usage:
    python build-quiz.py <quiz.json> <output.html>       # build
    python build-quiz.py --check <quiz.json> <output.html>  # verify alignment

Version marker
--------------
Every build stamps a ``version`` into BOTH the JSON and the HTML. It is a
short SHA-1 of the quiz content (title, level, no, subtitle, summary,
questions — keys sorted, so key order in the file does not matter). Editing
the questions changes the version, so a later ``--check`` reports the HTML as
out of sync until it is rebuilt.

Quiz JSON schema (see SKILL.md for the full spec):

    {
      "title": "动词ば形",
      "level": "N4",
      "no": "22",
      "subtitle": "基于笔记 notes/raw/n4/22.ば形.md",
      "summary": ["知识点速览，一条一句"],
      "questions": [
        {
          "stem": "题干，用 ＿＿＿ 表示挖空处",
          "options": ["A", "B", "C", "D"],
          "answer": 0,
          "explain": "一句话讲解：核心知识点",
          "translation": "整句中文翻译",
          "tip": "一句话做题技巧（可选）"
        }
      ]
    }
"""
import argparse
import hashlib
import json
import os
import re
import sys

TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "..", "assets", "quiz-template.html")
PLACEHOLDER = "__QUIZ_DATA__"
VERSION_PLACEHOLDER = "__QUIZ_VERSION__"
VERSION_FIELDS = ("title", "level", "no", "subtitle", "summary", "questions")
VERSION_RE = re.compile(r'name="quiz-version"\s+content="([0-9a-f]+)"')


def fail(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def version_of(quiz):
    """Deterministic content hash over the stable quiz fields."""
    content = {k: quiz[k] for k in VERSION_FIELDS if k in quiz}
    blob = json.dumps(content, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":")).encode("utf-8")
    return hashlib.sha1(blob).hexdigest()[:12]


def load_quiz(path):
    with open(path, "r", encoding="utf-8-sig") as fh:
        return json.load(fh)


def validate(quiz):
    for field in ("title", "level", "no", "questions"):
        if field not in quiz:
            fail(f"quiz JSON is missing required field: {field}")
    if not quiz["questions"]:
        fail("quiz JSON has no questions")
    for i, q in enumerate(quiz["questions"]):
        for field in ("stem", "options", "answer", "explain", "translation"):
            if field not in q:
                fail(f"question {i} is missing required field: {field}")
        if len(q["options"]) != 4:
            fail(f"question {i} must have exactly 4 options")
        if not (0 <= q["answer"] < len(q["options"])):
            fail(f"question {i} answer index out of range")
    quiz.setdefault("subtitle", "")
    quiz.setdefault("summary", [])


def build(args):
    quiz = load_quiz(args.quiz_json)
    validate(quiz)
    version = version_of(quiz)
    quiz["version"] = version

    with open(TEMPLATE, "r", encoding="utf-8") as fh:
        html = fh.read()
    if PLACEHOLDER not in html:
        fail(f"template is missing the {PLACEHOLDER} placeholder")

    data = json.dumps(quiz, ensure_ascii=False, separators=(",", ":"))
    html = html.replace(PLACEHOLDER, data)
    html = html.replace(VERSION_PLACEHOLDER, version)

    # Persist the version into the JSON source too, so JSON and HTML both carry it.
    with open(args.quiz_json, "w", encoding="utf-8") as fh:
        json.dump(quiz, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(html)

    print(f"wrote {args.output} ({len(quiz['questions'])} questions) "
          f"version={version}")


def check(args):
    quiz = load_quiz(args.quiz_json)
    expected = version_of(quiz)
    json_version = quiz.get("version")
    with open(args.output, "r", encoding="utf-8") as fh:
        html = fh.read()
    m = VERSION_RE.search(html)
    html_version = m.group(1) if m else None

    problems = []
    if json_version != expected:
        problems.append(f"JSON version {json_version!r} != computed {expected!r}")
    if html_version != expected:
        problems.append(f"HTML version {html_version!r} != computed {expected!r}")

    if problems:
        print("OUT OF SYNC")
        for p in problems:
            print("  - " + p)
        sys.exit(1)
    print(f"IN SYNC  version={expected}")


def main():
    ap = argparse.ArgumentParser(
        description="Build a JLPT quiz HTML from quiz JSON, or check alignment.")
    ap.add_argument("--check", action="store_true",
                    help="verify the HTML is in sync with the JSON")
    ap.add_argument("quiz_json", help="path to the quiz JSON file")
    ap.add_argument("output", help="path to the output .html file")
    args = ap.parse_args()

    if not os.path.exists(TEMPLATE):
        fail(f"template not found: {TEMPLATE}")
    if args.check:
        check(args)
    else:
        build(args)


if __name__ == "__main__":
    main()
