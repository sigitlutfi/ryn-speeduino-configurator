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

  const DIRTY_SYNC_STATES = useMemo(
    () =>
      new Set([
        "dirty-local",
        "write-pending",
        "burn-pending",
        "different",
        "verify-failed",
        "unknown",
      ]),
    [],
  );

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

  const buildScopedPayload = useCallback(() => {
    const scopedPages = {};

    if (typeof targets[0] === "number") {
      pagesFound.forEach((pId) => {
        scopedPages[pId] = { ...(localConstants[pId] || {}) };
      });
      return scopedPages;
    }

    Object.entries(fieldToPageMap.map).forEach(([fieldName, info]) => {
      if (!info) return;
      const pageId = info.pageId;
      if (!scopedPages[pageId]) scopedPages[pageId] = {};
      scopedPages[pageId][info.key] = localConstants[pageId]?.[info.key];
    });

    return scopedPages;
  }, [targets, pagesFound, localConstants, fieldToPageMap]);

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
      const scopedPayload = buildScopedPayload();

      // Update project-local decoded/raw state first
      await updateConstants(scopedPayload);

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
    if (typeof targets[0] === "number") {
      pagesFound.forEach((pId) => {
        const decodedPage = getDecodedPages(currentProject?.constants)?.[pId];
        if (decodedPage) reset[pId] = decodedPage;
      });
    } else {
      Object.values(fieldToPageMap.map).forEach((info) => {
        if (!info) return;
        const decodedPage = getDecodedPages(currentProject?.constants)?.[info.pageId];
        if (!decodedPage) return;
        if (!reset[info.pageId]) reset[info.pageId] = {};
        reset[info.pageId][info.key] = decodedPage[info.key];
      });
    }
    setLocalConstants(reset);
    notify("Changes discarded", "info");
  }, [currentProject?.constants, pagesFound, targets, fieldToPageMap, notify]);

  const isDirty = useMemo(() => {
    if (typeof targets[0] === "number") {
      for (const pId of pagesFound) {
        const pageSnapshot =
          currentProject?.constants?.pages?.[pId] ||
          currentProject?.constants?.pages?.[String(pId)];
        if (DIRTY_SYNC_STATES.has(pageSnapshot?.syncState)) return true;

        const current = localConstants[pId] || {};
        const store = getDecodedPages(currentProject?.constants)?.[pId] || {};
        if (JSON.stringify(current) !== JSON.stringify(store)) return true;
      }
      return false;
    }

    for (const info of Object.values(fieldToPageMap.map)) {
      if (!info) continue;
      const pageSnapshot =
        currentProject?.constants?.pages?.[info.pageId] ||
        currentProject?.constants?.pages?.[String(info.pageId)];
      if (DIRTY_SYNC_STATES.has(pageSnapshot?.syncState)) return true;

      const currentValue = localConstants[info.pageId]?.[info.key];
      const storeValue = getDecodedPages(currentProject?.constants)?.[info.pageId]?.[info.key];
      if (JSON.stringify(currentValue) !== JSON.stringify(storeValue)) return true;
    }

    return false;
  }, [
    localConstants,
    currentProject?.constants,
    pagesFound,
    DIRTY_SYNC_STATES,
    targets,
    fieldToPageMap,
  ]);

  return {
    localConstants,
    getFieldValue,
    setFieldValue,
    setLocalPage,
    setLocalField,
    getLocalPage,
    getFieldInfo,
    getSavePayload: buildScopedPayload,
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
