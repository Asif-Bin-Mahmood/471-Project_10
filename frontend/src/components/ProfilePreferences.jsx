import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import FacilitiesPicker from "./FacilitiesPicker.jsx";

const SERVICE_NEEDS = [
  "Interior Design",
  "Internet / ISP",
  "Electrical Setup",
  "Furniture & Fixtures",
  "Security & CCTV",
  "Cleaning Service",
  "Moving & Logistics",
  "Maintenance",
  "Branding & Signage",
  "Legal & Documentation"
];

function money(value) {
  return `BDT ${Number(value).toLocaleString("en-BD")}`;
}

function OptionalRange({ name, label, value, min, max, step, formatter, onChange }) {
  const selected = Number(value) > 0;
  const sliderMax = Math.max(max, Math.ceil(Number(value || 0) / step) * step);
  return (
    <div className="preference-range">
      <div className="preference-range-head">
        <label htmlFor={`preference-${name}-amount`}>{label}</label>
        <strong className={selected ? "" : "unset"}>{selected ? formatter(value) : "Not set"}</strong>
      </div>
      <input
        className="preference-number-input"
        id={`preference-${name}-amount`}
        name={name}
        type="number"
        min={min}
        step={step}
        value={selected ? value : ""}
        onChange={(event) => onChange(event.target.value === "" ? 0 : Math.max(min, Number(event.target.value) || 0))}
        placeholder="Enter any amount"
      />
      <input
        id={`preference-${name}-slider`}
        type="range"
        min={min}
        max={sliderMax}
        step={step}
        value={selected ? value : min}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={selected ? formatter(value) : "Not set"}
        aria-label={`${label} slider`}
      />
      <div className="preference-range-scale"><span>{formatter(min)}</span><span>{formatter(sliderMax)}+</span></div>
    </div>
  );
}

export default function ProfilePreferences({ user }) {
  const [budgetMin, setBudgetMin] = useState(Number(user?.budgetMin) || 0);
  const [budgetMax, setBudgetMax] = useState(Number(user?.budgetMax) || 0);
  const [minSize, setMinSize] = useState(Number(user?.minSize) || 0);

  function clearRanges() {
    setBudgetMin(0);
    setBudgetMax(0);
    setMinSize(0);
  }

  function updateMinimum(nextValue) {
    setBudgetMin(nextValue);
    if (budgetMax > 0 && nextValue > budgetMax) setBudgetMax(nextValue);
  }

  function updateMaximum(nextValue) {
    setBudgetMax(nextValue);
    if (nextValue > 0 && budgetMin > nextValue) setBudgetMin(nextValue);
  }

  return (
    <fieldset className="profile-fieldset profile-preferences">
      <legend>Workspace preferences</legend>
      <div className="preference-intro">
        <span><SlidersHorizontal size={17} /></span>
        <div><strong>Set only what matters to you</strong><p>Move a slider or type any larger amount. Unchanged preferences remain empty.</p></div>
        <button type="button" onClick={clearRanges}><RotateCcw size={14} />Clear sliders</button>
      </div>
      <div className="field-row">
        <label>Business type<input name="businessType" defaultValue={user?.businessType || ""} maxLength="80" placeholder="e.g. Startup, retail, consultancy" /></label>
        <label>Preferred area<input name="preferredArea" defaultValue={user?.preferredArea || ""} maxLength="80" placeholder="Search area from Marketplace" /></label>
      </div>
      <div className="profile-range-grid">
        <OptionalRange name="budgetMin" label="Minimum monthly budget" value={budgetMin} min={0} max={500000} step={5000} formatter={money} onChange={updateMinimum} />
        <OptionalRange name="budgetMax" label="Maximum monthly budget" value={budgetMax} min={0} max={500000} step={5000} formatter={money} onChange={updateMaximum} />
        <OptionalRange name="minSize" label="Minimum workspace size" value={minSize} min={0} max={5000} step={50} formatter={(value) => `${Number(value).toLocaleString("en-BD")} sq ft`} onChange={setMinSize} />
      </div>
      <FacilitiesPicker
        listingType="service"
        name="serviceNeed"
        customLabel="Setup services needed"
        customSuggestions={SERVICE_NEEDS}
        initialValues={user?.serviceNeed || ""}
        maxSelections={4}
        customPlaceholder="Search services such as internet or interior design..."
      />
    </fieldset>
  );
}
