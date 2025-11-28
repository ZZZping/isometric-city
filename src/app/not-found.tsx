export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-light text-white mb-4">404</h1>
        <p className="text-white/60">Page not found</p>
        <a href="/" className="text-primary mt-4 inline-block">
          Return Home
        </a>
      </div>
    </div>
  );
}
