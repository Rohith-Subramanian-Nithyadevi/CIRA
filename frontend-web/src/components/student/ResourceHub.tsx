import { useState, useEffect } from 'react';
import { ExternalLink, BookOpen, Search, Folder, ChevronRight, Star } from 'lucide-react';
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
  type: string;
}

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
      
      if (Array.isArray(data) && data.length > 0) {
        setResources(data);
      } else {
        setResources([]);
      }
    } catch (error) {
      console.error('Failed to fetch resources', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['ALL', ...Array.from(new Set(resources.map(r => r.category)))];

  const filteredResources = resources.filter(r => 
    (activeCategory === 'ALL' || r.category === activeCategory) &&
    (r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
     (r.topic && r.topic.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  if (activeSheetId) {
    return <SheetView sheetId={activeSheetId} onBack={() => setActiveSheetId(null)} />;
  }

  if (loading) {
    return <div className="animate-pulse bg-white rounded-xl h-64 border border-border-soft"></div>;
  }

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm flex flex-col min-h-[calc(100vh-8rem)] relative">
      {showRevision && <RevisionPool onClose={() => setShowRevision(false)} />}
      <div className="p-6 border-b border-border-soft bg-cream/20 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-serif font-bold text-ink">Resource Hub</h2>
          <button 
            onClick={() => setShowRevision(true)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-sm font-bold hover:bg-yellow-100 transition-colors"
          >
            <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
            Revision Pool
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  activeCategory === category
                    ? 'bg-maroon text-white border-maroon'
                    : 'bg-white text-gray-body border-border-soft hover:border-maroon/50'
                }`}
              >
                {category.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-body/50" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon outline-none transition-all text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white">
        {filteredResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResources.map(resource => {
              const isSheet = resource.type === 'SHEET';
              const Component = isSheet ? 'button' : 'a';
              
              return (
                <Component
                  key={resource.id}
                  href={isSheet ? undefined : resource.url!}
                  target={isSheet ? undefined : "_blank"}
                  rel={isSheet ? undefined : "noopener noreferrer"}
                  onClick={() => isSheet && setActiveSheetId(resource.id)}
                  className="group text-left flex flex-col p-4 rounded-xl border border-border-soft hover:border-maroon/40 hover:shadow-md transition-all bg-cream/10"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-white rounded-lg border border-border-soft group-hover:border-maroon/20">
                      <BookOpen className="w-5 h-5 text-maroon" />
                    </div>
                    {isSheet ? (
                      <ChevronRight className="w-4 h-4 text-gray-body/40 group-hover:text-maroon transition-colors" />
                    ) : (
                      <ExternalLink className="w-4 h-4 text-gray-body/40 group-hover:text-maroon transition-colors" />
                    )}
                  </div>
                  
                  <h3 className="font-bold text-ink text-sm mb-1 group-hover:text-maroon transition-colors line-clamp-2">
                    {resource.title}
                  </h3>
                  
                  <p className="text-xs text-gray-body line-clamp-2 mb-4 flex-1">
                    {resource.description}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border-soft/50">
                    <Folder className="w-3 h-3 text-gray-body/60" />
                    <span className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">
                      {resource.topic || resource.category}
                    </span>
                    {isSheet && (
                      <span className="ml-auto text-[10px] font-bold text-maroon bg-maroon/10 px-2 py-0.5 rounded-full">
                        SHEET
                      </span>
                    )}
                  </div>
                </Component>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-body/60 pb-8 text-center">
            <Search className="w-12 h-12 mb-3 stroke-1" />
            <p className="font-medium">No resources found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
