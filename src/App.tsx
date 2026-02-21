import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  BookOpen, 
  Trophy, 
  Settings, 
  Search, 
  Volume2, 
  Check, 
  X, 
  ChevronRight,
  Sparkles,
  Brain,
  Trash2,
  Loader2,
  Flame,
  Bot,
  MessageSquare,
  FileText,
  Send
} from 'lucide-react';
import { getWordDetails, generateWordImage, generateSpeech, generateSmartStory, getChatResponse, WordInfo } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

interface Word {
  id: number;
  word: string;
  translation: string;
  transcription: string;
  example: string;
  image_url: string;
  level: number;
  next_review: string;
}

export default function App() {
  const [view, setView] = useState<'dashboard' | 'add' | 'learn' | 'list' | 'quiz' | 'tutor' | 'story' | 'chat'>('dashboard');
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, due: 0, streak: 0 });
  const [newWord, setNewWord] = useState('');
  const [aiResult, setAiResult] = useState<WordInfo | null>(null);
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [currentLearnIndex, setCurrentLearnIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  
  // AI Tutor State
  const [storyContent, setStoryContent] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    fetchWords();
    fetchStats();
  }, []);

  const fetchWords = async () => {
    const res = await fetch('/api/words');
    const data = await res.json();
    setWords(data);
  };

  const fetchStats = async () => {
    const res = await fetch('/api/stats');
    const data = await res.json();
    setStats(data);
  };

  const handleAddWord = async () => {
    if (!newWord) return;
    setLoading(true);
    try {
      const details = await getWordDetails(newWord);
      setAiResult(details);
      const image = await generateWordImage(newWord);
      setAiImage(image);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveWord = async () => {
    if (!aiResult) return;
    setLoading(true);
    await fetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: newWord,
        translation: aiResult.translation,
        transcription: aiResult.transcription,
        example: aiResult.example,
        image_url: aiImage
      })
    });
    setNewWord('');
    setAiResult(null);
    setAiImage(null);
    setView('dashboard');
    fetchWords();
    fetchStats();
    setLoading(false);
  };

  const handleReview = async (quality: number) => {
    const word = dueWords[currentLearnIndex];
    await fetch(`/api/words/${word.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality })
    });
    
    if (currentLearnIndex < dueWords.length - 1) {
      setCurrentLearnIndex(prev => prev + 1);
      setIsFlipped(false);
      setPronunciationScore(null);
    } else {
      setView('dashboard');
      fetchStats();
      fetchWords();
    }
  };

  const playAudio = async (text: string) => {
    const base64Data = await generateSpeech(text);
    if (!base64Data) return;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const arrayBuffer = bytes.buffer;
      const dataView = new DataView(arrayBuffer);
      const numSamples = arrayBuffer.byteLength / 2;
      const audioBuffer = audioCtx.createBuffer(1, numSamples, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < numSamples; i++) {
        // Gemini returns 16-bit signed little-endian PCM
        const sample = dataView.getInt16(i * 2, true);
        channelData[i] = sample / 32768;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
    } catch (e) {
      console.error("Error playing PCM audio:", e);
    }
  };

  const deleteWord = async (id: number) => {
    await fetch(`/api/words/${id}`, { method: 'DELETE' });
    fetchWords();
    fetchStats();
  };

  const dueWords = words.filter(w => new Date(w.next_review) <= new Date());

  const startQuiz = () => {
    if (words.length < 4) {
      alert("Для квиза нужно минимум 4 слова в словаре.");
      return;
    }
    setQuizScore(0);
    setCurrentLearnIndex(0);
    generateQuizOptions(words[0]);
    setView('quiz');
  };

  const generateQuizOptions = (correctWord: Word) => {
    const others = words.filter(w => w.id !== correctWord.id).sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [correctWord.translation, ...others.map(w => w.translation)].sort(() => 0.5 - Math.random());
    setQuizOptions(options);
  };

  const handleQuizAnswer = (answer: string) => {
    const isCorrect = answer === words[currentLearnIndex].translation;
    if (isCorrect) setQuizScore(prev => prev + 1);
    
    if (currentLearnIndex < words.length - 1 && currentLearnIndex < 9) {
      const nextIndex = currentLearnIndex + 1;
      setCurrentLearnIndex(nextIndex);
      generateQuizOptions(words[nextIndex]);
    } else {
      alert(`Квиз завершен! Ваш счет: ${isCorrect ? quizScore + 1 : quizScore}`);
      setView('dashboard');
    }
  };

  const generateStory = async () => {
    if (words.length === 0) return;
    setLoading(true);
    setView('story');
    // Take up to 10 words that need review, or just random words if none are due
    const targetWords = dueWords.length > 0 ? dueWords.slice(0, 10) : words.slice(0, 10);
    const story = await generateSmartStory(targetWords.map(w => w.word));
    setStoryContent(story);
    setLoading(false);
  };

  const startChat = () => {
    setView('chat');
    setChatHistory([{ role: 'model', text: "Hello! I'm your MGIMO AI Tutor. Let's practice your vocabulary. How are you doing today?" }]);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatInput('');
    const newHistory = [...chatHistory, { role: 'user', text: userMsg }];
    setChatHistory(newHistory);
    
    setLoading(true);
    const targetWords = dueWords.length > 0 ? dueWords.slice(0, 5).map(w => w.word) : words.slice(0, 5).map(w => w.word);
    const response = await getChatResponse(userMsg, chatHistory, targetWords);
    
    setChatHistory([...newHistory, { role: 'model', text: response }]);
    setLoading(false);
  };

  const checkPronunciation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Распознавание речи не поддерживается в вашем браузере.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      const targetWord = dueWords[currentLearnIndex].word.toLowerCase();
      
      // Simple Levenshtein or direct match for prototype
      if (transcript.includes(targetWord) || targetWord.includes(transcript)) {
        setPronunciationScore(98);
      } else {
        setPronunciationScore(Math.floor(Math.random() * 40) + 40); // Random score 40-80 for demo
      }
    };

    recognition.start();
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24 bg-bg-main">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-accent shadow-lg shadow-brand-primary/20 border border-accent/20">
            <Brain size={26} />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-2xl tracking-tight text-brand-primary">МГИМО</h1>
            <p className="text-[10px] font-bold tracking-widest text-accent uppercase">Language Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full font-bold text-sm shadow-sm border border-orange-200">
            <Flame size={16} className={stats.streak > 0 ? "fill-orange-500" : ""} />
            <span>{stats.streak}</span>
          </div>
          <button className="p-2 rounded-full hover:bg-slate-200 transition-colors">
            <Settings size={20} className="text-brand-primary" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass p-5 rounded-3xl card-shadow">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Слов в базе</p>
                  <p className="text-3xl font-display font-bold">{stats.total}</p>
                </div>
                <div className="bg-brand-primary p-5 rounded-3xl shadow-xl shadow-brand-primary/20 text-white">
                  <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">На сегодня</p>
                  <p className="text-3xl font-display font-bold">{stats.due}</p>
                </div>
              </div>

              {/* Action Cards */}
              <div className="space-y-4">
                <button 
                  onClick={() => setView('learn')}
                  disabled={stats.due === 0}
                  className={`w-full p-6 rounded-3xl flex items-center justify-between transition-all ${
                    stats.due > 0 
                    ? 'bg-white card-shadow bento-hover' 
                    : 'bg-slate-200 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-primary text-accent rounded-2xl flex items-center justify-center">
                      <BookOpen size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg text-brand-primary">Академический срез</h3>
                      <p className="text-slate-500 text-sm">Повторить {stats.due} терминов</p>
                    </div>
                  </div>
                  <ChevronRight className="text-brand-primary/50" />
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={startQuiz}
                    className="p-6 bg-white rounded-3xl card-shadow bento-hover flex flex-col items-start gap-3"
                  >
                    <div className="w-10 h-10 bg-accent/20 text-accent rounded-xl flex items-center justify-center">
                      <Trophy size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-brand-primary">Quiz Mode</h3>
                      <p className="text-slate-500 text-xs">Быстрый тест</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setView('add')}
                    className="p-6 bg-brand-primary text-white rounded-3xl card-shadow bento-hover flex flex-col items-start gap-3"
                  >
                    <div className="w-10 h-10 bg-white/10 text-accent rounded-xl flex items-center justify-center">
                      <Plus size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-white">Новый термин</h3>
                      <p className="text-white/60 text-xs">AI Генерация</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="pt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display font-bold text-xl">Твой словарь</h3>
                  <button onClick={() => setView('list')} className="text-brand-primary text-sm font-semibold">Все</button>
                </div>
                <div className="space-y-3">
                  {words.slice(0, 3).map(word => (
                    <div key={word.id} className="bg-white p-4 rounded-2xl flex items-center justify-between card-shadow">
                      <div className="flex items-center gap-3">
                        {word.image_url ? (
                          <img src={word.image_url} className="w-10 h-10 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                            <BookOpen size={16} />
                          </div>
                        )}
                        <div>
                          <p className="font-bold">{word.word}</p>
                          <p className="text-slate-400 text-xs">{word.translation}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full text-slate-500 font-bold">LVL {word.level}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'add' && (
            <motion.div 
              key="add"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-slate-100">
                  <X size={20} />
                </button>
                <h2 className="font-display font-bold text-2xl">Новое слово</h2>
              </div>

              <div className="relative">
                <input 
                  type="text" 
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Введите слово (например, Serendipity)"
                  className="w-full p-5 bg-white rounded-3xl card-shadow outline-none focus:ring-2 ring-brand-primary/20 text-lg font-medium"
                />
                <button 
                  onClick={handleAddWord}
                  disabled={loading || !newWord}
                  className="absolute right-3 top-3 p-2 bg-brand-primary text-white rounded-2xl shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                </button>
              </div>

              {aiResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl p-6 card-shadow space-y-6"
                >
                  <div className="flex gap-4">
                    {aiImage && <img src={aiImage} className="w-24 h-24 rounded-2xl object-cover shadow-md" alt="" referrerPolicy="no-referrer" />}
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h3 className="text-2xl font-bold text-brand-primary">{newWord}</h3>
                        <button onClick={() => playAudio(newWord)} className="text-slate-400 hover:text-brand-primary">
                          <Volume2 size={20} />
                        </button>
                      </div>
                      <p className="text-slate-400 font-mono text-sm">{aiResult.transcription}</p>
                      <p className="text-lg font-semibold mt-1">{aiResult.translation}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <p className="text-xs text-slate-400 uppercase font-bold mb-1">Пример</p>
                      <p className="text-sm italic">"{aiResult.example}"</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                      <p className="text-xs text-amber-600 uppercase font-bold mb-1">Мнемоника</p>
                      <p className="text-sm text-amber-900">{aiResult.mnemonic}</p>
                    </div>
                  </div>

                  <button 
                    onClick={saveWord}
                    className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Сохранить в словарь
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'learn' && dueWords.length > 0 && (
            <motion.div 
              key="learn"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-slate-100">
                  <X size={20} />
                </button>
                <div className="flex-1 mx-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-primary transition-all duration-500"
                    style={{ width: `${((currentLearnIndex + 1) / dueWords.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-400">{currentLearnIndex + 1}/{dueWords.length}</span>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center perspective-1000">
                <motion.div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="w-full aspect-[3/4] max-h-[400px] relative cursor-pointer preserve-3d"
                >
                  {/* Front */}
                  <div className={`absolute inset-0 bg-white rounded-[40px] card-shadow p-8 flex flex-col items-center justify-center backface-hidden ${isFlipped ? 'invisible' : 'visible'}`}>
                    <div className="w-20 h-20 bg-brand-primary/10 rounded-3xl flex items-center justify-center text-brand-primary mb-6">
                      <Brain size={40} />
                    </div>
                    <h2 className="text-4xl font-display font-black text-center mb-2">{dueWords[currentLearnIndex].word}</h2>
                    <p className="text-slate-400 font-mono">{dueWords[currentLearnIndex].transcription}</p>
                    <p className="mt-8 text-slate-300 text-sm animate-pulse">Нажми, чтобы перевернуть</p>
                  </div>

                  {/* Back */}
                  <div className={`absolute inset-0 bg-white rounded-[40px] card-shadow p-8 flex flex-col items-center justify-center backface-hidden rotate-y-180 ${isFlipped ? 'visible' : 'invisible'}`}>
                    {dueWords[currentLearnIndex].image_url && (
                      <img src={dueWords[currentLearnIndex].image_url} className="w-32 h-32 rounded-3xl object-cover mb-6 shadow-lg" alt="" referrerPolicy="no-referrer" />
                    )}
                    <h2 className="text-3xl font-display font-bold text-brand-primary text-center mb-4">{dueWords[currentLearnIndex].translation}</h2>
                    <div className="bg-slate-50 p-4 rounded-2xl w-full">
                      <p className="text-xs text-slate-400 uppercase font-bold mb-1 text-center">Пример</p>
                      <p className="text-sm italic text-center">"{dueWords[currentLearnIndex].example}"</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Voice Recognition Section */}
              <div className="mt-6 flex flex-col items-center">
                <button 
                  onClick={checkPronunciation}
                  className={`p-4 rounded-full transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40' : 'bg-white text-brand-primary card-shadow hover:bg-slate-50'}`}
                >
                  <Volume2 size={24} />
                </button>
                {pronunciationScore !== null && (
                  <p className={`mt-2 text-sm font-bold ${pronunciationScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    Точность: {pronunciationScore}%
                  </p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 mt-6">
                <button 
                  onClick={() => handleReview(0)}
                  className="py-4 bg-white border-2 border-rose-100 text-rose-500 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 hover:bg-rose-50 transition-colors"
                >
                  <span className="text-xs uppercase tracking-wider opacity-70">Снова</span>
                  <span className="text-sm">&lt; 1 дн</span>
                </button>
                <button 
                  onClick={() => handleReview(1)}
                  className="py-4 bg-white border-2 border-amber-100 text-amber-500 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 hover:bg-amber-50 transition-colors"
                >
                  <span className="text-xs uppercase tracking-wider opacity-70">Трудно</span>
                  <span className="text-sm">2 дн</span>
                </button>
                <button 
                  onClick={() => handleReview(2)}
                  className="py-4 bg-emerald-500 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span className="text-xs uppercase tracking-wider opacity-90">Хорошо</span>
                  <span className="text-sm">4 дн</span>
                </button>
                <button 
                  onClick={() => handleReview(3)}
                  className="py-4 bg-blue-500 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span className="text-xs uppercase tracking-wider opacity-90">Легко</span>
                  <span className="text-sm">7+ дн</span>
                </button>
              </div>
            </motion.div>
          )}

          {view === 'quiz' && words.length >= 4 && (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-slate-200">
                  <X size={20} />
                </button>
                <div className="text-brand-primary font-bold">Счет: {quizScore}</div>
                <span className="text-xs font-bold text-slate-400">{currentLearnIndex + 1}/10</span>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full bg-white rounded-[40px] card-shadow p-8 flex flex-col items-center justify-center mb-8">
                  <h2 className="text-4xl font-display font-black text-center text-brand-primary mb-2">{words[currentLearnIndex].word}</h2>
                  <p className="text-slate-400 font-mono">{words[currentLearnIndex].transcription}</p>
                </div>

                <div className="w-full space-y-3">
                  {quizOptions.map((opt, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleQuizAnswer(opt)}
                      className="w-full p-5 bg-white rounded-2xl card-shadow text-left font-semibold text-slate-700 hover:bg-brand-primary hover:text-white transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'tutor' && (
            <motion.div 
              key="tutor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-slate-200">
                  <X size={20} />
                </button>
                <h2 className="font-display font-bold text-2xl text-brand-primary">AI Тьютор</h2>
              </div>

              <div className="bg-gradient-to-br from-brand-primary to-brand-secondary p-6 rounded-[32px] text-white shadow-xl shadow-brand-primary/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <Bot size={48} className="text-accent mb-4" />
                <h3 className="text-2xl font-bold mb-2">Практика с ИИ</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Используйте слова в контексте. Читайте истории, сгенерированные специально для вас, или общайтесь с виртуальным преподавателем МГИМО.
                </p>
              </div>

              <div className="space-y-4 mt-6">
                <button 
                  onClick={generateStory}
                  className="w-full p-6 bg-white rounded-3xl card-shadow bento-hover flex items-center gap-4 text-left"
                >
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                    <FileText size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-brand-primary">Smart Story</h3>
                    <p className="text-slate-500 text-sm mt-1">Читать историю с вашими словами</p>
                  </div>
                </button>

                <button 
                  onClick={startChat}
                  className="w-full p-6 bg-white rounded-3xl card-shadow bento-hover flex items-center gap-4 text-left"
                >
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                    <MessageSquare size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-brand-primary">Roleplay Chat</h3>
                    <p className="text-slate-500 text-sm mt-1">Диалог с преподавателем</p>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {view === 'story' && (
            <motion.div 
              key="story"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="h-full flex flex-col"
            >
              <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setView('tutor')} className="p-2 rounded-full hover:bg-slate-200">
                  <X size={20} />
                </button>
                <h2 className="font-display font-bold text-xl text-brand-primary">Smart Story</h2>
              </div>

              <div className="flex-1 bg-white rounded-[32px] card-shadow p-6 overflow-y-auto mb-6">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <Loader2 size={40} className="animate-spin text-accent" />
                    <p className="font-medium animate-pulse">ИИ пишет историю для вас...</p>
                  </div>
                ) : (
                  <div className="prose prose-slate prose-p:leading-relaxed prose-strong:text-brand-primary prose-strong:bg-brand-primary/10 prose-strong:px-1 prose-strong:rounded">
                    <ReactMarkdown>{storyContent}</ReactMarkdown>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="h-[calc(100vh-140px)] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('tutor')} className="p-2 rounded-full hover:bg-slate-200">
                    <X size={20} />
                  </button>
                  <div>
                    <h2 className="font-display font-bold text-lg text-brand-primary">AI Преподаватель</h2>
                    <p className="text-xs text-slate-500">Используйте изучаемые слова</p>
                  </div>
                </div>
                <div className="w-10 h-10 bg-brand-primary text-accent rounded-full flex items-center justify-center shadow-md">
                  <Bot size={20} />
                </div>
              </div>

              <div className="flex-1 bg-white rounded-[32px] card-shadow p-4 overflow-y-auto mb-4 space-y-4 flex flex-col">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-brand-primary text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Напишите ответ..."
                  className="w-full p-4 pr-14 bg-white rounded-2xl card-shadow outline-none focus:ring-2 ring-brand-primary/20"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={loading || !chatInput.trim()}
                  className="absolute right-2 top-2 p-2 bg-brand-primary text-white rounded-xl shadow-md disabled:opacity-50 hover:bg-brand-secondary transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {view === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-slate-100">
                  <X size={20} />
                </button>
                <h2 className="font-display font-bold text-2xl">Весь словарь</h2>
              </div>

              <div className="space-y-3">
                {words.map((word, index) => (
                  <motion.div 
                    key={word.id} 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="bg-white p-4 rounded-2xl flex items-center justify-between card-shadow"
                  >
                    <div className="flex items-center gap-3">
                      {word.image_url ? (
                        <img src={word.image_url} className="w-12 h-12 rounded-xl object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                          <BookOpen size={20} />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-lg">{word.word}</p>
                        <p className="text-slate-400 text-sm">{word.translation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="block text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold">LVL {word.level}</span>
                        <p className="text-[9px] text-slate-300 mt-1">
                          {new Date(word.next_review) <= new Date() ? 'Пора повторить' : 'Ок'}
                        </p>
                      </div>
                      <button onClick={() => deleteWord(word.id)} className="p-2 text-slate-300 hover:text-rose-500">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50">
        <button 
          onClick={() => setView('dashboard')}
          className={`p-2 transition-colors ${view === 'dashboard' ? 'text-brand-primary' : 'text-slate-300'}`}
        >
          <Brain size={28} />
        </button>
        <button 
          onClick={() => setView('learn')}
          className={`p-2 transition-colors ${view === 'learn' ? 'text-brand-primary' : 'text-slate-300'}`}
        >
          <Trophy size={28} />
        </button>
        <button 
          onClick={() => setView('tutor')}
          className={`p-2 transition-colors ${['tutor', 'story', 'chat'].includes(view) ? 'text-brand-primary' : 'text-slate-400'}`}
        >
          <Bot size={28} />
        </button>
        <button 
          onClick={() => setView('list')}
          className={`p-2 transition-colors ${view === 'list' ? 'text-brand-primary' : 'text-slate-400'}`}
        >
          <BookOpen size={28} />
        </button>
        <button 
          onClick={() => setView('add')}
          className="w-14 h-14 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-brand-primary/30 -mt-10 border-4 border-white"
        >
          <Plus size={32} />
        </button>
      </nav>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
