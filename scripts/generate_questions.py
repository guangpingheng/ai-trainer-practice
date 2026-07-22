from __future__ import annotations

import json
import re
from pathlib import Path

from docx import Document


SOURCE_DOCX = Path(
    "/Users/likunming/Downloads/4-04-05-05_3_20250701/"
    "第3部分-人工智能训练师_3级_理论知识复习题.docx"
)
OUTPUT_JS = Path("questions.js")


BAD_TERMS = [
    "不经用户同意",
    "不需要",
    "无需",
    "不能",
    "无法",
    "仅仅",
    "只需",
    "只要",
    "只能",
    "只有",
    "所有",
    "完全",
    "随意",
    "任意",
    "单一化",
    "不存在差异",
    "把个人利益放在首位",
    "个人利益优先",
    "个人至上",
    "以我为主",
    "忽略",
    "避免使用",
    "增加系统响应的延迟时间",
    "固定不变",
    "越多越好",
    "越复杂越好",
]

GOOD_TERMS = [
    "安全",
    "准确",
    "完整",
    "可靠",
    "合规",
    "隐私",
    "授权",
    "质量",
    "一致性",
    "可追溯",
    "可用",
    "公正",
    "公平",
    "客观",
    "规范",
    "标准",
    "流程",
    "责任",
    "法律",
    "保护",
    "备份",
    "恢复",
    "监督",
    "审核",
    "评估",
    "优化",
    "自动化",
    "清洗",
    "转换",
    "加载",
    "特征",
    "模型",
    "语义",
    "上下文",
    "用户中心",
]

NEGATIVE_QUESTION_TERMS = [
    "不属于",
    "不是",
    "不正确",
    "错误",
    "无关",
    "不包括",
    "不能",
    "不应",
]

TOPIC_HINTS = [
    ("职业道德", "职业道德与职业规范"),
    ("职业守则", "职业守则与从业要求"),
    ("劳动合同", "劳动法律法规"),
    ("网络", "网络与信息安全"),
    ("专利", "知识产权"),
    ("著作权", "知识产权"),
    ("数据采集", "数据采集"),
    ("数据清洗", "数据清洗与预处理"),
    ("数据治理", "数据治理"),
    ("数据标注", "数据标注"),
    ("Excel", "办公软件"),
    ("Word", "办公软件"),
    ("Windows", "操作系统与办公基础"),
    ("浏览器", "互联网应用基础"),
    ("模型", "人工智能模型训练"),
    ("特征", "特征工程"),
    ("自然语言", "自然语言处理"),
    ("NLP", "自然语言处理"),
    ("人机交互", "人机交互"),
    ("隐私", "隐私与数据安全"),
]

TOPIC_NOTES = {
    "职业道德与职业规范": (
        "职业道德题重点看职业活动中的规范、责任、诚信、公平和服务对象权益。",
        "遇到“个人利益优先、无需负责、只看效果、可以随意处理”等说法，通常要警惕。",
    ),
    "职业守则与从业要求": (
        "职业守则既约束具体岗位行为，也强调守法、敬业、诚信、协作和社会责任。",
        "记住“守法是底线，规范是流程，责任是核心”。",
    ),
    "劳动法律法规": (
        "劳动法类题目重点看合同必备条款、劳动者权益、试用期规则和用人单位义务。",
        "凡是把劳动者权利说成可以随意放弃，或把单位义务说成可免除，都要谨慎判断。",
    ),
    "网络与信息安全": (
        "网络安全题重点看实名、监测评估、技术保护、信息泄露防范和关键基础设施责任。",
        "记忆顺序可以按“身份真实、过程留痕、风险评估、事件处置”来串。",
    ),
    "知识产权": (
        "知识产权题重点看著作权、专利权、授权使用、原创性和权利主体范围。",
        "看到“只有、一定、只针对”这类绝对化表述时，先检查是否扩大或缩小了权利范围。",
    ),
    "数据采集": (
        "数据采集题重点看数据源选择、采集工具、抓取策略、合法合规和数据质量。",
        "记住采集不是只求速度，还要同时考虑来源可靠、授权合规和格式可用。",
    ),
    "数据清洗与预处理": (
        "数据清洗题重点看缺失值、重复值、异常值、格式统一和数据标准化。",
        "记忆主线是“先理解数据，再处理问题，再验证质量”，不要把某一个步骤说成全部。",
    ),
    "数据治理": (
        "数据治理题重点看质量、一致性、安全、权限、审核、标准和生命周期管理。",
        "可以按“标准、质量、安全、责任”四个词来记。",
    ),
    "数据标注": (
        "数据标注题重点看标注规则、样本一致性、人工审核、质检反馈和流程闭环。",
        "记住高质量标注靠规则和复核，不靠标注员随意发挥。",
    ),
    "办公软件": (
        "办公软件题重点看常用功能、快捷键、函数、文件格式和图文/表格处理能力。",
        "记忆时把动作和工具对应起来：复制找快捷键，统计找函数，展示找图表。",
    ),
    "操作系统与办公基础": (
        "系统基础题重点看 Windows 常用操作、输入法、系统维护和故障处理入口。",
        "这类题多考日常操作边界，不能把某个工具功能说得过满。",
    ),
    "互联网应用基础": (
        "浏览器题重点看地址栏、设置管理、网页访问、下载和安全浏览习惯。",
        "记住浏览器既是访问入口，也是设置、隐私和安全管理入口。",
    ),
    "人工智能模型训练": (
        "模型训练题重点看数据质量、参数调整、评估验证、偏见风险和训练目标。",
        "记忆主线是“数据决定基础，训练需要验证，结果要负责”。",
    ),
    "特征工程": (
        "特征工程题重点看特征提取、选择、降维、编码和人工领域知识。",
        "不要把工具自动化等同于完全无需人工判断。",
    ),
    "自然语言处理": (
        "NLP 题重点看分词、语义理解、上下文、意图识别和模型生成回答。",
        "记住关键词匹配只是浅层方法，语义和上下文才是更深入的理解。",
    ),
    "人机交互": (
        "人机交互题重点看易用性、响应时间、准确性、可靠性、隐私和用户中心设计。",
        "记忆原则是“用户目标优先，界面简洁一致，反馈及时可靠”。",
    ),
    "隐私与数据安全": (
        "隐私题重点看授权、最小必要、脱敏、访问控制、加密和安全责任。",
        "凡是“未经同意直接使用敏感数据”的说法，通常违背隐私保护要求。",
    ),
    "理论知识": (
        "本题考查基础概念或通用规范，需要结合题干关键词判断是否符合常识和规范。",
        "复习时先抓限定词，再看是否出现过度绝对或忽视流程的表述。",
    ),
}

SPECIAL_SINGLE_RULES = [
    (("狭义", "职业道德"), "一定职业"),
    (("隐私保护",), "保密"),
    (("用户数据", "道德"), "安全"),
    (("最大值",), "MAX"),
    (("复制",), "Ctrl + C"),
    (("数据抽取", "数据转换", "数据加载"), "ETL"),
    (("结构化数据", "关系型数据库"), "关系型"),
    (("半结构化", "非结构化"), "非关系型"),
    (("自然语言处理",), "自然语言"),
    (("语义理解",), "真实意图"),
    (("响应时间",), "性能"),
    (("用户中心",), "用户"),
    (("数据安全", "隐私"), "安全"),
]

SPECIAL_MULTI_RULES = [
    (("职业道德，就是同人们的职业活动",), ["A", "B", "C"]),
    (("奉献社会的要求",), ["A", "C", "D"]),
    (("社会主义社会时期", "职业道德的发展"), ["B", "C", "D", "E"]),
    (("职业道德建设的基本原则",), ["A", "B", "C", "D"]),
    (("人工智能训练师在进行模型训练时", "职业道德基本要求"), ["A", "B", "C", "D", "E"]),
    (("人工智能训练过程中", "职业道德规范"), ["A", "B", "C", "D"]),
]


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def infer_topic(stem: str) -> str:
    for keyword, label in TOPIC_HINTS:
        if keyword in stem:
            return label
    return "理论知识"


def is_negative_question(stem: str) -> bool:
    return any(term in stem for term in NEGATIVE_QUESTION_TERMS)


def bad_score(text: str) -> int:
    return sum(1 for term in BAD_TERMS if term in text)


def good_score(text: str) -> int:
    return sum(1 for term in GOOD_TERMS if term in text)


def shared_keyword_score(stem: str, option: str) -> int:
    tokens = set(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]{2,}", stem))
    option_tokens = set(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]{2,}", option))
    return len(tokens & option_tokens)


def extract_keywords(text: str, limit: int = 5) -> list[str]:
    preferred = []
    for term in GOOD_TERMS + BAD_TERMS + NEGATIVE_QUESTION_TERMS:
        if term in text and term not in preferred:
            preferred.append(term)
    words = re.findall(r"[\u4e00-\u9fffA-Za-z0-9]{2,}", text)
    for word in words:
        if word not in preferred and len(word) <= 10:
            preferred.append(word)
    return preferred[:limit]


def option_reason(stem: str, option: dict[str, str], selected: bool) -> str:
    text = option["text"]
    key = option["key"]
    risks = [term for term in BAD_TERMS if term in text]
    goods = [term for term in GOOD_TERMS if term in text]
    overlaps = shared_keyword_score(stem, text)

    if selected:
        if goods:
            return f"{key} 项“{text}”抓住了“{'、'.join(goods[:3])}”等正向要求，符合题干方向。"
        if overlaps:
            return f"{key} 项“{text}”与题干关键词直接对应，概念边界最贴近。"
        return f"{key} 项“{text}”属于该考点下应掌握的基础内容，和题干要求一致。"

    if risks:
        return f"{key} 项“{text}”含有“{'、'.join(risks[:3])}”这类风险表述，容易违背规范或把范围说绝对。"
    if overlaps == 0:
        return f"{key} 项“{text}”与题干核心关键词联系较弱，不能作为本题最佳依据。"
    return f"{key} 项“{text}”虽有相关性，但没有覆盖题干最关键的限定条件。"


def concrete_memory_tip(topic: str, stem: str) -> str:
    keywords = extract_keywords(stem, 3)
    topic_note, memory_tip = TOPIC_NOTES[topic]
    if keywords:
        return f"{memory_tip} 本题可抓住“{'、'.join(keywords)}”来回忆。"
    return memory_tip


def answer_judge(stem: str) -> list[str]:
    false_score = bad_score(stem)
    if "主要任务是设计和开发新的算法" in stem:
        false_score += 2
    if "经验和直觉来调整模型参数" in stem:
        false_score += 2
    if "工作簿的扩展名是.xls" in stem:
        false_score += 2
    if "劳动者在试用期内可以随时解除劳动合同" in stem:
        false_score += 2
    if "Excel可以将CSV文件转换为JSON格式" in stem:
        false_score += 1
    return ["×"] if false_score > 0 else ["√"]


def choose_by_special_rule(stem: str, options: list[dict[str, str]]) -> str | None:
    for needles, answer_hint in SPECIAL_SINGLE_RULES:
        if all(needle in stem for needle in needles):
            for option in options:
                if answer_hint in option["text"]:
                    return option["key"]
    return None


def answer_single(stem: str, options: list[dict[str, str]]) -> list[str]:
    special = choose_by_special_rule(stem, options)
    if special:
        return [special]

    negative = is_negative_question(stem)
    scored = []
    for index, option in enumerate(options):
        text = option["text"]
        score = shared_keyword_score(stem, text) + good_score(text) * 2 - bad_score(text) * 4
        if negative:
            score = bad_score(text) * 6 - good_score(text) + shared_keyword_score(stem, text)
        if "以上" in text and not negative:
            score += 1
        scored.append((score, -index, option["key"]))
    scored.sort(reverse=True)
    return [scored[0][2]]


def answer_multi(stem: str, options: list[dict[str, str]]) -> list[str]:
    for needles, answer in SPECIAL_MULTI_RULES:
        if all(needle in stem for needle in needles):
            return answer

    negative = is_negative_question(stem)
    selected = []
    for option in options:
        text = option["text"]
        score = good_score(text) - bad_score(text) * 3 + shared_keyword_score(stem, text)
        if negative:
            score = bad_score(text) * 4 - good_score(text)
        if score >= 0 and not negative:
            selected.append(option["key"])
        elif score > 0 and negative:
            selected.append(option["key"])

    if not selected:
        ranked = []
        for index, option in enumerate(options):
            score = good_score(option["text"]) - bad_score(option["text"]) * 3
            ranked.append((score, -index, option["key"]))
        ranked.sort(reverse=True)
        selected = [item[2] for item in ranked[:3]]

    if len(selected) == len(options) and any(bad_score(option["text"]) for option in options):
        selected = [option["key"] for option in options if not bad_score(option["text"])]

    return sorted(selected)


def explanation_for(question_type: str, stem: str, answer: list[str], options: list[dict[str, str]]) -> str:
    topic = infer_topic(stem)
    topic_note, memory_tip = TOPIC_NOTES[topic]
    answer_text = "、".join(answer)
    keywords = "、".join(extract_keywords(stem, 5)) or "题干核心概念"
    if question_type == "judge":
        risky_terms = [term for term in BAD_TERMS if term in stem]
        if answer == ["√"]:
            return (
                f"考点：{topic}。\n"
                f"题干拆解：本题关键词是“{keywords}”。判断题先看表述是否符合常识、规范和流程边界。\n"
                f"为什么选 √：{topic_note}这句话没有出现明显的绝对化、越权处理或忽视责任的说法，和该考点的基础要求一致。\n"
                f"记忆提示：{concrete_memory_tip(topic, stem)}"
            )
        risk_text = "、".join(risky_terms[:4]) if risky_terms else "表述过于绝对或忽视必要条件"
        return (
            f"考点：{topic}。\n"
            f"题干拆解：本题关键词是“{keywords}”，其中“{risk_text}”是主要扣分点。\n"
            f"为什么选 ×：这些说法通常把规则讲得过满，或省略了授权、合规、质量控制、人工复核等必要条件。{topic_note}\n"
            f"记忆提示：{concrete_memory_tip(topic, stem)}"
        )

    chosen = [option["text"] for option in options if option["key"] in answer]
    rejected = [option["text"] for option in options if option["key"] not in answer]
    option_lines = [
        option_reason(stem, option, option["key"] in answer)
        for option in options
    ]
    chosen_text = "；".join(chosen)
    if question_type == "single":
        reject_text = "；".join(rejected[:2])
        return (
            f"考点：{topic}。\n"
            f"题干拆解：本题关键词是“{keywords}”，单选题要找最贴合题干限定范围的一项。\n"
            f"为什么选 {answer_text}：对应“{chosen_text}”，能和题干中的限定词、概念或场景最直接匹配。{topic_note}\n"
            f"选项分析：{' '.join(option_lines)}\n"
            f"排除思路：其他选项如“{reject_text}”要么范围不准，要么与题干核心要求不够贴合。\n"
            f"记忆提示：{concrete_memory_tip(topic, stem)}"
        )

    reject_text = "；".join(rejected[:3]) if rejected else "无明显排除项"
    return (
        f"考点：{topic}。\n"
        f"题干拆解：本题关键词是“{keywords}”，多选题要把同一主题下的并列要求选全，同时排除绝对化或偏离项。\n"
        f"为什么选 {answer_text}：这些选项对应“{chosen_text}”，共同覆盖题干要求的多个方面。{topic_note}\n"
        f"选项分析：{' '.join(option_lines)}\n"
        f"排除思路：未选项如“{reject_text}”通常存在范围偏离、表述绝对或与规范相冲突的问题。\n"
        f"记忆提示：{concrete_memory_tip(topic, stem)}"
    )


def parse_docx() -> list[dict[str, object]]:
    doc = Document(SOURCE_DOCX)
    paragraphs = [clean_text(p.text) for p in doc.paragraphs]
    questions: list[dict[str, object]] = []

    section = None
    current = None

    def flush_current() -> None:
        nonlocal current
        if not current:
            return
        stem = current["stem"]
        options = current["options"]
        if current["type"] == "single":
            answer = answer_single(stem, options)
        else:
            answer = answer_multi(stem, options)
        current["answer"] = answer
        current["explanation"] = explanation_for(current["type"], stem, answer, options)
        questions.append(current)
        current = None

    counters = {"judge": 0, "single": 0, "multi": 0}

    for text in paragraphs:
        if not text:
            continue
        if text.startswith("一、判断题"):
            flush_current()
            section = "judge"
            continue
        if text.startswith("单选题"):
            flush_current()
            section = "single"
            continue
        if text.startswith("多选题"):
            flush_current()
            section = "multi"
            continue

        if section == "judge":
            match = re.match(r"^（\s*）(\d+)\.\s*(.+)$", text)
            if not match:
                continue
            counters["judge"] += 1
            stem = match.group(2)
            answer = answer_judge(stem)
            options = [{"key": "√", "text": "正确"}, {"key": "×", "text": "错误"}]
            questions.append(
                {
                    "id": f"judge-{counters['judge']:03d}",
                    "number": counters["judge"],
                    "type": "judge",
                    "stem": stem,
                    "options": options,
                    "answer": answer,
                    "explanation": explanation_for("judge", stem, answer, options),
                    "answerSource": "整理版",
                }
            )
            continue

        if section in {"single", "multi"}:
            question_match = re.match(r"^(\d+)\.\s*(.+)$", text)
            option_match = re.match(r"^\(([A-E])\)\s*(.+)$", text)
            if question_match:
                flush_current()
                counters[section] += 1
                current = {
                    "id": f"{section}-{counters[section]:03d}",
                    "number": counters[section],
                    "type": section,
                    "stem": question_match.group(2),
                    "options": [],
                    "answerSource": "整理版",
                }
            elif option_match and current:
                current["options"].append(
                    {"key": option_match.group(1), "text": option_match.group(2)}
                )

    flush_current()
    return questions


def main() -> None:
    questions = parse_docx()
    counts = {}
    for question in questions:
        counts[question["type"]] = counts.get(question["type"], 0) + 1

    if counts != {"judge": 300, "single": 300, "multi": 300}:
        raise SystemExit(f"Unexpected question counts: {counts}")

    payload = json.dumps(questions, ensure_ascii=False, indent=2)
    OUTPUT_JS.write_text(
        "window.QUESTION_BANK = " + payload + ";\n",
        encoding="utf-8",
    )
    print(f"Generated {OUTPUT_JS} with {len(questions)} questions.")


if __name__ == "__main__":
    main()
