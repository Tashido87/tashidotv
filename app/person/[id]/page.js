import { getPersonDetails, getPersonCredits, IMG } from '@/lib/tmdb';
import { notFound } from 'next/navigation';
import { Calendar, MapPin, Film } from 'lucide-react';
import BackButton from '@/components/BackButton';
import PersonFilmography from '@/components/PersonFilmography';

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const person = await getPersonDetails(params.id);
  if (!person) return { title: 'Not Found — Tashido TV' };
  return {
    title: `${person.name} — Tashido TV`,
    description: person.biography ? person.biography.slice(0, 160) : `Discover movies and TV shows starring ${person.name} on Tashido TV.`,
  };
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
}

export default async function PersonPage({ params }) {
  const [person, credits] = await Promise.all([
    getPersonDetails(params.id),
    getPersonCredits(params.id),
  ]);

  if (!person) notFound();

  // De-duplicate cast credits by project ID and filter out items without posters
  const seen = new Set();
  const rawCast = credits?.cast || [];
  const uniqueCast = rawCast.filter((c) => {
    if (!c.id) return false;
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return c.poster_path || c.backdrop_path;
  });

  // Clean: keep movies and tv shows, remove talk shows / award show "Self" appearances
  const cleanedCast = uniqueCast.filter((c) => {
    const type = c.media_type;
    if (type !== 'movie' && type !== 'tv') return false;
    // Remove "Self", "Himself", "Herself" appearances
    const character = (c.character || '').toLowerCase();
    if (character.includes('self') || character.includes('himself') || character.includes('herself')) return false;
    // Remove items with extremely low vote count (cameos or obscure clips)
    if ((c.vote_count || 0) < 5) return false;
    return true;
  });

  // Sort chronologically, with the most recent releases at the top (descending)
  const sortedCast = cleanedCast.sort((a, b) => {
    const dateA = new Date(a.release_date || a.first_air_date || '1900-01-01');
    const dateB = new Date(b.release_date || b.first_air_date || '1900-01-01');
    return dateB.getTime() - dateA.getTime();
  });

  // Determine a popular background backdrop from their filmography to create a premium blurred aesthetic
  const featuredBackdrop = sortedCast.find((c) => c.backdrop_path)?.backdrop_path;
  const backdropUrl = featuredBackdrop ? IMG.backdrop(featuredBackdrop) : null;
  const profileUrl = person.profile_path ? IMG.original(person.profile_path) : null;

  return (
    <article className="relative min-h-screen pt-28 pb-16 bg-zinc-950 text-white overflow-hidden">
      <BackButton />
      {/* Dynamic blurred backdrop background for visual excellence */}
      {backdropUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-10 scale-105 pointer-events-none select-none transition-opacity duration-1000"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/80 to-zinc-950 pointer-events-none" />

      <div className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-10 space-y-12">
        {/* Header/Bio Section */}
        <section className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 lg:p-10 backdrop-blur-xl shadow-2xl">
          {/* Profile Image */}
          <div className="w-full md:w-64 lg:w-72 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden bg-white/5 border border-white/15 shadow-xl transition-all duration-300 hover:border-white/30 group">
            {profileUrl ? (
              <img
                src={profileUrl}
                alt={person.name}
                className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-white/20 font-bold bg-white/5 uppercase select-none">
                {person.name?.[0]}
              </div>
            )}
          </div>

          {/* Actor Info */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              {person.known_for_department && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold tracking-wider text-white/70 uppercase">
                  <Film className="w-3.5 h-3.5" />
                  {person.known_for_department}
                </span>
              )}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-platinum leading-none">
                {person.name}
              </h1>
            </div>

            {/* Birthday and Birth Place */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-white/60">
              {person.birthday && (
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/40" />
                  Born: {formatDate(person.birthday)}
                  {person.deathday && ` — Died: ${formatDate(person.deathday)}`}
                </span>
              )}
              {person.place_of_birth && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-white/40" />
                  {person.place_of_birth}
                </span>
              )}
            </div>

            {/* Biography */}
            {person.biography && (
              <div className="space-y-2.5">
                <h2 className="text-lg font-semibold tracking-tight text-platinum">Biography</h2>
                <p className="text-[15px] text-white/80 leading-relaxed font-normal whitespace-pre-wrap max-w-4xl max-h-[250px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {person.biography}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Filmography Section */}
        <PersonFilmography items={sortedCast} />
      </div>
    </article>
  );
}
