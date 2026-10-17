import React from "react";
import { Fuel } from "lucide-react";
import { TuningTablePage } from "../shared/components/TuningTablePage";

export default function VETable() {
  return (
    <TuningTablePage
      tableKey="ve"
      iniTableId="veTable1Tbl"
      icon={Fuel}
      theme="cyan"
      unitLabel="VE"
      secondaryTableKey="ve2"
      loadAlgorithmType="fuel1"
      description={({ meta, dynamicYLabel }) =>
        `VE Table — ${meta.xLabel} vs ${dynamicYLabel}`
      }
      loadingText="Loading Table Metadata..."
    />
  );
}
