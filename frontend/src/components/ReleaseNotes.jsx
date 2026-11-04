import React from 'react';
import { History } from 'lucide-react';
import { Modal } from './ui/Modal';
import release from '../data/programRelease.json';

export const PROGRAM_VERSION = release.version;

export default function ReleaseNotes({ isOpen, onClose }) {
  return <Modal isOpen={isOpen} onClose={onClose} title="Sürüm notları" subtitle={`Bu program · v${PROGRAM_VERSION}`} icon={History} size="lg">
    <div className="vx-release-notes">
      <p className="vx-release-intro">Veniux’taki son yenilikler ve iyileştirmeler.</p>
      {release.releases.map((entry, index) => <details key={entry.version} open={index === 0}>
        <summary><span><b>v{entry.version}</b>{index === 0 && <em>Bu sürüm</em>}{entry.platform && <em>{entry.platform}</em>}<small>{entry.date}</small></span><strong>{entry.title}</strong></summary>
        <ul>{entry.items.map(item => <li key={item}>{item}</li>)}</ul>
      </details>)}
      <p className="vx-release-footnote">Notlar programla birlikte saklanır; açmak için internet gerekmez.</p>
    </div>
  </Modal>;
}
