import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from './AppContext.jsx';

const SocialContext = createContext(null);

// Only ever select these columns for OTHER users' profiles — never
// is_admin, stripe_*, or email. RLS allows reading any row (needed for the
// directory/feed to work at all), so the column allowlist here is what
// actually keeps other users' private fields from ever reaching the browser.
const PUBLIC_PROFILE_COLUMNS = 'id, display_name, country, bio, experience_level, favorite_pairs, avatar_path, is_pro, created_at';

export function SocialProvider({ children }) {
  const { user } = useApp();

  /* ---------------------------- my own profile ---------------------------- */
  const [myProfile, setMyProfile] = useState(null);
  const [myProfileLoading, setMyProfileLoading] = useState(false);

  const loadMyProfile = useCallback(async () => {
    if (!user) { setMyProfile(null); return; }
    setMyProfileLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error) console.error('loadMyProfile error', error);
    setMyProfile(data || null);
    setMyProfileLoading(false);
  }, [user]);

  useEffect(() => { loadMyProfile(); }, [loadMyProfile]);

  const updateMyProfile = useCallback(async (patch) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) throw error;
    await loadMyProfile();
  }, [user, loadMyProfile]);

  const uploadAvatar = useCallback(async (blob) => {
    if (!user) return null;
    const path = `${user.id}/avatar.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    await updateMyProfile({ avatar_path: path });
    return path;
  }, [user, updateMyProfile]);

  const getAvatarUrl = useCallback((path) => {
    if (!path) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  }, []);

  /* ---------------------------- traders directory ---------------------------- */
  const [traders, setTraders] = useState([]);
  const [tradersLoading, setTradersLoading] = useState(false);
  const [tradersError, setTradersError] = useState(null);

  const loadTraders = useCallback(async () => {
    setTradersLoading(true);
    setTradersError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .not('display_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { console.error('loadTraders error', error); setTradersError(error.message); }
    setTraders(data || []);
    setTradersLoading(false);
  }, []);

  useEffect(() => { loadTraders(); }, [loadTraders]);

  /* ---------------------------- follows ---------------------------- */
  const [followingIds, setFollowingIds] = useState(new Set());

  const loadFollowing = useCallback(async () => {
    if (!user) { setFollowingIds(new Set()); return; }
    const { data, error } = await supabase.from('follows').select('followee_id').eq('follower_id', user.id);
    if (error) { console.error('loadFollowing error', error); return; }
    setFollowingIds(new Set((data || []).map((r) => r.followee_id)));
  }, [user]);

  useEffect(() => { loadFollowing(); }, [loadFollowing]);

  const followUser = useCallback(async (followeeId) => {
    if (!user) return;
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, followee_id: followeeId });
    if (error) throw error;
    setFollowingIds((prev) => new Set(prev).add(followeeId));
  }, [user]);

  const unfollowUser = useCallback(async (followeeId) => {
    if (!user) return;
    const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('followee_id', followeeId);
    if (error) throw error;
    setFollowingIds((prev) => { const next = new Set(prev); next.delete(followeeId); return next; });
  }, [user]);

  /* ---------------------------- feed ---------------------------- */
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(null);
  const [likesByPost, setLikesByPost] = useState({});   // postId -> Set(userIds)
  const [commentsByPost, setCommentsByPost] = useState({}); // postId -> [{id, user_id, content, created_at}]

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    setPostsError(null);
    const { data: postRows, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) { console.error('loadPosts error', error); setPostsError(error.message); setPostsLoading(false); return; }

    // Fetch authors as a separate query and merge client-side, rather than
    // relying on a PostgREST foreign-key embed — posts.user_id references
    // auth.users, not profiles, so an embedded `profiles(...)` join isn't
    // guaranteed to resolve without an explicit second FK we haven't added.
    const authorIds = [...new Set((postRows || []).map((p) => p.user_id))];
    let authorsById = {};
    if (authorIds.length > 0) {
      const { data: authors } = await supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).in('id', authorIds);
      authorsById = Object.fromEntries((authors || []).map((a) => [a.id, a]));
    }
    const withAuthors = (postRows || []).map((p) => ({ ...p, author: authorsById[p.user_id] || null }));
    setPosts(withAuthors);

    const postIds = withAuthors.map((p) => p.id);
    if (postIds.length > 0) {
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_comments').select('*').in('post_id', postIds).order('created_at', { ascending: true }),
      ]);
      const likeMap = {};
      (likes || []).forEach((l) => { (likeMap[l.post_id] ||= new Set()).add(l.user_id); });
      setLikesByPost(likeMap);
      const commentMap = {};
      (comments || []).forEach((c) => { (commentMap[c.post_id] ||= []).push(c); });
      setCommentsByPost(commentMap);
    }
    setPostsLoading(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // media: { blob, type: 'image' | 'video', contentType } or null
  const addPost = useCallback(async (content, media) => {
    if (!user) return;
    const { data: row, error } = await supabase
      .from('posts')
      .insert({ user_id: user.id, content, country: myProfile?.country || null })
      .select()
      .single();
    if (error) throw error;

    if (media?.blob) {
      const ext = media.type === 'video' ? 'mp4' : 'jpg';
      const path = `${user.id}/${row.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from('posts').upload(path, media.blob, { contentType: media.contentType });
      if (!upErr) await supabase.from('posts').update({ image_path: path, media_type: media.type }).eq('id', row.id);
    }
    await loadPosts();
  }, [user, myProfile, loadPosts]);

  const deletePost = useCallback(async (postId, imagePath) => {
    await supabase.from('posts').delete().eq('id', postId);
    if (imagePath) await supabase.storage.from('posts').remove([imagePath]);
    await loadPosts();
  }, [loadPosts]);

  const getPostImageUrl = useCallback((path) => {
    if (!path) return null;
    const { data } = supabase.storage.from('posts').getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const toggleLike = useCallback(async (postId) => {
    if (!user) return;
    const alreadyLiked = likesByPost[postId]?.has(user.id);
    if (alreadyLiked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      setLikesByPost((prev) => { const next = { ...prev }; next[postId] = new Set(next[postId]); next[postId].delete(user.id); return next; });
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      setLikesByPost((prev) => { const next = { ...prev }; next[postId] = new Set(next[postId] || []); next[postId].add(user.id); return next; });
    }
  }, [user, likesByPost]);

  const addComment = useCallback(async (postId, content) => {
    if (!user) return;
    const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, content }).select().single();
    if (error) throw error;
    setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), data] }));
  }, [user]);

  const value = useMemo(() => ({
    myProfile, myProfileLoading, updateMyProfile, uploadAvatar, getAvatarUrl,
    traders, tradersLoading, tradersError, loadTraders,
    followingIds, followUser, unfollowUser,
    posts, postsLoading, postsError, loadPosts, addPost, deletePost, getPostImageUrl,
    likesByPost, commentsByPost, toggleLike, addComment,
  }), [
    myProfile, myProfileLoading, updateMyProfile, uploadAvatar, getAvatarUrl,
    traders, tradersLoading, tradersError, loadTraders,
    followingIds, followUser, unfollowUser,
    posts, postsLoading, postsError, loadPosts, addPost, deletePost, getPostImageUrl,
    likesByPost, commentsByPost, toggleLike, addComment,
  ]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside <SocialProvider>');
  return ctx;
}
