import { useState } from 'react';
import { useSocial } from '../../context/SocialContext.jsx';
import TradersDirectory from './TradersDirectory.jsx';
import EditProfile from './EditProfile.jsx';

export default function TradersPage({ onMessage }) {
  const { myProfile, myProfileLoading } = useSocial();
  // First-time visitors with no display_name yet land on the profile editor
  // so they're not browsing anonymously; everyone else lands on the directory.
  const [view, setView] = useState(null);

  const effectiveView = view || (!myProfileLoading && myProfile && !myProfile.display_name ? 'profile' : 'directory');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setView('directory')} className={`px-3 py-1.5 rounded-lg text-sm border ${effectiveView === 'directory' ? 'bg-brand-400/15 border-brand-400/40 text-brand-200' : 'border-slate-800 text-slate-400'}`}>
          Browse traders
        </button>
        <button onClick={() => setView('profile')} className={`px-3 py-1.5 rounded-lg text-sm border ${effectiveView === 'profile' ? 'bg-brand-400/15 border-brand-400/40 text-brand-200' : 'border-slate-800 text-slate-400'}`}>
          My profile
        </button>
      </div>
      {effectiveView === 'directory' ? <TradersDirectory onMessage={onMessage} /> : <EditProfile />}
    </div>
  );
}
