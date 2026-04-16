import React from "react";
import { Check } from "lucide-react";

export default function Stepper({ currentStep }) {
  const steps = [
    { id: 1, label: "Profile", sub: "Basic Details" },
    { id: 2, label: "Policy", sub: "Plan Selection" },
    { id: 3, label: "Payouts", sub: "Link Account" }
  ];

  return (
    <div className="stepper-wrap">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className={`step-item ${currentStep === s.id ? "active" : currentStep > s.id ? "done" : ""}`}>
            <div className="step-num">
              {currentStep > s.id ? <Check size={14} /> : s.id}
            </div>
            <div className="step-text">
              <div className="step-label">{s.label}</div>
              <div className="step-sub">{s.sub}</div>
            </div>
          </div>
          {i < steps.length - 1 && <div className="step-line" />}
        </React.Fragment>
      ))}
    </div>
  );
}
