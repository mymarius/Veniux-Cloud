import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './AssistantMarkdown.css';

const components = {
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  table: ({ children }) => <div className="assistant-table-scroll"><table>{children}</table></div>,
  // Model output must not trigger remote image requests.
  img: ({ alt }) => <span>{alt || 'Görsel'}</span>,
};

export default function AssistantMarkdown({ children }) {
  return <div className="assistant-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>{children || ''}</ReactMarkdown></div>;
}
