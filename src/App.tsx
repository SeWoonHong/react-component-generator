import { useState, useEffect } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import type { Provider } from './types';
import { usePersistentState } from './hooks/usePersistentState';
import {
  addToHistory,
  parseApiKeys,
  parseHistory,
  parseProvider,
  STORAGE_KEYS,
} from './utils/storage';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

function App() {
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = usePersistentState<Provider>(
    STORAGE_KEYS.provider,
    'google',
    (raw) => parseProvider(raw) ?? 'google',
  );
  // 키는 provider별로 따로 저장해 provider를 바꿨다 돌아와도 다시 입력하지 않게 한다.
  const [apiKeys, setApiKeys] = usePersistentState(
    STORAGE_KEYS.apiKeys,
    parseApiKeys('{}'),
    parseApiKeys,
  );
  const apiKey = apiKeys[provider];
  const [history, setHistory] = usePersistentState<string[]>(STORAGE_KEYS.history, [], parseHistory);
  const setApiKey = (value: string) => setApiKeys((prev) => ({ ...prev, [provider]: value }));
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const { components, isLoading, error, generate, removeComponent, clearAll } =
    useComponentGenerator();

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  const hasEnvKey = envKeys[provider];
  const hasKey = hasEnvKey || apiKey.trim().length > 0;

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      alert(`${PROVIDER_CONFIG[provider].label} API 키를 입력하거나 .env에 설정해주세요.`);
      return;
    }
    setHistory((prev) => addToHistory(prev, prompt));
    generate(prompt, apiKey || undefined, provider);
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
  };

  return (
    <div className="app">
      <div className="machine">
        <header className="machine-top">
          <div className="badge" aria-hidden="true">RC-84</div>
          <div className="machine-title">
            <h1>React 컴포넌트 생성기</h1>
            <p>만들고 싶은 UI를 적으면 React 컴포넌트로 바로 만들어 미리보기와 코드로 보여줍니다.</p>
          </div>
          <div className="indicators" aria-label="현재 상태">
            <span className={`led ${hasKey ? 'led--on' : ''}`}>
              <i aria-hidden="true" />
              {PROVIDER_CONFIG[provider].label}
            </span>
            <span className="counter" aria-label={`생성된 컴포넌트 ${components.length}개`}>
              {String(components.length).padStart(3, '0')}
            </span>
          </div>
        </header>

        <main className="machine-body">
          <section className="composer" aria-label="컴포넌트 생성">
            <PromptInput
              onGenerate={handleGenerate}
              isLoading={isLoading}
              history={history}
              onClearHistory={() => setHistory([])}
            />
          </section>

          <aside className="back-panel" aria-label="실행 설정">
            <h2>연결 설정</h2>
            <fieldset className="switch">
              <legend>AI 제공자</legend>
              <div className="switch-track">
                {(Object.keys(PROVIDER_CONFIG) as Provider[]).map((key) => (
                  <label key={key} className={provider === key ? 'is-on' : ''}>
                    <input
                      type="radio"
                      name="provider"
                      value={key}
                      checked={provider === key}
                      onChange={() => handleProviderChange(key)}
                    />
                    {PROVIDER_CONFIG[key].label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="key-slot">
              <label htmlFor="api-key">API 키</label>
              <div className="key-field">
                <input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  placeholder={
                    hasEnvKey ? '서버 키 사용 중' : PROVIDER_CONFIG[provider].placeholder
                  }
                />
                <button className="key" onClick={() => setShowKey(!showKey)} type="button">
                  {showKey ? '숨기기' : '보기'}
                </button>
              </div>
              <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
                {hasEnvKey
                  ? '.env 키가 연결되어 있습니다. 직접 입력하면 그 키를 대신 씁니다.'
                  : '키를 직접 입력하거나 서버 .env에 설정하세요.'}
              </p>
            </div>
          </aside>
        </main>

        {error && (
          <div className="error-strip" role="alert">
            <i aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {components.length > 0 && (
          <div className="feed-bar">
            <h2>생성된 컴포넌트 {components.length}개</h2>
            <button className="key key--ghost" onClick={clearAll}>
              전체 삭제
            </button>
          </div>
        )}

        <div className={`slot ${isLoading ? 'slot--printing' : ''}`} aria-hidden="true">
          <span className="printhead" />
        </div>
      </div>

      <section className="feed" aria-label="생성된 컴포넌트">
        <div className="paper-stack">
          {isLoading && (
            <div className="sheet sheet--pending" role="status">
              <p className="dot-print">생성 중</p>
              <p>요청한 컴포넌트를 만들고 있습니다.</p>
            </div>
          )}

          {components.length === 0 && !isLoading && (
            <div className="sheet sheet--blank">
              <p className="dot-print">빈 용지</p>
              <h2>아직 만든 컴포넌트가 없습니다.</h2>
              <p>위에 원하는 UI를 적고 컴포넌트 생성을 누르면 이곳에 결과가 나옵니다.</p>
            </div>
          )}

          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onRemove={removeComponent}
              onRegenerate={handleGenerate}
              isLoading={isLoading}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
