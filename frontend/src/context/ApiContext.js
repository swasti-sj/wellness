import React, { createContext, useContext, useEffect, useState } from 'react';

const ApiContext = createContext();

export const ApiProvider = ({ children }) => {
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
        const response = await fetch(`${backendUrl}/config`);
        const cfg = await response.json();
        const base = cfg?.apiBaseUrl || backendUrl;
        setApiBaseUrl(base);
        console.log('✅ API Base URL loaded:', base);
      } catch (err) {
        const fallback = process.env.REACT_APP_BACKEND_URL || window.location.origin;
        console.warn('❌ Failed to load config, using fallback:', fallback, err);
        setApiBaseUrl(fallback);
      }
    };

    fetchConfig();
  }, []);

  return (
    <ApiContext.Provider value={{ apiBaseUrl }}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context.apiBaseUrl;
};
