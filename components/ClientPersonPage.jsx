'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Calendar, Film, Loader2, MapPin } from 'lucide-react';
import BackButton from '@/components/BackButton';
import PersonFilmography from '@/components/PersonFilmography';
import { getPersonCredits, getPersonDetails, IMG } from '@/lib/tmdb';

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

function buildCastItems(credits) {
  const seen = new Set();
  const rawCast = credits?.cast || [];
  const uniqueCast = rawCast.filter((c) => {
    if (!c.id) return false;
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return c.poster_path || c.backdrop_path;
  });

  const cleanedCast = uniqueCast.filter((c) => {
    const type = c.media_type;
    if (type !== 'movie' && type !== 'tv') return false;
    const character = (c.character || '').toLowerCase();
    if (character.includes('self') || character.includes('himself') || character.includes('herself')) return false;
    if ((c.vote_count || 0) < 5) return false;
    return true;
  });

  return cleanedCast.sort((a, b) => {
    const dateA = new Date(a.release_date || a.first_air_date || '1900-01-01');
    const dateB = new Date(b.release_date || b.first_air_date || '1900-01-01');
    return dateB.getTime() - dateA.getTime();
  });
}

export default function ClientPersonPage() {
  const params = useParams();
  const id = params?.id;
  const [person, setPerson] = useState(null);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    async function loadPerson() {
      setLoading(true);
      try {
        const [personData, creditsData] = await Promise.all([
          getPersonDetails(id),
          getPersonCredits(id),
        ]);

        if (!cancelled) {
          setPerson(personData);
          setCredits(creditsData);
        }
      } catch (err) {
        console.error('Error loading person details:', err);
        if (!cancelled) {
          setPerson(null);
          setCredits(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPerson();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sortedCast = useMemo(() => buildCastItems(credits), [credits]);
  const featuredBackdrop = sortedCast.find((c) => c.backdrop_path)?.backdrop_path;
  const backdropUrl = featuredBackdrop ? IMG.backdrop(featuredBackdrop) : null;
  const profileUrl = person?.profile_path ? IMG.original(person.profile_path) : null;

  useEffect(() => {
    if (person?.name) {
      document.title = `${person.name} - Tashido TV`;
    }
  }, [person?.name]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-white/70" />
        <p className="text-[12px] tracking-[0.25em] uppercase text-white/40">Loading</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-6 text-center">
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-3">Not Found</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-platinum mb-4">
            We could not find that person.
          </h1>
        </div>
      </div>
    );
  }

  return (
    <article className="relative min-h-screen pt-28 pb-16 bg-zinc-950 text-white overflow-hidden">
      <BackButton />
      {backdropUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-10 scale-105 pointer-events-none select-none transition-opacity duration-1000"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/80 to-zinc-950 pointer-events-none" />

      <div className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-10 space-y-12">
        <section className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 lg:p-10 backdrop-blur-xl shadow-2xl">
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

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-white/60">
              {person.birthday && (
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/40" />
                  Born: {formatDate(person.birthday)}
                  {person.deathday && ` - Died: ${formatDate(person.deathday)}`}
                </span>
              )}
              {person.place_of_birth && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-white/40" />
                  {person.place_of_birth}
                </span>
              )}
            </div>

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

        <PersonFilmography items={sortedCast} />
      </div>
    </article>
  );
}
