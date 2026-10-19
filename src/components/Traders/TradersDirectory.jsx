import { useMemo, useState } from 'react';
import { UserPlus, UserCheck, Star, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useSocial } from '../../context/SocialContext.jsx';
import { useMessages } from '../../context/MessagesContext.jsx';
import { COUNTRIES, countryFlag } from '../../lib/countries.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

export default function TradersDirectory({ onMessage }) {
  const { user } = useApp();
  const { traders, tradersLoading, tradersError, loadTraders, myProfile, followingIds, followUser, unfollowUser, getAvatarUrl } = useSocial();
  const { openConversationWith } = useMessages();
  const [countryFilter, setCountryFilter] = useState(myProfile?.country || 'ALL');
  const [search, setSearch] = useState('');

  async function handleMessage(traderId) {
    try {
      await openConversationWith(traderId);
      onMessage?.();
    } catch (err) {
      console.error('Failed to open conversation', err);
    }
  }

  const filtered = useMemo(() => {
    return traders
      .filter((t) => t.id !== user?.id)
      .filter((t) => countryFilter === 'ALL' || t.country === countryFilter)
      .filter((t) => !search.trim() || t.display_name?.toLowerCase().includes(search.toLowerCase()));
  }, [traders, user, countryFilter, search]);

  const usedCountries = useMemo(() => [...new Set(traders.map((t) => t.country).filter(Boolean))], [traders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100">
          <option value="ALL">All countries</option>
          {COUNTRIES.filter(([code]) => usedCountries.includes(code)).map(([code, name]) => (
            <option key={code} value={code}>{countryFlag(code)} {name}</option>
          ))}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…"
          className="flex-1 min-w-[160px] bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
      </div>

      {tradersError && <ErrorBanner message={`Couldn't load traders: ${tradersError}`} onRetry={loadTraders} retrying={tradersLoading} />}

      {tradersLoading && filtered.length === 0 ? (
        <LoadingBlock label="Loading traders…" />
      ) : filtered.length === 0 && !tradersError ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          {traders.length === 0 ? 'No traders have set up their profile yet — be the first!' : 'No traders match that filter.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const isFollowing = followingIds.has(t.id);
            const avatarUrl = getAvatarUrl(t.avatar_path);
            return (
              <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-slate-500 text-sm font-data">
                    {avatarUrl ? <img src={avatarUrl} alt={t.display_name} className="w-full h-full object-cover" /> : (t.display_name?.[0] || '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-100 truncate">{t.display_name}</span>
                      {t.is_pro && <Star size={12} className="text-amber-400 shrink-0" fill="currentColor" />}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t.country ? `${countryFlag(t.country)} ${COUNTRIES.find(([c]) => c === t.country)?.[1] || t.country}` : '—'}
                      {t.experience_level ? ` · ${t.experience_level}` : ''}
                    </div>
                    {t.bio && <div className="text-sm text-slate-400 mt-1.5 line-clamp-2">{t.bio}</div>}
                    {t.favorite_pairs?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {t.favorite_pairs.slice(0, 4).map((p) => (
                          <span key={p} className="text-[10px] font-data px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => (isFollowing ? unfollowUser(t.id) : followUser(t.id))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium ${
                      isFollowing ? 'border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40' : 'bg-brand-500 text-slate-950 hover:bg-brand-400'
                    }`}
                  >
                    {isFollowing ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
                  </button>
                  <button
                    onClick={() => handleMessage(t.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:border-brand-400/40 hover:text-brand-300"
                  >
                    <MessageCircle size={13} /> Message
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
