import { useEffect, useRef, useState } from 'react';
import './VoiceSearch.css';

export default function VoiceSearch({
  query,
  setQuery,
  onSearch
}) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');

  const recognitionRef = useRef(null);

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      }
    };
  }, []);

  function startVoiceSearch() {
    setMessage('');

    if (!SpeechRecognition) {
      setMessage(
        'Voice search is not supported in this browser. Please try Chrome or type your search.'
      );
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setListening(true);
      setMessage('Listening... Speak your product name.');
    };

    recognition.onresult = event => {
      let transcript = '';

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      setQuery(transcript);

      const lastResult =
        event.results[event.results.length - 1];

      if (lastResult.isFinal) {
        setMessage(`You said: "${transcript}"`);
        onSearch(transcript);
      }
    };

    recognition.onerror = event => {
      setListening(false);

      const errors = {
        'not-allowed':
          'Microphone permission denied. Please allow microphone access.',
        'no-speech':
          'No speech detected. Please try again.',
        'audio-capture':
          'Microphone not available.',
        'network':
          'Voice recognition network error. Please try again.',
        'aborted':
          'Voice search cancelled.'
      };

      setMessage(
        errors[event.error] ||
        'Voice recognition failed. Please try again.'
      );
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;

      setMessage(previous =>
        previous.startsWith('Listening')
          ? 'Tap the microphone to search again.'
          : previous
      );
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setMessage('Unable to start voice search.');
    }
  }

  function clearSearch() {
    recognitionRef.current?.abort();
    setQuery('');
    setMessage('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    recognitionRef.current?.stop();
    onSearch(query);
  }

  return (
    <div className="vs-container">

      <form
        className={`vs-search-bar ${
          listening ? 'vs-listening' : ''
        }`}
        onSubmit={handleSubmit}
        role="search"
      >

        <svg
          className="vs-search-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setMessage('');
          }}
          placeholder="Search products or speak..."
          aria-label="Search products"
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            className="vs-clear"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            ×
          </button>
        )}

        <button
          type="button"
          className={`vs-mic ${
            listening ? 'vs-mic-active' : ''
          }`}
          onClick={startVoiceSearch}
          aria-label={
            listening
              ? 'Stop voice search'
              : 'Start voice search'
          }
          aria-pressed={listening}
          title="Search using your voice"
        >

          <svg
            width="23"
            height="23"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect
              x="9"
              y="2"
              width="6"
              height="13"
              rx="3"
            />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
            <path d="M12 19v3" />
            <path d="M8 22h8" />
          </svg>

        </button>

        <button
          type="submit"
          className="vs-submit"
        >
          Search
        </button>

      </form>

      <div
        className="vs-status"
        role="status"
        aria-live="polite"
      >

        {listening && (
          <div className="vs-wave" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}

        {message ||
          'Type a product name or tap the microphone to search.'}

      </div>

    </div>
  );
}