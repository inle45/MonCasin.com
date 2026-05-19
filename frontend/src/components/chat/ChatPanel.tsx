'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { ChatMessage } from '@/types';
import { Send } from 'lucide-react';
import { clsx } from 'clsx';
import ProfileModal from '@/components/ui/ProfileModal';

const GRADE_BADGES: Record<string, string> = {
  SILVER: '🥈',
  GOLD: '🥇',
  PLATINUM: '💠',
  DIAMOND: '💎',
};

export default function ChatPanel({ initialMessages = [] }: { initialMessages?: ChatMessage[] }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [profilePseudo, setProfilePseudo] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-99), msg]);
    };

    socket.on('chat:message', handleMessage);
    return () => { socket.off('chat:message', handleMessage); };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('chat:message', { content: input.trim() });
    setInput('');
  };

  return (
    <div className="casino-card flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-casino-border flex items-center gap-2">
        <span className="text-green-400">●</span>
        <span className="text-sm font-medium text-white">Chat général</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-gray-500 text-xs text-center mt-4">Aucun message. Soyez le premier !</p>
        )}
        {messages.map((msg) => (
          (msg as unknown as { isSystem?: boolean }).isSystem ? (
            <div key={msg.id} className="text-xs text-center text-casino-gold/80 py-1 px-2 bg-casino-gold/5 rounded animate-slide-up">
              {msg.content}
            </div>
          ) : (
            <div key={msg.id} className="flex gap-2 text-sm animate-slide-up">
              <img
                src={msg.avatar || '/avatars/default-1.png'}
                alt={msg.pseudo}
                className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
                onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
              />
              <div className="min-w-0">
                <span
                  className="font-medium cursor-pointer hover:underline"
                  style={{ color: msg.pseudoColor && msg.pseudoColor !== 'rainbow' ? msg.pseudoColor : undefined }}
                  onClick={() => setProfilePseudo(msg.pseudo)}
                >
                  {msg.grade !== 'NONE' && GRADE_BADGES[msg.grade] && (
                    <span className="mr-1 text-xs">{GRADE_BADGES[msg.grade]}</span>
                  )}
                  <span className={clsx(msg.pseudoColor === 'rainbow' && 'animate-rainbow')}>
                    {msg.pseudo}
                  </span>
                </span>
                <span className="text-gray-500 mx-1">:</span>
                <span className="text-gray-300 break-words">{msg.content}</span>
              </div>
            </div>
          )
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-casino-border flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message... ou /pay <pseudo> <montant>"
          maxLength={500}
          className="flex-1 bg-casino-darker border border-casino-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-casino-gold"
        />
        <button
          type="submit"
          className="bg-casino-gold hover:bg-casino-gold-light text-black p-2 rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {profilePseudo && (
        <ProfileModal pseudo={profilePseudo} onClose={() => setProfilePseudo(null)} />
      )}
    </div>
  );
}
