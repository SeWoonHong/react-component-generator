import { useEffect, useRef, useState } from 'react';

interface CodeViewProps {
  code: string;
  isStreaming?: boolean;
}

export function CodeView({ code, isStreaming = false }: CodeViewProps) {
  const [copied, setCopied] = useState(false);
  const blockRef = useRef<HTMLPreElement>(null);

  // 받는 중에는 새로 출력된 줄이 보이도록 아래로 따라간다.
  useEffect(() => {
    const block = blockRef.current;
    if (isStreaming && block) block.scrollTop = block.scrollHeight;
  }, [code, isStreaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-panel">
      {!isStreaming && (
        <button className="key btn-copy" onClick={handleCopy}>
          {copied ? '복사됨' : '코드 복사'}
        </button>
      )}
      <pre
        ref={blockRef}
        className={`code-block ${isStreaming ? 'code-block--streaming' : ''}`}
        aria-busy={isStreaming}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
