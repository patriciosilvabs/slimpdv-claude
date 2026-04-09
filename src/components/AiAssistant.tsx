import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Send, Loader2, ChevronDown, Trash2, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { client } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Position { x: number; y: number }

const STORAGE_KEY = 'ai_assistant_messages';
const POS_KEY = 'ai_assistant_position';
const MAX_STORED = 100;
const WIDGET_W = 384; // sm:w-96
const WIDGET_H = 500;

function getSavedPos(): Position {
  try {
    const saved = localStorage.getItem(POS_KEY);
    if (saved) {
      const p = JSON.parse(saved) as Position;
      // Clamp to viewport in case screen was resized
      return {
        x: Math.min(Math.max(0, p.x), window.innerWidth - WIDGET_W),
        y: Math.min(Math.max(0, p.y), window.innerHeight - WIDGET_H),
      };
    }
  } catch {}
  // Default: bottom-right
  return {
    x: window.innerWidth - WIDGET_W - 20,
    y: window.innerHeight - WIDGET_H - 20,
  };
}

export function AiAssistant() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Position state (top-left corner of the widget)
  const [pos, setPos] = useState<Position>({ x: 0, y: 0 });
  const [posReady, setPosReady] = useState(false);
  const dragging = useRef(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });

  // Init position after mount (window is available)
  useEffect(() => {
    setPos(getSavedPos());
    setPosReady(true);
  }, []);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {}
  }, [messages]);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    dragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - pos.x, y: clientY - pos.y };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const newX = Math.min(Math.max(0, cx - dragOffset.current.x), window.innerWidth - WIDGET_W);
      const newY = Math.min(Math.max(0, cy - dragOffset.current.y), window.innerHeight - WIDGET_H);
      setPos({ x: newX, y: newY });
    };

    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      // Save position
      setPos(p => {
        try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
        return p;
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, [pos]);

  // Drag for closed button
  const btnDragged = useRef(false);
  const btnDragOffset = useRef<Position>({ x: 0, y: 0 });
  const [btnPos, setBtnPos] = useState<Position | null>(null);

  const onBtnDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    btnDragged.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const btn = e.currentTarget.getBoundingClientRect();
    btnDragOffset.current = { x: clientX - btn.left, y: clientY - btn.top };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      btnDragged.current = true;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const newX = Math.min(Math.max(0, cx - btnDragOffset.current.x), window.innerWidth - 120);
      const newY = Math.min(Math.max(0, cy - btnDragOffset.current.y), window.innerHeight - 48);
      setBtnPos({ x: newX, y: newY });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    scrollToBottom();
    try {
      const history = newMessages.map(m => ({ role: m.role, content: m.content }));
      const data = await client.post('/ai/chat', { messages: history });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err?.message || 'Erro ao conectar com a IA'}` }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleOpenClick = (e: React.MouseEvent) => {
    if (btnDragged.current) { e.preventDefault(); return; }
    // When opening, sync widget position to where the button is
    if (btnPos) {
      const wx = Math.min(Math.max(0, btnPos.x), window.innerWidth - WIDGET_W);
      const wy = Math.min(Math.max(0, btnPos.y), window.innerHeight - WIDGET_H);
      setPos({ x: wx, y: wy });
    }
    setOpen(true);
  };

  if (!user || !isAdmin) return null;

  // Button position: use btnPos if dragged, otherwise follow widget pos
  const buttonStyle = btnPos
    ? { position: 'fixed' as const, left: btnPos.x, top: btnPos.y, zIndex: 99999 }
    : { position: 'fixed' as const, right: 20, bottom: 20, zIndex: 99999 };

  return createPortal(
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpenClick}
          onMouseDown={onBtnDragStart}
          onTouchStart={onBtnDragStart}
          style={buttonStyle}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:opacity-90 transition-opacity select-none"
          aria-label="Abrir IA Assistente"
        >
          <Bot className="h-5 w-5" />
          <span className="text-sm font-medium">IA</span>
        </button>
      )}

      {/* Chat panel */}
      {open && posReady && (
        <div
          style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 99999, width: WIDGET_W, height: WIDGET_H }}
          className="flex flex-col bg-background border rounded-xl shadow-2xl overflow-hidden select-none"
        >
          {/* Header — drag handle */}
          <div
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
            className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <GripHorizontal className="h-4 w-4 opacity-60" />
              <Bot className="h-5 w-5" />
              <span className="font-semibold text-sm">Assistente IA</span>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => { setMessages([]); localStorage.removeItem(STORAGE_KEY); }}
                  className="hover:opacity-70 transition-opacity cursor-pointer"
                  aria-label="Limpar conversa"
                  title="Limpar conversa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setOpen(false)}
                className="hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Minimizar"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 select-text">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-8 px-4">
                <Bot className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Olá! Sou seu assistente.</p>
                <p className="mt-1">Posso consultar e editar produtos, pedidos, clientes, relatórios e muito mais.</p>
                <p className="mt-3 text-xs italic">Ex: "Quais produtos estão pausados?" ou "Atualiza o preço do X-Burguer para R$18"</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-muted text-foreground rounded-bl-none'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted px-3 py-2 rounded-lg rounded-bl-none">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2 items-end shrink-0 select-text">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onMouseDown={e => e.stopPropagation()}
              placeholder="Digite sua mensagem..."
              className="resize-none min-h-[40px] max-h-24 text-sm"
              rows={1}
              disabled={loading}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              onMouseDown={e => e.stopPropagation()}
              disabled={loading || !input.trim()}
              className="shrink-0 h-9 w-9"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
