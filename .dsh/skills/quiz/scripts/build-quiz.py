#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build a JLPT quiz HTML page from quiz JSON + the fixed template.

Usage:
    python build-quiz.py <quiz.json> <output.html>

The quiz JSON follows this schema (see SKILL.md for the full spec):

    {
      "title": "动词ば形",
      "level": "N4",
      "subtitle": "基于笔记 notes/raw/n4/22.ば形.md",
      "summary": ["知识点速览，一条一句"],
      "questions": [
        {
          "stem": "题干，用 __ 表示挖空处",
          "options": ["A", "B", "C", "D"],
          "answer": 0,
          "explain": "一句话讲解：核心知识点",
          "tip": "一句话做题技巧（可选）"
        }
      ]
    }

The script reads the fixed template that sits beside it, replaces the
__QUIZ_DATA__ placeholder with the JSON, and writes the output file. JSON is
inlined with json.dumps so it needs no manual HTML escaping.
"""
import argparse
import json
import os
import sys

TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "..", "assets", "quiz-template.html")
PLACEHOLDER = "__QUIZ_DATA__"


def fail(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description="Build a JLPT quiz HTML page.")
    ap.add_argument("quiz_json", help="path to the quiz JSON file")
    ap.add_argument("output", help="path to the output .html file")
    args = ap.parse_args()

    with open(args.quiz_json, "r", encoding="utf-8-sig") as fh:
        quiz = json.load(fh)

    for field in ("title", "level", "questions"):
        if field not in quiz:
            fail(f"quiz JSON is missing required field: {field}")
    if not quiz["questions"]:
        fail("quiz JSON has no questions")
    for i, q in enumerate(quiz["questions"]):
        for field in ("stem", "options", "answer", "explain"):
            if field not in q:
                fail(f"question {i} is missing required field: {field}")
        if len(q["options"]) != 4:
            fail(f"question {i} must have exactly 4 options")
        if not (0 <= q["answer"] < len(q["options"])):
            fail(f"question {i} answer index out of range")
    quiz.setdefault("subtitle", "")
    quiz.setdefault("summary", [])

    if not os.path.exists(TEMPLATE):
        fail(f"template not found: {TEMPLATE}")
    with open(TEMPLATE, "r", encoding="utf-8") as fh:
        html = fh.read()
    if PLACEHOLDER not in html:
        fail(f"template is missing the {PLACEHOLDER} placeholder")

    data = json.dumps(quiz, ensure_ascii=False, separators=(",", ":"))
    html = html.replace(PLACEHOLDER, data)

    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(html)

    print(f"wrote {args.output} ({len(quiz['questions'])} questions)")


if __name__ == "__main__":
    main()
