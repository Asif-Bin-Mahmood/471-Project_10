import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

const PROPERTY_FACILITIES = [
  "Lift",
  "Generator",
  "Parking",
  "24/7 Security",
  "CCTV",
  "Fire Safety",
  "Reception",
  "Conference Room",
  "High-speed Internet",
  "Air Conditioning",
  "Backup Power",
  "Accessible Entrance",
  "Prayer Room",
  "Kitchen",
  "Rooftop",
  "Road Access",
  "Loading Bay",
  "Washroom"
];

const SERVICE_FEATURES = [
  "Consultation",
  "Planning",
  "Design",
  "Installation",
  "Delivery",
  "Office Setup",
  "Maintenance",
  "Emergency Support",
  "On-site Support",
  "Remote Support",
  "Warranty",
  "After-sales Support",
  "Customization",
  "Project Management",
  "Material Supply",
  "Testing",
  "Training"
];

function normalizeValues(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

export default function FacilitiesPicker({
  listingType,
  initialValues = [],
  resetSignal = 0,
  name = "facilities",
  customLabel,
  customSuggestions,
  maxSelections = 20,
  customPlaceholder
}) {
  const initial = useMemo(() => normalizeValues(initialValues), [initialValues]);
  const suggestions = customSuggestions || (listingType === "service" ? SERVICE_FEATURES : PROPERTY_FACILITIES);
  const label = customLabel || (listingType === "service" ? "Service features" : "Facilities");
  const inputId = useId();
  const rootRef = useRef(null);
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSelected(initial);
    setQuery("");
    setOpen(false);
  }, [resetSignal]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const filtered = (selected.length >= maxSelections ? [] : suggestions).filter((item) => (
    !selected.some((value) => value.toLowerCase() === item.toLowerCase()) &&
    item.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const cleanedQuery = query.trim();
  const canAddCustom = selected.length < maxSelections && cleanedQuery.length >= 2 &&
    !selected.some((item) => item.toLowerCase() === cleanedQuery.toLowerCase()) &&
    !suggestions.some((item) => item.toLowerCase() === cleanedQuery.toLowerCase());

  function addValue(value) {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) return;
    setSelected((current) => {
      if (current.length >= maxSelections || current.some((item) => item.toLowerCase() === cleanValue.toLowerCase())) return current;
      return [...current, cleanValue];
    });
    setQuery("");
    setOpen(true);
  }

  function removeValue(value) {
    setSelected((current) => current.filter((item) => item !== value));
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Backspace" && !query && selected.length) {
      removeValue(selected.at(-1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (filtered.length) addValue(filtered[0]);
      else if (canAddCustom) addValue(cleanedQuery);
    }
  }

  return (
    <div className="facility-picker" ref={rootRef}>
      <label htmlFor={inputId}>{label}</label>
      <input type="hidden" name={name} value={selected.join(", ")} readOnly />
      <div className={`facility-picker-control ${open ? "open" : ""}`}>
        <Search size={17} aria-hidden="true" />
        <input
          id={inputId}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={customPlaceholder || `Search or add ${label.toLowerCase()}...`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-options`}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>

      {selected.length ? (
        <div className="facility-selected" aria-label={`Selected ${label.toLowerCase()}`}>
          {selected.map((item) => (
            <span key={item}>
              <Check size={13} />{item}
              <button type="button" onClick={() => removeValue(item)} aria-label={`Remove ${item}`}><X size={13} /></button>
            </span>
          ))}
        </div>
      ) : <p className="facility-picker-help">Choose one or more suggestions, or type your own.</p>}

      {open ? (
        <div className="facility-options" id={`${inputId}-options`} role="listbox">
          <div className="facility-options-head">
            <strong>{query ? "Matching suggestions" : "Popular suggestions"}</strong>
            <small>{selected.length}/{maxSelections} selected</small>
          </div>
          {filtered.slice(0, 10).map((item) => (
            <button type="button" role="option" aria-selected="false" key={item} onClick={() => addValue(item)}>
              <Plus size={15} /><span>{item}</span>
            </button>
          ))}
          {canAddCustom ? (
            <button className="facility-custom-option" type="button" role="option" aria-selected="false" onClick={() => addValue(cleanedQuery)}>
              <Plus size={15} /><span>Add “{cleanedQuery}”</span>
            </button>
          ) : null}
          {!filtered.length && !canAddCustom ? <p>No more matching suggestions.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
