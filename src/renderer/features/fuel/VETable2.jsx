import React from "react";
import { Fuel } from "lucide-react";
import { TuningTablePage } from "../shared/components/TuningTablePage";

export default function VETable2() {
  return (
    <TuningTablePage
      tableKey="ve2"
      iniTableId="fuelTable2Tbl"
      icon={Fuel}
      theme="cyan"
      unitLabel=""
      secondaryTableKey="ve"
      loadAlgorithmType="fuel2"
      description={({ meta, dynamicYLabel }) =>
        `Secondary VE Table — ${meta.xLabel} vs ${dynamicYLabel}`
      }
      loadingText="Loading Secondary Table Metadata..."
    >
      <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl">
        <h3 className="text-neon-cyan font-orbitron font-black text-sm uppercase mb-2">
          Secondary Fuel Mode
        </h3>
        <p className="text-white/60 text-xs italic">
          Note: These settings determine how this table interacts with VE Table
          1.
        </p>
      </div>
    </TuningTablePage>
  );
}
