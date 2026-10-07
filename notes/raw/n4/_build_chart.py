# -*- coding: utf-8 -*-
"""Render the N4 conjecture summary (ようだ/みたいだ/そうだ/らしい) as one chart."""
import os
from PIL import Image, ImageDraw, ImageFont

W = 2100
M = 56
RIGHT = W - M
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "0.推量四件套记忆图.png")

JP = r"C:\Windows\Fonts\meiryo.ttc"
JPB = r"C:\Windows\Fonts\meiryob.ttc"
CN = r"C:\Windows\Fonts\msyh.ttc"
CNB = r"C:\Windows\Fonts\msyhbd.ttc"

INK = "#1b1b1f"
MUTED = "#6b6f76"
LINE = "#ccd2d9"
BG_SOFT = "#f7f8fa"
BG_HEAD = "#eef1f5"
A = ["#2f6fb2", "#c2603f", "#3f8f63", "#8a5aa8"]  # ようだ / みたいだ / そうだ / らしい
WARN = "#b03030"

_cache = {}
def f(role, size):
    key = (role, size)
    if key not in _cache:
        _cache[key] = ImageFont.truetype({"jp": JP, "jpb": JPB, "cn": CN, "cnb": CNB}[role], size)
    return _cache[key]

img = Image.new("RGB", (W, 9000), "white")
d = ImageDraw.Draw(img)
y = M


def runs(x, yy, parts, size=25, color=INK):
    """Draw a sequence of text runs; returns the x after the last run."""
    for p in parts:
        if isinstance(p, str):
            t, role, col = p, "cn", color
        elif len(p) == 2:
            t, role = p
            col = color
        else:
            t, role, col = p
        d.text((x, yy), t, font=f(role, size), fill=col)
        x += d.textlength(t, font=f(role, size))
    return x


def para(parts, size=25, gap=12, x=M, color=INK):
    global y
    runs(x, y, parts, size, color)
    y += size + gap


def rule(color=LINE, pad=20, thick=2):
    global y
    y += pad
    d.line([(M, y), (RIGHT, y)], fill=color, width=thick)
    y += pad


def h1(text, sub):
    global y
    d.text((M, y), text, font=f("cnb", 62), fill=INK)
    y += 88
    d.text((M, y), sub, font=f("cn", 27), fill=MUTED)
    y += 50


def h2(num, text, tail=None):
    global y
    d.rounded_rectangle([M, y + 4, M + 52, y + 46], 8, fill=INK)
    d.text((M + 14, y + 8), num, font=f("cnb", 26), fill="white")
    x = runs(M + 68, y + 6, [(text, "cnb", INK)], 34)
    if tail:
        runs(x + 16, y + 16, tail, 25, MUTED)
    y += 62


class Table:
    def __init__(self, xs, head_h=54, row_h=48):
        self.xs, self.head_h, self.row_h = xs, head_h, row_h

    def header(self, cells):
        global y
        top = y
        d.rectangle([M - 4, top, RIGHT + 4, top + self.head_h], fill=BG_HEAD)
        for i, c in enumerate(cells):
            runs(self.xs[i] + 16, top + 14, [(c, "cnb", INK)], 26)
        y = top + self.head_h
        d.line([(M - 4, y), (RIGHT + 4, y)], fill=LINE, width=2)

    def row(self, cells, fill=None, size=25):
        global y
        top = y
        if fill:
            d.rectangle([M - 4, top, RIGHT + 4, top + self.row_h], fill=fill)
        for i, c in enumerate(cells):
            if c is None:
                continue
            # a cell may hold several stacked lines, split on a "\x00line" marker
            raw = [(c, "cn", INK)] if isinstance(c, str) else c
            lines, cur = [], []
            for part in raw:
                if part[0] == "\x00line":
                    lines.append(cur)
                    cur = []
                else:
                    cur.append(part)
            lines.append(cur)
            lh = size + 6
            y0 = top + (self.row_h - (len(lines) * lh - 6)) // 2 - 4
            for k, ln in enumerate(lines):
                if ln:
                    runs(self.xs[i] + 16, y0 + k * lh, ln, size)
        y = top + self.row_h
        d.line([(M - 4, y), (RIGHT + 4, y)], fill="#e6e9ee", width=1)


def band(parts, size=25, fill="#fdf3ec", outline="#e8c3a8", pad=20):
    """A highlighted note strip sized to its text."""
    global y
    h = size + 2 * pad - 4
    d.rounded_rectangle([M, y, RIGHT, y + h], 10, fill=fill, outline=outline)
    runs(M + 24, y + pad - 4, parts, size)
    y += h + 16


# =====================================================================  TITLE
h1("N4 推量四件套 · 一页记忆图",
   "ようだ ／ みたいだ ／ そうだ ／ らしい —— 同样一句「好像」，先问信息来源，再问语气")

# ================================================================ 1. 横向对比
h2("1", "横向对比总表", "四个词一张表，先记这一层")
xs1 = [56, 180, 580, 880, 1170]
t1 = Table(xs1, head_h=56, row_h=60)
t1.header(["对比项", "ようだ", "みたいだ", "そうだ", "らしい"])
rows1 = [
    ("核心意义", [("比喩・例示・主观推测", "cn"), ("\x00line", "cn", INK), ("目的・内容（ように）", "cn")], [("比喩・例示・推测", "cn")],
     [("①传闻 ②样态", "cn")], [("①客观推测 ②传闻 ③典型特征", "cn")]),
    ("信息来源", "说话人自己的感觉或判断", "说话人自己的感觉或判断", "传闻＝转述；样态＝外观", "别人的话；对象固有特征"),
    ("主观性", "主观", "主观・更随意", "转述／外观印象", "客观"),
    ("语体", "书面、正式", "口语、日常", "不限", "不限，新闻常见"),
    ("名词接续", [("名词＋", "cn"), ("の", "jp", A[0]), ("＋ようだ", "cn")],
     [("名词＋", "cn"), ("直接", "jp", A[1]), ("＋みたいだ", "cn")],
     [("名词＋", "cn"), ("だ", "jp", A[2]), ("＋そうだ", "cn")],
     [("名词＋", "cn"), ("直接", "jp", A[3]), ("＋らしい", "cn")]),
    ("连体形", [("ような", "jp", A[0]), ("＋名词", "cn")], [("みたいな", "jp", A[1]), ("＋名词", "cn")],
     [("そうな", "jp", A[2]), ("＋名词（样态）", "cn")], [("らしい", "jp", A[3]), ("＋名词", "cn")]),
    ("连用形", [("ように", "jp", A[0]), ("＋动词", "cn")], [("みたいに", "jp", A[1]), ("＋动词", "cn")],
     [("そうに", "jp", A[2]), ("＋动词（样态）", "cn")], [("らしく", "jp", A[3]), ("＋动词", "cn")]),
    ("独有用法", "目的・内容（ように）", "无", [("样态：眼看就要……", "cn", A[2])], [("接尾词：很有……的样子", "cn", A[3])]),
    ("信号词", "まるで／どうも／なんだか", "まるで／なんだか", "～によると（传闻）", "～によると／話では"),
]
for i, r in enumerate(rows1):
    t1.row(list(r), fill=BG_SOFT if i % 2 == 0 else None)

y += 8
para([("第一个单元格是「看什么」，后面四列才是四个词的差异。", "cn", MUTED)], 24)
rule()

# ============================================================== 2. 接续对照
h2("2", "接续对照表", "最高频的一层：先看前接怎么变")
xs2 = [56, 172, 420, 640, 930, 1190]
t2 = Table(xs2, head_h=54, row_h=50)
t2.header(["前接", "ようだ", "みたいだ", "そうだ（传闻）", "そうだ（样态）", "らしい"])
rows2 = [
    ("名词", [("名词＋の", "cn"), ("＋よう", "jp", A[0])], [("名词＋直接", "cn"), ("＋みたい", "jp", A[1])],
     [("名词＋だ", "cn"), ("＋そう", "jp", A[2])], [("名词＋直接", "cn"), ("＋そう", "jp", A[2])],
     [("名词＋直接", "cn"), ("＋らしい", "jp", A[3])]),
    ("イ形容词", "高い＋ようだ", "高い＋みたいだ", "高い＋そうだ",
     [("高", "cn"), ("い→", "cn", WARN), ("高そうだ", "jp", A[2])], "高い＋らしい"),
    ("ナ形容词", [("静か", "cn"), ("な", "jp", A[0]), ("＋ようだ", "cn")], "静か＋みたいだ",
     [("静か", "cn"), ("だ", "jp", A[2]), ("＋そうだ", "cn")], "静か＋そうだ", "静か＋らしい"),
    ("动词", "降る＋ようだ", "降る＋みたいだ", "降る＋そうだ",
     [("降り", "jp", A[2]), ("＋そうだ", "cn")], "降る＋らしい"),
    ("否定", "降らないようだ", "降らないみたいだ", "降らないそうだ", "降りそうにない", "降らないらしい"),
    ("特殊", None, None, None,
     [("\x00line", "cn", INK), ("いい→", "cn"), ("よさ", "jp", A[2]), ("そう／ない→", "cn"), ("なさ", "jp", A[2]), ("そう", "cn")], None),
]
for i, r in enumerate(rows2):
    t2.row(list(r), fill=BG_SOFT if i % 2 == 0 else None, size=24)

rule()

# ========================================================= 3. 同一句怎么区分
h2("3", "同一句「好像要下雨」：依据完全不同", "意思重合时，靠信息来源区分")
for jp, cn, who, col in [
    ("雨が降るようだ。", "凭天色和感觉判断", "主观推测・书面", A[0]),
    ("雨が降るみたいだ。", "同上一句，日常口语说法", "主观推测・口语", A[1]),
    ("雨が降るそうだ。", "天气预报说……", "传闻・转述别人的话", A[2]),
    ("雨が降るらしい。", "听人说／消息来源可靠", "客观传闻", A[3]),
    ("雨が降りそうだ。", "乌云压顶，眼看就要下", "样态・外观", A[2]),
]:
    d.rounded_rectangle([M, y + 4, M + 8, y + 48], 4, fill=col)
    x = runs(M + 26, y + 6, [(jp, "jp", col)], 30)
    runs(x + 40, y + 14, [(cn, "cn", INK)], 25)
    runs(1500, y + 14, [(who, "cn", MUTED)], 25)
    y += 56

y += 6
para([("判定顺序：", "cnb", INK), ("① 是不是听来的？是 → そうだ（～によると）／らしい。", "cn"),
      ("② 不是 → 眼看就要发生用 そうだ（样态），心里觉得大概如此用 ようだ／みたいだ。", "cn")], 25)
rule()

# ================================================================ 4. 决策树
h2("4", "一张流程图定词", "从「信息来源」往下走，不会选错")

LW, RW = 620, 653
LX, RX = M, 1391
top = y
d.rounded_rectangle([700, top, 1400, top + 56], 10, fill=INK)
runs(766, top + 13, [("「好像」先问信息来源", "cnb", "white")], 28)

head_y = top + 104
mid = head_y - 26
d.line([(1050, top + 56), (1050, mid)], fill=LINE, width=3)
d.line([(LX + LW // 2, mid), (RX + RW // 2, mid)], fill=LINE, width=3)
for x in (LX + LW // 2, RX + RW // 2):
    d.line([(x, mid), (x, head_y)], fill=LINE, width=3)

for x, head, rows, accent in [
    (LX, "听来的、不是亲眼所见", [("そうだ（～によると）→ 转述别人的话", A[2]),
                          ("らしい → 客观传闻、常传消息", A[3])], "#f2f8f4"),
    (RX, "自己感知、自己判断", [("眼看就要发生 → そうだ【样态】", A[2]),
                        ("心里判断・书面 → ようだ", A[0]),
                        ("心里判断・口语 → みたいだ", A[1])], "#eef4fb"),
]:
    d.text((x + 4, head_y), head, font=f("cnb", 26), fill=INK)
    ry = head_y + 48
    for txt, col in rows:
        d.rounded_rectangle([x, ry, x + (LW if x == LX else RW), ry + 50], 8, fill="#ffffff", outline=col, width=2)
        runs(x + 18, ry + 11, [(txt, "cn", INK)], 24)
        ry += 62
    if x == LX:
        left_bottom = ry
    else:
        right_bottom = ry

y = max(left_bottom, right_bottom) + 10
band([("另有：名词＋らしい ＝ 典型特征（「很有……的样子」）—— 只有它有。", "cn")])
rule()

# ============================================================== 5. 两组同名
h2("5", "两组最容易混的「同名不同义」")

para([("■ ", "cn", A[2]), ("そうだ：传闻 vs 样态", "cnb", INK)], 30, gap=14)
t3 = Table([56, 224, 596], head_h=50, row_h=48)
t3.header(["", "传闻", "样态"])
for i, r in enumerate([
    ("接续", "简体句＋そうだ", [("词干＋そうだ", "cn"), ("（ます形／形容词词干）", "cn", MUTED)]),
    ("关键差别", [("前接", "cn"), ("完整句子", "cnb", WARN), ("（有终止形）", "cn")], [("前接", "cn"), ("词干", "cnb", WARN)]),
    ("例句", [("雨が", "jp"), ("降る", "jpb", A[2]), ("そうだ。", "jp")], [("雨が", "jp"), ("降り", "jpb", A[2]), ("そうだ。", "jp")]),
    ("否定", "降らないそうだ", "降りそうにない"),
    ("连体修饰", [("不能修饰名词", "cn", WARN)], "降りそうな空／おいしそうなケーキ"),
    ("意思", "听说", "眼看就要……／看起来"),
    ("信号词", "～によると", "今にも"),
]):
    t3.row(list(r), fill=BG_SOFT if i % 2 == 0 else None, size=24)

y += 10
band([("记法：", "cnb", "#a35320"),
      ("降るそう＝听来的（整句）；降りそう＝看出来的（词干）。形容词看有没有「い」：高いそう（听说）／高そう（看起来）。", "cn")])

para([("■ ", "cn", A[3]), ("らしい：接尾词 vs 推量助动词", "cnb", INK)], 30, gap=14)
t4 = Table([56, 305, 688], head_h=50, row_h=48)
t4.header(["", "接尾词らしい", "推量助动词らしい"])
for i, r in enumerate([
    ("接续", [("名词＋", "cn"), ("らしい", "jp", A[3])], [("简体句＋", "cn"), ("らしい", "jp", A[3])]),
    ("意思", "有……的典型特征、很像……的样子", "客观推测：好像、听说"),
    ("否定", [("名词＋", "cn"), ("らしくない", "jpb", A[3])], "简体句＋らしい（无特殊否定）"),
    ("例句", [("日本語", "jp"), ("らしい", "jpb", A[3]), ("日本語", "jp")], [("美味しい", "jp"), ("らしい", "jpb", A[3]), ("です", "jp")]),
    ("再加一例", [("この絵は子供", "jp"), ("らしくない", "jpb", A[3]), ("絵です", "jp")], [("風邪が流行っている", "jp"), ("らしい", "jpb", A[3])]),
]):
    t4.row(list(r), fill=BG_SOFT if i % 2 == 0 else None, size=24)

y += 10
band([("区别：", "cnb", "#6a3d84"),
      ("接尾词说的是「像不像那回事」，推量说的是「我判断事实大概如此」。", "cn")],
     fill="#f6f0fa", outline="#cdb3dd")
rule()

# ============================================================== 6. 常见坑
h2("6", "六个常见坑", "带 × 的是最容易被扣分的")
for i, (a, b) in enumerate([
    ("名词接续：", "子供のように／子供みたいに／元気だそうだ；不能写「元気そうだ」，那是样态！"),
    ("らしい是イ形容词型：", "らしい人（○）／らしいな人（×）"),
    ("ようだ独有的目的和内容：", "わかるように説明する（为了）；合格しますように（愿望的内容）"),
    ("传闻そうだ不能修饰名词：", "雨が降るそうだ（○）／雨が降るそうな日（×），修饰名词只能用样态"),
    ("样态そうだ的「即将」", "不必亲眼所见：木が倒れそうだ 也算外观判断"),
    ("特殊变形：", "いい→よさそう；ない→なさそう（不是「いそう」「ないそう」）"),
]):
    hot = i in (0, 1, 3, 5)
    col = WARN if hot else INK
    d.text((M, y), "×" if hot else "·", font=f("cnb", 26), fill=col)
    runs(M + 34, y, [(a, "cnb", col), (b, "cn")], 25)
    y += 46
rule()

# ================================================================== 7. 口诀
h2("7", "口诀与记忆锚点")
box_h = 34 * 2 + 76
d.rounded_rectangle([M, y, RIGHT, y + box_h], 12, fill=BG_SOFT, outline=LINE, width=2)
runs(M + 34, y + 30, [("听来 そう／らしい，看到 そう／らしい；心里想 ようだ／みたいだ。", "cnb", INK)], 34)
runs(M + 34, y + 30 + 50, [("名词加 ", "cn"), ("らしい", "jpb", A[3]), (" 最典型；名词加 ", "cn"),
                          ("の", "jpb", A[0]), (" 才接 ", "cn"), ("ようだ", "jpb", A[0]), ("。", "cn")], 34)
y += box_h + 24

t5 = Table([56, 190, 620, 1032], head_h=0, row_h=50)
for i, r in enumerate([
    ([("形式", "cnb", MUTED)], [("锚点", "cnb", MUTED)], [("易错提醒", "cnb", MUTED)], [("信号词", "cnb", MUTED)]),
    ([("ようだ", "jpb", A[0])], "名词加 の，书面正式，五义全能", "ように思う 比 と思う 更委婉", "まるで／どうも／なんだか"),
    ([("みたいだ", "jpb", A[1])], "和ようだ同义，直接接名词，口语随意", "没有目的・内容的用法", "まるで／なんだか"),
    ([("そうだ", "jpb", A[2])], "词干＝样态，整句＝传闻", "传闻不能修饰名词；いい→よさそう", "今にも／～によると"),
    ([("らしい", "jpb", A[3])], "客观传闻；名词＋らしい＝典型特征", "イ形容词型，无「らしいな」", "～によると／話では"),
]):
    t5.row(list(r), fill=BG_SOFT if i % 2 == 0 else None, size=24)

y += 18
para([("自测：", "cnb", INK),
      ("① 彼は来る____ 填 そうだ／らしい／ようだ，意思差在哪？  ② 美味し＋そうだ怎么变？和「美味しいそうだ」差在哪？", "cn")], 25)
para([("　　　", "cn"),
      ("③ 把「子供のように笑う」改成 みたいだ、らしい 两种说法。", "cn")], 25)
para([("完整讲解见同目录的 ", "cn"), ("0.N4四件套总结.md", "cnb", A[0]), ("。", "cn")], 24)

# ------------------------------------------------------------------ save
img = img.crop((0, 0, W, y + M))
d2 = ImageDraw.Draw(img)
d2.rectangle([0, 0, img.width - 1, img.height - 1], outline="#b9c1cb", width=3)
img.save(OUT)
print("saved", OUT, img.size)
