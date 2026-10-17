import { useState, useEffect, useCallback, useMemo } from "react";
import { useStore } from "../../../core/store.js";
import { getDecodedPages } from "../utils/projectConstants.js";
import { validateConfigurationValues } from "../../../../shared/protocol/configuration-validation.js";
import { configurationWriteOptions } from '../../../../shared/protocol/board-pins.js';
import { validateConfigurationChange } from '../../../../shared/protocol/configuration-policy.js';

/**
 * Professional Tuning Module Hook.
 * Implements "Smart but Honest" vision:
 * - Doesn't "Stuck" if fields are missing.
 * - Gracefully handles version discrepancies.
 * - Fast path first + fuzzy search fallback.
 */
export function useTuningModule(targets, options = {}) {
  const { onValidate, onSaveSuccess, fallbacks = {}, page: preferredPage = null } = options;
  const currentProject = useStore((s) => s.currentProject);
  const parsedIni = useStore((s) => s.parsedIni);
  const updateConstants = useStore((s) => s.updateConstants);
  const writePagesToRAM = useStore((s) => s.writePagesToRAM);
  const burnPendingPages = useStore((s) => s.burnPendingPages);
  const saveProject = useStore((s) => s.saveProject);
  const connection = useStore((s) => s.connection);
  const notify = useStore((s) => s.notify);

  const fieldDrafts = useStore(s => s.fieldDrafts);
  const localConstants = useMemo(() => {
    const pages = { ...getDecodedPages(currentProject?.constants, parsedIni) };
    for (const [page, values] of Object.entries(fieldDrafts || {})) pages[page] = { ...pages[page], ...values };
    return pages;
  }, [currentProject?.constants, parsedIni, fieldDrafts]);
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
  const targetSignature = useMemo(() => {
    if (Array.isArray(targets)) return JSON.stringify(targets);
    return JSON.stringify([targets ?? null]);
  }, [targets]);
  const normalizedTargets = useMemo(() => {
    if (Array.isArray(targets)) return targets;
    if (targets === undefined || targets === null) return [];
    return [targets];
  }, [targetSignature]);
  const isPageTargetMode = typeof normalizedTargets[0] === "number";

  // 1. IMPROVED MAPPING
  const fieldToPageMap = useMemo(() => {
    const map = {};
    const pagesFoundSet = new Set();
    const constantsRoot = parsedIni?.constants?.pages;

    if (!constantsRoot) return { map, pagesFound: [] };

    // Numerical targets (Explicit pages)
    if (isPageTargetMode) {
      normalizedTargets.forEach((pId) => pagesFoundSet.add(pId));
      return { map, pagesFound: Array.from(pagesFoundSet) };
    }

    // String targets (Variable names)
    if (normalizedTargets.length > 0) {
      normalizedTargets.forEach((fieldName) => {
        const lowerName = fieldName.trim().toLowerCase();
        let found = false;

        const candidateEntries = preferredPage !== null && preferredPage !== undefined
          ? [
              [String(preferredPage), constantsRoot?.[preferredPage]],
              ...Object.entries(constantsRoot).filter(([pId]) => Number(pId) !== Number(preferredPage)),
            ]
          : Object.entries(constantsRoot);

        // Optimized pId scan
        for (const [pId, pageData] of candidateEntries) {
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
  }, [parsedIni, targetSignature, isPageTargetMode, preferredPage]);

  const { pagesFound } = fieldToPageMap;

  useEffect(() => { setIsMappingDone(!!parsedIni); }, [parsedIni]);

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
      if (info.meta?.type === 'array' && !Array.isArray(raw)) {
        const size = info.meta.shape?.reduce((total, value) => total * value, 1) || 1;
        return new Array(size).fill(0);
      }

      return raw ?? 0;
    },
    [localConstants, getFieldInfo, fallbacks],
  );

  const setFieldValue = useCallback((name, value) => {
    const info = getFieldInfo(name);
    if (info) useStore.getState().updateProjectFieldDrafts({ [info.pageId]: { [info.key]: value } });
  }, [getFieldInfo]);

  const getLocalPage = useCallback(pId => localConstants[pId] || {}, [localConstants]);
  const setLocalField = useCallback((pId, name, value) => {
    useStore.getState().updateProjectFieldDrafts({ [pId]: { [name]: value } });
  }, []);
  const setLocalPage = useCallback((pId, data) => {
    useStore.getState().updateProjectFieldDrafts({ [pId]: data });
  }, []);

  const buildScopedPayload = useCallback(() => {
    const scopedPages = {};

    if (isPageTargetMode) {
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
  }, [isPageTargetMode, pagesFound, localConstants, fieldToPageMap]);

  const handleSave = async (isBurn = false) => {
    const storedPages = getDecodedPages(currentProject?.constants, parsedIni);
    const needsPowerCycle = Object.entries(buildScopedPayload()).some(([page, values]) =>
      Object.entries(values).some(([name, value]) => parsedIni?.constants?.pages?.[page]?.[name]?.requiresPowerCycle &&
        value !== undefined && value !== storedPages?.[page]?.[name]));
    // An existing out-of-range value must not prevent disabling a feature.
    // Validate edits rather than unrelated values already present in the tune.
    const editedPages = Object.fromEntries(Object.entries(buildScopedPayload()).map(([page, values]) =>
      [page, Object.fromEntries(Object.entries(values).filter(([name, value]) =>
        JSON.stringify(value) !== JSON.stringify(storedPages?.[page]?.[name])))]));
    const rangeError = validateConfigurationValues(parsedIni, editedPages, storedPages, storedPages);
    if (rangeError) {
      setSaveStatus("error");
      notify(rangeError, "error");
      return { ok: false, error: rangeError };
    }
    const scoped = buildScopedPayload();
    const candidatePages = { ...storedPages };
    for (const [page, values] of Object.entries(scoped)) candidatePages[page] = { ...candidatePages[page], ...values };
    const pinError = validateConfigurationChange(parsedIni, storedPages, candidatePages, configurationWriteOptions(currentProject));
    if (pinError) {
      setSaveStatus('error');
      notify(pinError, 'error');
      return { ok: false, error: pinError };
    }
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
      const committed = useStore.getState().applyProjectTableDrafts();
      if (!committed.ok) throw new Error(committed.error);

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
        if (needsPowerCycle) notify("Pin or hardware settings changed. Burn the page, then restart the ECU to apply them.", "info", 10000);
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess(result);
        }
      } else {
        setSaveStatus("error");
        notify(result.error || "Project save failed", "error");
      }
      return result;
    } catch (e) {
      setSaveStatus("error");
      notify(e?.message || "Save failed", "error");
      return { ok: false, error: e?.message || "Save failed" };
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const discardChanges = useCallback(() => {
    const reset = {};
    if (isPageTargetMode) {
      pagesFound.forEach((pId) => {
        const decodedPage = getDecodedPages(currentProject?.constants, parsedIni)?.[pId];
        if (decodedPage) reset[pId] = decodedPage;
      });
    } else {
      Object.values(fieldToPageMap.map).forEach((info) => {
        if (!info) return;
        const decodedPage = getDecodedPages(currentProject?.constants, parsedIni)?.[info.pageId];
        if (!decodedPage) return;
        if (!reset[info.pageId]) reset[info.pageId] = {};
        reset[info.pageId][info.key] = decodedPage[info.key];
      });
    }
    const scope = Object.fromEntries(Object.entries(reset).map(([page, values]) => [page,
      isPageTargetMode ? null : Object.keys(values)]));
    useStore.getState().discardProjectFieldDrafts(scope);
    notify("Changes discarded", "info");
  }, [currentProject?.constants, pagesFound, isPageTargetMode, fieldToPageMap, notify, parsedIni]);

  const isDirty = useMemo(() => {
    if (isPageTargetMode) {
      for (const pId of pagesFound) {
        const pageSnapshot =
          currentProject?.constants?.pages?.[pId] ||
          currentProject?.constants?.pages?.[String(pId)];
        if (DIRTY_SYNC_STATES.has(pageSnapshot?.syncState)) return true;

        const current = localConstants[pId] || {};
        const store = getDecodedPages(currentProject?.constants, parsedIni)?.[pId] || {};
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
      const storeValue = getDecodedPages(currentProject?.constants, parsedIni)?.[info.pageId]?.[info.key];
      if (JSON.stringify(currentValue) !== JSON.stringify(storeValue)) return true;
    }

    return false;
  }, [
    localConstants,
    currentProject?.constants,
    pagesFound,
    DIRTY_SYNC_STATES,
    isPageTargetMode,
    fieldToPageMap,
    parsedIni,
  ]);

  const pinPages = useMemo(() => {
    const pages = { ...getDecodedPages(currentProject?.constants, parsedIni) };
    for (const [page, values] of Object.entries(localConstants)) {
      pages[page] = { ...pages[page], ...values };
    }
    return pages;
  }, [currentProject?.constants, parsedIni, localConstants]);

  return {
    pinPages,
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
