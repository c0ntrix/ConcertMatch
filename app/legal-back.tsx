"use client";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

export default function LegalBack() {
  const [href, setHref] = useState("/");
  useEffect(() => {
    const saved = sessionStorage.getItem("cm_return_to_search");
    if (
      saved &&
      /^\/(?:\?(?:group|join)=[a-zA-Z0-9-]+(?:&edit=1)?)?$/.test(saved)
    )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHref(saved);
    const reset = () => setHref("/");
    window.addEventListener("cm-data-deleted", reset);
    return () => window.removeEventListener("cm-data-deleted", reset);
  }, []);
  return (
    <a className="navigation-button legal-back" href={href}>
      <ArrowLeft size={18} aria-hidden="true" /> Zur Konzertsuche
    </a>
  );
}
