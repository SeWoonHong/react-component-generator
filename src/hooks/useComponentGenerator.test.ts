import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';
import { STORAGE_KEYS } from '../utils/storage';

// 테스트가 원하는 시점에 NDJSON 이벤트를 흘려보낼 수 있는 응답 스트림
function controllableStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    body,
    send: (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
    close: () => controller.close(),
  };
}

function stubFetch(response: Response) {
  vi.stubGlobal('fetch', vi.fn(async () => response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useComponentGenerator', () => {
  it('저장된 컴포넌트 목록으로 시작한다', () => {
    localStorage.setItem(
      STORAGE_KEYS.components,
      JSON.stringify([{ id: 'a', prompt: '카드', code: 'render(<A />)', createdAt: '2026-10-19T02:00:00.000Z' }]),
    );

    const { result } = renderHook(() => useComponentGenerator());

    expect(result.current.components.map((c) => c.prompt)).toEqual(['카드']);
  });

  it('스트리밍으로 받은 코드 조각을 이어 붙여 생성 중인 코드로 보여준다', async () => {
    const stream = controllableStream();
    stubFetch(new Response(stream.body));
    const { result } = renderHook(() => useComponentGenerator());

    act(() => {
      void result.current.generate('버튼', undefined, 'google');
    });
    await act(async () => {
      stream.send({ type: 'delta', text: 'const A' });
      stream.send({ type: 'delta', text: ' = 1;' });
    });

    await waitFor(() =>
      expect(result.current.streaming).toMatchObject({ prompt: '버튼', code: 'const A = 1;' }),
    );
  });

  it('done 이벤트를 받으면 정규화된 코드로 컴포넌트를 추가하고 스트리밍을 끝낸다', async () => {
    const stream = controllableStream();
    stubFetch(new Response(stream.body));
    const { result } = renderHook(() => useComponentGenerator());

    const pending = act(() => result.current.generate('버튼', undefined, 'google'));
    stream.send({ type: 'delta', text: '```jsx\nrender(<A />)' });
    stream.send({ type: 'done', code: 'render(<A />)' });
    stream.close();
    await pending;

    expect(result.current.components[0]).toMatchObject({ prompt: '버튼', code: 'render(<A />)' });
    expect(result.current.streaming).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('완료된 컴포넌트는 스트리밍 중이던 것과 같은 id를 가진다', async () => {
    const stream = controllableStream();
    stubFetch(new Response(stream.body));
    const { result } = renderHook(() => useComponentGenerator());

    act(() => {
      void result.current.generate('버튼', undefined, 'google');
    });
    await act(async () => {
      stream.send({ type: 'delta', text: 'render(<A />)' });
    });
    await waitFor(() => expect(result.current.streaming?.code).toBe('render(<A />)'));
    const streamingId = result.current.streaming?.id;
    await act(async () => {
      stream.send({ type: 'done', code: 'render(<A />)' });
      stream.close();
    });

    await waitFor(() => expect(result.current.components).toHaveLength(1));
    expect(streamingId).toEqual(expect.any(String));
    expect(result.current.components[0].id).toBe(streamingId);
  });

  it('error 이벤트를 받으면 에러를 보여주고 컴포넌트를 추가하지 않는다', async () => {
    const stream = controllableStream();
    stubFetch(new Response(stream.body));
    const { result } = renderHook(() => useComponentGenerator());

    const pending = act(() => result.current.generate('버튼', undefined, 'google'));
    stream.send({ type: 'delta', text: 'const A' });
    stream.send({ type: 'error', error: '생성된 코드가 너무 길어 잘렸습니다.' });
    stream.close();
    await pending;

    expect(result.current.error).toBe('생성된 코드가 너무 길어 잘렸습니다.');
    expect(result.current.components).toEqual([]);
    expect(result.current.streaming).toBeNull();
  });

  it('done 없이 스트림이 끝나면 에러를 보여준다', async () => {
    const stream = controllableStream();
    stubFetch(new Response(stream.body));
    const { result } = renderHook(() => useComponentGenerator());

    const pending = act(() => result.current.generate('버튼', undefined, 'google'));
    stream.send({ type: 'delta', text: 'const A' });
    stream.close();
    await pending;

    expect(result.current.error).toBe('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
    expect(result.current.components).toEqual([]);
  });

  it('스트림을 열기 전 실패한 요청은 서버 에러 메시지를 보여준다', async () => {
    stubFetch(Response.json({ error: '요청이 너무 많습니다.' }, { status: 429 }));
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', undefined, 'google'));

    expect(result.current.error).toBe('요청이 너무 많습니다.');
    expect(result.current.streaming).toBeNull();
  });
});
