import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useBrand } from "@/contexts/BrandContext";

// ============================================================================
// CampaignDraftContext
//
// Holds the in-progress campaign as the user moves between /strategy,
// /creative, and /launch. Persists to sessionStorage so a refresh or a
// route change doesn't drop the draft. Scoped per active brand so two
// brands don't share a half-built campaign.
// ============================================================================

export interface DraftStrategy {
  id?: string;
  name?: string;
  slug?: string;
  goal?: string;
  objective?: string;
  audience?: string;
  description?: string;
  creative_brief?: string;
  [key: string]: any;
}

export interface DraftCreativeConcept {
  id: string;
  title?: string;
  angle?: string;
  styleHint?: string;
  templateName?: string;
  copy?: Record<string, any>;
  assetUrl?: string;
  thumbnailUrl?: string;
  [key: string]: any;
}

export interface DraftBudget {
  daily?: number;
  total?: number;
  currency?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
}

export interface CampaignDraft {
  brandId: string | null;
  strategy: DraftStrategy | null;
  concepts: DraftCreativeConcept[];
  budget: DraftBudget | null;
  notes?: string;
  updatedAt: string;
}

const EMPTY_DRAFT = (brandId: string | null): CampaignDraft => ({
  brandId,
  strategy: null,
  concepts: [],
  budget: null,
  notes: "",
  updatedAt: new Date().toISOString(),
});

const STORAGE_KEY_BASE = "lumi:campaign-draft";
const keyFor = (brandId: string | null) =>
  `${STORAGE_KEY_BASE}:${brandId ?? "anon"}`;

function loadDraft(brandId: string | null): CampaignDraft {
  try {
    const raw = sessionStorage.getItem(keyFor(brandId));
    if (!raw) return EMPTY_DRAFT(brandId);
    const parsed = JSON.parse(raw) as CampaignDraft;
    return { ...EMPTY_DRAFT(brandId), ...parsed, brandId };
  } catch {
    return EMPTY_DRAFT(brandId);
  }
}

function saveDraft(draft: CampaignDraft) {
  try {
    sessionStorage.setItem(keyFor(draft.brandId), JSON.stringify(draft));
  } catch {
    // ignore quota / serialization errors
  }
}

interface CampaignDraftContextValue {
  draft: CampaignDraft;
  setStrategy: (strategy: DraftStrategy | null) => void;
  setBudget: (budget: DraftBudget | null) => void;
  addConcept: (concept: DraftCreativeConcept) => void;
  removeConcept: (conceptId: string) => void;
  setConcepts: (concepts: DraftCreativeConcept[]) => void;
  toggleConcept: (concept: DraftCreativeConcept) => void;
  updateDraft: (partial: Partial<CampaignDraft>) => void;
  clearDraft: () => void;
  hasDraft: boolean;
}

const CampaignDraftContext = createContext<CampaignDraftContextValue | null>(
  null,
);

export function CampaignDraftProvider({ children }: { children: ReactNode }) {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id ?? null;
  const [draft, setDraft] = useState<CampaignDraft>(() => loadDraft(brandId));

  // When the active brand changes, reload that brand's draft from storage.
  useEffect(() => {
    setDraft(loadDraft(brandId));
  }, [brandId]);

  // Persist every change.
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  // Cross-tab sync.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === keyFor(brandId)) setDraft(loadDraft(brandId));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [brandId]);

  const mutate = useCallback(
    (updater: (prev: CampaignDraft) => CampaignDraft) => {
      setDraft((prev) => ({
        ...updater(prev),
        brandId,
        updatedAt: new Date().toISOString(),
      }));
    },
    [brandId],
  );

  const setStrategy = useCallback(
    (strategy: DraftStrategy | null) =>
      mutate((prev) => ({ ...prev, strategy })),
    [mutate],
  );

  const setBudget = useCallback(
    (budget: DraftBudget | null) => mutate((prev) => ({ ...prev, budget })),
    [mutate],
  );

  const setConcepts = useCallback(
    (concepts: DraftCreativeConcept[]) =>
      mutate((prev) => ({ ...prev, concepts })),
    [mutate],
  );

  const addConcept = useCallback(
    (concept: DraftCreativeConcept) =>
      mutate((prev) => {
        if (prev.concepts.some((c) => c.id === concept.id)) return prev;
        return { ...prev, concepts: [...prev.concepts, concept] };
      }),
    [mutate],
  );

  const removeConcept = useCallback(
    (conceptId: string) =>
      mutate((prev) => ({
        ...prev,
        concepts: prev.concepts.filter((c) => c.id !== conceptId),
      })),
    [mutate],
  );

  const toggleConcept = useCallback(
    (concept: DraftCreativeConcept) =>
      mutate((prev) => {
        const exists = prev.concepts.some((c) => c.id === concept.id);
        return {
          ...prev,
          concepts: exists
            ? prev.concepts.filter((c) => c.id !== concept.id)
            : [...prev.concepts, concept],
        };
      }),
    [mutate],
  );

  const updateDraft = useCallback(
    (partial: Partial<CampaignDraft>) =>
      mutate((prev) => ({ ...prev, ...partial })),
    [mutate],
  );

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(keyFor(brandId));
    } catch {
      // ignore
    }
    setDraft(EMPTY_DRAFT(brandId));
  }, [brandId]);

  const hasDraft = useMemo(
    () =>
      !!draft.strategy ||
      draft.concepts.length > 0 ||
      !!draft.budget,
    [draft],
  );

  const value = useMemo<CampaignDraftContextValue>(
    () => ({
      draft,
      setStrategy,
      setBudget,
      addConcept,
      removeConcept,
      setConcepts,
      toggleConcept,
      updateDraft,
      clearDraft,
      hasDraft,
    }),
    [
      draft,
      setStrategy,
      setBudget,
      addConcept,
      removeConcept,
      setConcepts,
      toggleConcept,
      updateDraft,
      clearDraft,
      hasDraft,
    ],
  );

  return (
    <CampaignDraftContext.Provider value={value}>
      {children}
    </CampaignDraftContext.Provider>
  );
}

export function useCampaignDraft(): CampaignDraftContextValue {
  const ctx = useContext(CampaignDraftContext);
  if (!ctx) {
    throw new Error(
      "useCampaignDraft must be used within a CampaignDraftProvider",
    );
  }
  return ctx;
}
