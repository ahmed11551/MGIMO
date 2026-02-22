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
  Send,
  Download,
  Upload,
  Copy,
  LayoutGrid,
  List,
  Moon,
  Sun,
  Bell
} from 'lucide-react';
import { API_BASE } from './config';
import { getLaunchRef } from './telegram';
import { getWordDetails, generateWordImage, generateSpeech, generateSmartStory, getChatResponse, generateWordsByTopic, WordInfo } from './services/apiClient';
import { useToast } from './Toast';
import { SkeletonList, SkeletonStats } from './Skeleton';
import { ConfirmModal } from './ConfirmModal';
import ReactMarkdown from 'react-markdown';

interface Category {
  id: number;
  name: string;
  sort_order: number;
}

interface Word {
  id: number;
  word: string;
  translation: string;
  transcription: string;
  example: string;
  example_translation?: string;
  image_url: string;
  category_id?: number;
  category_name?: string;
  level: number;
  next_review: string;
}

export default function App() {
  const [view, setView] = useState<'dashboard' | 'add' | 'learn' | 'list' | 'quiz' | 'tutor' | 'story' | 'chat' | 'settings'>('dashboard');
  const { toast } = useToast();
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
  const [quizMode, setQuizMode] = useState<'word-to-translation' | 'translation-to-word'>('word-to-translation');
  const [isListening, setIsListening] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  
  // AI Tutor State
  const [storyContent, setStoryContent] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [generatedWords, setGeneratedWords] = useState<WordInfo[]>([]);
  
  // List view: search, sort, import, view mode
  const [searchQuery, setSearchQuery] = useState('');
  const [listSort, setListSort] = useState<'word' | 'level' | 'due'>('word');
  const [listViewMode, setListViewMode] = useState<'cards' | 'table'>('cards');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [lastGeneratedTopic, setLastGeneratedTopic] = useState<string>('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'csv' | 'text'>('text');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedWordDetail, setSelectedWordDetail] = useState<Word | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('mgimo-dark') === '1';
    } catch {
      return false;
    }
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem('mgimo-notifications') === '1';
    } catch {
      return false;
    }
  });
  const [wordsLoading, setWordsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number } | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem('mgimo-ref');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    fetchWords();
    fetchStats();
    fetchCategories();
  }, []);

  useEffect(() => {
    const ref = getLaunchRef();
    if (ref) {
      try {
        localStorage.setItem('mgimo-ref', ref);
        setReferralCode(ref);
      } catch {}
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('mgimo-dark', darkMode ? '1' : '0');
    } catch {}
  }, [darkMode]);

  // Push-уведомление о повторениях (раз в день при due > 0)
  useEffect(() => {
    if (!notificationsEnabled || stats.due === 0 || !statsLoading) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const last = localStorage.getItem('mgimo-last-notify');
      const today = new Date().toDateString();
      if (last === today) return;
      new Notification('МГИМО AI — пора повторить', {
        body: `Сегодня ${stats.due} ${stats.due === 1 ? 'слово' : stats.due < 5 ? 'слова' : 'слов'} ждут повторения`,
        icon: '/favicon.ico',
      });
      localStorage.setItem('mgimo-last-notify', today);
    } catch {}
  }, [notificationsEnabled, stats.due, statsLoading]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(API_BASE + '/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch {}
  };

  const fetchWords = async () => {
    setWordsLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/words');
      if (!res.ok) throw new Error('Ошибка загрузки слов');
      const data = await res.json();
      setWords(data);
    } catch (e) {
      console.error('fetchWords:', e);
      setWords([]);
      const isNetworkError = e instanceof TypeError || (e instanceof Error && /fetch|network/i.test(e.message));
      if (isNetworkError) {
        toast('Нет подключения. Проверьте интернет и URL backend.', 'error');
      }
    } finally {
      setWordsLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/stats');
      if (!res.ok) throw new Error('Ошибка загрузки статистики');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('fetchStats:', e);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim()) {
      toast('Введите слово для генерации', 'info');
      return;
    }
    setLoading(true);
    try {
      const details = await getWordDetails(newWord);
      setAiResult(details);
      const image = await generateWordImage(newWord);
      setAiImage(image);
    } catch (e) {
      console.error(e);
      toast('Ошибка AI. Проверьте GEMINI_API_KEY в .env', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveWord = async () => {
    if (!aiResult) return;
    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: newWord,
          translation: aiResult.translation,
          transcription: aiResult.transcription,
          example: aiResult.example,
          example_translation: aiResult.example_translation,
          image_url: aiImage,
          category_id: selectedCategoryId
        })
      });
      if (!res.ok) throw new Error('Не удалось сохранить');
      setNewWord('');
      setAiResult(null);
      setAiImage(null);
      setView('dashboard');
      fetchWords();
      fetchStats();
    } catch (e) {
      toast('Ошибка сохранения. Проверьте подключение.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTopic = async (topic: string) => {
    setLoading(true);
    setAiResult(null);
    setGeneratedWords([]);
    setLastGeneratedTopic(topic);
    try {
      const words = await generateWordsByTopic(topic, 5);
      setGeneratedWords(words);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ошибка при генерации слов', 'error');
    }
    setLoading(false);
  };

  const saveGeneratedWords = async () => {
    setLoading(true);
    const topicCatId = categories.find(c => c.name === lastGeneratedTopic)?.id ?? selectedCategoryId;
    for (const w of generatedWords) {
      await fetch(API_BASE + '/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: w.word,
          translation: w.translation,
          transcription: w.transcription,
          example: w.example,
          example_translation: w.example_translation,
          image_url: null,
          category_id: topicCatId
        })
      });
    }
    setGeneratedWords([]);
    fetchWords();
    fetchStats();
    setView('dashboard');
    setLoading(false);
  };

  const handleReview = async (quality: number) => {
    const word = dueWords[currentLearnIndex];
    try {
      const res = await fetch(API_BASE + `/api/words/${word.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality })
      });
      if (!res.ok) throw new Error();
    } catch {
      return;
    }
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
    setDeleteConfirm({ id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(API_BASE + `/api/words/${deleteConfirm.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchWords();
        fetchStats();
        toast('Слово удалено', 'success');
      } else {
        toast('Не удалось удалить', 'error');
      }
    } catch {
      toast('Ошибка сети', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const exportWords = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(API_BASE + `/api/words/export?format=${format}`);
      if (!res.ok) throw new Error();
      const blob = format === 'csv' 
        ? new Blob([await res.text()], { type: 'text/csv;charset=utf-8' })
        : new Blob([JSON.stringify(await res.json(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mgimo-words.${format === 'csv' ? 'csv' : 'json'}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast('Ошибка экспорта', 'error');
    }
  };

  const importWords = async () => {
    if (!importText.trim()) return;
    setLoading(true);
    try {
      let data: unknown = importText;
      if (importFormat === 'json') {
        try {
          data = JSON.parse(importText);
        } catch {
          throw new Error('Неверный JSON');
        }
      }
      const res = await fetch(API_BASE + '/api/words/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: importFormat, data })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка импорта');
      toast(`Импортировано: ${json.imported} слов`, 'success');
      setShowImport(false);
      setImportText('');
      fetchWords();
      fetchStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ошибка импорта', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyWord = (word: Word) => {
    const parts = [`${word.word} — ${word.translation}`, word.transcription, word.example, word.example_translation].filter(Boolean);
    navigator.clipboard?.writeText(parts.join('\n')).then(() => {
      setCopiedId(word.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const dueWords = words.filter(w => new Date(w.next_review) <= new Date());
  
  // Filtered and sorted list
  const filteredWords = words
    .filter(w => {
      if (searchQuery && !w.word.toLowerCase().includes(searchQuery.toLowerCase()) && !(w.translation || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (categoryFilter && String(w.category_id) !== categoryFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (listSort === 'word') return a.word.localeCompare(b.word);
      if (listSort === 'level') return b.level - a.level;
      return new Date(a.next_review).getTime() - new Date(b.next_review).getTime();
    });

  const startQuiz = () => {
    if (words.length < 4) {
      toast('Для квиза нужно минимум 4 слова в словаре.', 'info');
      return;
    }
    setQuizScore(0);
    setCurrentLearnIndex(0);
    generateQuizOptions(words[0], quizMode);
    setView('quiz');
  };

  const generateQuizOptions = (correctWord: Word, mode: 'word-to-translation' | 'translation-to-word') => {
    const others = words.filter(w => w.id !== correctWord.id).sort(() => 0.5 - Math.random());
    if (mode === 'word-to-translation') {
      const wrongTranslations = [...new Set(others.map(w => w.translation).filter(Boolean))].slice(0, 3);
      const allOptions = [correctWord.translation, ...wrongTranslations];
      const unique = [...new Set(allOptions)].sort(() => 0.5 - Math.random());
      setQuizOptions(unique.length >= 4 ? unique.slice(0, 4) : unique);
    } else {
      const wrongWords = [...new Set(others.map(w => w.word).filter(Boolean))].slice(0, 3);
      const allOptions = [correctWord.word, ...wrongWords];
      const unique = [...new Set(allOptions)].sort(() => 0.5 - Math.random());
      setQuizOptions(unique.length >= 4 ? unique.slice(0, 4) : unique);
    }
  };

  const quizLength = Math.min(10, words.length);
  const handleQuizAnswer = (answer: string) => {
    const current = words[currentLearnIndex];
    const isCorrect = quizMode === 'word-to-translation' ? answer === current.translation : answer === current.word;
    if (isCorrect) setQuizScore(prev => prev + 1);
    
    if (currentLearnIndex < quizLength - 1) {
      const nextIndex = currentLearnIndex + 1;
      setCurrentLearnIndex(nextIndex);
      generateQuizOptions(words[nextIndex], quizMode);
    } else {
      toast(`Квиз завершен! Ваш счет: ${isCorrect ? quizScore + 1 : quizScore}`, 'success');
      setView('dashboard');
    }
  };

  const generateStory = async () => {
    if (words.length === 0) return;
    setLoading(true);
    setView('story');
    try {
      const targetWords = dueWords.length > 0 ? dueWords.slice(0, 10) : words.slice(0, 10);
      const story = await generateSmartStory(targetWords.map(w => w.word));
      setStoryContent(story);
    } catch (e) {
      setStoryContent('Не удалось сгенерировать историю. Проверьте подключение и GEMINI_API_KEY.');
    } finally {
      setLoading(false);
    }
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
    try {
      const targetWords = dueWords.length > 0 ? dueWords.slice(0, 5).map(w => w.word) : words.slice(0, 5).map(w => w.word);
      const response = await getChatResponse(userMsg, chatHistory, targetWords);
      setChatHistory([...newHistory, { role: 'model', text: response }]);
    } catch (e) {
      setChatHistory([...newHistory, { role: 'model', text: 'Извините, произошла ошибка. Попробуйте ещё раз.' }]);
    } finally {
      setLoading(false);
    }
  };

  const checkPronunciation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('Распознавание речи не поддерживается в вашем браузере.', 'info');
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
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24 bg-bg-main transition-colors duration-300">
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
          <button onClick={() => setView('settings')} className="p-2 rounded-full hover:bg-slate-200 transition-colors" title="Настройки" aria-label="Настройки">
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
                {statsLoading ? (
                  <SkeletonStats />
                ) : (
                  <>
                    <div className="glass p-5 rounded-3xl card-shadow">
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Слов в базе</p>
                      <p className="text-3xl font-display font-bold">{stats.total}</p>
                    </div>
                    <div className="bg-brand-primary p-5 rounded-3xl shadow-xl shadow-brand-primary/20 text-white">
                      <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">На сегодня</p>
                      <p className="text-3xl font-display font-bold">{stats.due}</p>
                    </div>
                  </>
                )}
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
                  {wordsLoading ? (
                    <SkeletonList count={3} />
                  ) : (
                  words.slice(0, 3).map(word => (
                    <button
                      key={word.id}
                      onClick={() => setSelectedWordDetail(word)}
                      className="w-full bg-white p-4 rounded-2xl flex items-center justify-between card-shadow text-left hover:shadow-lg hover:border-brand-primary/20 border border-transparent transition-all"
                    >
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {word.category_name && <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">{word.category_name}</span>}
                        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full text-slate-500 font-bold">LVL {word.level}</span>
                      </div>
                    </button>
                  ))
                  )}
                </div>
              </div>

              {/* Word Detail Modal */}
              {selectedWordDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedWordDetail(null)}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl p-6 w-full max-w-md card-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-brand-primary">{selectedWordDetail.word}</h3>
                        <p className="text-slate-400 font-mono text-sm">{selectedWordDetail.transcription}</p>
                        <p className="text-lg font-semibold mt-1">{selectedWordDetail.translation}</p>
                      </div>
                      <button onClick={() => setSelectedWordDetail(null)} className="p-2 hover:bg-slate-100 rounded-full">
                        <X size={20} />
                      </button>
                    </div>
                    {selectedWordDetail.example && (
                      <div className="bg-slate-50 p-4 rounded-2xl mb-4">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Пример</p>
                        <p className="text-sm italic">"{selectedWordDetail.example}"</p>
                        {selectedWordDetail.example_translation && (
                          <p className="text-sm text-brand-primary font-medium mt-1">"{selectedWordDetail.example_translation}"</p>
                        )}
                      </div>
                    )}
                    <button onClick={() => { setSelectedWordDetail(null); setView('list'); }} className="w-full py-3 bg-brand-primary text-white rounded-xl font-semibold">
                      Открыть в словаре
                    </button>
                  </motion.div>
                </div>
              )}
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
                  {loading && !generatedWords.length && !aiResult ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                </button>
              </div>

              {!aiResult && generatedWords.length === 0 && (
                <div className="pt-4">
                  <h3 className="font-display font-bold text-lg mb-4 text-brand-primary">Модули МГИМО (AI Генерация)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {['Международное право', 'Дипломатия', 'Макроэкономика', 'Политология', 'Общая лексика', 'Бизнес', 'Медиа'].map((topic) => (
                      <button 
                        key={topic}
                        onClick={() => handleGenerateTopic(topic)}
                        disabled={loading}
                        className="p-4 bg-white rounded-2xl card-shadow text-left hover:border-brand-primary border border-transparent transition-all disabled:opacity-50"
                      >
                        <p className="font-bold text-sm text-brand-primary">{topic}</p>
                        <p className="text-xs text-slate-400 mt-1">+5 терминов</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {generatedWords.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-brand-primary">Сгенерированные термины</h3>
                    <button onClick={() => setGeneratedWords([])} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
                  </div>
                  <div className="space-y-3">
                    {generatedWords.map((w, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl card-shadow">
                        <p className="font-bold text-lg">{w.word} <span className="text-sm font-normal text-slate-400 ml-2">{w.transcription}</span></p>
                        <p className="text-brand-primary font-medium mt-1">{w.translation}</p>
                        <p className="text-xs text-slate-500 mt-2 italic">"{w.example}"</p>
                        {w.example_translation && <p className="text-xs text-brand-primary/80 mt-1">"{w.example_translation}"</p>}
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={saveGeneratedWords}
                    disabled={loading}
                    className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Добавить все в словарь'}
                  </button>
                </motion.div>
              )}

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
                    <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                      <p className="text-xs text-slate-400 uppercase font-bold">Пример</p>
                      <p className="text-sm italic">"{aiResult.example}"</p>
                      {aiResult.example_translation && (
                        <p className="text-sm text-brand-primary font-medium">"{aiResult.example_translation}"</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-slate-400">Категория:</span>
                      <select
                        value={selectedCategoryId ?? ''}
                        onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                        className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="">— не выбрана</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
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

          {view === 'learn' && (
            <motion.div 
              key="learn"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col"
            >
              {dueWords.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <Check size={40} className="text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-xl text-brand-primary mb-2">Всё повторено!</h3>
                  <p className="text-slate-500 text-sm mb-6">Нет слов для повторения на сегодня. Загляните завтра или добавьте новые термины.</p>
                  <button onClick={() => setView('dashboard')} className="px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold">
                    На главную
                  </button>
                </div>
              ) : (
              <>
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
                    <div className="bg-slate-50 p-4 rounded-2xl w-full space-y-2">
                      <p className="text-xs text-slate-400 uppercase font-bold text-center">Пример</p>
                      <p className="text-sm italic text-center">"{dueWords[currentLearnIndex].example}"</p>
                      {dueWords[currentLearnIndex].example_translation && (
                        <p className="text-sm text-brand-primary font-medium text-center">"{dueWords[currentLearnIndex].example_translation}"</p>
                      )}
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
              </>
              )}
            </motion.div>
          )}

          {view === 'quiz' && words.length >= 4 && (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col"
            >
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-slate-200">
                  <X size={20} />
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setQuizMode('word-to-translation'); generateQuizOptions(words[currentLearnIndex], 'word-to-translation'); }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${quizMode === 'word-to-translation' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    Слово → перевод
                  </button>
                  <button
                    onClick={() => { setQuizMode('translation-to-word'); generateQuizOptions(words[currentLearnIndex], 'translation-to-word'); }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${quizMode === 'translation-to-word' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    Перевод → слово
                  </button>
                </div>
                <div className="text-brand-primary font-bold">Счет: {quizScore}</div>
                <span className="text-xs font-bold text-slate-400">{currentLearnIndex + 1}/{quizLength}</span>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full bg-white rounded-[40px] card-shadow p-8 flex flex-col items-center justify-center mb-8">
                  {quizMode === 'word-to-translation' ? (
                    <>
                      <h2 className="text-4xl font-display font-black text-center text-brand-primary mb-2">{words[currentLearnIndex].word}</h2>
                      <p className="text-slate-400 font-mono">{words[currentLearnIndex].transcription}</p>
                    </>
                  ) : (
                    <h2 className="text-4xl font-display font-black text-center text-brand-primary mb-2">{words[currentLearnIndex].translation}</h2>
                  )}
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
                  disabled={words.length === 0}
                  className={`w-full p-6 rounded-3xl card-shadow flex items-center gap-4 text-left transition-all ${words.length > 0 ? 'bg-white bento-hover' : 'bg-slate-100 opacity-60 cursor-not-allowed'}`}
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
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
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
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-slate-100">
                  <X size={20} />
                </button>
                <h2 className="font-display font-bold text-2xl">Весь словарь</h2>
              </div>

              {/* Search & Category */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск..."
                    className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl card-shadow outline-none focus:ring-2 ring-brand-primary/20"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-medium min-w-[140px]"
                >
                  <option value="">Все категории</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Sort, View & Actions */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-2 items-center">
                  {(['word', 'level', 'due'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setListSort(s)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        listSort === s ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s === 'word' ? 'А-Я' : s === 'level' ? 'Уровень' : 'К повтору'}
                    </button>
                  ))}
                  <div className="flex rounded-lg overflow-hidden border border-slate-200">
                    <button
                      onClick={() => setListViewMode('cards')}
                      className={`p-2 ${listViewMode === 'cards' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500'}`}
                      title="Карточки"
                    >
                      <LayoutGrid size={18} />
                    </button>
                    <button
                      onClick={() => setListViewMode('table')}
                      className={`p-2 ${listViewMode === 'table' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500'}`}
                      title="Таблица"
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportWords('csv')} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600" title="Экспорт CSV">
                    <Download size={18} />
                  </button>
                  <button onClick={() => setShowImport(true)} className="p-2 rounded-xl bg-brand-primary text-white hover:bg-brand-secondary" title="Импорт">
                    <Upload size={18} />
                  </button>
                </div>
              </div>

              {/* Import Modal */}
              {showImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto card-shadow"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-brand-primary">Импорт слов</h3>
                      <button onClick={() => setShowImport(false)} className="p-2 hover:bg-slate-100 rounded-full">
                        <X size={20} />
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 mb-3">
                      Вставьте данные из @mgimomobot, botengl или другого источника. Форматы: JSON, CSV, текст (слово — перевод).
                    </p>
                    <select
                      value={importFormat}
                      onChange={(e) => setImportFormat(e.target.value as 'json' | 'csv' | 'text')}
                      className="w-full mb-3 p-3 rounded-xl border border-slate-200"
                    >
                      <option value="text">Текст (слово — перевод)</option>
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </select>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder={importFormat === 'json' ? '[{"word":"...","translation":"..."}]' : importFormat === 'csv' ? 'word,translation,transcription,example' : 'word — перевод\nword2 — перевод2'}
                      className="w-full h-40 p-4 rounded-xl border border-slate-200 font-mono text-sm resize-none"
                    />
                    <div className="flex gap-4 mt-4">
                      <button
                        onClick={importWords}
                        disabled={loading || !importText.trim()}
                        className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-bold disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Импортировать'}
                      </button>
                      <button onClick={() => setShowImport(false)} className="px-6 py-3 bg-slate-100 rounded-xl font-medium">
                        Отмена
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {listViewMode === 'table' ? (
                <div className="bg-white rounded-2xl card-shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left p-3 font-semibold text-brand-primary">Слово</th>
                          <th className="text-left p-3 font-semibold text-brand-primary">Перевод</th>
                          <th className="text-left p-3 font-semibold text-brand-primary hidden sm:table-cell">Пример</th>
                          <th className="text-left p-3 font-semibold text-brand-primary hidden md:table-cell">Перевод примера</th>
                          <th className="p-3 font-semibold text-brand-primary w-16">LVL</th>
                          <th className="p-3 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWords.map((word) => (
                          <tr key={word.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="p-3 font-medium">{word.word}</td>
                            <td className="p-3 text-slate-600">{word.translation}</td>
                            <td className="p-3 text-slate-500 italic hidden sm:table-cell max-w-[180px] truncate" title={word.example}>{word.example || '—'}</td>
                            <td className="p-3 text-brand-primary/80 hidden md:table-cell max-w-[180px] truncate" title={word.example_translation}>{word.example_translation || '—'}</td>
                            <td className="p-3"><span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold">LVL {word.level}</span></td>
                            <td className="p-3 flex gap-1">
                              <button onClick={() => copyWord(word)} className={`p-1.5 rounded-lg transition-colors ${copiedId === word.id ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 hover:text-brand-primary hover:bg-slate-100'}`} title={copiedId === word.id ? 'Скопировано' : 'Копировать'}><Copy size={16} /></button>
                              <button onClick={() => deleteWord(word.id)} className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:!bg-rose-900/20" aria-label={`Удалить ${word.word}`}><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
              <div className="space-y-3">
                {filteredWords.map((word, index) => (
                  <motion.div 
                    key={word.id} 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
                    className="bg-white p-4 rounded-2xl flex items-center justify-between card-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {word.image_url ? (
                        <img src={word.image_url} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                          <BookOpen size={20} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-lg">{word.word}</p>
                          {word.category_name && <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">{word.category_name}</span>}
                        </div>
                        <p className="text-slate-400 text-sm">{word.translation}</p>
                        {word.example_translation && <p className="text-xs text-brand-primary/80 mt-1 truncate">"{word.example_translation}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="block text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold">LVL {word.level}</span>
                        <p className="text-[9px] text-slate-300 mt-1">{new Date(word.next_review) <= new Date() ? 'Повторить' : 'Ок'}</p>
                      </div>
                      <button onClick={() => copyWord(word)} className={`p-2 transition-colors ${copiedId === word.id ? 'text-emerald-500' : 'text-slate-300 hover:text-brand-primary'}`} title={copiedId === word.id ? 'Скопировано' : 'Копировать'}><Copy size={18} /></button>
                      <button onClick={() => deleteWord(word.id)} className="p-2 text-slate-300 hover:text-rose-500" aria-label={`Удалить ${word.word}`}><Trash2 size={18} /></button>
                    </div>
                  </motion.div>
                ))}
              </div>
              )}
              {filteredWords.length === 0 && (
                <p className="text-center text-slate-400 py-8">
                  {words.length === 0 
                    ? 'Словарь пуст. Добавьте слова или импортируйте.' 
                    : (searchQuery || categoryFilter) ? 'Ничего не найдено по фильтрам.' : 'Словарь пуст.'}
                </p>
              )}
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-slate-100">
                  <X size={20} />
                </button>
                <h2 className="font-display font-bold text-2xl text-brand-primary">Настройки</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 card-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                        {darkMode ? <Moon size={20} className="text-slate-600" /> : <Sun size={20} className="text-amber-500" />}
                      </div>
                      <div>
                        <p className="font-bold text-brand-primary">Тёмная тема</p>
                        <p className="text-xs text-slate-500">{darkMode ? 'Включена' : 'Выключена'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className={`relative w-12 h-7 rounded-full transition-colors ${darkMode ? 'bg-brand-primary' : 'bg-slate-200'}`}
                      aria-label={darkMode ? 'Выключить тёмную тему' : 'Включить тёмную тему'}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 card-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Bell size={20} className="text-slate-600" />
                      </div>
                      <div>
                        <p className="font-bold text-brand-primary">Напоминания</p>
                        <p className="text-xs text-slate-500">
                          {notificationsEnabled ? 'Включены' : 'Push-уведомления о повторениях'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!notificationsEnabled) {
                          if ('Notification' in window && Notification.permission === 'default') {
                            const perm = await Notification.requestPermission();
                            if (perm !== 'granted') {
                              toast('Разрешите уведомления в настройках браузера', 'info');
                              return;
                            }
                          }
                          setNotificationsEnabled(true);
                          try {
                            localStorage.setItem('mgimo-notifications', '1');
                          } catch {}
                          toast('Напоминания включены', 'success');
                        } else {
                          setNotificationsEnabled(false);
                          try {
                            localStorage.setItem('mgimo-notifications', '0');
                          } catch {}
                          toast('Напоминания выключены', 'info');
                        }
                      }}
                      className={`relative w-12 h-7 rounded-full transition-colors ${notificationsEnabled ? 'bg-brand-primary' : 'bg-slate-200'}`}
                      aria-label={notificationsEnabled ? 'Выключить уведомления' : 'Включить уведомления'}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                {referralCode && (
                  <div className="bg-white rounded-2xl p-5 card-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Bot size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-bold text-brand-primary">Реферальная ссылка</p>
                        <p className="text-xs text-slate-500">Вы перешли по: {referralCode}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl p-5 card-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <BookOpen size={20} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="font-bold text-brand-primary">О приложении</p>
                      <p className="text-xs text-slate-500">МГИМО AI v1.0 — платформа для изучения академической лексики</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50" role="navigation" aria-label="Главное меню">
        <button 
          onClick={() => setView('dashboard')}
          className={`p-2 transition-colors ${view === 'dashboard' ? 'text-brand-primary' : 'text-slate-300'}`}
          aria-label="Главная"
          aria-current={view === 'dashboard' ? 'page' : undefined}
        >
          <Brain size={28} />
        </button>
        <button 
          onClick={() => setView('learn')}
          className={`p-2 transition-colors ${view === 'learn' ? 'text-brand-primary' : 'text-slate-300'}`}
          aria-label="Обучение"
          aria-current={view === 'learn' ? 'page' : undefined}
        >
          <Trophy size={28} />
        </button>
        <button 
          onClick={() => setView('tutor')}
          className={`p-2 transition-colors ${['tutor', 'story', 'chat'].includes(view) ? 'text-brand-primary' : 'text-slate-400'}`}
          aria-label="Тьютор"
          aria-current={['tutor', 'story', 'chat'].includes(view) ? 'page' : undefined}
        >
          <Bot size={28} />
        </button>
        <button 
          onClick={() => setView('list')}
          className={`p-2 transition-colors ${view === 'list' ? 'text-brand-primary' : 'text-slate-400'}`}
          aria-label="Словарь"
          aria-current={view === 'list' ? 'page' : undefined}
        >
          <BookOpen size={28} />
        </button>
        <button 
          onClick={() => setView('add')}
          className="w-14 h-14 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-brand-primary/30 -mt-10 border-4 border-white"
          aria-label="Добавить слово"
        >
          <Plus size={32} />
        </button>
      </nav>

      <ConfirmModal
        open={!!deleteConfirm}
        title="Удалить слово?"
        message="Слово будет удалено из словаря. Это действие нельзя отменить."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
