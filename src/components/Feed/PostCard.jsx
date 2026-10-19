import { useState } from 'react';
import { Heart, MessageCircle, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useSocial } from '../../context/SocialContext.jsx';
import { countryFlag } from '../../lib/countries.js';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function PostCard({ post }) {
  const { user } = useApp();
  const { likesByPost, commentsByPost, toggleLike, addComment, deletePost, getPostImageUrl, getAvatarUrl } = useSocial();
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  const likes = likesByPost[post.id] || new Set();
  const comments = commentsByPost[post.id] || [];
  const liked = user && likes.has(user.id);
  const author = post.author;
  const avatarUrl = getAvatarUrl(author?.avatar_path);
  const imageUrl = getPostImageUrl(post.image_path);

  async function handleComment() {
    if (!commentText.trim()) return;
    await addComment(post.id, commentText.trim());
    setCommentText('');
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-slate-500 text-xs font-data">
          {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (author?.display_name?.[0] || '?')}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">{author?.display_name || 'A trader'}</div>
          <div className="text-xs text-slate-500">
            {author?.country ? `${countryFlag(author.country)} ` : ''}{timeAgo(post.created_at)}
          </div>
        </div>
        {user?.id === post.user_id && (
          <button onClick={() => deletePost(post.id, post.image_path)} className="ml-auto text-slate-600 hover:text-red-400">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="text-sm text-slate-200 mt-3 whitespace-pre-wrap">{post.content}</div>
      {imageUrl && post.media_type === 'video' ? (
        <video src={imageUrl} controls className="mt-3 rounded-lg border border-slate-800 max-h-80 w-full" />
      ) : imageUrl ? (
        <img src={imageUrl} alt="" className="mt-3 rounded-lg border border-slate-800 max-h-80 object-cover w-full" />
      ) : null}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800">
        <button onClick={() => toggleLike(post.id)} className={`flex items-center gap-1.5 text-xs ${liked ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}>
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} /> {likes.size || ''}
        </button>
        <button onClick={() => setShowComments((s) => !s)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
          <MessageCircle size={15} /> {comments.length || ''}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="text-xs text-slate-400 bg-slate-950/60 rounded-lg px-3 py-2">{c.content}</div>
          ))}
          <div className="flex gap-2">
            <input
              value={commentText} onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
              placeholder="Write a comment…"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
            />
            <button onClick={handleComment} className="px-3 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-xs font-semibold hover:bg-brand-400">
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
