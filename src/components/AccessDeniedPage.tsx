export function AccessDeniedPage({ title = 'Access denied', message = 'You do not have permission to open this page.' }: { title?: string; message?: string }) {
  return (
    <div className="vessel-master dashboard-page">
      <div className="admin-link-panel">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  )
}
