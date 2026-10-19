import { describe, it, expect } from 'vitest';
import { parseSSE, anthropicTextDeltas, googleTextDeltas, toNdjsonStream } from './stream';

async function* fromChunks(chunks: string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const chunk of chunks) yield encoder.encode(chunk);
}

async function* fromEvents(events: unknown[]): AsyncGenerator<string> {
  for (const event of events) yield JSON.stringify(event);
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

describe('parseSSE', () => {
  it('이벤트마다 data 값을 순서대로 내보낸다', async () => {
    const events = await collect(parseSSE(fromChunks(['data: a\n\ndata: b\n\n'])));
    expect(events).toEqual(['a', 'b']);
  });

  it('청크 경계에서 잘린 이벤트를 이어 붙여 해석한다', async () => {
    const events = await collect(parseSSE(fromChunks(['da', 'ta: {"x":', '1}\n', '\n'])));
    expect(events).toEqual(['{"x":1}']);
  });

  it('event 줄은 무시하고 data 줄만 사용한다', async () => {
    const events = await collect(parseSSE(fromChunks(['event: ping\ndata: hi\n\n'])));
    expect(events).toEqual(['hi']);
  });

  it('CRLF 줄바꿈도 이벤트 구분으로 처리한다', async () => {
    const events = await collect(parseSSE(fromChunks(['data: a\r\n\r\ndata: b\r\n\r\n'])));
    expect(events).toEqual(['a', 'b']);
  });

  it('CR과 LF가 서로 다른 청크로 나뉘어도 이벤트를 구분한다', async () => {
    const events = await collect(parseSSE(fromChunks(['data: a\r', '\n\r', '\ndata: b\r\n\r\n'])));
    expect(events).toEqual(['a', 'b']);
  });

  it('마지막 빈 줄 없이 끝난 이벤트도 내보낸다', async () => {
    const events = await collect(parseSSE(fromChunks(['data: last'])));
    expect(events).toEqual(['last']);
  });
});

describe('anthropicTextDeltas', () => {
  it('text_delta 이벤트의 텍스트만 순서대로 내보낸다', async () => {
    const deltas = await collect(
      anthropicTextDeltas(
        fromEvents([
          { type: 'message_start', message: {} },
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'const ' } },
          { type: 'ping' },
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'A' } },
          { type: 'message_stop' },
        ]),
      ),
    );
    expect(deltas).toEqual(['const ', 'A']);
  });

  it('error 이벤트를 받으면 에러를 던진다', async () => {
    const deltas = anthropicTextDeltas(
      fromEvents([{ type: 'error', error: { type: 'api_error', message: 'Internal' } }]),
    );
    await expect(collect(deltas)).rejects.toThrow('Claude API error: api_error');
  });

  it('overloaded_error 이벤트는 과부하 안내로 바꿔 던진다', async () => {
    const deltas = anthropicTextDeltas(
      fromEvents([{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]),
    );
    await expect(collect(deltas)).rejects.toThrow('API 서버가 일시적으로 과부하 상태입니다.');
  });

  it('rate_limit_error 이벤트는 요청 제한 안내로 바꿔 던진다', async () => {
    const deltas = anthropicTextDeltas(
      fromEvents([{ type: 'error', error: { type: 'rate_limit_error', message: 'Rate limited' } }]),
    );
    await expect(collect(deltas)).rejects.toThrow('요청이 너무 많습니다.');
  });

  it('max_tokens로 끝나면 잘림 안내 에러를 던진다', async () => {
    const deltas = anthropicTextDeltas(
      fromEvents([{ type: 'message_delta', delta: { stop_reason: 'max_tokens' } }]),
    );
    await expect(collect(deltas)).rejects.toThrow('생성된 코드가 너무 길어 잘렸습니다.');
  });
});

describe('googleTextDeltas', () => {
  it('각 응답 조각의 parts 텍스트를 순서대로 내보낸다', async () => {
    const deltas = await collect(
      googleTextDeltas(
        fromEvents([
          { candidates: [{ content: { parts: [{ text: 'const ' }, { text: 'A' }] } }] },
          { candidates: [{ content: { parts: [{ text: ' = 1;' }] }, finishReason: 'STOP' }] },
        ]),
      ),
    );
    expect(deltas).toEqual(['const ', 'A', ' = 1;']);
  });

  it('MAX_TOKENS로 끝나면 잘림 안내 에러를 던진다', async () => {
    const deltas = googleTextDeltas(
      fromEvents([{ candidates: [{ content: { parts: [{ text: 'a' }] }, finishReason: 'MAX_TOKENS' }] }]),
    );
    await expect(collect(deltas)).rejects.toThrow('생성된 코드가 너무 길어 잘렸습니다.');
  });

  it('error 필드가 담긴 조각을 받으면 에러를 던진다', async () => {
    const deltas = googleTextDeltas(
      fromEvents([{ error: { code: 500, message: 'Internal', status: 'INTERNAL' } }]),
    );
    await expect(collect(deltas)).rejects.toThrow('Gemini 응답 중 오류가 발생했습니다. (500)');
  });

  it('SAFETY 같은 비정상 종료 사유면 에러를 던진다', async () => {
    const deltas = googleTextDeltas(
      fromEvents([{ candidates: [{ content: { parts: [{ text: 'a' }] }, finishReason: 'SAFETY' }] }]),
    );
    await expect(collect(deltas)).rejects.toThrow('응답 생성이 중단되었습니다. (SAFETY)');
  });
});

async function* fromTexts(texts: string[], failWith?: Error): AsyncGenerator<string> {
  for (const text of texts) yield text;
  if (failWith) throw failWith;
}

async function readLines(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const text = await new Response(stream).text();
  return text.trim().split('\n').map((line) => JSON.parse(line));
}

describe('toNdjsonStream', () => {
  it('텍스트 조각마다 delta 이벤트를 한 줄씩 보낸다', async () => {
    const lines = await readLines(toNdjsonStream(fromTexts(['a', 'b']), (text) => text));
    expect(lines.slice(0, 2)).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'delta', text: 'b' },
    ]);
  });

  it('끝나면 전체 텍스트를 후처리한 코드로 done 이벤트를 보낸다', async () => {
    const lines = await readLines(toNdjsonStream(fromTexts(['a', 'b']), (text) => text.toUpperCase()));
    expect(lines.at(-1)).toEqual({ type: 'done', code: 'AB' });
  });

  it('도중에 실패하면 error 이벤트를 보내고 done은 보내지 않는다', async () => {
    const lines = await readLines(
      toNdjsonStream(fromTexts(['a'], new Error('잘렸습니다')), (text) => text),
    );
    expect(lines).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'error', error: '잘렸습니다' },
    ]);
  });
});
