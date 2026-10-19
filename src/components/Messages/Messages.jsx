import { useState } from 'react';
import { ArrowLeft, Send, ShieldOff, Flag } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useMessages } from '../../context/MessagesContext.jsx';
import { useSocial } from '../../context/SocialContext.jsx';
import { countryFlag } from '../../lib/countries.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

const REPORT_REASONS = ['Spam or scam', 'Impersonation', 'Harassment', 'Sharing paid signals against platform rules', 'Other'];

function timeShort(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Messages() {
  const { user } = useApp();
  const { getAvatarUrl } = useSocial();
  const {
    conversations, conversationsLoading, conversationsError, loadConversations, peersById,
    activeConversationId, setActiveConversationId,
    messages, messagesLoading, messagesError,
    sendMessage, blockedIds, blockUser, unblockUser, reportUser,
  } = useMessages();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const peerId = activeConv ? (activeConv.user_a === user?.id ? activeConv.user_b : activeConv.user_a) : null;
  const peer = peerId ? peersById[peerId] : null;
  const isBlocked = peerId && blockedIds.has(peerId);

  async function handleSend() {
    if (!draft.trim() || !activeConversationId) return;
    setSending(true);
    try {
      await sendMessage(activeConversationId, draft);
      setDraft('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  async function handleReport() {
    if (!peerId) return;
    await reportUser(peerId, reportReason, reportDetails.trim() || null);
    setReportSent(true);
    setReportDetails('');
  }

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-180px)] md:h-[calc(100vh-140px)]">
      {/* Conversation list — hidden on mobile once a thread is open */}
      <div className={`${activeConversationId ? 'hidden md:block' : ''} space-y-2 overflow-y-auto`}>
        {conversationsError && <ErrorBanner message={`Couldn't load messages: ${conversationsError}`} onRetry={loadConversations} retrying={conversationsLoading} />}
        {conversationsLoading && conversations.length === 0 ? (
          <LoadingBlock label="Loading conversations…" />
        ) : conversations.length === 0 && !conversationsError ? (
          <div className="text-center py-16 text-slate-500 text-sm px-2">
            No conversations yet — message a trader from the Traders directory to start one.
          </div>
        ) : (
          conversations.map((c) => {
            const pid = c.user_a === user?.id ? c.user_b : c.user_a;
            const p = peersById[pid];
            const avatarUrl = getAvatarUrl(p?.avatar_path);
            return (
              <button
                key={c.id}
                onClick={() => setActiveConversationId(c.id)}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left ${activeConversationId === c.id ? 'bg-brand-400/10' : 'hover:bg-slate-900'}`}
              >
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-slate-500 text-xs font-data">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (p?.display_name?.[0] || '?')}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">{p?.display_name || 'Trader'}</div>
                  <div className="text-xs text-slate-500">{p?.country ? countryFlag(p.country) : ''}</div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Thread */}
      <div className={`${activeConversationId ? '' : 'hidden md:flex'} flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden`}>
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Select a conversation</div>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 border-b border-slate-800">
              <button onClick={() => setActiveConversationId(null)} className="md:hidden text-slate-400"><ArrowLeft size={18} /></button>
              <div className="text-sm font-medium text-slate-200 flex-1 truncate">
                {peer?.display_name || 'Trader'} {peer?.country ? countryFlag(peer.country) : ''}
              </div>
              <button onClick={() => setShowReport((s) => !s)} className="text-slate-500 hover:text-amber-400" title="Report"><Flag size={15} /></button>
              <button
                onClick={() => (isBlocked ? unblockUser(peerId) : blockUser(peerId))}
                className={`text-xs px-2 py-1 rounded-md border ${isBlocked ? 'border-slate-700 text-slate-400' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}`}
              >
                {isBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>

            {showReport && (
              <div className="p-3 border-b border-slate-800 bg-slate-950/50 space-y-2">
                {reportSent ? (
                  <div className="text-xs text-brand-400">Report sent to the admin team.</div>
                ) : (
                  <>
                    <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100">
                      {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <textarea rows={2} value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Optional details…" className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100" />
                    <button onClick={handleReport} className="px-3 py-1 rounded-md bg-amber-400 text-slate-950 text-xs font-semibold">Submit report</button>
                  </>
                )}
              </div>
            )}

            {isBlocked && (
              <div className="px-3 py-2 bg-amber-400/10 text-amber-300 text-xs">You've blocked this trader — unblock to send messages again.</div>
            )}

            {messagesError && <div className="p-3"><ErrorBanner message={`Couldn't load messages: ${messagesError}`} /></div>}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messagesLoading && messages.length === 0 ? (
                <LoadingBlock label="Loading messages…" />
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${mine ? 'bg-brand-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>
                        {m.content}
                        <div className={`text-[10px] mt-0.5 ${mine ? 'text-slate-950/60' : 'text-slate-500'}`}>{timeShort(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-800 flex gap-2">
              <input
                value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                disabled={isBlocked}
                placeholder={isBlocked ? 'Unblock to send a message' : 'Message…'}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
              />
              <button onClick={handleSend} disabled={sending || isBlocked} className="px-3 py-2 rounded-lg bg-brand-500 text-slate-950 disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
