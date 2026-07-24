'use client';

import { useState, useEffect } from 'react';

export function useUserTime() {
  const [dateStr, setDateStr] = useState('');
  useEffect(() => {
    const d = new Date();
    setDateStr(
      d.toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
        ' — ' +
        d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })
    );
  }, []);
  return dateStr;
}
