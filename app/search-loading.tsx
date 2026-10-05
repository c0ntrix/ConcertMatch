import { Check, Music2, Sparkles } from "lucide-react";

export default function SearchLoading({ refining }: { refining: boolean }) {
  return (
    <div className="search-loading" role="status" aria-live="polite">
      <div className="search-orbit" aria-hidden="true">
        <div className="orbit-ring" />
        <div className="orbit-ring inner" />
        <span className="orbit-center">
          {refining ? <Sparkles size={30} /> : <Music2 size={30} />}
        </span>
        <span className="orbit-note">
          <Music2 size={16} />
        </span>
      </div>
      <h2>
        {refining
          ? "Musikgeschmack wird abgeglichen"
          : "Konzerte werden gesucht"}
      </h2>
      <p>
        {refining
          ? "Die KI bewertet die gefundenen Künstler anhand deiner Auswahl."
          : "Termine im gewählten Umkreis werden abgerufen."}
      </p>
      <div className="loading-stages" aria-hidden="true">
        <span className={refining ? "complete" : "current"}>
          {refining ? <Check size={14} /> : <i />} Tourtermine
        </span>
        <span className={refining ? "current" : ""}>
          <i /> Musikabgleich
        </span>
        <span>
          <i /> Deine Auswahl
        </span>
      </div>
      <div className="loading-track" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
