// utils/quiz.ts
// Generates an OX (O/X = true/false) quiz from study notes using OpenAI.

const OPENAI_API_KEY =
  "OPENAI_API_KEY_REMOVED";

export type Difficulty = "easy" | "medium" | "hard";

export type QuizQuestion = {
  question: string;
  answer: "O" | "X";
  explanation: string;
};

const NUM_QUESTIONS = 10;

const DIFFICULTY_INSTRUCTIONS: Record<Difficulty, string> = {
  easy: `난이도: 쉬움
- 노트의 핵심 사실을 직접 묻는 문제로 구성하세요
- 명확한 정의나 분명한 사실을 다루세요
- 함정이나 애매한 표현은 피하세요
- 노트를 한 번 읽은 사람이면 대부분 풀 수 있어야 합니다`,
  medium: `난이도: 보통
- 노트 내용을 응용하거나 추론해야 풀 수 있는 문제를 섞으세요
- 절반 정도는 직접적인 사실, 절반 정도는 개념 응용으로 구성하세요
- 약간 헷갈릴 만한 비교나 관계도 포함하세요
- 노트를 잘 이해한 사람이 풀 수 있는 수준이어야 합니다`,
  hard: `난이도: 어려움
- 깊은 이해와 비판적 사고가 필요한 문제 위주로 구성하세요
- 함정 문제(살짝 틀린 부분이 있는 문장)를 적극적으로 포함하세요
- 흔히 오해하기 쉬운 개념이나 미묘한 차이를 묻는 문제를 만드세요
- 부분만 맞고 나머지는 틀린 문장 등 세밀한 판단이 필요한 문제를 만드세요
- 노트를 완벽히 이해한 사람만 풀 수 있는 수준이어야 합니다`,
};

const PROMPT_TEMPLATE = (
  noteText: string,
  aiSummary: string,
  subject: string,
  difficulty: Difficulty
) => `당신은 한국어 학습 도우미입니다. 학생의 공부 노트와 AI 요약을 바탕으로 OX 퀴즈 ${NUM_QUESTIONS}개를 만들어주세요.

과목: ${subject}

학생 노트:
"""
${noteText || "(노트 없음)"}
"""

AI 요약:
"""
${aiSummary || "(요약 없음)"}
"""

${DIFFICULTY_INSTRUCTIONS[difficulty]}

기본 요구사항:
- 정확히 ${NUM_QUESTIONS}개의 OX 문제를 만드세요
- 각 문제는 "O" (참) 또는 "X" (거짓)로 답할 수 있어야 합니다
- O와 X 답이 골고루 섞이게 해주세요 (대략 5:5)
- 각 문제마다 짧은 해설을 포함하세요 (1-2문장)
- 한국어로 작성하세요

응답은 다른 텍스트 없이 오직 아래 JSON 배열 형식으로만 작성하세요:

[
  {
    "question": "문제 내용",
    "answer": "O",
    "explanation": "해설 내용"
  },
  ...
]`;

export async function generateQuiz(
  noteText: string,
  aiSummary: string,
  subject: string = "기타",
  difficulty: Difficulty = "medium"
): Promise<QuizQuestion[]> {
  if (!noteText.trim() && !aiSummary.trim()) {
    throw new Error("노트와 AI 요약이 모두 비어있어요. 퀴즈를 생성할 수 없습니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        // Hard mode gets the better model since it needs to make subtler distinctions
        model: difficulty === "hard" ? "gpt-4o" : "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: PROMPT_TEMPLATE(noteText, aiSummary, subject, difficulty),
          },
        ],
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const rawContent: string = data?.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      throw new Error("퀴즈를 생성하지 못했습니다.");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const stripped = rawContent.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(stripped);
    }

    const questions: QuizQuestion[] = Array.isArray(parsed)
      ? parsed
      : parsed.questions ?? parsed.quiz ?? [];

    const valid = questions.filter(
      (q) =>
        q &&
        typeof q.question === "string" &&
        (q.answer === "O" || q.answer === "X") &&
        typeof q.explanation === "string"
    );

    if (valid.length === 0) {
      throw new Error("퀴즈 형식이 올바르지 않습니다. 다시 시도해주세요.");
    }

    return valid;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      throw new Error("퀴즈 생성 시간이 너무 오래 걸렸어요. 다시 시도해주세요.");
    }
    throw error;
  }
}