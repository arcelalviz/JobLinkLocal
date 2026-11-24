'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X, ExternalLink, LoaderCircle, Download } from 'lucide-react';
import { fetchWithSessionRetry } from '@/lib/http';

export function PrivateFileViewer({ url, label = 'View document' }: { url: string; label?: string }) {
  const [opened, setOpened] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [media, setMedia] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!opened) return;
    const controller = new AbortController();
    let currentUrl: string | null = null;
    setPreview(null);
    setError('');
    setMedia('');
    (url.startsWith('blob:')?fetch(url,{signal:controller.signal}):fetchWithSessionRetry(url+(url.includes('?')?'&':'?')+'ticket=1',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('This file is unavailable or you do not have access.');const result=await response.json();if(typeof result.data?.url!=='string')throw new Error('The file link is unavailable.');return fetch(result.data.url,{credentials:'omit',cache:'no-store',signal:controller.signal});}))
      .then(async response => {
        if (!response.ok) throw new Error('This file is unavailable or you do not have access.');
        const blob = await response.blob();
        const mime = blob.type.split(';')[0].trim();
        if (!['application/pdf','image/jpeg','image/png'].includes(mime)) throw new Error('This file format cannot be previewed.');
        if (controller.signal.aborted) return;
        currentUrl = URL.createObjectURL(blob);
        setMedia(mime);
        setPreview(currentUrl);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not open the document.'); });
    return () => { controller.abort(); if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [opened, url]);
  return <>
    <button type="button" className="text-action" onClick={() => setOpened(true)} aria-label={label}><Eye size={16}/>{label}</button>
    {opened && createPortal(<div className="modal-backdrop file-view-backdrop" onClick={() => setOpened(false)}>
      <div className="file-view-modal" role="dialog" aria-label={label} aria-modal="true" onClick={event => event.stopPropagation()}>
        <div className="file-view-toolbar"><strong>{label}</strong><div>
          {preview && <><a href={preview} download={media==='application/pdf'?'document.pdf':media==='image/png'?'document.png':'document.jpg'} title="Download document" aria-label="Download document"><Download size={18}/></a><a href={preview} target="_blank" rel="noopener noreferrer" aria-label="Open preview in a new tab"><ExternalLink size={18}/></a></>}
          <button type="button" onClick={() => setOpened(false)} aria-label="Close preview"><X size={20}/></button>
        </div></div>
        {error ? <p className="file-view-status" role="alert">{error}</p>
          : !preview ? <p className="file-view-status"><LoaderCircle size={20}/> Preparing secure preview…</p>
          : media.startsWith('image/') ? <img src={preview} alt={label} className="file-view-image"/>
          : <iframe src={preview} title={label} className="file-view-frame"/>}
        <p className="file-view-note">Only authorized users can open this document. Select the top-right icon to view it in a separate tab.</p>
      </div>
    </div>, document.body)}
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
