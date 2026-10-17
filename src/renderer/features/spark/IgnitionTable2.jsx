import React from "react";
import { Flame } from "lucide-react";
import { TuningTablePage } from "../shared/components/TuningTablePage";

export default function IgnitionTable2() {
  return (
    <TuningTablePage
      tableKey="ign2"
      iniTableId="spark2Tbl"
      title="Secondary Ignition Table"
      description="Dual-fuel or switchable ignition advance"
      icon={Flame}
      theme="orange"
      headerTheme="orange"
      unitLabel="DEG"
      defaultRange={{ min: 0, max: 50 }}
      secondaryTableKey="ign"
      loadAlgorithmType="ign2"
      loadingText="Loading Secondary Ignition Metadata..."
    />
  );
}
