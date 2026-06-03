export default function Footer() {
  return (
    <footer className="border-t border-black/5 dark:border-white/5 mt-24">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-10 text-[12px] text-zinc-400 dark:text-white/40 flex flex-col md:flex-row items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} Tashido TV. Private streaming for personal use.</p>
        <p>Powered by TMDB. All content rights reserved by their respective owners.</p>
      </div>
    </footer>
  );
}
