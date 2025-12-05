import React, { useState, useEffect, useRef } from 'react';

// URL API
// ВНИМАНИЕ: Если сервер блокирует CORS, используйте прокси (см. инструкцию ниже)
const API_URL = '/api/messages';

export default function AnonymousChat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef(null);

  // Функция получения сообщений
  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Ошибка сети');
      
      const data = await response.json();
      
      // API обычно возвращает новые сверху. Для чата нам нужно перевернуть массив,
      // чтобы новые были внизу, или просто правильно отобразить.
      // Здесь мы сортируем по дате (старые -> новые), чтобы это выглядело как чат.
      const sortedData = data.sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));
      
      setMessages(sortedData);
    } catch (error) {
      console.error("Ошибка при получении сообщений:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция отправки сообщения
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    try {
      setIsSending(true);
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: inputValue }),
      });

      if (response.ok) {
        setInputValue(''); // Очистить поле
        fetchMessages();   // Обновить список сообщений
      } else {
        alert('Не удалось отправить сообщение');
      }
    } catch (error) {
      console.error("Ошибка отправки:", error);
      alert('Ошибка соединения');
    } finally {
      setIsSending(false);
    }
  };

  // Загружаем сообщения при старте и каждые 5 секунд
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  // Автоскролл вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Форматирование даты
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-zinc-950 text-zinc-100 border-x border-zinc-800 shadow-2xl">
      
      {/* Шапка */}
      <header className="p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
          CU E2A
        </h1>
        <p className="text-xs text-zinc-500 mt-1">Сообщения модерируются. Будьте вежливы.</p>
      </header>

      {/* Список сообщений */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-zinc-500 mt-10">Нет сообщений...</div>
        )}
        
        {messages.map((msg, index) => (
          <div key={index} className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none self-start max-w-[85%] border border-zinc-700/50">
              {/* Обработка ссылок и переносов строк */}
              <p className="whitespace-pre-wrap break-words text-sm md:text-base leading-relaxed">
                {msg.content}
              </p>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 ml-1">
              {formatTime(msg.postedAt)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Поле ввода */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <form onSubmit={sendMessage} className="relative flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            placeholder="Напишите сообщение..."
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 resize-none h-14 scrollbar-hide"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || !inputValue.trim()}
            className="bg-white text-black font-semibold rounded-xl px-4 py-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}