import { useState, useEffect, useCallback, useMemo } from "react";
import { useStore } from "../../../core/store.js";
import { getDecodedPages } from "../utils/projectConstants.js";

/**
 * Professional Tuning Module Hook.
 * Implements "Smart but Honest" vision:
 * - Doesn't "Stuck" if fields are missing.
 * - Gracefully handles version discrepancies.
 * - Fast path first + fuzzy search fallback.
 */
export function useTuningModule(targets, options = {}) {
  const { onValidate, onSaveSuccess, fallbacks = {} } = options;
  const currentProject = useStore((s) => s.currentProject);
  const parsedIni = useStore((s) => s.parsedIni);
  const updateConstants = useStore((s) => s.updateConstants);
  const writePagesToRAM = useStore((s) => s.writePagesToRAM);
  const burnPendingPages = useStore((s) => s.burnPendingPages);
  const saveProject = useStore((s) => s.saveProject);
  const connection = useStore((s) => s.connection);
  const notify = useStore((s) => s.notify);

  const [localConstants, setLocalConstants] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isMappingDone, setIsMappingDone] = useState(false);

  const isConnected = connection.status === "connected";

  // 1. IMPROVED MAPPING
  const fieldToPageMap = useMemo(() => {
    const map = {};
    const pagesFoundSet = new Set();
    const constantsRoot = parsedIni?.constants?.pages;

    if (!constantsRoot) return { map, pagesFound: [] };

    // Numerical targets (Explicit pages)
    if (typeof targets[0] === "number") {
      targets.forEach((pId) => pagesFoundSet.add(pId));
      return { map, pagesFound: Array.from(pagesFoundSet) };
    }

    // String targets (Variable names)
    if (targets && targets.length > 0) {
      targets.forEach((fieldName) => {
        const lowerName = fieldName.trim().toLowerCase();
        let found = false;

        // Optimized pId scan
        for (const [pId, pageData] of Object.entries(constantsRoot)) {
          if (!pageData) continue;

          // Strategy A: Direct Match (Fast)
          if (pageData[fieldName]) {
            const numericId = parseInt(pId);
            map[fieldName] = {
              pageId: numericId,
              key: fieldName,
              meta: pageData[fieldName],
            };
            pagesFoundSet.add(numericId);
            found = true;
            break;
          }

          // Strategy B: Fuzzy Match (Case Insensitive)
          const realKey = Object.keys(pageData).find(
            (k) => k.trim().toLowerCase() === lowerName,
          );

          if (realKey) {
            const numericId = parseInt(pId);
            map[fieldName] = {
              pageId: numericId,
              key: realKey,
              meta: pageData[realKey],
            };
            pagesFoundSet.add(numericId);
            found = true;
            break;
          }
        }

        if (!found) {
          console.warn(
            `[TuningModule] Variable "${fieldName}" not found in current INI definitions.`,
          );
        }
      });
    }

    return { map, pagesFound: Array.from(pagesFoundSet) };
  }, [parsedIni, JSON.stringify(targets)]);

  const { pagesFound } = fieldToPageMap;

  // 2. DATA SYNCHRONIZATION
  useEffect(() => {
    if (currentProject?.constants) {
      setLocalConstants((prev) => {
        const next = { ...prev };
        let hasChanges = false;

        // Sync targeted pages
        pagesFound.forEach((pId) => {
          const storeData = getDecodedPages(currentProject.constants)?.[pId] || {};
          if (JSON.stringify(prev[pId]) !== JSON.stringify(storeData)) {
            next[pId] = storeData;
            hasChanges = true;
          }
        });

        // Finalize mapping state
        if (!isMappingDone && parsedIni) setIsMappingDone(true);

        return hasChanges ? next : prev;
      });
    }
  }, [currentProject?.constants, pagesFound, parsedIni, isMappingDone]);

  // Handle case where parsedIni is available but pagesFound is empty (e.g. invalid names)
  useEffect(() => {
    if (parsedIni && !isMappingDone) {
      const timer = setTimeout(() => setIsMappingDone(true), 200); // Small grace period
      return () => clearTimeout(timer);
    }
  }, [parsedIni, isMappingDone]);

  // 3. INTERNAL HELPERS
  const getFieldInfo = useCallback(
    (name) => {
      return fieldToPageMap.map[name] || null;
    },
    [fieldToPageMap],
  );

  const getFieldValue = useCallback(
    (name) => {
      const info = getFieldInfo(name);
      if (!info) return 0;

      // Priority: localConstants -> parsedIni defaultValue -> custom fallbacks -> 0
      let raw = localConstants[info.pageId]?.[info.key];

      if (raw === undefined || raw === null) {
        raw = info.meta?.defaultValue ?? fallbacks[name];
      }

      // If it's an array field but the current value is not an array (or is missing)
      if (info.meta?.isArray && !Array.isArray(raw)) {
        const size = info.meta.dimensions?.[0] || 1;
        return new Array(size).fill(0);
      }

      return raw ?? 0;
    },
    [localConstants, getFieldInfo, fallbacks],
  );

  const setFieldValue = useCallback(
    (name, value) => {
      const info = getFieldInfo(name);
      if (!info) return;

      setLocalConstants((prev) => ({
        ...prev,
        [info.pageId]: {
          ...(prev[info.pageId] || {}),
          [info.key]: value,
        },
      }));
    },
    [getFieldInfo],
  );

  const getLocalPage = useCallback(
    (pId) => {
      return localConstants[pId] || {};
    },
    [localConstants],
  );

  const setLocalField = useCallback((pId, name, value) => {
    setLocalConstants((prev) => ({
      ...prev,
      [pId]: {
        ...(prev[pId] || {}),
        [name]: value,
      },
    }));
  }, []);

  const setLocalPage = useCallback((pId, data) => {
    setLocalConstants((prev) => ({
      ...prev,
      [pId]: { ...(prev[pId] || {}), ...data },
    }));
  }, []);

  const handleSave = async (isBurn = false) => {
    if (isBurn && !isConnected) {
      notify("Device not connected", "error");
      return { ok: false };
    }

    if (onValidate && !onValidate(localConstants)) {
      setSaveStatus("error");
      notify("Form validation failed", "error");
      return { ok: false };
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      // Update project-local decoded/raw state first
      await updateConstants(localConstants);

      if (isConnected && pagesFound.length > 0) {
        const ramResult = await writePagesToRAM(pagesFound);
        if (!ramResult.ok) {
          throw new Error(ramResult.errors?.[0]?.error || "ECU RAM sync failed");
        }

        if (isBurn) {
          const burnResult = await burnPendingPages(pagesFound);
          if (!burnResult.ok) {
            throw new Error(burnResult.errors?.[0]?.error || "ECU burn failed");
          }
        }
      }

      const result = await saveProject();
      if (result.ok) {
        setSaveStatus("success");
      } else {
        setSaveStatus("error");
      }
      return result;
    } catch (e) {
      setSaveStatus("error");
      return { ok: false };
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const discardChanges = useCallback(() => {
    const reset = {};
    pagesFound.forEach((pId) => {
      const decodedPage = getDecodedPages(currentProject?.constants)?.[pId];
      if (decodedPage) reset[pId] = decodedPage;
    });
    setLocalConstants(reset);
    notify("Changes discarded", "info");
  }, [currentProject?.constants, pagesFound]);

  const isDirty = useMemo(() => {
    for (const pId of pagesFound) {
      const current = localConstants[pId] || {};
      const store = getDecodedPages(currentProject?.constants)?.[pId] || {};
      if (JSON.stringify(current) !== JSON.stringify(store)) return true;
    }
    return false;
  }, [localConstants, currentProject?.constants, pagesFound]);

  return {
    localConstants,
    getFieldValue,
    setFieldValue,
    setLocalPage,
    setLocalField,
    getLocalPage,
    getFieldInfo,
    handleSave,
    discardChanges,
    isSaving,
    saveStatus,
    isConnected,
    isDirty,
    pagesFound,
    isReady: !!parsedIni && isMappingDone,
  };
}
