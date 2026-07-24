'use client';

import { useState, useCallback } from 'react';

export function useReportMeta() {
  const [projectName, setProjectName] = useState('');
  const [engineerName, setEngineerName] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);

  const handleLogoFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result);
    reader.readAsDataURL(file);
  }, []);

  const handleSignatureFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSignatureDataUrl(reader.result);
    reader.readAsDataURL(file);
  }, []);

  return {
    projectName,
    setProjectName,
    engineerName,
    setEngineerName,
    logoDataUrl,
    setLogoDataUrl,
    signatureDataUrl,
    setSignatureDataUrl,
    handleLogoFile,
    handleSignatureFile,
  };
}
