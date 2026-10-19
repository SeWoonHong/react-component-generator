/**
 * NDJSON(줄마다 JSON 하나) 응답 본문을 한 줄씩 해석해 내보낸다.
 * 일부 브라우저는 ReadableStream 비동기 순회를 지원하지 않아 reader를 직접 쓴다.
 */
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line);
    }
  }

  if (buffer.trim()) yield JSON.parse(buffer);
}
