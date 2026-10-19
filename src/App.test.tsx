import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEYS } from './utils/storage';

// 테스트가 원하는 시점에 NDJSON 이벤트를 흘려보낼 수 있는 /api/generate 응답
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

function stubFetch(generateBody: () => BodyInit) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === '/api/generate'
        ? new Response(generateBody())
        : Response.json({ envKeys: { anthropic: false, google: false } }),
    ),
  );
}

beforeEach(() => {
  stubFetch(() => '{"type":"done","code":"render(<div>생성됨</div>);"}\n');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('App 상태 유지', () => {
  it('저장된 provider로 시작한다', () => {
    localStorage.setItem(STORAGE_KEYS.provider, JSON.stringify('anthropic'));

    render(<App />);

    expect(screen.getByRole('radio', { name: 'Anthropic' })).toBeChecked();
  });

  it('입력한 API 키가 새로고침 후에도 남아 있다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.type(screen.getByLabelText('API 키'), 'AIza-test-key');
    unmount();

    render(<App />);

    expect(screen.getByLabelText('API 키')).toHaveValue('AIza-test-key');
  });

  it('생성 요청한 프롬프트가 최근 요청에 남아 새로고침 후에도 보인다', async () => {
    localStorage.setItem(STORAGE_KEYS.apiKeys, JSON.stringify({ google: 'AIza-test-key' }));
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.type(screen.getByRole('textbox', { name: '무엇을 만들까요?' }), '프로필 카드');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));
    unmount();

    render(<App />);

    const recent = screen.getByRole('region', { name: '최근 요청' });
    expect(within(recent).getByRole('button', { name: '프로필 카드' })).toBeInTheDocument();
  });
});

describe('컴포넌트 생성 스트리밍', () => {
  async function startGenerating() {
    const stream = controllableStream();
    stubFetch(() => stream.body);
    localStorage.setItem(STORAGE_KEYS.apiKeys, JSON.stringify({ google: 'AIza-test-key' }));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole('textbox', { name: '무엇을 만들까요?' }), '프로필 카드');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));
    return stream;
  }

  it('생성 중에는 코드 탭이 선택되고 받은 코드가 실시간으로 보인다', async () => {
    const stream = await startGenerating();

    await act(async () => {
      stream.send({ type: 'delta', text: 'const Profile' });
      stream.send({ type: 'delta', text: 'Card = () => null;' });
    });

    const feed = screen.getByRole('region', { name: '생성된 컴포넌트' });
    expect(await within(feed).findByRole('tab', { name: '코드', selected: true })).toBeInTheDocument();
    expect(within(feed).getByText('const ProfileCard = () => null;')).toBeInTheDocument();
  });

  it('생성 중에는 미리보기 탭을 누를 수 없다', async () => {
    const stream = await startGenerating();

    await act(async () => {
      stream.send({ type: 'delta', text: 'const A' });
    });

    const feed = screen.getByRole('region', { name: '생성된 컴포넌트' });
    expect(await within(feed).findByRole('tab', { name: '미리보기' })).toBeDisabled();
  });

  it('코드가 오기 시작하면 생성 중 대기 용지를 치운다', async () => {
    const stream = await startGenerating();

    await act(async () => {
      stream.send({ type: 'delta', text: 'const A' });
    });

    const feed = screen.getByRole('region', { name: '생성된 컴포넌트' });
    await within(feed).findByText('const A');
    expect(within(feed).queryByRole('status')).not.toBeInTheDocument();
  });

  it('생성 중인 카드는 삭제할 수 없다', async () => {
    const stream = await startGenerating();

    await act(async () => {
      stream.send({ type: 'delta', text: 'const A' });
    });

    const feed = screen.getByRole('region', { name: '생성된 컴포넌트' });
    expect(await within(feed).findByRole('button', { name: '삭제' })).toBeDisabled();
  });

  it('생성 중인 카드는 미리보기를 새로고침할 수 없다', async () => {
    const stream = await startGenerating();

    await act(async () => {
      stream.send({ type: 'delta', text: 'const A' });
    });

    const feed = screen.getByRole('region', { name: '생성된 컴포넌트' });
    expect(await within(feed).findByRole('button', { name: '미리보기 새로고침' })).toBeDisabled();
  });

  it('생성 중인 코드는 복사 버튼을 보여주지 않는다', async () => {
    const stream = await startGenerating();

    await act(async () => {
      stream.send({ type: 'delta', text: 'const A' });
    });

    const feed = screen.getByRole('region', { name: '생성된 컴포넌트' });
    await within(feed).findByText('const A');
    expect(within(feed).queryByRole('button', { name: '코드 복사' })).not.toBeInTheDocument();
  });

  it('새 코드가 도착하면 코드 영역을 맨 아래로 스크롤한다', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900);
    const stream = await startGenerating();

    await act(async () => {
      stream.send({ type: 'delta', text: 'const A' });
    });

    const feed = screen.getByRole('region', { name: '생성된 컴포넌트' });
    const code = await within(feed).findByText('const A');
    expect(code.closest('pre')?.scrollTop).toBe(900);
  });

  it('생성이 끝나면 같은 카드가 미리보기 탭으로 전환된다', async () => {
    const stream = await startGenerating();
    await act(async () => {
      stream.send({ type: 'delta', text: 'render(<div>완성</div>);' });
    });
    const feed = screen.getByRole('region', { name: '생성된 컴포넌트' });
    const card = (await within(feed).findByRole('tab', { name: '코드', selected: true })).closest('article');

    await act(async () => {
      stream.send({ type: 'done', code: 'render(<div>완성</div>);' });
      stream.close();
    });

    const previewTab = await within(feed).findByRole('tab', { name: '미리보기', selected: true });
    expect(previewTab.closest('article')).toBe(card);
    expect(await within(feed).findByText('완성')).toBeInTheDocument();
  });
});
