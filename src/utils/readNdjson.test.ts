import { describe, it, expect } from 'vitest';
import { readNdjson } from './readNdjson';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const items: unknown[] = [];
  for await (const item of readNdjson(stream)) items.push(item);
  return items;
}

describe('readNdjson', () => {
  it('한 줄에 하나씩 JSON 객체를 해석해 내보낸다', async () => {
    expect(await collect(streamOf(['{"a":1}\n{"b":2}\n']))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('청크 경계에서 잘린 줄을 이어 붙여 해석한다', async () => {
    expect(await collect(streamOf(['{"a"', ':1}\n{"b":', '2}\n']))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('마지막 줄바꿈이 없어도 남은 줄을 해석한다', async () => {
    expect(await collect(streamOf(['{"a":1}']))).toEqual([{ a: 1 }]);
  });

  it('빈 줄은 건너뛴다', async () => {
    expect(await collect(streamOf(['\n{"a":1}\n\n']))).toEqual([{ a: 1 }]);
  });
});
