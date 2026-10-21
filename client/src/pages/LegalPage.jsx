import { useSite } from "../context/SiteContext.jsx";

function renderBlock(block, index) {
  const lines = block.split("\n");
  if (lines[0].startsWith("## ")) return <h2 key={index}>{lines[0].slice(3)}</h2>;
  if (lines.every((line) => line.startsWith("- "))) {
    return <ul key={index}>{lines.map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
  }
  return <p key={index}>{block}</p>;
}

export default function LegalPage({ pageKey, title }) {
  const { settings } = useSite();
  const content = settings[pageKey] || "";
  const blocks = content.trim().split(/\n\s*\n/).filter(Boolean);

  return (
    <article className="container section legal-page">
      <header className="legal-page__header">
        <p className="account__eyebrow">{settings.storeName || "DreamYard"}</p>
        <h1 className="page-title">{title}</h1>
      </header>
      <div className="legal-page__content">
        {blocks.length
          ? blocks.map(renderBlock)
          : <p>Information for this page is being prepared. Please contact us using the details in the footer.</p>}
      </div>
    </article>
  );
}