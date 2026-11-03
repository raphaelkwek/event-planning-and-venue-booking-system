import { createRoot } from "react-dom/client";
import "@atlaskit/css-reset";
import "./theme/fonts.css";
import "./theme/tokens.css";
import "./theme/atlaskit.css";
import "./theme/base.css";
import "./theme/legacy.css";
import "./shell/shell.css";
import { readStoredTheme } from "./theme/ThemeProvider.js";
import { Root } from "./Root.js";
import { setPasswordHash } from "./api/password.js";

// ADR-0016: a Supabase invite or password-reset link that came back to the site root goes to
// the Set your password screen, before the hash router reads the address.
const moved = setPasswordHash(window.location.hash);
if (moved) window.history.replaceState(null, "", moved);

// The remembered theme is set before the first render, so a light-theme user never sees dark first.
document.documentElement.dataset.csTheme = readStoredTheme();

createRoot(document.getElementById("root")!).render(<Root />);
