import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [0]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export const useVoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        // ZMIANA: Wyłączamy interimResults, żeby nie dostawać "śmieci" w trakcie mówienia.
        // Dostaniemy wynik dopiero jak użytkownik skończy zdanie/frazę.
        recognitionInstance.interimResults = false; 
        recognitionInstance.lang = 'pl-PL';
        setRecognition(recognitionInstance);
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognition && !isListening) {
      try {
        setTranscript(''); // Clear previous transcript on new start
        recognition.start();
        setIsListening(true);
      } catch (error) {
        console.error("Speech recognition start error:", error);
      }
    }
  }, [recognition, isListening]);

  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
    }
  }, [recognition, isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Pobieramy ostatni wynik (najnowszy fragment)
      const lastResultIndex = event.results.length - 1;
      const lastResult = event.results[lastResultIndex];

      if (lastResult.isFinal) {
        const text = lastResult[0].transcript.trim();
        if (text) {
          console.log("🎤 Rozpoznano:", text);
          setTranscript(text);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognition.onresult = () => {};
      recognition.onerror = () => {};
      recognition.onend = () => {};
    };
  }, [recognition]);

  return {
    isListening,
    transcript,
    resetTranscript, // Eksportujemy funkcję do czyszczenia po "zużyciu" tekstu
    startListening,
    stopListening,
    isSupported
  };
};
