'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { ChatMessage } from '@/types';
import { Send, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import ProfileModal from '@/components/ui/ProfileModal';
import toast from 'react-hot-toast';

const GRADE_BADGES: Record<string, string> = {
  SILVER: '🥈',
  GOLD: '🥇',
  PLATINUM: '💠',
  DIAMOND: '💎',
};

function renderContent(content: string, myPseudo: string | undefined, mentions: string[] = []) {
  const isMentioned = myPseudo && mentions.includes(myPseudo);
  const parts = content.split(/(@\w+)/g);
  return (
    <span className={clsx('break-words', isMentioned && 'bg-casino-gold/10 rounded px-0.5')}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const mentioned = part.slice(1);
          const isMe = myPseudo && mentioned === myPseudo;
          return (
            <span key={i} className={clsx('font-bold', isMe ? 'text-casino-gold' : 'text-blue-400')}>
              {part}
            </span>
          );
        }
        return <span key={i} className="text-gray-300">{part}</span>;
      })}
    </span>
  );
}

export default function ChatPanel({ initialMessages = [] }: { initialMessages?: ChatMessage[] }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [profilePseudo, setProfilePseudo] = useState<string | null>(null);
  const [mentionCount, setMentionCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-99), msg]);
      if (user?.pseudo && msg.mentions?.includes(user.pseudo) && msg.userId !== user.id) {
        setMentionCount(c => c + 1);
      }
    };

    const handleMention = (data: { from: string; content: string }) => {
      toast(`💬 ${data.from} vous a mentionné`, { icon: '🔔', duration: 4000 });
    };

    socket.on('chat:message', handleMessage);
    socket.on('mention:received', handleMention);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('mention:received', handleMention);
    };
  }, [socket, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('chat:message', { content: input.trim() });
    setInput('');
  };

  // Auto-complétion @pseudo simple : Tab complète la mention en cours
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const match = input.match(/@(\w*)$/);
      if (!match) return;
      const partial = match[1].toLowerCase();
      const found = messages.map(m => m.pseudo).find(p => p.toLowerCase().startsWith(partial) && p !== user?.pseudo);
      if (found) setInput(input.slice(0, input.length - match[0].length) + '@' + found + ' ');
    }
  }, [input, messages, user]);

  return (
    <div className="casino-card flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-casino-border flex items-center gap-2">
        <span className="text-green-400">●</span>
        <span className="text-sm font-medium text-white flex-1">Chat général</span>
        {mentionCount > 0 && (
          <button
            onClick={() => setMentionCount(0)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-black"
            style={{ background: '#f59e0b' }}
          >
            <Bell className="w-3 h-3" />
            {mentionCount}
          </button>
        )}
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
            <div
              key={msg.id}
              className={clsx(
                'flex gap-2 text-sm animate-slide-up rounded-lg px-1 py-0.5 transition-colors',
                user?.pseudo && msg.mentions?.includes(user.pseudo) && 'bg-casino-gold/5 border border-casino-gold/20'
              )}
            >
              <img
                src={msg.avatar || '/avatars/default-1.png'}
                alt={msg.pseudo}
                className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5 cursor-pointer"
                onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
                onClick={() => setProfilePseudo(msg.pseudo)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span
                    className="font-medium cursor-pointer hover:underline"
                    style={{ color: msg.pseudoColor && msg.pseudoColor !== 'rainbow' ? msg.pseudoColor : undefined }}
                    onClick={() => setProfilePseudo(msg.pseudo)}
                  >
                    {msg.grade !== 'NONE' && GRADE_BADGES[msg.grade] && (
                      <span className="mr-0.5 text-xs">{GRADE_BADGES[msg.grade]}</span>
                    )}
                    <span className={clsx(msg.pseudoColor === 'rainbow' && 'animate-rainbow')}>
                      {msg.pseudo}
                    </span>
                  </span>
                  {msg.title && (
                    <span className="text-xs text-gray-500 italic">{msg.title}</span>
                  )}
                </div>
                <div className="mt-0.5">
                  {renderContent(msg.content, user?.pseudo, msg.mentions)}
                </div>
              </div>
            </div>
          )
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-casino-border flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message... @pseudo pour mentionner, Tab pour compléter"
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
