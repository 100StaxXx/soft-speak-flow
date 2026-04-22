import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/mentorImageLoader", () => ({
  loadMentorImage: vi.fn(),
}));

import { MentorAvatar } from "@/components/MentorAvatar";
import { loadMentorImage } from "@/utils/mentorImageLoader";

describe("MentorAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to Lyra's bundled portrait when the remote avatar fails", async () => {
    vi.mocked(loadMentorImage).mockResolvedValue("/mock/lyra-mentor.png");

    render(
      <MentorAvatar
        mentorSlug="lyra"
        mentorName="Lyra"
        primaryColor="#ff00aa"
        avatarUrl="https://cdn.example.com/broken-lyra.png"
      />,
    );

    const image = screen.getByAltText("Lyra");
    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.getByAltText("Lyra")).toHaveAttribute("src", "/mock/lyra-mentor.png");
    });

    expect(loadMentorImage).toHaveBeenCalledWith("lyra");
  });

  it("falls back to The Operator's bundled portrait when the remote avatar fails", async () => {
    vi.mocked(loadMentorImage).mockResolvedValue("/mock/operator-mentor.png");

    render(
      <MentorAvatar
        mentorSlug="operator"
        mentorName="The Operator"
        primaryColor="#00ffaa"
        avatarUrl="https://cdn.example.com/broken-operator.png"
      />,
    );

    const image = screen.getByAltText("The Operator");
    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.getByAltText("The Operator")).toHaveAttribute("src", "/mock/operator-mentor.png");
    });

    expect(loadMentorImage).toHaveBeenCalledWith("operator");
  });
});
