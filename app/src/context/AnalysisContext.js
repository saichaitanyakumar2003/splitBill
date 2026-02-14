import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [userAnalysisData, setUserAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryUsage, setAiSummaryUsage] = useState({ remaining: 2, used: 0, limit: 2 });
  const prevAuthRef = useRef(isAuthenticated);

  // Clear cache on logout
  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      setUserAnalysisData(null);
      setAnalysisLoading(false);
      setAiSummary(null);
      setAiSummaryUsage({ remaining: 2, used: 0, limit: 2 });
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const value = {
    userAnalysisData,
    setUserAnalysisData,
    analysisLoading,
    setAnalysisLoading,
    aiSummary,
    setAiSummary,
    aiSummaryLoading,
    setAiSummaryLoading,
    aiSummaryUsage,
    setAiSummaryUsage,
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider');
  return ctx;
}
