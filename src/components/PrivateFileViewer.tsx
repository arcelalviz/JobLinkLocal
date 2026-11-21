'use client';
import { useEffect, useState } from 'react';
import { Eye, X, ExternalLink } from 'lucide-react';

export function PrivateFileViewer({ url, label = 'View document' }: { url: string; label?: string }) {
  const [opened, setOpened] = useState(false);
  return <>
    <button type="button" className="text-action" onClick={() => setOpened(true)}><Eye size={16}/>{label}</button>
    {opened && <div className="modal-backdrop file-view-backdrop" onClick={() => setOpened(false)}>
      <div className="file-view-modal" role="dialog" aria-label={label} aria-modal="true" onClick={event => event.stopPropagation()}>
        <div className="file-view-toolbar"><strong>{label}</strong><div>
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab"><ExternalLink size={18}/></a>
          <button type="button" onClick={() => setOpened(false)} aria-label="Close preview"><X size={20}/></button>
        </div></div>
        <iframe src={url} title={label} className="file-view-frame" />
        <p className="file-view-note">If the browser cannot preview this file, open it in a new tab.</p>
      </div>
    </div>}
  </>;
}

export function LocalFilePreview({ file, label = 'Preview selected file' }: { file: File | null; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!url) return null;
  return <PrivateFileViewer url={url} label={label} />;
}
