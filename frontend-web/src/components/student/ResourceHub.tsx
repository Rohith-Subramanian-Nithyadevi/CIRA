import { useState, useEffect } from 'react';
import { 
  Search, 
  Star, 
  BookOpen, 
  ExternalLink, 
  Folder, 
  ChevronRight, 
  Sparkles, 
  Clock, 
  Layers, 
  Code2, 
  CheckCircle2
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import SheetView from './SheetView';
import RevisionPool from './RevisionPool';

interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  category: string;
  topic: string | null;
  type: string; // 'SHEET' | 'LINK'
  totalQuestions?: number;
}

const CATEGORIES = [
  { key: 'ALL',         label: 'All' },
  { key: 'DSA',         label: 'DSA' },
  { key: 'CORE',        label: 'Core Subjects' },
  { key: 'APTITUDE',    label: 'Aptitude' },
  { key: 'VERBAL',      label: 'Verbal' },
  { key: 'SOFT_SKILLS', label: 'Soft Skills' },
];

const CURATED_PLACEHOLDERS: Record<string, { title: string; topic: string; desc: string }[]> = {
  CORE: [
    { title: 'CN Top 100', topic: 'Computer Networks', desc: 'Curated 100 questions covering OSI layers, TCP/IP protocols, subnetting, and socket programming.' },
    { title: 'OS Top 100', topic: 'Operating Systems', desc: 'Concurrency, deadlocks, virtual memory, paging, and CPU scheduling interview essentials.' },
    { title: 'DBMS Top 100', topic: 'Database Management', desc: 'ACID properties, normalization, indexing strategies, transactions, and complex SQL joins.' },
    { title: 'OOPS Top 100', topic: 'Object Oriented Programming', desc: 'Inheritance, polymorphism, encapsulation, abstraction, and real-world design principles.' },
    { title: 'Top 100 System Design Questions', topic: 'System Design', desc: 'Scalability, microservices, load balancing, caching architectures, and distributed systems.' },
    { title: 'CIR LLD – Low Level Design', topic: 'Low Level Design', desc: 'Design patterns (Factory, Singleton, Observer, Strategy) and UML class modeling.' },
  ],
  APTITUDE: [
    { title: 'Speed Math & Quantitative Aptitude', topic: 'Quantitative', desc: 'Shortcuts for percentages, ratios, profit & loss, time-speed-distance, and quick calculations.' },
    { title: 'Logical Reasoning – Pattern Mastery', topic: 'Logical Reasoning', desc: 'Seating arrangements, syllogisms, blood relations, series completion, and direction tests.' },
    { title: 'Data Interpretation – 50 Caselets', topic: 'Data Interpretation', desc: 'Tables, bar graphs, pie charts, radar plots, and multi-set data analysis.' },
    { title: 'Puzzles & Brain Teasers – Top 50', topic: 'Puzzles', desc: 'Analytical puzzles, river crossing, coin weighing, and algorithmic lateral thinking.' },
  ],
  VERBAL: [
    { title: 'Verbal Comprehension Mastery', topic: 'Reading Comprehension', desc: 'Techniques for skimming, tone identification, central theme deduction, and inference questions.' },
    { title: 'Grammar Essentials & Error Spotting', topic: 'Grammar', desc: 'Subject-verb agreement, modifier placement, parallelism, tense consistency, and idioms.' },
    { title: 'Para-Jumbles & Sentence Ordering', topic: 'Verbal Logic', desc: 'Coherence rules, transition word identification, and paragraph structural flow.' },
  ],
  SOFT_SKILLS: [
    { title: 'Behavioral Interviews – STAR Method', topic: 'HR Interviews', desc: 'Situation, Task, Action, Result framework for answering high-stakes behavioral questions.' },
    { title: 'Group Discussion – Winning Strategies', topic: 'Group Discussion', desc: 'Initiating discussions, structured content generation, handling conflicts, and effective closures.' },
    { title: 'Technical Resume & Portfolio Optimization', topic: 'Career Prep', desc: 'Impact metrics, action verbs, project presentation, and ATS formatting standards.' },
  ],
};

export default function ResourceHub() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [showRevision, setShowRevision] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const res = await apiClient.fetch('/api/v1/student/resources');
      const data = await res.json();
      if (Array.isArray(data)) {
        setResources(data);
      } else {
        setResources([]);
      }
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  if (activeSheetId) {
    return <SheetView sheetId={activeSheetId} onBack={() => setActiveSheetId(null)} />;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border-soft p-12 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-maroon border-t-transparent animate-spin" />
        <p className="text-xs text-gray-body font-medium">Loading Resource Hub...</p>
      </div>
    );
  }

  // Filter resources from database
  const filteredDbResources = resources.filter(r => {
    const matchesCategory = activeCategory === 'ALL' || r.category === activeCategory;
    const matchesQuery = !searchQuery || 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.topic && r.topic.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  // Separate sheets from links
  const sheetResources = filteredDbResources.filter(r => r.type === 'SHEET');
  const nonSheetResources = filteredDbResources.filter(r => r.type !== 'SHEET');

  // Placeholder curated cards for non-DSA categories
  const showCuratedPlaceholders = activeCategory !== 'ALL' && activeCategory !== 'DSA';
  const curatedCards = (CURATED_PLACEHOLDERS[activeCategory] || []).filter(c => {
    if (!searchQuery) return true;
    return c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.desc.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-xs flex flex-col min-h-[calc(100vh-8rem)] relative">
      {showRevision && <RevisionPool onClose={() => setShowRevision(false)} />}

      {/* ── Top Header ── */}
      <div className="p-6 border-b border-border-soft bg-cream/20 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-ink">Resource Hub</h2>
            <p className="text-xs text-gray-body mt-0.5">Comprehensive preparation sheets, curriculum roadmaps, and interview resources</p>
          </div>

          <button 
            onClick={() => setShowRevision(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-maroon/10 text-maroon border border-maroon/20 rounded-lg text-xs font-bold hover:bg-maroon/15 transition-all shadow-2xs"
          >
            <Star className="w-3.5 h-3.5 fill-maroon text-maroon" />
            Revision Pool
          </button>
        </div>

        {/* Category Tabs & Search */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-maroon text-white border-maroon shadow-xs'
                    : 'bg-white text-gray-body border-border-soft hover:border-maroon/40 hover:text-ink'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-body/50" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon outline-none transition-all text-xs bg-white"
            />
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 1. Featured DSA Sheets (Visible in ALL and DSA) */}
        {(activeCategory === 'ALL' || activeCategory === 'DSA') && sheetResources.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-maroon" />
                <h3 className="text-xs uppercase tracking-widest font-bold text-gray-body">
                  Curated DSA Practice Sheets
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-gray-body/60">
                16 Topics · Stepped Roadmaps · Real LeetCode Links
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sheetResources.map(sheet => {
                const count = sheet.totalQuestions || 0;
                return (
                  <div
                    key={sheet.id}
                    onClick={() => setActiveSheetId(sheet.id)}
                    className="group cursor-pointer text-left flex flex-col p-5 rounded-xl border border-border-soft bg-gradient-to-br from-white to-cream/20 hover:border-maroon/40 hover:shadow-md hover:bg-cream/30 transition-all relative overflow-hidden"
                  >
                    {/* Subtle top indicator bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-maroon/20 group-hover:bg-maroon transition-colors" />

                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-white rounded-lg border border-border-soft/80 group-hover:border-maroon/30 shadow-2xs transition-colors">
                        <Code2 className="w-5 h-5 text-maroon" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-maroon bg-maroon/10 border border-maroon/20 px-2 py-0.5 rounded-full">
                        {count > 0 ? `${count} Questions` : 'Roadmap Sheet'}
                      </span>
                    </div>

                    <h4 className="font-serif font-bold text-ink text-base mb-1.5 group-hover:text-maroon transition-colors">
                      {sheet.title}
                    </h4>

                    <p className="text-xs text-gray-body leading-relaxed mb-4 flex-1 line-clamp-2">
                      {sheet.description}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-border-soft/60 mt-auto">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-body/70">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Interactive Tracking</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-maroon group-hover:translate-x-1 transition-transform">
                        <span>Open Sheet</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Standard Resources (Links) */}
        {nonSheetResources.length > 0 && (
          <div>
            {(activeCategory === 'ALL' || activeCategory === 'DSA') && sheetResources.length > 0 && (
              <div className="flex items-center gap-2 mb-3 pt-2">
                <BookOpen className="w-4 h-4 text-gray-body/70" />
                <h3 className="text-xs uppercase tracking-widest font-bold text-gray-body">
                  Study Guides & Subject Resources
                </h3>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nonSheetResources.map(resource => (
                <a
                  key={resource.id}
                  href={resource.url || '#'}
                  target={resource.url && resource.url !== '#' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="group flex flex-col p-4 rounded-xl border border-border-soft bg-white hover:border-maroon/30 hover:shadow-xs hover:bg-cream/10 transition-all text-left"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-cream/30 rounded-lg border border-border-soft/60 group-hover:border-maroon/20">
                      <BookOpen className="w-4 h-4 text-maroon/80" />
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-body/40 group-hover:text-maroon transition-colors" />
                  </div>

                  <h4 className="font-bold text-ink text-sm mb-1 group-hover:text-maroon transition-colors line-clamp-1">
                    {resource.title}
                  </h4>

                  <p className="text-xs text-gray-body line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {resource.description}
                  </p>

                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border-soft/50">
                    <Folder className="w-3 h-3 text-gray-body/60" />
                    <span className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">
                      {resource.topic || resource.category}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 3. Non-DSA Curated Content Cards with Professional Notice */}
        {showCuratedPlaceholders && curatedCards.length > 0 && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {curatedCards.map((item, i) => (
                <div 
                  key={i} 
                  className="flex flex-col p-5 rounded-xl border border-dashed border-border-soft bg-gradient-to-br from-white to-cream/30 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-cream/40 rounded-lg border border-border-soft/60">
                      <BookOpen className="w-4 h-4 text-maroon/60" />
                    </div>
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-maroon/70 bg-maroon/8 border border-maroon/15 px-2 py-0.5 rounded-full">
                      <Clock className="w-2.5 h-2.5" /> Curating
                    </span>
                  </div>

                  <h4 className="font-serif font-bold text-ink/80 text-sm mb-1.5 line-clamp-1">
                    {item.title}
                  </h4>

                  <p className="text-xs text-gray-body/70 leading-relaxed line-clamp-2 mb-4 flex-1">
                    {item.desc}
                  </p>

                  {/* Professional Notice Banner */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-cream/40 border border-border-soft/40 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-maroon/60 shrink-0" />
                    <p className="text-[11px] text-gray-body font-medium leading-tight">
                      We are curating the perfect course modules for you
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2.5 border-t border-border-soft/40 mt-auto">
                    <Folder className="w-3 h-3 text-gray-body/40" />
                    <span className="text-[10px] font-semibold text-gray-body/60 uppercase tracking-wider">
                      {item.topic}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredDbResources.length === 0 && (!showCuratedPlaceholders || curatedCards.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-body/60 text-center">
            <Search className="w-10 h-10 mb-3 stroke-1 text-gray-body/40" />
            <p className="font-semibold text-ink text-sm">No resources found</p>
            <p className="text-xs text-gray-body mt-1">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
