// src/components/AccountMenu.tsx
//
// Visual confirmation of who's signed in, plus sign out and a link to
// the /settings page (SettingsPage.tsx).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CurrentUser } from "../api/client";
import { wrapper, avatar, panel, identityBlock, identityPrimary, identitySecondary, divider, menuItemButton } from "../styles/AccountMenuStyles";

function initials(identity: string): string {
  const local = identity.split("@")[0]; // strip domain if it's an email
  if (!local) return "?";
  const segments = local.split(/[._\-\s]+/).filter(Boolean);
  const chars =
    segments.length >= 2 ? [segments[0][0], segments[1][0]] : [local[0], local[1] ?? ""];
  return chars.join("").toUpperCase();
}

export function AccountMenu({ user, onSignOut }: { user: CurrentUser | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const identity = user.email || user.username;
  const showUsername = user.username && user.username !== identity;

  return (
    <div ref={menuRef} style={wrapper}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={avatar}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${identity}`}
        title={identity}
      >
        {initials(identity)}
      </button>

      {open && (
        <div role="menu" style={panel}>
          <div style={identityBlock}>
            <p style={identityPrimary}>{identity}</p>
            {showUsername && <p style={identitySecondary}>{user.username}</p>}
          </div>
          <div style={divider} />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            style={menuItemButton}
          >
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            style={menuItemButton}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
