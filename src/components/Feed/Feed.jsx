import { useMemo, useState } from 'react';
import { Camera, Video, X } from 'lucide-react';
import { useSocial } from '../../context/SocialContext.jsx';
import { resizeImageToBlob } from '../../lib/image.js';
import { COUNTRIES, countryFlag } from '../../lib/countries.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';
import PostCard from './PostCard.jsx';

const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25MB — generous for a short clip, cheap enough to keep uploads fast

export default function Feed() {
  const { posts, postsLoading, postsError, loadPosts, addPost, myProfile } = useSocial();
  const [content, setContent] = useState('');
  const [pendingMedia, setPendingMedia] = useState(null); // { blob, type, contentType }
  const [previewUrl, setPreviewUrl] = useState(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState(myProfile?.country ? 'country' : 'all');

  const visiblePosts = useMemo(() => {
    if (scope === 'country' && myProfile?.country) {
      return posts.filter((p) => p.country === myProfile.country);
    }
    return posts;
  }, [posts, scope, myProfile]);

  async function handleMediaChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (file.type.startsWith('video/')) {
      if (file.size > MAX_VIDEO_BYTES) {
        setError(`That video is too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — keep clips under 25MB.`);
        return;
      }
      setPendingMedia({ blob: file, type: 'video', contentType: file.type || 'video/mp4' });
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }

    if (file.type.startsWith('image/')) {
      try {
        const { blob, previewUrl: url } = await resizeImageToBlob(file, 800, 0.7);
        setPendingMedia({ blob, type: 'image', contentType: 'image/jpeg' });
        setPreviewUrl(url);
      } catch {
        setError('Could not read that image.');
      }
      return;
    }

    setError('Only images and videos are supported.');
  }

  function clearMedia() {
    setPendingMedia(null);
    setPreviewUrl(null);
  }

  async function handlePost() {
    if (!content.trim()) { setError('Write something first.'); return; }
    setError('');
    setPosting(true);
    try {
      await addPost(content.trim(), pendingMedia);
      setContent('');
      clearMedia();
    } catch (err) {
      setError(err.message || 'Failed to post.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {!myProfile?.display_name && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-200 text-sm p-3">
          Set up your trader profile (Traders tab → your profile) so other traders know who's posting.
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <textarea
          rows={3} value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="Share a setup, an idea, a lesson learned… #EURUSD"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
        />
        {previewUrl && (
          <div className="relative inline-block">
            {pendingMedia?.type === 'video' ? (
              <video src={previewUrl} controls className="max-h-48 rounded-lg border border-slate-800" />
            ) : (
              <img src={previewUrl} alt="" className="max-h-40 rounded-lg border border-slate-800" />
            )}
            <button onClick={clearMedia} className="absolute -top-2 -right-2 bg-slate-900 border border-slate-700 rounded-full p-1 text-slate-300 hover:text-red-400">
              <X size={13} />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-slate-200">
              <Camera size={15} /> Image
              <input type="file" accept="image/*" onChange={handleMediaChange} className="hidden" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-slate-200">
              <Video size={15} /> Video
              <input type="file" accept="video/*" onChange={handleMediaChange} className="hidden" />
            </label>
          </div>
          <button onClick={handlePost} disabled={posting} className="px-4 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400 disabled:opacity-50">
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>

      {myProfile?.country && (
        <div className="flex gap-2">
          <button onClick={() => setScope('country')} className={`px-3 py-1.5 rounded-lg text-xs border ${scope === 'country' ? 'bg-brand-400/15 border-brand-400/40 text-brand-200' : 'border-slate-800 text-slate-400'}`}>
            {countryFlag(myProfile.country)} {COUNTRIES.find(([c]) => c === myProfile.country)?.[1] || 'My country'}
          </button>
          <button onClick={() => setScope('all')} className={`px-3 py-1.5 rounded-lg text-xs border ${scope === 'all' ? 'bg-brand-400/15 border-brand-400/40 text-brand-200' : 'border-slate-800 text-slate-400'}`}>
            Everyone
          </button>
        </div>
      )}

      {postsError && <ErrorBanner message={`Couldn't load the feed: ${postsError}`} onRetry={loadPosts} retrying={postsLoading} />}

      {postsLoading && visiblePosts.length === 0 ? (
        <LoadingBlock label="Loading feed…" />
      ) : visiblePosts.length === 0 && !postsError ? (
        <div className="text-center py-16 text-slate-500 text-sm">Nothing posted yet — be the first.</div>
      ) : (
        <div className="space-y-3">
          {visiblePosts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
