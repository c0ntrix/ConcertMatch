"use client";

import { useId, useState } from "react";
import { CalendarDays, MapPin, Radius } from "lucide-react";
import { CITIES } from "@/lib/catalog";
import { addCalendarMonths, localDate, offsetDays } from "@/lib/date";
import type { Preferences } from "@/lib/types";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";

type SearchFieldProps = {
  value: Preferences;
  onChange: (preferences: Preferences) => void;
};

type Period = "four-weeks" | "three-months" | "six-months" | "custom";

const CITY_NAMES = CITIES.map((city) => city.name);
const RADII = [25, 50, 100, 150, 200, 300, 500, 750, 1000];
const PERIODS: { value: Period; label: string }[] = [
  { value: "four-weeks", label: "Nächste 4 Wochen" },
  { value: "three-months", label: "Nächste 3 Monate" },
  { value: "six-months", label: "Nächste 6 Monate" },
  { value: "custom", label: "Datum wählen" },
];

function periodRange(period: Exclude<Period, "custom">) {
  const start = new Date();
  const from = localDate(start);
  const to =
    period === "four-weeks"
      ? offsetDays(from, 28)
      : localDate(addCalendarMonths(start, period === "three-months" ? 3 : 6));
  return { from, to };
}

function inferPeriod(value: Preferences): Period {
  for (const period of PERIODS) {
    if (period.value === "custom") continue;
    const range = periodRange(period.value);
    if (range.from === value.from && range.to === value.to) return period.value;
  }
  return "custom";
}

export function LocationFields({ value, onChange }: SearchFieldProps) {
  const id = useId();

  return (
    <div className="location-fields">
      <div className="search-field location-city">
        <label className="search-field-label" htmlFor={`${id}-city`}>
          <MapPin size={15} aria-hidden="true" /> Stadt
        </label>
        <Combobox
          items={CITY_NAMES}
          value={value.city}
          onValueChange={(name) => {
            const city = CITIES.find((city) => city.name === name);
            if (city)
              onChange({
                ...value,
                city: city.name,
                lat: city.lat,
                lng: city.lng,
              });
          }}
        >
          <ComboboxInput
            id={`${id}-city`}
            className="search-control"
            aria-label="Startort"
            placeholder="Stadt suchen"
            autoComplete="off"
          />
          <ComboboxContent className="search-popover">
            <ComboboxEmpty>Keine Stadt gefunden.</ComboboxEmpty>
            <ComboboxList>
              {(name: string) => (
                <ComboboxItem className="search-option" key={name} value={name}>
                  {name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
      <div className="search-field">
        <label className="search-field-label" htmlFor={`${id}-radius`}>
          <Radius size={15} aria-hidden="true" /> Umkreis
        </label>
        <Select
          value={String(value.radius)}
          onValueChange={(radius) =>
            onChange({ ...value, radius: Number(radius) })
          }
        >
          <SelectTrigger
            id={`${id}-radius`}
            className="search-control"
            aria-label="Maximale Entfernung"
          >
            <SelectValue>Bis {value.radius} km</SelectValue>
          </SelectTrigger>
          <SelectContent
            className="search-popover"
            position="popper"
            align="start"
          >
            {RADII.map((radius) => (
              <SelectItem
                className="search-option"
                key={radius}
                value={String(radius)}
              >
                Bis {radius} km
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function SearchFields({ value, onChange }: SearchFieldProps) {
  const id = useId();
  const [selection, setSelection] = useState(() => ({
    from: value.from,
    to: value.to,
    period: inferPeriod(value),
  }));
  const period =
    selection.from === value.from && selection.to === value.to
      ? selection.period
      : inferPeriod(value);

  function changePeriod(next: Period) {
    const range =
      next === "custom"
        ? { from: value.from, to: value.to }
        : periodRange(next);
    setSelection({ ...range, period: next });
    if (next !== "custom") onChange({ ...value, ...range });
  }

  function changeDate(field: "from" | "to", next: string) {
    if (!next) return;
    const from = field === "from" ? next : value.from;
    let to = field === "to" ? next : value.to;
    const latest = offsetDays(from, 366);
    if (to < from) to = from;
    if (to > latest) to = latest;
    setSelection({ from, to, period: "custom" });
    onChange({ ...value, from, to });
  }

  return (
    <div className="search-fields">
      <LocationFields value={value} onChange={onChange} />
      <div className="search-field search-period">
        <label className="search-field-label" htmlFor={`${id}-period`}>
          <CalendarDays size={15} aria-hidden="true" /> Zeitraum
        </label>
        <Select
          value={period}
          onValueChange={(next) => changePeriod(next as Period)}
        >
          <SelectTrigger
            id={`${id}-period`}
            className="search-control"
            aria-label="Zeitraum"
          >
            <SelectValue>
              {PERIODS.find((option) => option.value === period)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            className="search-popover"
            position="popper"
            align="start"
          >
            {PERIODS.map((option) => (
              <SelectItem
                className="search-option"
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {period === "custom" && (
        <div className="search-date-range">
          <div className="search-field search-date-field">
            <label className="search-field-label" htmlFor={`${id}-from`}>
              Von
            </label>
            <input
              id={`${id}-from`}
              className="search-control"
              type="date"
              value={value.from}
              required
              onChange={(event) => changeDate("from", event.target.value)}
            />
          </div>
          <div className="search-field search-date-field">
            <label className="search-field-label" htmlFor={`${id}-to`}>
              Bis
            </label>
            <input
              id={`${id}-to`}
              className="search-control"
              type="date"
              value={value.to}
              min={value.from}
              max={offsetDays(value.from, 366)}
              required
              onChange={(event) => changeDate("to", event.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
