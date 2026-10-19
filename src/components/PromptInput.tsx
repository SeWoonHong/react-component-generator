import { useState } from 'react';
import { MAX_PROMPT_LENGTH, validatePromptLength } from '../utils/validatePrompt';

interface PromptInputProps {
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
}

const EXAMPLES = [
  'SaaS 관리자용 KPI 카드 3개. 매출, 활성 사용자, 전환율을 비교 가능한 형태로 표시',
  '설정 페이지의 알림 토글 패널. 이메일, 슬랙, 주간 리포트 옵션 포함',
  '검색 필터 바. 상태, 담당자, 날짜 범위를 선택하고 결과 수를 보여주는 UI',
  '온보딩 체크리스트. 5단계 진행률과 완료/대기 상태를 보여주는 카드',
  '요금제 비교 카드 3개. 추천 플랜을 강조하고 CTA 버튼 포함',
  '테이블 행 상세보기 패널. 선택한 고객의 기본 정보와 최근 활동 표시',
];

export function PromptInput({ onGenerate, isLoading }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const { isValid, length } = validatePromptLength(prompt);
  const lengthError = isValid
    ? null
    : `${MAX_PROMPT_LENGTH}자 이내로 입력해 주세요. ${length - MAX_PROMPT_LENGTH}자를 줄이면 생성할 수 있습니다.`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && isValid && !isLoading) {
      onGenerate(prompt.trim());
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  return (
    <div className="prompt-section">
      <form onSubmit={handleSubmit} className="prompt-form">
        <label htmlFor="prompt" className="prompt-label">
          무엇을 만들까요?
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="예: 고객 목록 테이블 위에 들어갈 검색 필터 바를 만들어줘. 상태, 담당자, 날짜 범위 필터가 필요해."
          className="prompt-textarea"
          rows={4}
          aria-invalid={!isValid}
          aria-describedby={lengthError ? 'prompt-error' : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e);
            }
          }}
        />
        {lengthError && (
          <p id="prompt-error" className="prompt-error" role="alert">
            {lengthError}
          </p>
        )}
        <div className="prompt-actions">
          <div className="prompt-meta">
            <span className={`prompt-count ${isValid ? '' : 'prompt-count--over'}`}>
              {length} / {MAX_PROMPT_LENGTH}
            </span>
            <span className="prompt-hint">⌘ + Enter로도 생성할 수 있습니다</span>
          </div>
          <button
            type="submit"
            className="btn-generate"
            disabled={!prompt.trim() || !isValid || isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner">생성 중...</span>
            ) : (
              '컴포넌트 생성'
            )}
          </button>
        </div>
      </form>
      <div className="prompt-examples">
        <p className="examples-label">이렇게 요청해 보세요</p>
        <ul>
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                className="example-chip"
                onClick={() => handleExampleClick(example)}
                type="button"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
