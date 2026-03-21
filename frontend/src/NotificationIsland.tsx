interface NotificationIslandProps {
  error?: string;
  info?: string;
  onClearError?: () => void;
  onClearInfo?: () => void;
}

export default function NotificationIsland({ error, info, onClearError, onClearInfo }: NotificationIslandProps) {
  if (!error && !info) {
    return null;
  }

  return (
    <div className="notification-island" aria-live="polite" aria-atomic="true">
      {error && (
        <div className="notice notice-error" role="alert">
          <div>
            <strong>Ошибка</strong>
            <p>{error}</p>
          </div>
          {onClearError && (
            <button type="button" className="notice-close" onClick={onClearError} aria-label="Закрыть ошибку">
              ×
            </button>
          )}
        </div>
      )}

      {info && (
        <div className="notice notice-info" role="status">
          <div>
            <strong>Инфо</strong>
            <p>{info}</p>
          </div>
          {onClearInfo && (
            <button type="button" className="notice-close" onClick={onClearInfo} aria-label="Закрыть уведомление">
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
