// AI 프로바이더의 스트리밍 응답(SSE)을 해석하는 순수 함수들.
// 부수효과가 없어 단위 테스트가 가능하다.

/** SSE 바이트 스트림을 이벤트 단위로 나눠 data 값을 내보낸다. */
export async function* parseSSE(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of chunks) {
    // CR과 LF가 청크 경계에서 갈라질 수 있어 이어 붙인 뒤에 정규화한다.
    buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n');

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const data = extractData(buffer.slice(0, boundary));
      if (data !== null) yield data;
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
  }

  const rest = extractData(buffer);
  if (rest !== null) yield rest;
}

function extractData(rawEvent: string): string | null {
  const lines = rawEvent
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''));
  return lines.length > 0 ? lines.join('\n') : null;
}

export const TRUNCATED_MESSAGE =
  '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.';
export const OVERLOADED_MESSAGE =
  'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.';
export const RATE_LIMITED_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';

// 스트리밍 도중 에러는 HTTP 상태로 전달할 수 없어 사용자용 문구로 바로 바꾼다.
const ANTHROPIC_STREAM_ERRORS: Record<string, string> = {
  overloaded_error: OVERLOADED_MESSAGE,
  rate_limit_error: RATE_LIMITED_MESSAGE,
};

type AnthropicStreamEvent = {
  type: string;
  delta?: { type?: string; text?: string; stop_reason?: string };
  error?: { type?: string };
};

/** Anthropic Messages 스트림 이벤트에서 텍스트 조각만 뽑아낸다. */
export async function* anthropicTextDeltas(events: AsyncIterable<string>): AsyncGenerator<string> {
  for await (const raw of events) {
    const event = JSON.parse(raw) as AnthropicStreamEvent;

    if (event.type === 'error') {
      const errorType = event.error?.type ?? 'unknown';
      throw new Error(ANTHROPIC_STREAM_ERRORS[errorType] ?? `Claude API error: ${errorType}`);
    }
    if (event.type === 'message_delta' && event.delta?.stop_reason === 'max_tokens') {
      throw new Error(TRUNCATED_MESSAGE);
    }
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
      yield event.delta.text;
    }
  }
}

type GoogleStreamChunk = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { code?: number };
};

/** Gemini streamGenerateContent(SSE) 응답 조각에서 텍스트만 뽑아낸다. */
export async function* googleTextDeltas(events: AsyncIterable<string>): AsyncGenerator<string> {
  for await (const raw of events) {
    const chunk = JSON.parse(raw) as GoogleStreamChunk;
    if (chunk.error) {
      throw new Error(`Gemini 응답 중 오류가 발생했습니다. (${chunk.error.code ?? 'unknown'})`);
    }

    const candidate = chunk.candidates?.[0];
    for (const part of candidate?.content?.parts ?? []) {
      if (part.text) yield part.text;
    }

    const finishReason = candidate?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new Error(TRUNCATED_MESSAGE);
    }
    // SAFETY·RECITATION 등으로 끊긴 코드를 완성본으로 확정하지 않는다.
    if (finishReason && finishReason !== 'STOP') {
      throw new Error(`응답 생성이 중단되었습니다. (${finishReason})`);
    }
  }
}

/**
 * 텍스트 조각을 클라이언트용 NDJSON 스트림으로 바꾼다.
 * 조각마다 `delta`, 끝나면 `finalize`로 정규화한 `done`, 실패하면 `error` 한 줄을 보낸다.
 */
export function toNdjsonStream(
  deltas: AsyncIterable<string>,
  finalize: (text: string) => string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let text = '';
      try {
        for await (const delta of deltas) {
          text += delta;
          send({ type: 'delta', text: delta });
        }
        send({ type: 'done', code: finalize(text) });
      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
      }
      controller.close();
    },
  });
}
