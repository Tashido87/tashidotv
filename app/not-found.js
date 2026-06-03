import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6 text-center">
      <div>
        <p className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-3">Not Found</p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-platinum mb-4">
          We couldn’t find that title.
        </h1>
        <Link
          href="/"
          className="inline-block mt-4 px-6 py-3 rounded-full bg-white text-black font-semibold text-[14px] hover:bg-white/90 transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
