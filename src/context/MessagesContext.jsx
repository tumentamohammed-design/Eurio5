import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from './AppContext.jsx';

const MessagesContext = createContext(null);

function orderPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export function MessagesProvider({ children }) {
  const { user } = useApp();

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState(null);
  const [peersById, setPeersById] = useState({});

  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

  const [blockedIds, setBlockedIds] = useState(new Set());

  const loadConversations = useCallback(async () => {
    if (!user) { setConversations([]); return; }
    setConversationsLoading(true);
    setConversationsError(null);
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false });
    if (error) { console.error('loadConversations error', error); setConversationsError(error.message); setConversationsLoading(false); return; }
    setConversations(data || []);

    const peerIds = [...new Set((data || []).map((c) => (c.user_a === user.id ? c.user_b : c.user_a)))];
    if (peerIds.length > 0) {
      const { data: peers } = await supabase
        .from('profiles')
        .select('id, display_name, country, avatar_path')
        .in('id', peerIds);
      setPeersById(Object.fromEntries((peers || []).map((p) => [p.id, p])));
    }
    setConversationsLoading(false);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadBlocked = useCallback(async () => {
    if (!user) { setBlockedIds(new Set()); return; }
    const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id);
    setBlockedIds(new Set((data || []).map((r) => r.blocked_id)));
  }, [user]);

  useEffect(() => { loadBlocked(); }, [loadBlocked]);

  // Finds an existing conversation with peerId, or creates one. Returns the
  // conversation id, or throws (e.g. if you've blocked each other).
  const openConversationWith = useCallback(async (peerId) => {
    if (!user) return null;
    const [a, b] = orderPair(user.id, peerId);
    const { data: existing } = await supabase.from('conversations').select('id').eq('user_a', a).eq('user_b', b).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: created, error } = await supabase.from('conversations').insert({ user_a: a, user_b: b }).select().single();
      if (error) throw error;
      convId = created.id;
      await loadConversations();
    }
    setActiveConversationId(convId);
    return convId;
  }, [user, loadConversations]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) { setMessages([]); return; }
    setMessagesLoading(true);
    setMessagesError(null);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) { console.error('loadMessages error', error); setMessagesError(error.message); }
    setMessages(data || []);
    setMessagesLoading(false);
  }, []);

  useEffect(() => { loadMessages(activeConversationId); }, [activeConversationId, loadMessages]);

  // Realtime: subscribe to new messages in the active conversation.
  useEffect(() => {
    if (!activeConversationId) return undefined;
    const channel = supabase
      .channel(`messages:${activeConversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversationId}` },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversationId]);

  const sendMessage = useCallback(async (conversationId, content) => {
    if (!user || !content.trim()) return;
    const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, content: content.trim() });
    if (error) throw error;
    await loadConversations();
  }, [user, loadConversations]);

  const blockUser = useCallback(async (peerId) => {
    if (!user) return;
    const { error } = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: peerId });
    if (error) throw error;
    setBlockedIds((prev) => new Set(prev).add(peerId));
  }, [user]);

  const unblockUser = useCallback(async (peerId) => {
    if (!user) return;
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', peerId);
    if (error) throw error;
    setBlockedIds((prev) => { const next = new Set(prev); next.delete(peerId); return next; });
  }, [user]);

  const reportUser = useCallback(async (peerId, reason, details) => {
    if (!user) return;
    const { error } = await supabase.from('reports').insert({ reporter_id: user.id, reported_user_id: peerId, reason, details: details || null });
    if (error) throw error;
  }, [user]);

  const totalUnreadHint = conversations.length; // simple presence signal; true unread tracking is a reasonable future add

  const value = useMemo(() => ({
    conversations, conversationsLoading, conversationsError, loadConversations, peersById,
    activeConversationId, setActiveConversationId, openConversationWith,
    messages, messagesLoading, messagesError, sendMessage,
    blockedIds, blockUser, unblockUser, reportUser,
    totalUnreadHint,
  }), [
    conversations, conversationsLoading, conversationsError, loadConversations, peersById,
    activeConversationId, openConversationWith,
    messages, messagesLoading, messagesError, sendMessage,
    blockedIds, blockUser, unblockUser, reportUser,
    totalUnreadHint,
  ]);

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used inside <MessagesProvider>');
  return ctx;
}
