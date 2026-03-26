import React from "react";
import { useStore } from "../../core/store.js";
import SparkSettings from "./SparkSettings";
import DwellSettings from "./DwellSettings";
import DwellVoltageCurve from "./curves/DwellVoltageCurve";
import IATRetardCurve from "./curves/IATRetardCurve";
import ColdAdvanceCurve from "./curves/ColdAdvanceCurve";
import { Zap, Activity, Thermometer, ShieldAlert, ZapIcon } from "lucide-react";

const CurvePlaceholder = ({ title, icon: Icon, description }) => (
  <div className="glass-card border border-white/5 rounded-2xl p-6 bg-black/20 flex flex-col gap-4 relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-1 h-full bg-white/10" />
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-white/5 text-white/40">
        <Icon size={16} />
      </div>
      <div>
        <h3 className="text-[12px] font-black text-white/80 uppercase tracking-widest">
          {title}
        </h3>
        <p className="text-[10px] text-white/30 font-inter">{description}</p>
      </div>
    </div>
    <div className="h-40 w-full border border-dashed border-white/10 rounded-xl flex items-center justify-center bg-white/5">
      <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
        Universal CurveEditor — Under Construction
      </span>
    </div>
  </div>
);

export default function SparkSetup() {
  return (
    <div className=" h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar bg-transparent rounded-3xl">
      <div className="max-w-4xl flex flex-col gap-8 pb-12">
        {/* Main Spark Configuration Component */}
        <SparkSettings />

        {/* Dwell Module */}
        <DwellSettings />

        {/* Spark Curves / Compensations */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[10px] font-black text-white/60 uppercase tracking-widest pl-2 pt-4">
            Ignition Compensations
          </h2>
          <DwellVoltageCurve />
          <IATRetardCurve />
          <ColdAdvanceCurve />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-[10px] font-black text-white/60 uppercase tracking-widest pl-2 pt-4">
            Engine Integrity
          </h2>
          <CurvePlaceholder
            title="Knock Settings"
            icon={ShieldAlert}
            description="DSP Knock detection parameters and automatic aggressive timing truncation."
          />
        </div>
      </div>
    </div>
  );
}
