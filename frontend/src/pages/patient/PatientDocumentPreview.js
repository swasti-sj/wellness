import React, { useMemo } from "react";
import { buildDocumentUrl, getDocumentName } from "../doctor/documentHelpers";

export default function PatientDocumentPreview({ title, url, emptyMessage = "No document uploaded." }) {
  const resolvedUrl = useMemo(() => buildDocumentUrl(url), [url]);
  const isPdf = useMemo(() => /\.pdf($|\?)/i.test(url || "") || /^data:application\/pdf/i.test(url || ""), [url]);
  const documentName = /^data:/i.test(url || "") ? "Uploaded document" : getDocumentName(url, title || "Document");

  if (!url) {
    return <p className="ph-empty">{emptyMessage}</p>;
  }

  return (
    <article className="ph-doc-preview">
      <div className="ph-doc-preview-header">
        <div>
          <strong>{title || "Document"}</strong>
          <span>{documentName}</span>
        </div>
        <a href={resolvedUrl} target="_blank" rel="noreferrer" className="ph-doc-open">
          Open
        </a>
      </div>
      <div className={`ph-doc-frame${isPdf ? " pdf" : ""}`}>
        {isPdf ? (
          <object data={resolvedUrl} type="application/pdf" aria-label={title || "Uploaded document"}>
            <a href={resolvedUrl} target="_blank" rel="noreferrer">Open document</a>
          </object>
        ) : (
          <img src={resolvedUrl} alt={title || "Uploaded document"} loading="lazy" />
        )}
      </div>
    </article>
  );
}
