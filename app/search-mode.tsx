"use client";
import { useId } from "react";
import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function SearchMode({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={"search-mode" + (enabled ? " enabled" : "")}>
      <span className="search-mode-icon" aria-hidden="true">
        <Sparkles size={19} />
      </span>
      <div className="search-mode-copy">
        <div className="search-mode-heading">
          <label htmlFor={id}>Erweiterte KI-Suche</label>
          <span className="search-mode-price">Derzeit kostenlos</span>
        </div>
        <p id={id + "-hint"}>
          Die KI bewertet musikalische Nähe für zusätzliche Empfehlungen. Die
          Suche dauert etwas länger.
        </p>
      </div>
      <Switch
        className="search-mode-switch"
        id={id}
        checked={enabled}
        onCheckedChange={onChange}
        aria-describedby={id + "-hint" + (enabled ? " " + id + "-privacy" : "")}
      />
      {enabled && (
        <small className="search-mode-privacy" id={id + "-privacy"}>
          Künstlerauswahl an Cloudflare AI.{" "}
          <a href="/datenschutz">Datenschutz</a>
        </small>
      )}
    </div>
  );
}
