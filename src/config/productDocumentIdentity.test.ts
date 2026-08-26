import { describe, expect, it } from "vitest";
import { getProductDocumentIdentity } from "./productDocumentIdentity";

describe("product document identity", () => {
  it("keeps Graceward and Cosmiq metadata distinct", () => {
    const graceward = getProductDocumentIdentity("christian");
    const cosmiq = getProductDocumentIdentity("cosmiq");

    expect(graceward.title).toContain("Graceward");
    expect(graceward.description).toContain("Christian");
    expect(cosmiq.title).toContain("Cosmiq");
    expect(cosmiq.description).toContain("cinematic evolution");
    expect(cosmiq.description).not.toContain("Scripture");
  });
});
