import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrickStatusBadge } from "./TrickStatusBadge";

/*
 * `<TrickStatusBadge status={string} />` (design.md §5.6): takes the API's
 * raw, unnormalized status string and calls `toTrickStatus()` +
 * `TRICK_STATUS_META` internally - the whole point of that normalization
 * layer is that the badge itself, not its caller, has to survive an unknown
 * value. Each status must be identifiable by text and icon, not color alone
 * (Ticket, section "Statusdarstellung"; lucide-react renders each icon's own
 * `svg.lucide-<name>` class, e.g. `lucide-circle-check`).
 */

describe("TrickStatusBadge", () => {
  it.each([
    ["sitzt", "Sitzt", "lucide-circle-check"],
    ["uebe", "Übe ich", "lucide-target"],
    ["bereit", "Bereit", "lucide-circle-dot"],
    ["gesperrt", "Gesperrt", "lucide-lock"],
  ])("status '%s' shows the German label '%s' and its own icon", (status, label, iconClass) => {
    const { container } = render(<TrickStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(`svg.${iconClass}`)).not.toBeNull();
  });

  it("design.md §5.6: an unknown status falls back to the 'gesperrt' presentation instead of crashing", () => {
    const { container } = render(<TrickStatusBadge status="future-status" />);

    expect(screen.getByText("Gesperrt")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-lock")).not.toBeNull();
  });

  it("the four known statuses each get a visually distinct icon, not the same one repeated", () => {
    const icons = ["sitzt", "uebe", "bereit", "gesperrt"].map((status) => {
      const { container, unmount } = render(<TrickStatusBadge status={status} />);
      const icon = container.querySelector("svg")?.getAttribute("class");
      unmount();
      return icon;
    });

    expect(new Set(icons).size).toBe(4);
  });
});
