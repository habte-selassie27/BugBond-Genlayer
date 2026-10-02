import { useState } from "react";
import { copyText } from "@/lib/scope-data";

/** Shows a truncated transaction hash with a copy button and inline confirmation. */
export function CopyHash({ value, label = "Transaction hash" }: { value: unknown; label?: string }) {
  const [copied, setCopied] = useState(false);
  const hash = String(value ?? "");
  if (!hash) return null;
  const shown = hash.length > 22 ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : hash;

  return (
    <div className="copy-hash">
      <span className="copy-hash__label">{label}</span>
      <code className="copy-hash__value" title={hash}>{shown}</code>
      <button
        type="button"
        className="copy-hash__button"
        onClick={async () => {
          const ok = await copyText(hash);
          setCopied(ok);
          if (ok) window.setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? "COPIED" : "COPY"}
      </button>
    </div>
  );
}
