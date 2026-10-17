import React from "react";
import { Target } from "lucide-react";
import { TuningTablePage } from "../shared/components/TuningTablePage";

export default function AFRTable() {
  return (
    <TuningTablePage
      tableKey="afr"
      iniTableId="afrTable1Tbl"
      title={({ meta }) => meta.title || "AFR Target Table"}
      description={({ scaling }) =>
        `AFR Target — Units: ${scaling.scale === 0.1 ? "0.1 Scale" : "Standard"}`
      }
      icon={Target}
      theme="green"
      unitLabel="AFR"
      precision={1}
      minVal={7.0}
      maxVal={20.0}
      loadAlgorithmType="fuel1"
      loadingText="Loading AFR Table Metadata..."
    >
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
            Stoichiometric AFR
          </span>
          <span className="text-lg font-black text-neon-green">14.7 : 1</span>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
            Rich (Max Power)
          </span>
          <span className="text-lg font-black text-amber-400">
            12.5–13.0 : 1
          </span>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
            Lean (Economy)
          </span>
          <span className="text-lg font-black text-sky-400">15.0–16.0 : 1</span>
        </div>
      </div>
    </TuningTablePage>
  );
}
