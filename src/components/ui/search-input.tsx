"use client";
import { useEffect, useRef, useState } from "react";
export function SearchInput({
  value,
  onValueChange,
  label,
  placeholder,
  preventSubmit = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  preventSubmit?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [isComposing, setIsComposing] = useState(false);
  const [hasValue, setHasValue] = useState(Boolean(value));
  useEffect(() => {
    if (!composing.current && ref.current) ref.current.value = value;
  }, [value]);
  return (
    <span className="p2-search-input">
      <input
        ref={ref}
        type="search"
        defaultValue={value}
        aria-label={label}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (preventSubmit && e.key === "Enter") e.preventDefault();
        }}
        onCompositionStart={() => {
          composing.current = true;
          setIsComposing(true);
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          setIsComposing(false);
          onValueChange(e.currentTarget.value);
        }}
        onChange={(e) => {
          setHasValue(Boolean(e.currentTarget.value));
          if (!composing.current) onValueChange(e.currentTarget.value);
        }}
      />
      {(value || (isComposing && hasValue)) && (
        <button
          type="button"
          className="p2-search-clear"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            if (ref.current) ref.current.value = "";
            setHasValue(false);
            onValueChange("");
            ref.current?.focus();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </span>
  );
}
