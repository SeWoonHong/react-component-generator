import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEYS } from './utils/storage';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === '/api/generate'
        ? Response.json({ code: 'render(<div>생성됨</div>);' })
        : Response.json({ envKeys: { anthropic: false, google: false } }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
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
