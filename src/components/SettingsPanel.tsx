import type { ReaderSettings, ReaderTheme } from '../models/Novel';

interface SettingsPanelProps {
  settings: ReaderSettings;
  onChange: (settings: ReaderSettings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const update = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <aside className="settings-panel" aria-label="表示設定">
      <div className="settings-header">
        <h2>表示設定</h2>
        <button className="icon-button" type="button" onClick={onClose} aria-label="設定を閉じる">
          ×
        </button>
      </div>

      <label className="setting-field">
        <span>テーマ</span>
        <select value={settings.theme} onChange={(event) => update('theme', event.target.value as ReaderTheme)}>
          <option value="paper">紙</option>
          <option value="dark">ダーク</option>
        </select>
      </label>

      <label className="setting-field">
        <span>文字サイズ <strong>{settings.fontSize}px</strong></span>
        <input
          type="range"
          min="15"
          max="30"
          step="1"
          value={settings.fontSize}
          onChange={(event) => update('fontSize', Number(event.target.value))}
        />
      </label>

      <label className="setting-field">
        <span>行間 <strong>{settings.lineHeight.toFixed(2)}</strong></span>
        <input
          type="range"
          min="1.4"
          max="2.6"
          step="0.05"
          value={settings.lineHeight}
          onChange={(event) => update('lineHeight', Number(event.target.value))}
        />
      </label>

      <label className="setting-field">
        <span>本文幅 <strong>{settings.contentWidth}px</strong></span>
        <input
          type="range"
          min="520"
          max="960"
          step="20"
          value={settings.contentWidth}
          onChange={(event) => update('contentWidth', Number(event.target.value))}
        />
      </label>
    </aside>
  );
}
