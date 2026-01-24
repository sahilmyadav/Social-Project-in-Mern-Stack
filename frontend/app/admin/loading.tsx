export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary animate-spin mx-auto mb-4"></div>
        <p className="text-foreground">Loading admin panel...</p>
      </div>
    </div>
  )
}
