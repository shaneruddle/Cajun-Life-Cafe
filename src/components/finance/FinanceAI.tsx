import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Loader2, Sparkles, MessageSquare, Trash2 } from 'lucide-react';
import { FinanceEntry } from '../../types';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface FinanceAIProps {
  entries: FinanceEntry[];
}

const FinanceAI: React.FC<FinanceAIProps> = ({ entries }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Hello! I'm your Finance AI Assistant. I have access to all your income and expense records. You can ask me things like:\n\n- What is the current price of pizza sauce?\n- How much did we spend on vegetables last month?\n- What's our most expensive category this year?\n- Show me a summary of our dividends." 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

      // Prepare context from entries
      // Limit to last 100 entries to avoid token limits
      const contextEntries = [...entries]
        .sort((a, b) => {
          const dateA = typeof a.date === 'string' ? a.date : (a.date as any)?.toDate?.()?.toISOString() || '';
          const dateB = typeof b.date === 'string' ? b.date : (b.date as any)?.toDate?.()?.toISOString() || '';
          return dateB.localeCompare(dateA);
        })
        .slice(0, 100)
        .map(e => ({
          date: typeof e.date === 'string' ? e.date : (e.date as any)?.toDate?.()?.toISOString()?.split('T')[0] || e.date,
          type: e.type,
          amount: e.amount,
          category: e.categoryName,
          desc: e.description,
          items: e.lineItems?.map(li => `${li.description} (${li.weight || ''} ${li.quantity || ''}): ฿${li.amount}`).join(', ')
        }));

      const prompt = `
        You are a specialized Finance AI Assistant for "Cajun Life Cafe". 
        You have access to the last 100 finance records (income, expenses, dividends):
        
        ${JSON.stringify(contextEntries, null, 2)}
        
        User Question: ${userMessage}
        
        Instructions:
        1. Use the provided data to answer the question accurately.
        2. If the user asks for the "current price" of something, look for the most recent entry for that item.
        3. Be concise but helpful.
        4. Use Markdown for formatting (bolding, lists, etc.).
        5. If you don't find specific data, say so clearly.
        6. Always refer to currency as ฿ (Baht).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
      });

      const text = response.text || "I couldn't generate a response.";

      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error: any) {
      console.error("AI Error Details:", error);
      const errorMessage = error?.message || "Unknown error";
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Sorry, I encountered an error while processing your request: ${errorMessage}. Please try again.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-terracotta text-white rounded-xl shadow-lg shadow-terracotta/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-ink">Finance AI Assistant</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Powered by Gemini</p>
          </div>
        </div>
        <button 
          onClick={() => setMessages([{ role: 'assistant', content: "Chat cleared. How can I help you now?" }])}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          title="Clear Chat"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' ? 'bg-gray-100 text-gray-500' : 'bg-terracotta/10 text-terracotta'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-2xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-terracotta text-white rounded-tr-none' 
                  : 'bg-gray-50 text-ink rounded-tl-none border border-gray-100'
              }`}>
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl rounded-tl-none border border-gray-100">
                <Loader2 size={16} className="animate-spin text-terracotta" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-6 border-t border-gray-100 bg-gray-50/30">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about prices, trends, or summaries..."
            className="w-full pl-6 pr-14 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20 shadow-sm"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-terracotta text-white rounded-xl hover:bg-terracotta/90 transition-all disabled:opacity-50 disabled:hover:bg-terracotta"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default FinanceAI;
