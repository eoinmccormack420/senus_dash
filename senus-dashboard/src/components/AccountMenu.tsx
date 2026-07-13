// src/components/AccountMenu.tsx
//
// Visual confirmation of who's signed in, plus sign out and a link to
// the /settings page (SettingsPage.tsx).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CurrentUser } from "../api/client";

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

const wrapper: React.CSSProperties = {
  position: "relative",
};

const avatar: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "var(--color-forest)",
  color: "var(--color-on-accent)",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-xs)",
  cursor: "pointer",
  flexShrink: 0,
};

const panel: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  minWidth: 220,
  background: "var(--color-paper-raised)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "var(--shadow-card-hover)",
  padding: "var(--space-2)",
  zIndex: 10,
};

const identityBlock: React.CSSProperties = {
  padding: "var(--space-2) var(--space-2)",
};

const identityPrimary: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: 0,
  wordBreak: "break-all",
};

const identitySecondary: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "2px 0 0 0",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "var(--color-grey-line)",
  margin: "var(--space-2) 0",
};

const menuItemButton: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "none",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2)",
  cursor: "pointer",
};
