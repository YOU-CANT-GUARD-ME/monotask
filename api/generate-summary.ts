// api/generate-summary.ts
// Generates an AI study summary from notes and photos.
// Runs on Vercel so the OpenAI key is read from the environment, not shipped in the app.

function isImageBlock(b: any) {
  return (
    b &&
    b.type === "image_url" &&
    typeof b?.image_url?.url === "string" &&
    (b.image_url.url.startsWith("data:image/") ||
      b.image_url.url.startsWith("https://"))
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing on Vercel",
      });
    }

    const { noteText: rawNote = "", imageBlocks: rawImages = [] } = req.body || {};
    const noteText = String(rawNote);
    const imageBlocks = (Array.isArray(rawImages) ? rawImages : [])
      .filter(isImageBlock)
      .slice(0, 10)
      .map((b: any) => ({
        type: "image_url",
        image_url: { url: b.image_url.url, detail: "high" },
      }));
    const hasPhotos = imageBlocks.length > 0;

    if (!noteText.trim() && !hasPhotos) {
      return res.status(400).json({
        error: "노트와 사진이 모두 비어있어요. 요약을 생성할 수 없습니다.",
      });
    }

    const prompt = hasPhotos
      ? `당신은 학습 도우미입니다. 학생이 공부 세션을 마쳤고, ${imageBlocks.length}장의 사진과 노트를 첨부했습니다.

먼저 모든 사진을 순서대로 자세히 보고 거기에 적힌 글씨, 다이어그램, 표, 공식 등 모든 내용을 읽어내세요. 손글씨여도 최선을 다해 읽으세요. 여러 사진이 있다면 사진들이 연관된 내용일 수도 있다는 점을 고려하세요.

${noteText.trim() ? `학생이 추가로 작성한 노트:\n"${noteText}"` : "학생이 작성한 노트는 없습니다."}

사진에서 읽어낸 모든 내용과 노트를 종합해서 학습 요약을 한국어로 작성해주세요. 사진의 내용이 중심이 되어야 합니다.

형식:

📚 주요 주제
- 사진과 노트에서 다룬 핵심 주제 2~3개

💡 핵심 개념 / 내용
- 사진에 적힌 중요한 개념, 정의, 공식, 예시를 구체적으로 정리 (3~6개)

❓ 복습 질문
1. 사진의 내용을 활용한 자기 테스트 질문 2~3개

만약 일부 사진을 읽을 수 없거나 글씨를 알아볼 수 없다면, 솔직하게 그렇게 말해주세요.`
      : noteText.trim().length > 0
        ? `당신은 학습 도우미입니다.

학생 노트:

"${noteText}"

이 노트를 바탕으로 간결하고 구조화된 학습 요약을 한국어로 작성해주세요.

형식:

📚 주요 주제
- 핵심 주제 2~3개

💡 핵심 개념
- 중요한 개념 / 정의 / 공식 2~3개

❓ 복습 질문
1. 자기 테스트 질문 2개`
        : `학생이 공부 세션을 완료했지만 노트나 사진이 없습니다.

다음 공부 때 노트나 사진을 남기면 더 좋은 요약을 받을 수 있다고 짧게 격려해주세요.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-terra",
        reasoning_effort: "low",
        messages: [
          { role: "user", content: [{ type: "text", text: prompt }, ...imageBlocks] },
        ],
        max_completion_tokens: 4000,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({ error: data });
    }

    const summary = data?.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return res.status(500).json({ error: "요약을 생성할 수 없습니다." });
    }

    return res.status(200).json({ summary });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Summary generation failed",
    });
  }
}
