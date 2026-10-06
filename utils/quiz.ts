import { apiPost } from "./api";

// utils/quiz.ts
// Generates an OX quiz from study notes.
// Web/PWA version calls our own Vercel API route so the OpenAI key is not exposed.

export type Difficulty = "easy" | "medium" | "hard";

export type QuizQuestion = {
  question: string;
  answer: "O" | "X";
  explanation: string;
};

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
    const data = await apiPost<{ questions?: QuizQuestion[] }>(
      "/api/generate-quiz",
      { noteText, aiSummary, subject, difficulty },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const questions: QuizQuestion[] = data.questions ?? [];

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
