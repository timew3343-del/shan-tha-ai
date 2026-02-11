import { useEffect } from "react";
import inventory from "@/data/system-inventory.json";

/** Injects JSON-LD structured data + dynamic meta tags for AI crawlers & search engines */
export const SEOHead = () => {
  const totalTools = inventory.tools.length;
  const totalFeatures = inventory.tools.reduce((sum, t) => sum + t.features.length, 0);

  useEffect(() => {
    // Dynamic meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    const descContent = `Explore ${totalTools}+ AI Tools and ${totalFeatures}+ Capabilities developed by Ko Ko Phyo. Myanmar AI Studio offers AI Image, Video, Voice, Design, and Business tools in 53+ languages.`;
    if (metaDesc) {
      metaDesc.setAttribute("content", descContent);
    }

    // Dynamic meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement("meta");
      metaKeywords.setAttribute("name", "keywords");
      document.head.appendChild(metaKeywords);
    }
    const allKeywords = inventory.tools.flatMap(t => [t.name, ...t.features]);
    metaKeywords.setAttribute("content", [
      "Myanmar AI Studio", "Ko Ko Phyo", "AI Tools Myanmar",
      ...allKeywords.slice(0, 50),
    ].join(", "));

    // Dynamic title
    document.title = `Myanmar AI Studio — ${totalTools}+ AI Tools | ${totalFeatures}+ Capabilities by Ko Ko Phyo`;

    // OG tags
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", descContent);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", `Myanmar AI Studio — ${totalTools}+ AI Tools by Ko Ko Phyo`);

    // Author meta
    let metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor) metaAuthor.setAttribute("content", "Ko Ko Phyo");

    // JSON-LD: Organization
    const orgSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Myanmar AI Studio",
      "url": inventory.url,
      "founder": {
        "@type": "Person",
        "name": "Ko Ko Phyo",
      },
      "description": inventory.description,
    };

    // JSON-LD: WebApplication
    const appSchema = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Myanmar AI Studio",
      "url": inventory.url,
      "author": { "@type": "Person", "name": "Ko Ko Phyo" },
      "applicationCategory": "Multimedia, AI Tools, Design, Business",
      "operatingSystem": "Web Browser",
      "description": descContent,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free daily uses available",
      },
    };

    // JSON-LD: Each tool as a Service
    const serviceSchemas = inventory.tools.map(tool => ({
      "@context": "https://schema.org",
      "@type": "Service",
      "name": tool.name,
      "provider": {
        "@type": "Person",
        "name": "Ko Ko Phyo",
      },
      "serviceType": tool.category,
      "description": `${tool.name} — ${tool.features.join(", ")}. Part of Myanmar AI Studio's ${totalTools}+ AI tools.`,
      "areaServed": "Worldwide",
      "availableChannel": {
        "@type": "ServiceChannel",
        "serviceUrl": inventory.url,
      },
    }));

    // Inject all JSON-LD scripts
    const schemas = [orgSchema, appSchema, ...serviceSchemas];
    const existingScripts = document.querySelectorAll('script[data-seo-jsonld]');
    existingScripts.forEach(s => s.remove());

    schemas.forEach((schema, i) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-jsonld", `schema-${i}`);
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });

    return () => {
      const scripts = document.querySelectorAll('script[data-seo-jsonld]');
      scripts.forEach(s => s.remove());
    };
  }, [totalTools, totalFeatures]);

  return null;
};
