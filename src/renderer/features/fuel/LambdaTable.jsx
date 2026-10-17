import React, { useMemo } from "react";
import { Activity } from "lucide-react";
import { useStore } from "../../core/store.js";
import { getDecodedPage } from "../shared/utils/projectConstants";
import { TuningTablePage } from "../shared/components/TuningTablePage";

export default function LambdaTable() {
  const currentProject = useStore((s) => s.currentProject);
  const constants = currentProject?.constants;

  const stoich = useMemo(() => {
    if (!constants) return 14.7;
    const p1 = getDecodedPage(constants, 1) || getDecodedPage(constants, 0);
    return (p1?.stoich || 147) / 10;
  }, [constants]);

  const lambdaTransform = useMemo(
    () => ({
      toDisplay: (val) => {
        const afr = val / 10;
        return parseFloat((afr / stoich).toFixed(3));
      },
      toRaw: (val) => {
        return Math.round(val * stoich * 10);
      },
    }),
    [stoich],
  );

  return (
    <TuningTablePage
      tableKey="lambda"
      iniTableId="lambdaTable1Tbl"
      title="Lambda Target Table"
      description={`Lambda Targets — Stoich Core: ${stoich.toFixed(1)}`}
      icon={Activity}
      theme="cyan"
      unitLabel="λ"
      precision={3}
      minVal={0.5}
      maxVal={1.5}
      loadAlgorithmType="fuel1"
      transform={lambdaTransform}
      loadingText="Loading Lambda Table Metadata..."
    >
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
            Lambda 1.0
          </span>
          <span className="text-lg font-black text-neon-cyan">
            Perfect Balance
          </span>
          <span className="text-[9px] text-white/30 font-inter">
            Equivalent to {stoich.toFixed(1)} AFR
          </span>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
            Lambda &lt; 1.0
          </span>
          <span className="text-lg font-black text-amber-400">
            Rich Mixture
          </span>
          <span className="text-[9px] text-white/30 font-inter">
            Max power and cooling
          </span>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
            Lambda &gt; 1.0
          </span>
          <span className="text-lg font-black text-sky-400">Lean Mixture</span>
          <span className="text-[9px] text-white/30 font-inter">
            Fuel economy at cruise
          </span>
        </div>
      </div>
    </TuningTablePage>
  );
}
