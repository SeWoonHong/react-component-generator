import { useState } from 'react';

interface CodeViewProps {
  code: string;
}

export function CodeView({ code }: CodeViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-panel">
      <button className="key btn-copy" onClick={handleCopy}>
        {copied ? '복사됨' : '코드 복사'}
      </button>
      <pre className="code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}
