import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';

// === КОНФИГУРАЦИЯ ===
const API_BASE = 'https://cue2a.spdrm.ru/api/messages';

// === КОМПОНЕНТ ВВОДА ===
const ChatInput = React.memo(forwardRef(({ onSend, isSending, theme }, ref) => {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    insertText: (text) => {
      setValue(prev => text + '\n' + prev);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value);
    setValue('');
  };

  const inputClass = theme === 'dark' 
    ? "bg-zinc-950 border-zinc-700 text-white focus:border-zinc-500 placeholder:text-zinc-600"
    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500 placeholder:text-gray-400";

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
            }
        }}
        placeholder="Напишите сообщение..."
        className={`flex-1 border rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors resize-none h-12 custom-scroll ${inputClass}`}
        disabled={isSending}
      />
      <button
        type="submit"
        disabled={isSending || !value.trim()}
        className={`font-bold rounded-lg px-5 transition-colors flex items-center justify-center ${
          theme === 'dark' 
            ? 'bg-white text-black hover:bg-zinc-200 disabled:opacity-50' 
            : 'bg-black text-white hover:bg-gray-800 disabled:opacity-50'
        }`}
      >
        {isSending ? (
           <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"/>
        ) : '➤'}
      </button>
    </form>
  );
}));

// === ОСНОВНОЙ КОМПОНЕНТ ===
export default function AnonymousChat() {
  const [messages, setMessages] = useState([]); 
  const [pendingMessages, setPendingMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [contextMenu, setContextMenu] = useState(null);

  const scrollViewportRef = useRef(null);
  const bottomRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const isAutoScrolling = useRef(true);
  const chatInputRef = useRef(null);

  // === ЗАГРУЗКА ===
  const fetchMessages = useCallback(async (offset = 0, isHistory = false) => {
    try {
      if (isHistory) setIsLoadingHistory(true);
      const limit = 50;
      const response = await fetch(`${API_BASE}?limit=${limit}&offset=${offset}`);
      if (!response.ok) return; 
      
      const data = await response.json();
      const sortedBatch = data.sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));

      if (sortedBatch.length < limit && isHistory) {
        setHasMore(false);
      }

      setMessages(prev => {
        const currentIds = new Set(prev.map(m => m.postedAt + m.content));
        const newUnique = sortedBatch.filter(m => !currentIds.has(m.postedAt + m.content));
        if (newUnique.length === 0) return prev;
        return isHistory ? [...newUnique, ...prev] : [...prev, ...newUnique];
      });

      setPendingMessages(prevPending => {
        if (prevPending.length === 0) return prevPending;
        return prevPending.filter(pMsg => !sortedBatch.some(sMsg => sMsg.content === pMsg.content));
      });

    } catch (error) {
      console.error("Ошибка:", error);
    } finally {
      if (isHistory) setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages(0, false);
    const interval = setInterval(() => fetchMessages(0, false), 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // === ОТПРАВКА ===
  const handleSend = async (text) => {
    const tempId = Date.now();
    const newPendingMsg = {
      content: text,
      postedAt: new Date().toISOString(),
      isPending: true,
      id: tempId
    };
    
    setPendingMessages(prev => [...prev, newPendingMsg]);
    isAutoScrolling.current = true;
    setIsSending(true);

    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      fetchMessages(0, false);
    } catch (error) {
      alert('Ошибка отправки');
      setPendingMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleContextMenu = (e, telegramId) => {
    if (!telegramId) return;
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, telegramId: telegramId });
  };

  const handleReply = () => {
    if (contextMenu && chatInputRef.current) {
      chatInputRef.current.insertText(`https://t.me/cue2a/${contextMenu.telegramId}`);
    }
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop === 0 && !isLoadingHistory && hasMore && messages.length > 0) {
      prevScrollHeightRef.current = scrollHeight;
      fetchMessages(messages.length, true);
    }
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAutoScrolling.current = isAtBottom;
  };

  useLayoutEffect(() => {
    if (scrollViewportRef.current && prevScrollHeightRef.current > 0 && !isLoadingHistory) {
      const diff = scrollViewportRef.current.scrollHeight - prevScrollHeightRef.current;
      scrollViewportRef.current.scrollTop = diff;
      prevScrollHeightRef.current = 0;
    }
  }, [messages, isLoadingHistory]);

  useEffect(() => {
    if (isAutoScrolling.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, pendingMessages]);

  const messagesToRender = useMemo(() => [...messages, ...pendingMessages], [messages, pendingMessages]);
  const formatTime = (isoString) => {
    try { return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  const themeStyles = {
    // Внешний фон (на весь экран)
    bodyBackground: theme === 'dark' ? 'bg-zinc-950' : 'bg-slate-100',
    // Фон самого чата
    container: theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800',
    header: theme === 'dark' ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-slate-200',
    bubble: theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200 shadow-sm',
    pendingBubble: theme === 'dark' ? 'bg-zinc-900/50 border-dashed border-zinc-700 text-zinc-400' : 'bg-slate-100 border-dashed border-slate-300 text-slate-500',
    inputArea: theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200',
    menu: theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-slate-200 text-slate-800',
    menuHover: theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-slate-100',
  };

  return (
    // ВНЕШНЯЯ ОБЕРТКА: Занимает весь экран и красит фон
    <div className={`w-full h-screen flex justify-center transition-colors duration-300 ${themeStyles.bodyBackground}`}>
        
        {/* ВНУТРЕННЯЯ ОБЕРТКА: Сам чат с ограничением ширины */}
        <div className={`flex flex-col w-full max-w-2xl h-full border-x shadow-2xl font-sans ${themeStyles.container} ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
        
        {/* Шапка */}
        <div className={`p-4 border-b sticky top-0 z-20 flex items-center justify-between backdrop-blur-sm ${themeStyles.header}`}>
            <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <div>
                <h1 className="font-bold text-lg leading-none">CU E2A</h1>
                <span className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>
                Загружено: {messages.length}
                </span>
            </div>
            </div>
            <button 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-zinc-800 text-yellow-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
            {theme === 'dark' ? '☀' : '☾'}
            </button>
        </div>

        {/* Список сообщений */}
        <div 
            ref={scrollViewportRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-4 relative custom-scroll"
        >
            {isLoadingHistory && (
                <div className="flex justify-center py-2"><span className="animate-spin h-5 w-5 border-2 border-zinc-500 border-t-transparent rounded-full"/></div>
            )}

            {messagesToRender.map((msg, index) => {
            const isPending = msg.isPending;
            return (
                <div 
                key={index} 
                onContextMenu={(e) => handleContextMenu(e, msg.telegramId)}
                className={`flex flex-col ${isPending ? 'opacity-80' : 'animate-in fade-in slide-in-from-bottom-2 duration-300'}`}
                >
                <div className={`p-3 rounded-2xl rounded-tl-none self-start max-w-[85%] border cursor-context-menu ${isPending ? themeStyles.pendingBubble : themeStyles.bubble}`}>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>
                </div>
                <div className="flex items-center gap-2 mt-1 ml-1">
                    <span className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>
                    {formatTime(msg.postedAt)} {msg.telegramId ? `#${msg.telegramId}` : ''}
                    </span>
                    {isPending && <span className="text-[10px] text-amber-500 flex items-center gap-1">⏱ Модерация...</span>}
                </div>
                </div>
            );
            })}
            <div ref={bottomRef} />
        </div>

        {/* Ввод */}
        <div className={`p-3 border-t z-20 ${themeStyles.inputArea}`}>
            <ChatInput ref={chatInputRef} onSend={handleSend} isSending={isSending} theme={theme} />
        </div>

        {/* КОНТЕКСТНОЕ МЕНЮ */}
        {contextMenu && (
            <div 
            style={{ top: contextMenu.y, left: contextMenu.x }} 
            className={`fixed z-50 min-w-[150px] rounded-lg border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${themeStyles.menu}`}
            >
            <button 
                onClick={handleReply}
                className={`w-full text-left px-4 py-2 text-sm font-medium flex items-center gap-2 ${themeStyles.menuHover}`}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path></svg>
                Ответить
            </button>
            </div>
        )}
        </div>
    </div>
  );
}