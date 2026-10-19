import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptInput } from './PromptInput';

describe('PromptInput', () => {
  it('프롬프트가 비어 있으면 생성 버튼이 비활성이다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('입력하면 버튼이 활성화되고 클릭 시 입력값으로 onGenerate가 호출된다', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);

    await user.type(screen.getByRole('textbox'), '프로필 카드');
    const submit = screen.getByRole('button', { name: '컴포넌트 생성' });
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onGenerate).toHaveBeenCalledWith('프로필 카드');
  });

  it('500자를 넘으면 생성 버튼이 비활성이다', async () => {
    const user = userEvent.setup();
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

    await user.click(screen.getByRole('textbox'));
    await user.paste('가'.repeat(501));

    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('500자를 넘으면 Ctrl+Enter로도 생성 요청을 보내지 않는다', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);

    await user.click(screen.getByRole('textbox'));
    await user.paste('가'.repeat(501));
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('입력한 글자 수를 최대 글자 수와 함께 보여준다', async () => {
    const user = userEvent.setup();
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

    await user.type(screen.getByRole('textbox'), '프로필');

    expect(screen.getByText('3 / 500')).toBeInTheDocument();
  });

  it('500자를 넘으면 줄여야 할 글자 수를 알려준다', async () => {
    const user = userEvent.setup();
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

    await user.click(screen.getByRole('textbox'));
    await user.paste('가'.repeat(503));

    expect(screen.getByRole('alert')).toHaveTextContent(
      '500자 이내로 입력해 주세요. 3자를 줄이면 생성할 수 있습니다.',
    );
  });

  it('500자를 넘으면 입력창을 오류 상태로 표시한다', async () => {
    const user = userEvent.setup();
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

    await user.click(screen.getByRole('textbox'));
    await user.paste('가'.repeat(501));

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription(
      '500자 이내로 입력해 주세요. 1자를 줄이면 생성할 수 있습니다.',
    );
  });

  it('로딩 중에는 생성 버튼이 비활성이고 "생성 중..." 을 보여준다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={true} />);
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled();
  });
});
