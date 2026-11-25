
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sendAIMessage } from '../api';
import './AISupport.css';

const initialMessage = {
  role: 'assistant',
  text: "Hello! 👋 I'm your ShopEasy AI shopping assistant. I can help you discover products, compare prices, check your orders and explore your wishlist. How can I help you today?"
};

const suggestions = [
  'Suggest electronics under ₹2000',
  'Show me products under ₹1500',
  'Show my recent orders',
  'Recommend products from my wishlist'
];

export default function AISupport() {
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);
  const requestLock = useRef(false);

  useEffect(() => {
  const container = bottomRef.current?.parentElement;

  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }
}, [messages, loading]);

  async function sendMessage(value) {
    const message = value.trim();

    if (!message || message.length > 1000 || requestLock.current) {
      return;
    }

    requestLock.current = true;

    setMessages(previous => [
      ...previous,
      { role: 'user', text: message }
    ]);

    setInput('');
    setLoading(true);

    const token = localStorage.getItem('token');

    try {
      const response = await sendAIMessage(message, token);

      if (localStorage.getItem('token') !== token) {
        setMessages([initialMessage]);
        return;
      }

      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          text: response.data.reply || 'No response received.'
        }
      ]);

    } catch (error) {
      if (localStorage.getItem('token') !== token) {
        setMessages([initialMessage]);
        return;
      }

      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          text:
            error.response?.data?.message ||
            'Something went wrong. Please try again shortly.'
        }
      ]);

    } finally {
      setLoading(false);
      requestLock.current = false;
    }
  }

  function clearChat() {
    if (requestLock.current) return;

    setMessages([initialMessage]);
    setInput('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <main className="ai-page">

      <div className="ai-shell">

        <div className="ai-topbar">

          <Link to="/products" className="ai-back">
            ← Back to Shopping
          </Link>

          <button
            type="button"
            className="ai-new-chat"
            onClick={clearChat}
            disabled={loading}
          >
            + New Chat
          </button>

        </div>

        <section className="ai-container">

          <header className="ai-header">

            <div className="ai-avatar">🤖</div>

            <div className="ai-heading">
              <h1>ShopEasy AI Assistant</h1>
              <p>Powered by Google Gemini</p>
            </div>

            <span className="ai-status">
              <span></span>
              AI Assistant
            </span>

          </header>

          <div
            className="ai-messages"
            role="log"
            aria-live="polite"
          >

            {messages.map((message, index) => (

              <div
                key={index}
                className={`ai-message ${message.role}`}
              >

                <div className="ai-message-avatar">
                  {message.role === 'assistant' ? '🤖' : '👤'}
                </div>

                <div className="ai-message-content">

                  <small>
                    {message.role === 'assistant'
                      ? 'ShopEasy AI'
                      : 'You'}
                  </small>

                  <div className="ai-bubble">
                    {message.text}
                  </div>

                </div>

              </div>

            ))}

            {messages.length === 1 && (

              <div className="ai-suggestions">

                <h3>Try asking me</h3>

                <div className="ai-suggestion-grid">

                  {suggestions.map(suggestion => (

                    <button
                      type="button"
                      key={suggestion}
                      disabled={loading}
                      onClick={() => sendMessage(suggestion)}
                    >
                      ✦ {suggestion}
                    </button>

                  ))}

                </div>

              </div>

            )}

            {loading && (

              <div className="ai-message assistant">

                <div className="ai-message-avatar">🤖</div>

                <div className="ai-message-content">

                  <small>ShopEasy AI is thinking...</small>

                  <div className="ai-bubble ai-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>

                </div>

              </div>

            )}

            <div ref={bottomRef}></div>

          </div>

          <form
            className="ai-input-area"
            onSubmit={handleSubmit}
          >

            <input
              type="text"
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Ask me anything about shopping..."
              maxLength={1000}
              aria-label="Message to AI assistant"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
            >
              {loading ? 'Wait...' : 'Send ➤'}
            </button>

          </form>

          <footer className="ai-footer">
            AI can make mistakes. Verify prices and availability.
            Never share passwords, OTPs or card details.
            Relevant shopping information may be processed by Google Gemini.
          </footer>

        </section>

      </div>

    </main>
  );
}
