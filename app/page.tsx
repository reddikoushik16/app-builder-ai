'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ImagePlus,
  Pencil,
  Trash2,
  Settings,
  BotOff,
  ChevronUp,
  Sparkles,
  Users,
  Volume2,
  Image,
  Brain,
  Zap,
  MessageSquare,
  Cpu,
  GraduationCap,
  ArrowRight,
  Play,
  ChevronRight,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { LanguageSwitcher } from '@/components/language-switcher';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Textarea as UITextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings';
import { GenerationToolbar } from '@/components/generation/generation-toolbar';
import { AgentBar } from '@/components/agent/agent-bar';
import { nanoid } from 'nanoid';
import { storePdfBlob } from '@/lib/utils/image-storage';
import type { UserRequirements } from '@/lib/types/generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import {
  StageListItem,
  listStages,
  deleteStageData,
  renameStage,
  getFirstSlideByStages,
} from '@/lib/utils/stage-storage';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import type { Slide } from '@/lib/types/slides';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { SpeechButton } from '@/components/audio/speech-button';
import { EduVerseLogo } from '@/components/eduverse-logo';

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';
const LANGUAGE_STORAGE_KEY = 'generationLanguage';
const RECENT_OPEN_STORAGE_KEY = 'recentClassroomsOpen';

interface FormState {
  pdfFile: File | null;
  requirement: string;
  language: 'zh-CN' | 'en-US';
  webSearch: boolean;
}

const initialFormState: FormState = {
  pdfFile: null,
  requirement: '',
  language: 'zh-CN',
  webSearch: false,
};

// Star field canvas component
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.0008 + 0.0002,
      phase: Math.random() * Math.PI * 2,
      brightness: Math.random() * 0.6 + 0.2,
    }));

    let frame: number;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const opacity = s.brightness * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}

// Feature card data
const FEATURES = [
  { icon: Sparkles, color: '#00D4FF', title: 'AI Lesson Generation', desc: 'Type any topic and watch a complete 15-slide lesson appear in minutes. Powered by the best AI models.' },
  { icon: Users, color: '#7B2FFF', title: '4 AI Agents', desc: 'Dr. Nova teaches, Aria assists, Alex and Priya ask the questions real students ask. Feels real.' },
  { icon: Volume2, color: '#FF6B35', title: 'Premium Voice Acting', desc: 'Each agent has a unique voice. Dr. Nova sounds like a real professor. Powered by ElevenLabs AI.' },
  { icon: Image, color: '#00D4FF', title: 'Visual Learning', desc: 'Every slide gets a unique AI-generated image that makes complex concepts instantly understandable.' },
  { icon: Brain, color: '#7B2FFF', title: 'Adaptive Discussion', desc: 'Agents discuss, debate and build on each other\'s points creating a genuinely dynamic classroom.' },
  { icon: Zap, color: '#FF6B35', title: 'Instant Quiz', desc: 'Test your understanding with AI-generated quizzes that grade and explain answers in real time.' },
];

const EXAMPLE_CHIPS = [
  '✦ Teach me Python from scratch',
  '✦ Explain Quantum Computing',
  '✦ How does the brain work',
  '✦ Introduction to Machine Learning',
];

function HomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    import('@/lib/types/settings').SettingsSection | undefined
  >(undefined);

  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  const currentModelId = useSettingsStore((s) => s.modelId);
  const [recentOpen, setRecentOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_OPEN_STORAGE_KEY);
      if (saved !== null) setRecentOpen(saved !== 'false');
    } catch { /* */ }
    try {
      const savedWebSearch = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const updates: Partial<FormState> = {};
      if (savedWebSearch === 'true') updates.webSearch = true;
      if (savedLanguage === 'zh-CN' || savedLanguage === 'en-US') {
        updates.language = savedLanguage;
      } else {
        const detected = navigator.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
        updates.language = detected;
      }
      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
      }
    } catch { /* */ }
  }, []);

  const [prevCachedRequirement, setPrevCachedRequirement] = useState(cachedRequirement);
  if (cachedRequirement !== prevCachedRequirement) {
    setPrevCachedRequirement(cachedRequirement);
    if (cachedRequirement) {
      setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
    }
  }

  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadClassrooms = async () => {
    try {
      const list = await listStages();
      setClassrooms(list);
      if (list.length > 0) {
        const slides = await getFirstSlideByStages(list.map((c) => c.id));
        setThumbnails(slides);
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  };

  useEffect(() => {
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
    loadClassrooms();
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null);
    try {
      await deleteStageData(id);
      await loadClassrooms();
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('Failed to delete classroom');
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      await renameStage(id, newName);
      setClassrooms((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error(t('classroom.renameFailed'));
    }
  };

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    try {
      if (field === 'webSearch') localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(value));
      if (field === 'language') localStorage.setItem(LANGUAGE_STORAGE_KEY, String(value));
      if (field === 'requirement') updateRequirementCache(value as string);
    } catch { /* */ }
  };

  const showSetupToast = (icon: React.ReactNode, title: string, desc: string) => {
    toast.custom(
      (id) => (
        <div
          className="w-[356px] rounded-xl border bg-[var(--ev-bg-card)] shadow-lg p-4 flex items-start gap-3 cursor-pointer"
          style={{ borderColor: 'var(--ev-border-medium)' }}
          onClick={() => {
            toast.dismiss(id);
            setSettingsOpen(true);
          }}
        >
          <div className="shrink-0 mt-0.5 size-9 rounded-lg bg-[var(--ev-bg-elevated)] flex items-center justify-center">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--ev-text-primary)' }}>
              {title}
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--ev-text-secondary)' }}>
              {desc}
            </p>
          </div>
          <div className="shrink-0 mt-1">
            <Settings className="size-3.5 animate-[spin_3s_linear_infinite]" style={{ color: 'var(--ev-primary)' }} />
          </div>
        </div>
      ),
      { duration: 4000 },
    );
  };

  const handleGenerate = async () => {
    if (!currentModelId) {
      showSetupToast(
        <BotOff className="size-4.5" style={{ color: 'var(--ev-warning)' }} />,
        t('settings.modelNotConfigured'),
        t('settings.setupNeeded'),
      );
      setSettingsOpen(true);
      return;
    }

    if (!form.requirement.trim()) {
      setError(t('upload.requirementRequired'));
      return;
    }

    setError(null);

    try {
      const userProfile = useUserProfileStore.getState();
      const requirements: UserRequirements = {
        requirement: form.requirement,
        language: form.language,
        userNickname: userProfile.nickname || undefined,
        userBio: userProfile.bio || undefined,
        webSearch: form.webSearch || undefined,
      };

      let pdfStorageKey: string | undefined;
      let pdfFileName: string | undefined;
      let pdfProviderId: string | undefined;
      let pdfProviderConfig: { apiKey?: string; baseUrl?: string } | undefined;

      if (form.pdfFile) {
        pdfStorageKey = await storePdfBlob(form.pdfFile);
        pdfFileName = form.pdfFile.name;
        const settings = useSettingsStore.getState();
        pdfProviderId = settings.pdfProviderId;
        const providerCfg = settings.pdfProvidersConfig?.[settings.pdfProviderId];
        if (providerCfg) {
          pdfProviderConfig = { apiKey: providerCfg.apiKey, baseUrl: providerCfg.baseUrl };
        }
      }

      const sessionState = {
        sessionId: nanoid(),
        requirements,
        pdfText: '',
        pdfImages: [],
        imageStorageIds: [],
        pdfStorageKey,
        pdfFileName,
        pdfProviderId,
        pdfProviderConfig,
        sceneOutlines: null,
        currentStep: 'generating' as const,
      };
      sessionStorage.setItem('generationSession', JSON.stringify(sessionState));
      router.push('/generation-preview');
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('classroom.today');
    if (diffDays === 1) return t('classroom.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('classroom.daysAgo')}`;
    return date.toLocaleDateString();
  };

  const canGenerate = !!form.requirement.trim();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate) handleGenerate();
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col" style={{ background: 'var(--ev-bg-base)' }}>
      <StarField />

      {/* Aurora background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[1]">
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[120px]"
          style={{ background: 'rgba(0,212,255,0.07)', animation: 'ev-aurora-drift 20s ease-in-out infinite' }}
        />
        <div
          className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full blur-[100px]"
          style={{ background: 'rgba(123,47,255,0.06)', animation: 'ev-aurora-drift 25s ease-in-out infinite reverse' }}
        />
        <div
          className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[80px]"
          style={{ background: 'rgba(255,107,53,0.04)', animation: 'ev-aurora-drift 30s ease-in-out infinite' }}
        />
      </div>

      {/* ═══ Navbar ═══ */}
      <nav className="sticky top-0 z-50 h-[60px] flex items-center justify-between px-6 transition-all"
        style={{ background: 'transparent', backdropFilter: 'blur(20px)' }}
      >
        <EduVerseLogo size={28} />

        <div className="hidden md:flex items-center gap-1 rounded-full px-1.5 py-1"
          style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}
        >
          {['Features', 'How it Works', 'Models', 'Community'].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s/g, '-')}`}
              className="px-4 py-1.5 text-sm rounded-full transition-colors hover:text-[var(--ev-primary)]"
              style={{ color: 'var(--ev-text-secondary)' }}
            >
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher onOpen={() => {}} />
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-full transition-all hover:scale-105"
            style={{ color: 'var(--ev-text-secondary)' }}
          >
            <Settings className="size-4" />
          </button>
          <button
            onClick={() => textareaRef.current?.focus()}
            className="px-5 py-2 rounded-full text-sm font-semibold transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #00D4FF, #7B2FFF)',
              color: 'var(--ev-bg-base)',
              boxShadow: '0 4px 20px rgba(0,212,255,0.3)',
            }}
          >
            Start Learning
          </button>
        </div>
      </nav>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSection(undefined);
        }}
        initialSection={settingsSection}
      />

      {/* ═══ Hero Section ═══ */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-4 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2"
          style={{
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.2)',
            color: 'var(--ev-primary)',
          }}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--ev-primary)] animate-pulse" />
          ✦ AI-Powered Learning Universe
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-[-2px] leading-[1.05]" style={{ fontFamily: 'var(--font-heading)', color: 'white' }}>
            Learn Anything.
          </h1>
          <h1
            className="text-6xl md:text-7xl font-extrabold tracking-[-2px] leading-[1.05]"
            style={{
              fontFamily: 'var(--font-heading)',
              background: 'linear-gradient(135deg, #00D4FF, #7B2FFF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Master Everything.
          </h1>
          <p className="text-3xl md:text-4xl font-light tracking-[-1px] mt-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--ev-text-secondary)' }}>
            Together with AI.
          </p>
        </motion.div>

        {/* Sub description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-[560px] text-[17px] leading-[1.7] mt-6"
          style={{ color: 'var(--ev-text-secondary)' }}
        >
          EduVerse creates a living AI classroom just for you. Real teachers. Real discussions. Real learning.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-3 mt-8"
        >
          <button
            onClick={() => textareaRef.current?.focus()}
            className="group px-8 py-3.5 rounded-full text-sm font-semibold transition-all hover:scale-[1.02] flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #00D4FF, #7B2FFF)',
              color: 'var(--ev-bg-base)',
              boxShadow: '0 4px 32px rgba(0,212,255,0.35)',
            }}
          >
            Enter the Universe
            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            className="px-8 py-3.5 rounded-full text-sm font-medium transition-all hover:border-[var(--ev-primary)] hover:text-[var(--ev-primary)]"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
            }}
          >
            Watch Demo
          </button>
        </motion.div>

        {/* Hero visual card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.7 }}
          className="relative mt-16 max-w-[800px] w-full"
        >
          <div
            className="w-full aspect-video rounded-2xl overflow-hidden flex items-center justify-center relative"
            style={{
              background: 'var(--ev-bg-card)',
              border: '1px solid var(--ev-border-medium)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.05), rgba(123,47,255,0.05))',
              }}
            />
            <p className="text-lg font-medium" style={{ color: 'var(--ev-text-muted)', fontFamily: 'var(--font-heading)' }}>
              Your classroom is being prepared ✦
            </p>
          </div>

          {/* Floating stat pills */}
          <div className="absolute -top-4 -left-4 px-3 py-2 rounded-full text-xs font-medium backdrop-blur-md"
            style={{ background: 'rgba(10,22,40,0.8)', border: '1px solid var(--ev-border-subtle)', color: 'var(--ev-text-primary)', animation: 'ev-float 4s ease-in-out infinite' }}
          >
            🎓 15 AI Slides Generated
          </div>
          <div className="absolute -top-4 -right-4 px-3 py-2 rounded-full text-xs font-medium backdrop-blur-md"
            style={{ background: 'rgba(10,22,40,0.8)', border: '1px solid var(--ev-border-subtle)', color: 'var(--ev-text-primary)', animation: 'ev-float 4s ease-in-out infinite 1s' }}
          >
            🤖 4 AI Agents Teaching
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-full text-xs font-medium backdrop-blur-md"
            style={{ background: 'rgba(10,22,40,0.8)', border: '1px solid var(--ev-border-subtle)', color: 'var(--ev-text-primary)', animation: 'ev-float 4s ease-in-out infinite 0.5s' }}
          >
            ⚡ Powered by AI
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 2 }}
          className="mt-12"
          style={{ animation: 'ev-chevron-bounce 2s ease-in-out infinite' }}
        >
          <ChevronDown className="size-6" style={{ color: 'var(--ev-text-muted)' }} />
        </motion.div>
      </section>

      {/* ═══ Features Section ═══ */}
      <section id="features" className="relative z-10 py-24 px-4" style={{ background: 'var(--ev-bg-secondary)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full text-xs font-medium mb-4 inline-block"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'var(--ev-primary)' }}
            >
              ✦ Everything You Need
            </span>
            <h2 className="text-4xl font-bold mt-4" style={{ fontFamily: 'var(--font-heading)', color: 'white' }}>
              One universe. Infinite knowledge.
            </h2>
            <p className="max-w-[480px] mx-auto mt-3" style={{ color: 'var(--ev-text-secondary)' }}>
              Everything you need to master any topic, powered by cutting-edge AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-7 rounded-2xl transition-all duration-200 hover:-translate-y-1 group cursor-default"
                style={{
                  background: 'var(--ev-bg-card)',
                  border: '1px solid var(--ev-border-subtle)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ev-border-medium)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--ev-shadow-card)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ev-border-subtle)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div className="size-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}15` }}
                >
                  <f.icon className="size-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--ev-text-primary)' }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ev-text-secondary)' }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section id="how-it-works" className="relative z-10 py-24 px-4" style={{ background: 'var(--ev-bg-base)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full text-xs font-medium mb-4 inline-block"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'var(--ev-primary)' }}
            >
              ✦ Simple as 1-2-3
            </span>
            <h2 className="text-4xl font-bold mt-4" style={{ fontFamily: 'var(--font-heading)', color: 'white' }}>
              From idea to classroom in minutes.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '01', icon: MessageSquare, color: '#00D4FF', title: 'Tell Us What to Learn', desc: 'Type any topic or upload a PDF document. Our AI analyzes and plans your perfect lesson.' },
              { num: '02', icon: Cpu, color: '#7B2FFF', title: 'Watch AI Build Your Class', desc: 'Five AI agents collaborate to create slides, visuals, quiz questions and voice scripts.' },
              { num: '03', icon: GraduationCap, color: '#FF6B35', title: 'Learn with Your AI Class', desc: 'Enter your personal classroom. AI teachers explain, students ask questions, you master the topic.' },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative p-8 rounded-2xl overflow-hidden"
                style={{ background: 'var(--ev-bg-card)', border: '1px solid var(--ev-border-subtle)' }}
              >
                <span className="absolute -top-2 -left-2 text-[120px] font-black leading-none select-none pointer-events-none"
                  style={{ fontFamily: 'var(--font-heading)', color: 'rgba(0,212,255,0.04)' }}
                >
                  {step.num}
                </span>
                <div className="relative z-10">
                  <div className="size-12 rounded-full flex items-center justify-center mb-5"
                    style={{ background: `${step.color}20` }}
                  >
                    <step.icon className="size-5" style={{ color: step.color }} />
                  </div>
                  <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--ev-text-primary)' }}>
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ev-text-secondary)' }}>
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Input Section — Main CTA ═══ */}
      <section className="relative z-10 py-24 px-4" style={{ background: 'var(--ev-bg-base)' }}>
        <div className="max-w-3xl mx-auto">
          {/* Radial glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[400px] rounded-full blur-[120px]" style={{ background: 'rgba(0,212,255,0.06)' }} />
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 relative z-10" style={{ fontFamily: 'var(--font-heading)', color: 'white' }}>
            What do you want to learn today?
          </h2>

          {/* Agent preview row */}
          <div className="flex items-center justify-center gap-3 mb-6 relative z-10">
            <span className="text-xs font-medium" style={{ color: 'var(--ev-text-secondary)' }}>Your learning team is ready</span>
            <div className="flex -space-x-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="size-8 rounded-full flex items-center justify-center text-xs"
                  style={{
                    background: 'var(--ev-bg-elevated)',
                    border: '2px solid var(--ev-primary)',
                    color: 'var(--ev-primary)',
                    animation: `ev-pulse-glow 3s ease-in-out infinite ${i * 0.5}s`,
                  }}
                >
                  {['👩‍🏫', '👨‍💻', '👧', '👦'][i]}
                </div>
              ))}
            </div>
          </div>

          {/* Input card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10 rounded-2xl p-7 transition-all focus-within:shadow-[0_0_120px_rgba(0,212,255,0.15)]"
            style={{
              background: 'var(--ev-bg-card)',
              border: '1px solid var(--ev-border-medium)',
              boxShadow: '0 0 80px rgba(0,212,255,0.08)',
            }}
          >
            {/* Greeting + Agents */}
            <div className="flex items-start justify-between mb-3">
              <GreetingBar />
              <div className="shrink-0">
                <AgentBar />
              </div>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              placeholder={t('upload.requirementPlaceholder')}
              className="w-full resize-none bg-transparent px-1 pt-1 pb-2 text-[15px] leading-relaxed focus:outline-none min-h-[120px] max-h-[300px]"
              style={{ color: 'var(--ev-text-primary)', fontFamily: 'var(--font-sans)' }}
              value={form.requirement}
              onChange={(e) => updateForm('requirement', e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
            />

            {/* Example chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {EXAMPLE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => updateForm('requirement', chip.replace('✦ ', ''))}
                  className="px-3 py-1.5 rounded-full text-xs transition-all hover:text-[var(--ev-text-primary)] cursor-pointer"
                  style={{
                    background: 'rgba(0,212,255,0.06)',
                    border: '1px solid var(--ev-border-subtle)',
                    color: 'var(--ev-text-secondary)',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Toolbar row */}
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <GenerationToolbar
                  language={form.language}
                  onLanguageChange={(lang) => updateForm('language', lang)}
                  webSearch={form.webSearch}
                  onWebSearchChange={(v) => updateForm('webSearch', v)}
                  onSettingsOpen={(section) => {
                    setSettingsSection(section);
                    setSettingsOpen(true);
                  }}
                  pdfFile={form.pdfFile}
                  onPdfFileChange={(f) => updateForm('pdfFile', f)}
                  onPdfError={setError}
                />
              </div>
              <SpeechButton
                size="md"
                onTranscription={(text) => {
                  setForm((prev) => {
                    const next = prev.requirement + (prev.requirement ? ' ' : '') + text;
                    updateRequirementCache(next);
                    return { ...prev, requirement: next };
                  });
                }}
              />
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={cn(
                  'shrink-0 h-10 rounded-full flex items-center justify-center gap-2 transition-all px-6 text-sm font-semibold',
                  canGenerate ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-30 cursor-not-allowed',
                )}
                style={{
                  background: canGenerate ? 'linear-gradient(135deg, #00D4FF, #7B2FFF)' : 'var(--ev-bg-elevated)',
                  color: canGenerate ? 'var(--ev-bg-base)' : 'var(--ev-text-muted)',
                }}
              >
                Enter EduVerse
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </motion.div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 w-full p-3 rounded-lg"
                style={{ background: 'rgba(255,69,101,0.1)', border: '1px solid rgba(255,69,101,0.2)' }}
              >
                <p className="text-sm" style={{ color: 'var(--ev-error)' }}>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ═══ Recent classrooms ═══ */}
      {classrooms.length > 0 && (
        <section className="relative z-10 py-16 px-4" style={{ background: 'var(--ev-bg-secondary)' }}>
          <div className="max-w-6xl mx-auto">
            <button
              onClick={() => {
                const next = !recentOpen;
                setRecentOpen(next);
                try { localStorage.setItem(RECENT_OPEN_STORAGE_KEY, String(next)); } catch { /* */ }
              }}
              className="group w-full flex items-center gap-4 py-2 cursor-pointer"
            >
              <div className="flex-1 h-px" style={{ background: 'var(--ev-border-subtle)' }} />
              <span className="shrink-0 flex items-center gap-2 text-[13px] select-none" style={{ color: 'var(--ev-text-secondary)' }}>
                <Clock className="size-3.5" />
                {t('classroom.recentClassrooms')}
                <span className="text-[11px] tabular-nums opacity-60">{classrooms.length}</span>
                <motion.div
                  animate={{ rotate: recentOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <ChevronDown className="size-3.5" />
                </motion.div>
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--ev-border-subtle)' }} />
            </button>

            <AnimatePresence>
              {recentOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  className="w-full overflow-hidden"
                >
                  <div className="pt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
                    {classrooms.map((classroom, i) => (
                      <motion.div
                        key={classroom.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.35, ease: 'easeOut' }}
                      >
                        <ClassroomCard
                          classroom={classroom}
                          slide={thumbnails[classroom.id]}
                          formatDate={formatDate}
                          onDelete={handleDelete}
                          onRename={handleRename}
                          confirmingDelete={pendingDeleteId === classroom.id}
                          onConfirmDelete={() => confirmDelete(classroom.id)}
                          onCancelDelete={() => setPendingDeleteId(null)}
                          onClick={() => router.push(`/classroom/${classroom.id}`)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-xs" style={{ color: 'var(--ev-text-muted)' }}>
        EduVerse — Your Personal AI Universe of Learning
      </footer>
    </div>
  );
}

// ─── Greeting Bar ────
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function isCustomAvatar(src: string) {
  return src.startsWith('data:');
}

function GreetingBar() {
  const { t } = useI18n();
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const bio = useUserProfileStore((s) => s.bio);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);
  const setNickname = useUserProfileStore((s) => s.setNickname);
  const setBio = useUserProfileStore((s) => s.setBio);

  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = nickname || t('profile.defaultNickname');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingName(false);
        setAvatarPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const startEditName = () => {
    setNameDraft(nickname);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const commitName = () => {
    setNickname(nameDraft.trim());
    setEditingName(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) { toast.error(t('profile.fileTooLarge')); return; }
    if (!file.type.startsWith('image/')) { toast.error(t('profile.invalidFileType')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(128 / img.width, 128 / img.height);
        const w = img.width * scale; const h = img.height * scale;
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div ref={containerRef} className="relative py-1 w-auto">
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      {!open && (
        <div
          className="flex items-center gap-2.5 cursor-pointer transition-all duration-200 group rounded-full px-2.5 py-1.5"
          style={{ border: '1px solid var(--ev-border-subtle)', color: 'var(--ev-text-secondary)' }}
          onClick={() => setOpen(true)}
        >
          <div className="shrink-0 relative">
            <div className="size-8 rounded-full overflow-hidden" style={{ border: '1.5px solid var(--ev-border-medium)' }}>
              <img src={avatar} alt="" className="size-full object-cover" />
            </div>
          </div>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--ev-text-primary)' }}>
            {t('home.greetingWithName', { name: displayName })}
          </span>
          <ChevronDown className="size-3 opacity-40" />
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-0 top-0 z-50 w-64"
          >
            <div className="rounded-2xl backdrop-blur-sm p-2.5" style={{ background: 'var(--ev-bg-elevated)', border: '1px solid var(--ev-border-medium)' }}>
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setOpen(false); setEditingName(false); setAvatarPickerOpen(false); }}>
                <div className="shrink-0 relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setAvatarPickerOpen(!avatarPickerOpen); }}>
                  <div className="size-8 rounded-full overflow-hidden" style={{ border: '1.5px solid var(--ev-primary)' }}>
                    <img src={avatar} alt="" className="size-full object-cover" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={nameInputRef}
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
                        onBlur={commitName}
                        maxLength={20}
                        placeholder={t('profile.defaultNickname')}
                        className="flex-1 min-w-0 h-6 bg-transparent text-[13px] font-semibold outline-none"
                        style={{ borderBottom: '1px solid var(--ev-border-medium)', color: 'var(--ev-text-primary)' }}
                      />
                      <button onClick={commitName} className="shrink-0 size-5 rounded flex items-center justify-center" style={{ color: 'var(--ev-primary)' }}>
                        <Check className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <span onClick={(e) => { e.stopPropagation(); startEditName(); }} className="group/name inline-flex items-center gap-1 cursor-pointer">
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--ev-text-primary)' }}>{displayName}</span>
                      <Pencil className="size-2.5 opacity-30 group-hover/name:opacity-100 transition-opacity" style={{ color: 'var(--ev-text-muted)' }} />
                    </span>
                  )}
                </div>
                <ChevronUp className="size-3.5" style={{ color: 'var(--ev-text-muted)' }} />
              </div>

              <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                <AnimatePresence>
                  {avatarPickerOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="p-1 pb-2.5 flex items-center gap-1.5 flex-wrap">
                        {AVATAR_OPTIONS.map((url) => (
                          <button key={url} onClick={() => setAvatar(url)}
                            className={cn('size-7 rounded-full overflow-hidden cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95',
                              avatar === url ? 'ring-2 ring-offset-0' : 'hover:ring-1 hover:ring-[var(--ev-border-medium)]'
                            )}
                            style={avatar === url ? { boxShadow: '0 0 0 2px var(--ev-primary)' } : {}}
                          >
                            <img src={url} alt="" className="size-full" />
                          </button>
                        ))}
                        <label
                          className="size-7 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110"
                          style={{ border: '1px dashed var(--ev-border-medium)', color: 'var(--ev-text-muted)' }}
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          <ImagePlus className="size-3" />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <UITextarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                  maxLength={200}
                  rows={2}
                  className="resize-none bg-transparent min-h-[72px] !text-[13px] !leading-relaxed focus-visible:ring-1"
                  style={{ borderColor: 'var(--ev-border-subtle)', color: 'var(--ev-text-primary)' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Classroom Card ──────────────────────
function ClassroomCard({
  classroom, slide, formatDate, onDelete, onRename,
  confirmingDelete, onConfirmDelete, onCancelDelete, onClick,
}: {
  classroom: StageListItem;
  slide?: Slide;
  formatDate: (ts: number) => string;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newName: string) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setThumbWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameDraft(classroom.name);
    setEditing(true);
  };

  const commitRename = () => {
    if (!editing) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== classroom.name) onRename(classroom.id, trimmed);
    setEditing(false);
  };

  return (
    <div className="group cursor-pointer" onClick={confirmingDelete ? undefined : onClick}>
      <div
        ref={thumbRef}
        className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden transition-transform duration-200 group-hover:scale-[1.02]"
        style={{ background: 'var(--ev-bg-card)', border: '1px solid var(--ev-border-subtle)' }}
      >
        {slide && thumbWidth > 0 ? (
          <ThumbnailSlide slide={slide} size={thumbWidth} viewportSize={slide.viewportSize ?? 1000} viewportRatio={slide.viewportRatio ?? 0.5625} />
        ) : !slide ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--ev-bg-elevated)' }}>
              <span className="text-xl opacity-50">📄</span>
            </div>
          </div>
        ) : null}

        <AnimatePresence>
          {!confirmingDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button size="icon" variant="ghost"
                className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                style={{ background: 'rgba(0,0,0,0.4)', color: 'white' }}
                onClick={(e) => { e.stopPropagation(); onDelete(classroom.id, e); }}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost"
                className="absolute top-2 right-11 size-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                style={{ background: 'rgba(0,0,0,0.4)', color: 'white' }}
                onClick={startRename}
              >
                <Pencil className="size-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmingDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-[6px]"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('classroom.deleteConfirmTitle')}?
              </span>
              <div className="flex gap-2">
                <button className="px-3.5 py-1 rounded-lg text-[12px] font-medium" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }} onClick={onCancelDelete}>
                  {t('common.cancel')}
                </button>
                <button className="px-3.5 py-1 rounded-lg text-[12px] font-medium" style={{ background: 'rgba(255,69,101,0.9)', color: 'white' }} onClick={onConfirmDelete}>
                  {t('classroom.delete')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2.5 px-1 flex items-center gap-2">
        <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--ev-primary)' }}
        >
          {classroom.sceneCount} {t('classroom.slides')} · {formatDate(classroom.updatedAt)}
        </span>
        {editing ? (
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
              onBlur={commitRename}
              maxLength={100}
              className="w-full bg-transparent text-[15px] font-medium outline-none"
              style={{ borderBottom: '1px solid var(--ev-primary)', color: 'var(--ev-text-primary)' }}
            />
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-medium text-[15px] truncate min-w-0 cursor-text" style={{ color: 'var(--ev-text-primary)' }} onDoubleClick={startRename}>
                {classroom.name}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4} className="!max-w-[min(90vw,32rem)] break-words whitespace-normal">
              <div className="flex items-center gap-1.5">
                <span className="break-all">{classroom.name}</span>
                <button className="shrink-0 p-0.5 rounded" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(classroom.name); toast.success(t('classroom.nameCopied')); }}>
                  <Copy className="size-3 opacity-60" />
                </button>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <HomePage />;
}
