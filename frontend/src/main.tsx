import { createRoot } from "react-dom/client";
import "@atlaskit/css-reset";
import { Root } from "./Root.js";
import { setPasswordHash } from "./api/password.js";

// ADR-0016: a Supabase invite or password-reset link that came back to the site root goes to
// the Set your password screen, before the hash router reads the address.
const moved = setPasswordHash(window.location.hash);
if (moved) window.history.replaceState(null, "", moved);

createRoot(document.getElementById("root")!).render(<Root />);
