import { PRODUCT, type ProductMode } from "./product";

export const getProductDocumentIdentity = (mode: ProductMode) =>
  mode === "cosmiq"
    ? {
        title: "Cosmiq — Turn intention into meaningful momentum",
        description:
          "A living companion for planning, focus, reflection, and personalized cinematic evolution.",
        author: "Cosmiq",
      }
    : {
        title: "Graceward — Grow in faith, one day at a time",
        description:
          "A Christian companion for Scripture, prayer, reflection, and faithful action.",
        author: "Graceward",
      };

export const applyProductDocumentIdentity = () => {
  const identity = getProductDocumentIdentity(PRODUCT.mode);
  document.title = identity.title;

  const setMeta = (selector: string, content: string) => {
    document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", content);
  };
  setMeta('meta[name="description"]', identity.description);
  setMeta('meta[name="author"]', identity.author);
  setMeta('meta[property="og:title"]', identity.title);
  setMeta('meta[property="og:description"]', identity.description);
  setMeta('meta[name="twitter:title"]', identity.title);
  setMeta('meta[name="twitter:description"]', identity.description);
};
