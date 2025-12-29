import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';

const API_BASE = '/api';
const CHANNEL_USERNAME = 'cue2a'; 

// === ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ===

const UserAvatar = ({ name, id }) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
    const color = colors[Math.abs(id || 0) % colors.length] || 'bg-gray-500';
    const initials = name ? name[0].toUpperCase() : '?';
    return (
        <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-sm font-bold text-white shrink-0 select-none`}>
            {initials}
        </div>
    );
};

const cleanContent = (text) => {
    if (!text) return "";
    const regex = /^(https?:\/\/t\.me\/[a-zA-Z0-9_]+\/\d+(\?comment=\d+)?)\s*/;
    return text.replace(regex, '').trim();
};

// === УМНОЕ ПОЛЕ ВВОДА (MULTILINE) ===
const AutoTextarea = React.forwardRef(({ value, onChange, onSend, placeholder, className, autoFocus }, ref) => {
    const internalRef = useRef(null);
    
    useLayoutEffect(() => {
        if (typeof ref === 'function') {
            ref(internalRef.current);
        } else if (ref) {
            ref.current = internalRef.current;
        }
    }, [ref]);

    useLayoutEffect(() => {
        if (internalRef.current) {
            internalRef.current.style.height = 'auto';
            internalRef.current.style.height = `${internalRef.current.scrollHeight}px`;
        }
    }, [value]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend(e);
        }
    };

    return (
        <textarea
            ref={internalRef}
            rows={1}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={`${className} resize-none overflow-hidden hover:overflow-y-auto custom-scroll`}
            style={{ minHeight: '44px', maxHeight: '150px' }} 
        />
    );
});

const ReplyBlock = ({ replyUrl, allMessages, scrollToId }) => {
    const [fetchedMsg, setFetchedMsg] = useState(null);
    const [loading, setLoading] = useState(false);
    let replyId = null;
    try {
        const urlObj = new URL(replyUrl);
        const commentId = urlObj.searchParams.get('comment');
        const pathParts = urlObj.pathname.split('/');
        const lastPart = pathParts.pop();
        replyId = commentId ? parseInt(commentId) : parseInt(lastPart);
    } catch (e) { return null; }
    const localMsg = allMessages.find(m => m.id === replyId);
    const targetMsg = localMsg || fetchedMsg;
    useEffect(() => {
        if (!localMsg && replyId && !fetchedMsg && !loading) {
            setLoading(true);
            fetch(`${API_BASE}/single/${replyId}`)
                .then(res => res.json()).then(data => { if (data && !data.error) setFetchedMsg(data); })
                .catch(err => console.error(err)).finally(() => setLoading(false));
        }
    }, [localMsg, replyId, fetchedMsg, loading]);
    const handleClick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (replyId) scrollToId(replyId);
    };
    let previewText = "Загрузка...";
    if (targetMsg) {
        const cleanText = cleanContent(targetMsg.content);
        previewText = cleanText || <span className="italic opacity-70">Фото / Медиа</span>;
    } else if (!loading) previewText = "Сообщение не найдено";
    return (
        <div onClick={handleClick} className="flex flex-col mb-2 pl-3 border-l-[3px] border-[#e0823d] bg-[#2b2b2b]/50 rounded-r-md py-1 cursor-pointer hover:bg-[#2b2b2b] transition-colors group select-none min-h-[36px] justify-center">
            <span className="text-[#e0823d] text-xs font-bold mb-0.5">{targetMsg ? (targetMsg.senderName || 'Channel Post') : '...'}</span>
            <span className="text-zinc-300 text-[13px] truncate pr-2 opacity-90 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{previewText}</span>
        </div>
    );
};

const MessageCard = ({ msg, onClick, isActive, isComment = false, onReply, allMessages, scrollToId }) => {
    const time = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const replyRegex = new RegExp(`^(https:\\/\\/t\\.me\\/${CHANNEL_USERNAME}\\/(\\d+)(?:\\?comment=(\\d+))?)(\\s|\\n)*`);
    const match = msg.content.match(replyRegex);
    let replyUrl = null;
    let contentToShow = msg.content;
    if (match) {
        replyUrl = match[1];
        contentToShow = cleanContent(msg.content);
    }
    return (
        <div id={`msg-${msg.id}`} onClick={onClick} className={`mb-2 p-3 transition-all duration-300 relative rounded-lg mx-2 border-l-4 group ${isComment ? 'flex gap-3 mb-4 border-l-0 rounded-none mx-0' : (isActive ? 'bg-[#2c2c2c] border-blue-500' : 'bg-[#212121] border-transparent hover:bg-[#2a2a2a] cursor-pointer')}`}>
            {isComment && <UserAvatar name={msg.senderName} id={msg.senderId} />}
            <div className={`${isComment ? 'bg-[#212121] p-3 rounded-xl rounded-tl-none flex-1 min-w-0' : 'flex-1 min-w-0'}`}>
                {isComment && (<div className="flex justify-between items-baseline mb-1"><span className="text-[#70b5e8] text-sm font-semibold truncate pr-2">{msg.senderName}</span></div>)}
                {replyUrl && <ReplyBlock replyUrl={replyUrl} allMessages={allMessages} scrollToId={scrollToId} />}
                <p className="text-[15px] text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">{contentToShow || <span className="italic text-zinc-500">Медиа контент</span>}</p>
                {msg.reactions && msg.reactions.length > 0 && (<div className="flex flex-wrap gap-1 mt-2">{msg.reactions.map((r, i) => (<div key={i} className="flex items-center gap-1 bg-[#313131] px-1.5 py-0.5 rounded-full text-[11px] text-zinc-300 border border-zinc-700/50"><span>{r.emoji}</span><span className="font-medium">{r.count}</span></div>))}</div>)}
                
                <div className="flex items-center justify-between mt-2 pt-1 select-none">
                    {/* КНОПКА ОТВЕТИТЬ: Видна всегда на мобильном (opacity-100), на ПК только при наведении (md:opacity-0 md:group-hover:opacity-100) */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onReply(msg); }} 
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-xs text-[#e0823d] hover:text-[#ff9f5a] font-medium flex items-center gap-1 z-10"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6M3 10l6-6"/></svg>
                        Ответить
                    </button>
                    
                    <div className="flex items-center gap-3 ml-auto">
                        {!isComment && (
                             <div className="flex items-center gap-1 text-xs text-[#70b5e8]">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                <span>{msg.replies || 0}</span>
                             </div>
                        )}
                        <span className="text-[11px] text-zinc-500">{time}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ReplyPreview = ({ replyingTo, onCancel }) => {
    if (!replyingTo) return null;
    const previewContent = cleanContent(replyingTo.content);
    return (
        <div className="flex items-center justify-between bg-[#181818] p-2 rounded-t-lg border-b border-[#333] mb-[-1px] animate-in slide-in-from-bottom-2 fade-in">
            <div className="flex items-center gap-3 pl-2 border-l-[3px] border-[#e0823d]"><div className="flex flex-col max-w-[80vw]"><span className="text-[#e0823d] text-xs font-bold">{replyingTo.senderName || 'Channel Post'}</span><span className="text-zinc-400 text-xs truncate">{previewContent || 'Media'}</span></div></div>
            <button onClick={onCancel} className="p-2 text-zinc-500 hover:text-white"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
    );
};

// === ОСНОВНОЕ ПРИЛОЖЕНИЕ ===
export default function TelegramClone() {
    const [posts, setPosts] = useState([]);
    const [activePost, setActivePost] = useState(null);
    const [comments, setComments] = useState([]);
    
    // UI States
    const [channelInput, setChannelInput] = useState('');
    const [commentInput, setCommentInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    
    const [channelReplyingTo, setChannelReplyingTo] = useState(null); 
    const [threadReplyingTo, setThreadReplyingTo] = useState(null);   

    const channelInputRef = useRef(null);
    const commentInputRef = useRef(null);
    const commentsEndRef = useRef(null);
    const postsContainerRef = useRef(null);
    const prevScrollHeightRef = useRef(0);

    const scrollToId = (id) => {
        const el = document.getElementById(`msg-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('bg-[#333]');
            setTimeout(() => el.classList.remove('bg-[#333]'), 1000);
        }
    };

    const fetchPosts = useCallback(async (offsetId = 0) => {
        try {
            const url = `${API_BASE}/messages?limit=20${offsetId ? `&offsetId=${offsetId}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            const fetchedPosts = data.reverse(); 

            if (offsetId > 0) {
                if (postsContainerRef.current) prevScrollHeightRef.current = postsContainerRef.current.scrollHeight;
                setPosts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newUnique = fetchedPosts.filter(p => !existingIds.has(p.id));
                    if (newUnique.length === 0) return prev;
                    return [...newUnique, ...prev];
                });
            } else {
                setPosts(prev => {
                    if (prev.length === 0) return fetchedPosts;
                    const existingIds = new Set(prev.map(p => p.id));
                    const newUnique = fetchedPosts.filter(p => !existingIds.has(p.id));
                    if (newUnique.length === 0) return prev;
                    return [...prev, ...newUnique];
                });
            }
        } catch (e) { console.error(e); } 
        finally { if (offsetId > 0) setIsLoadingHistory(false); }
    }, []);

    useEffect(() => {
        fetchPosts(0);
        const interval = setInterval(() => { if (!isLoadingHistory) fetchPosts(0); }, 5000);
        return () => clearInterval(interval);
    }, [fetchPosts, isLoadingHistory]);

    // Авто-выбор поста ТОЛЬКО НА КОМПЬЮТЕРЕ (ширина >= 768)
    useEffect(() => {
        const isDesktop = window.innerWidth >= 768;
        if (!activePost && posts.length > 0 && isDesktop) {
            loadComments(posts[posts.length - 1]);
        }
    }, [posts, activePost]);

    const handleChannelScroll = (e) => {
        const { scrollTop } = e.target;
        if (scrollTop < 100 && !isLoadingHistory && posts.length > 0) {
            setIsLoadingHistory(true);
            fetchPosts(posts[0].id);
        }
    };

    useLayoutEffect(() => {
        if (!isLoadingHistory && prevScrollHeightRef.current > 0 && postsContainerRef.current) {
            const container = postsContainerRef.current;
            const diff = container.scrollHeight - prevScrollHeightRef.current;
            if (diff > 0) container.scrollTop += diff;
            prevScrollHeightRef.current = 0;
        }
    }, [posts, isLoadingHistory]);

    const loadComments = async (post) => {
        if (activePost?.id === post.id) return;
        setActivePost(post);
        setComments([]);
        setThreadReplyingTo(null);
        setCommentInput('');
        try {
            const res = await fetch(`${API_BASE}/comments/${post.id}`);
            const data = await res.json();
            setComments(data);
        } catch (e) { console.error(e); }
    };

    const handleChannelReply = (msg) => { setChannelReplyingTo(msg); channelInputRef.current?.focus(); };
    const handleThreadReply = (msg) => { setThreadReplyingTo(msg); commentInputRef.current?.focus(); };

    const sendChannelPost = async (e) => {
        e && e.preventDefault();
        if (!channelInput.trim()) return;
        setIsSending(true);
        let textToSend = channelInput;
        if (channelReplyingTo) {
            const link = `https://t.me/${CHANNEL_USERNAME}/${channelReplyingTo.id}`;
            textToSend = `${link}\n${channelInput}`;
        }
        try {
            await fetch(`${API_BASE}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSend })
            });
            setChannelInput('');
            setChannelReplyingTo(null);
            setTimeout(() => fetchPosts(0), 1000);
        } catch (e) { alert("Ошибка отправки"); } finally { setIsSending(false); }
    };

    const sendComment = async (e) => {
        e && e.preventDefault();
        if (!commentInput.trim()) return;
        setIsSending(true);
        let textToSend = commentInput;
        if (threadReplyingTo) {
             const link = `https://t.me/${CHANNEL_USERNAME}/${activePost.id}?comment=${threadReplyingTo.id}`;
             textToSend = `${link}\n${commentInput}`;
        } else if (activePost) {
             const link = `https://t.me/${CHANNEL_USERNAME}/${activePost.id}`;
             textToSend = `${link}\n${commentInput}`;
        }
        try {
            await fetch(`${API_BASE}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSend })
            });
            setCommentInput('');
            setThreadReplyingTo(null);
            setTimeout(() => loadComments(activePost), 2000);
        } catch (e) { alert("Ошибка отправки"); } finally { setIsSending(false); }
    };

    useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

    return (
        <div className="flex h-[100dvh] w-full bg-[#181818] text-zinc-100 font-sans overflow-hidden">
            
            {/* СЛЕВА: ЛЕНТА */}
            <div className={`flex flex-col border-r border-black/20 bg-[#1c1c1c] ${activePost ? 'hidden md:flex md:w-[450px]' : 'w-full'}`}>
                <div className="h-14 px-4 flex items-center bg-[#212121] shadow sticky top-0 z-10 shrink-0">
                    <h2 className="font-bold text-lg">CU E2A Channel</h2>
                </div>
                
                <div 
                    ref={postsContainerRef}
                    onScroll={handleChannelScroll}
                    style={{ overflowAnchor: 'none' }}
                    className="flex-1 overflow-y-auto custom-scroll py-2"
                >
                    {isLoadingHistory && (
                        <div className="flex justify-center py-2">
                             <span className="animate-spin h-4 w-4 border-2 border-zinc-500 border-t-transparent rounded-full"/>
                        </div>
                    )}
                    
                    {posts.map(post => (
                        <MessageCard 
                            key={post.id} 
                            msg={post} 
                            isActive={activePost?.id === post.id}
                            onClick={() => loadComments(post)}
                            onReply={handleChannelReply}
                            allMessages={posts}
                            scrollToId={scrollToId}
                        />
                    ))}
                </div>

                <div className="relative p-3 bg-[#212121]">
                    <ReplyPreview replyingTo={channelReplyingTo} onCancel={() => setChannelReplyingTo(null)} />
                    
                    <div className={`bg-[#181818] rounded-lg border border-transparent focus-within:border-zinc-700 transition-all ${channelReplyingTo ? 'rounded-t-none' : ''}`}>
                         <AutoTextarea 
                            ref={channelInputRef}
                            value={channelInput}
                            onChange={e => setChannelInput(e.target.value)}
                            onSend={sendChannelPost}
                            className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none placeholder:text-zinc-600 block"
                            placeholder="Написать пост в канал..."
                         />
                    </div>
                </div>
            </div>

            {/* СПРАВА: ОБСУЖДЕНИЕ */}
            {activePost ? (
                <div className="flex-1 flex flex-col bg-[#0f0f0f] relative w-full h-full bg-[url('https://web.telegram.org/img/bg_0.png')] bg-repeat">
                    <div className="absolute inset-0 bg-[#0f0f0f]/90 pointer-events-none" />

                    <div className="relative z-10 h-14 flex items-center justify-between px-4 bg-[#212121] shadow shrink-0">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setActivePost(null)} className="md:hidden text-zinc-400 p-2 -ml-2">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                            </button>
                            <div>
                                <h3 className="font-bold text-md leading-tight">Обсуждение</h3>
                                <span className="text-xs text-zinc-500">Post #{activePost.id}</span>
                            </div>
                        </div>
                        <button onClick={() => setActivePost(null)} className="hidden md:block text-zinc-400 hover:text-white">
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    <div className="relative z-10 flex-1 overflow-y-auto p-4 custom-scroll">
                        <div className="mb-6 opacity-70 pointer-events-none select-none">
                            <MessageCard msg={activePost} onClick={()=>{}} onReply={()=>{}} allMessages={posts} scrollToId={scrollToId} />
                            <div className="text-center text-xs text-zinc-600 mt-2 border-b border-zinc-800 pb-2">Начало комментариев</div>
                        </div>

                        {comments.map(comment => (
                            <MessageCard 
                                key={comment.id} 
                                msg={comment} 
                                isComment={true} 
                                onReply={handleThreadReply}
                                allMessages={[activePost, ...comments]}
                                scrollToId={scrollToId}
                            />
                        ))}
                        <div ref={commentsEndRef} />
                    </div>

                    <div className="relative z-10 p-3 bg-[#212121]">
                        <ReplyPreview replyingTo={threadReplyingTo} onCancel={() => setThreadReplyingTo(null)} />

                        <div className="flex gap-2 max-w-4xl mx-auto items-end">
                            <div className={`flex-1 bg-[#181818] rounded-xl focus-within:ring-1 focus-within:ring-blue-500 transition-all ${threadReplyingTo ? 'rounded-t-none' : ''}`}>
                                <AutoTextarea 
                                    ref={commentInputRef}
                                    autoFocus
                                    value={commentInput}
                                    onChange={e => setCommentInput(e.target.value)}
                                    onSend={sendComment}
                                    placeholder="Написать комментарий..."
                                    className="w-full bg-transparent text-white px-4 py-3 focus:outline-none block"
                                />
                            </div>
                            
                            <button 
                                onClick={sendComment}
                                disabled={isSending || !commentInput.trim()}
                                className="bg-[#70b5e8] hover:bg-[#5aa0d5] text-white rounded-full w-[44px] h-[44px] flex items-center justify-center transition disabled:opacity-50 disabled:bg-zinc-700 shrink-0 mb-[1px]"
                            >
                                {isSending ? <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"/> : 
                                <svg className="w-6 h-6 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 bg-[#0f0f0f] bg-[url('https://web.telegram.org/img/bg_0.png')] bg-repeat relative">
                   <div className="absolute inset-0 bg-[#0f0f0f]/95 pointer-events-none" />
                </div>
            )}
        </div>
    );
}