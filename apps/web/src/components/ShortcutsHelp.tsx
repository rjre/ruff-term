interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ["/", "Focus the ticker search"],
  ["Ctrl / Cmd + K", "Open the jump-to-tab-or-ticker palette"],
  ["?", "Show this shortcuts list"],
  ["Esc", "Close an open overlay"],
];

export function ShortcutsHelp({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input" style={{ cursor: "default" }}>
          Keyboard shortcuts
        </div>
        <div className="command-palette-list">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="shortcuts-row">
              <kbd>{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
        <div className="command-palette-hint">Esc to close</div>
      </div>
    </div>
  );
}
