import { ReactNode } from 'react';

export function Dialog({
  title,
  width = 440,
  children,
  actions,
}: {
  title: ReactNode;
  width?: number;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="dialog-backdrop">
      {/* max-width/max-height live in the .dialog/.dialog-body CSS rules
          (globals.css) instead of inline styles, so the desktop vs. mobile
          values (desktop is compensated for the 133% zoom; mobile isn't,
          since zoom is reset to 100% below 720px) can differ per breakpoint
          — a media query can't override an inline style. */}
      <div className="dialog" style={{ width }}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">
          {children}
        </div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
