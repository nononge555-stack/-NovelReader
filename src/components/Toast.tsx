export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  const role = toast.kind === 'error' ? 'alert' : 'status';

  return (
    <div className={`toast toast-${toast.kind}`} role={role} aria-live="polite">
      <span className="toast-icon" aria-hidden="true">
        {toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i'}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" type="button" aria-label="通知を閉じる" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
