import React from "react";
import { Activity } from "lucide-react";
import { TuningTablePage } from "../shared/components/TuningTablePage";

export default function IgnitionTable() {
  return (
    <TuningTablePage
      tableKey="ign"
      iniTableId="sparkTbl"
      icon={Activity}
      theme="purple"
      headerTheme="orange"
      unitLabel="DEG"
      defaultRange={{ min: 0, max: 50 }}
      secondaryTableKey="ign2"
      loadAlgorithmType="ign1"
      description={({ meta, dynamicYLabel }) =>
        `Ignition Table — ${meta.xLabel} vs ${dynamicYLabel}`
      }
      loadingText="Loading Ignition Metadata..."
    />
  );
}
