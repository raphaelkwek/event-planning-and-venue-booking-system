import type { ComponentProps } from "react";
import AtlaskitLozenge from "@atlaskit/lozenge";

/**
 * Atlaskit's Lozenge, with the red ("removed") appearance always bold. The subtle red one is
 * #DE350B on #FFEBE6, 3.95:1, below WCAG AA's 4.5:1 for its 11px text, so axe fails every screen
 * showing a Rejected, Cancelled, Confirmed-on-the-calendar or Requires-reconfirmation lozenge
 * (EN-14, documentation/evidence/EN-14/axe-findings.md). Atlaskit's own bold variant, white on red,
 * passes, so this changes which Atlaskit variant is used rather than restyling it (§7.1).
 */
export default function Lozenge(props: ComponentProps<typeof AtlaskitLozenge>) {
  return <AtlaskitLozenge {...props} isBold={props.isBold ?? props.appearance === "removed"} />;
}
