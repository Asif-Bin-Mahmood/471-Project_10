import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MapPin } from "lucide-react";
import { api } from "../api/client.js";

export default function AddressAutocomplete({
  idPrefix = "address",
  label = "Address search",
  placeholder = "Type at least 3 characters",
  initialLabel = "",
  resetSignal = 0,
  onSelect,
  required = false
}) {
  const [query, setQuery] = useState(initialLabel);
  const [selected, setSelected] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(initialLabel || "");
    setSelected(null);
    setSuggestions([]);
    setStatus("idle");
    setError("");
    setActiveIndex(-1);
    onSelect?.(null);
  }, [initialLabel, resetSignal]);

  useEffect(() => {
    const trimmed = query.trim();
    if (selected && trimmed === selected.label) return undefined;
    if (trimmed.length < 3) return undefined;

    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      setError("");
      try {
        const data = await api(`/address-suggestions?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        if (!active) return;
        const results = data.suggestions || [];
        setSuggestions(results);
        setActiveIndex(results.length ? 0 : -1);
        setStatus(results.length ? "ready" : "no-results");
      } catch (requestError) {
        if (!active || requestError.name === "AbortError") return;
        setSuggestions([]);
        setActiveIndex(-1);
        setStatus("error");
        setError(requestError.message || "Unable to load address suggestions.");
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  function updateQuery(value) {
    setQuery(value);
    setSelected(null);
    setSuggestions([]);
    setError("");
    setActiveIndex(-1);
    onSelect?.(null);
    const length = value.trim().length;
    setStatus(length === 0 ? "idle" : length < 3 ? "short" : "debouncing");
  }

  function selectSuggestion(suggestion) {
    setSelected(suggestion);
    setQuery(suggestion.label);
    setSuggestions([]);
    setStatus("selected");
    setError("");
    setActiveIndex(-1);
    onSelect?.(suggestion);
    inputRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (!suggestions.length) {
      if (event.key === "Escape") {
        setSuggestions([]);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  return (
    <div
      className="address-autocomplete"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setSuggestions([]);
          setActiveIndex(-1);
        }
      }}
    >
      <label>
        {label}
        <div className="address-input-wrap">
          <input
            ref={inputRef}
            name="address"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls={`${idPrefix}-suggestion-list`}
            aria-activedescendant={activeIndex >= 0 ? `${idPrefix}-option-${activeIndex}` : undefined}
            required={required}
          />
          {suggestions.length > 0 && (
            <div className="address-suggestion-menu" id={`${idPrefix}-suggestion-list`} role="listbox">
              {suggestions.map((item, index) => (
                <button
                  id={`${idPrefix}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "active" : ""}
                  key={item.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(item)}
                >
                  <MapPin size={15} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.area}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </label>
      {status === "short" && <p className="address-help">Enter at least 3 characters.</p>}
      {(status === "debouncing" || status === "loading") && <p className="address-help">Searching Mapbox...</p>}
      {status === "no-results" && <p className="address-help">No matching addresses found.</p>}
      {status === "error" && <p className="address-help error">{error}</p>}
      {selected && (
        <div className="selected-address" aria-live="polite">
          <CheckCircle2 size={16} />
          <span>
            <strong>{selected.label}</strong>
            <small>{selected.area}</small>
          </span>
        </div>
      )}
    </div>
  );
}
