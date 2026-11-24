'use client';
import { useEffect, useState } from 'react';

export function ManilaClock() {
  const [time, setTime] = useState<string>('');
  useEffect(() => {
    const render = () => setTime(new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(new Date()));
    render();
    const timer = window.setInterval(render, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <time className="jl-live-clock" aria-label="Current Philippine time">{time ? `${time} PHT` : 'Philippine time'}</time>;
}
