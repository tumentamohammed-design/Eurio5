import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { useSocial } from '../../context/SocialContext.jsx';
import { COUNTRIES, countryFlag } from '../../lib/countries.js';
import { resizeImageToBlob } from '../../lib/image.js';
import ToggleButtons from '../Layout/ToggleButtons.jsx';

const PAIR_OPTIONS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/JPY', 'GBP/JPY', 'XAU/USD'];
const EXPERIENCE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];

export default function EditProfile() {
  const { myProfile, updateMyProfile, uploadAvatar, getAvatarUrl } = useSocial();

  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('Beginner');
  const [pairs, setPairs] = useState(new Set());
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!myProfile) return;
    setDisplayName(myProfile.display_name || '');
    setCountry(myProfile.country || '');
    setBio(myProfile.bio || '');
    setExperience(myProfile.experience_level || 'Beginner');
    setPairs(new Set(myProfile.favorite_pairs || []));
    setAvatarPreview(myProfile.avatar_path ? getAvatarUrl(myProfile.avatar_path) : null);
  }, [myProfile, getAvatarUrl]);

  function togglePair(p) {
    setPairs((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { blob, previewUrl } = await resizeImageToBlob(file, 300, 0.8);
      setPendingAvatarBlob(blob);
      setAvatarPreview(previewUrl);
    } catch {
      setError('Could not read that image — try a different file.');
    }
  }

  async function handleSave() {
    if (!displayName.trim()) { setError('Add a display name — this is what other traders will see.'); return; }
    if (!country) { setError('Select your country.'); return; }
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      if (pendingAvatarBlob) await uploadAvatar(pendingAvatarBlob);
      await updateMyProfile({
        display_name: displayName.trim(),
        country,
        bio: bio.trim() || null,
        experience_level: experience,
        favorite_pairs: [...pairs],
      });
      setPendingAvatarBlob(null);
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="text-lg font-semibold text-slate-100">Your trader profile</div>
      <div className="text-sm text-slate-400">
        This is what other traders see in the directory and on your posts. Set your country and display name to appear in the network.
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1.5">Photo</label>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-500">
            {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" /> : <Camera size={20} />}
          </div>
          <label className="px-3 py-1.5 rounded-lg border border-dashed border-slate-700 text-sm text-slate-400 cursor-pointer hover:border-slate-600">
            Upload photo
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500">Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How other traders will see you"
          className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
      </div>

      <div>
        <label className="text-xs text-slate-500">Country</label>
        <select value={country} onChange={(e) => setCountry(e.target.value)}
          className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100">
          <option value="">Select a country…</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>{countryFlag(code)} {name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1.5">Experience level</label>
        <ToggleButtons options={EXPERIENCE_OPTIONS.map((v) => ({ value: v, label: v }))} value={experience} onChange={setExperience} />
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1.5">Pairs you trade</label>
        <div className="flex gap-2 flex-wrap">
          {PAIR_OPTIONS.map((p) => (
            <button key={p} type="button" onClick={() => togglePair(p)}
              className={`px-2.5 py-1 rounded-md text-xs border font-data ${
                pairs.has(p) ? 'bg-brand-400/15 border-brand-400/40 text-brand-200' : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500">Bio</label>
        <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short line about how you trade…"
          className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}
      {saved && <div className="text-sm text-brand-400">Profile saved.</div>}

      <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-lg bg-brand-500 text-slate-950 font-semibold text-sm hover:bg-brand-400 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  );
}
