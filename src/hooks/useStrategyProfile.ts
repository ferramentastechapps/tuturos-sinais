// ═══════════════════════════════════════════════════════════
// useStrategyProfile — State management for strategy profiles
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StrategyProfile, IndicatorKey, IndicatorConfig, computeProfileStats } from '@/types/strategyTypes';
import {
  loadUserProfiles,
  saveProfile,
  deleteProfile,
  setDefaultProfile,
  getStoredActiveProfileId,
  storeActiveProfileId,
  createBlankProfile,
  duplicateProfile as dupProfile,
  exportProfileAsJSON,
  importProfileFromJSON,
} from '@/services/strategyProfileService';

interface UseStrategyProfileReturn {
  profiles: StrategyProfile[];
  activeProfile: StrategyProfile | null;
  isLoading: boolean;
  setActiveProfile: (profile: StrategyProfile) => void;
  createProfile: (name: string) => Promise<StrategyProfile>;
  updateProfile: (profile: StrategyProfile) => Promise<void>;
  deleteProfileById: (id: string) => Promise<void>;
  duplicateProfile: (source: StrategyProfile, name?: string) => Promise<StrategyProfile>;
  setDefault: (id: string) => Promise<void>;
  exportProfile: (profile: StrategyProfile) => string;
  importProfile: (json: string) => Promise<StrategyProfile>;
  updateIndicator: (profileId: string, key: IndicatorKey, config: IndicatorConfig) => void;
}

export const useStrategyProfile = (): UseStrategyProfileReturn => {
  const { user } = useAuth();
  const userId = user?.id || null;

  const [profiles, setProfiles] = useState<StrategyProfile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<StrategyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load profiles on mount / auth change
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    loadUserProfiles(userId).then(loaded => {
      if (cancelled) return;
      setProfiles(loaded);

      // Restore active profile
      const storedId = getStoredActiveProfileId();
      const found = loaded.find(p => p.id === storedId) || loaded.find(p => p.isDefault) || loaded[0] || null;
      setActiveProfileState(found);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId]);

  const setActiveProfile = useCallback((profile: StrategyProfile) => {
    setActiveProfileState(profile);
    storeActiveProfileId(profile.id);
  }, []);

  const createProfile = useCallback(async (name: string): Promise<StrategyProfile> => {
    const newProfile = createBlankProfile(name);
    const saved = await saveProfile(newProfile, userId);
    setProfiles(prev => [saved, ...prev.filter(p => p.isPreset), ...prev.filter(p => !p.isPreset && p.id !== saved.id)]);
    return saved;
  }, [userId]);

  const updateProfile = useCallback(async (profile: StrategyProfile): Promise<void> => {
    const stats = computeProfileStats(profile);
    const saved = await saveProfile(stats, userId);
    setProfiles(prev => prev.map(p => p.id === saved.id ? saved : p));
    if (activeProfile?.id === saved.id) {
      setActiveProfileState(saved);
    }
  }, [userId, activeProfile]);

  const deleteProfileById = useCallback(async (id: string): Promise<void> => {
    await deleteProfile(id, userId);
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (activeProfile?.id === id) {
      const fallback = profiles.find(p => p.isDefault && p.id !== id) || profiles.find(p => p.id !== id) || null;
      setActiveProfileState(fallback);
      if (fallback) storeActiveProfileId(fallback.id);
    }
  }, [userId, activeProfile, profiles]);

  const duplicateProfileFn = useCallback(async (source: StrategyProfile, name?: string): Promise<StrategyProfile> => {
    const dup = dupProfile(source, name);
    const saved = await saveProfile(dup, userId);
    setProfiles(prev => [saved, ...prev.filter(p => p.isPreset), ...prev.filter(p => !p.isPreset && p.id !== saved.id)]);
    return saved;
  }, [userId]);

  const setDefault = useCallback(async (id: string): Promise<void> => {
    const updated = await setDefaultProfile(id, profiles, userId);
    setProfiles(updated);
  }, [profiles, userId]);

  const exportProfile = useCallback((profile: StrategyProfile): string => {
    return exportProfileAsJSON(profile);
  }, []);

  const importProfile = useCallback(async (json: string): Promise<StrategyProfile> => {
    const imported = importProfileFromJSON(json);
    const saved = await saveProfile(imported, userId);
    setProfiles(prev => [saved, ...prev.filter(p => p.isPreset), ...prev.filter(p => !p.isPreset)]);
    return saved;
  }, [userId]);

  const updateIndicator = useCallback((profileId: string, key: IndicatorKey, config: IndicatorConfig) => {
    setProfiles(prev => prev.map(p => {
      if (p.id !== profileId) return p;
      const updated = computeProfileStats({
        ...p,
        indicators: { ...p.indicators, [key]: config },
        updatedAt: new Date().toISOString(),
      });
      return updated;
    }));
    if (activeProfile?.id === profileId) {
      setActiveProfileState(prev => {
        if (!prev) return prev;
        return computeProfileStats({
          ...prev,
          indicators: { ...prev.indicators, [key]: config },
          updatedAt: new Date().toISOString(),
        });
      });
    }
  }, [activeProfile]);

  return {
    profiles,
    activeProfile,
    isLoading,
    setActiveProfile,
    createProfile,
    updateProfile,
    deleteProfileById,
    duplicateProfile: duplicateProfileFn,
    setDefault,
    exportProfile,
    importProfile,
    updateIndicator,
  };
};
