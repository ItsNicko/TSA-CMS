'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { initializeGitHub, getFileContent, commitFile } from '@/lib/github';
import { discoverPages, isValidJSON, getFileName } from '@/lib/utils';

interface Page {
  name: string;
  path: string;
  type: 'json' | 'html';
}

interface EditorPage extends Page {
  content: string;
  isDirty: boolean;
}

// GitHub config stored in localStorage - in production, use session storage with encryption
const getGitHubConfig = () => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('github-config');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const storeGitHubConfig = (config: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('github-config', JSON.stringify(config));
  }
};

export default function EditorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState<EditorPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<Page | null>(null);
  const [gitHubConfig, setGitHubConfig] = useState(getGitHubConfig());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Initialize GitHub and load only JSON pages
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        
        let config = getGitHubConfig();
        
        if (!config) {
          setShowConfigModal(true);
          setIsLoading(false);
          return;
        }
        
        initializeGitHub(config);
        const discoveredPages = await discoverPages();
        // Filter to only JSON pages
        const jsonPages = discoveredPages.filter(p => p.type === 'json');
        setPages(jsonPages);
        setError('');
      } catch (err: any) {
        console.error('Initialization error:', err);
        setError(err.message || 'Failed to load pages');
        setShowConfigModal(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && gitHubConfig) {
      initializeApp();
    } else if (user && !gitHubConfig) {
      setShowConfigModal(true);
      setIsLoading(false);
    }
  }, [user, gitHubConfig]);

  const loadPage = useCallback(async (page: Page) => {
    try {
      setIsLoading(true);
      const content = await getFileContent(page.path);
      setCurrentPage({
        ...page,
        content,
        isDirty: false,
      });
      setError('');
      setShowUnsavedWarning(false);
      setPendingNavigation(null);
    } catch (err: any) {
      setError(`Failed to load page: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectPage = useCallback((page: Page) => {
    if (currentPage?.isDirty) {
      setPendingNavigation(page);
      setShowUnsavedWarning(true);
      return;
    }
    loadPage(page);
  }, [currentPage?.isDirty, loadPage]);

  const handleContentChange = useCallback((newContent: string) => {
    if (currentPage) {
      setCurrentPage({
        ...currentPage,
        content: newContent,
        isDirty: true,
      });
    }
  }, [currentPage]);

  const handleSave = useCallback(async () => {
    if (!currentPage || !currentPage.isDirty) return;

    try {
      setIsSaving(true);
      setError('');
      
      const fileName = getFileName(currentPage.path);
      const message = `Update ${fileName} via TSA CMS Editor`;
      
      await commitFile(currentPage.path, currentPage.content, message);
      
      setCurrentPage(prev => prev ? { ...prev, isDirty: false } : null);
      
      // Reload the file to confirm changes
      const updatedContent = await getFileContent(currentPage.path);
      setCurrentPage(prev => prev ? { ...prev, content: updatedContent, isDirty: false } : null);
      
      // If there's pending navigation, proceed with it
      if (pendingNavigation) {
        await loadPage(pendingNavigation);
      }
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [currentPage, pendingNavigation, loadPage]);

  const handleConfigSubmit = useCallback((config: any) => {
    try {
      initializeGitHub(config);
      storeGitHubConfig(config);
      setGitHubConfig(config);
      setShowConfigModal(false);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  if (authLoading || (isLoading && !pages.length)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <TopBar 
        isDirty={currentPage?.isDirty ?? false}
        onSave={handleSave}
        currentPage={currentPage?.name ?? null}
        isSaving={isSaving}
      />

      {showConfigModal && <ConfigModal onSubmit={handleConfigSubmit} onClose={() => setShowConfigModal(false)} />}
      
      {showUnsavedWarning && (
        <UnsavedChangesModal
          onSave={() => handleSave()}
          onDiscard={() => {
            if (pendingNavigation) {
              loadPage(pendingNavigation);
            }
            setShowUnsavedWarning(false);
            setPendingNavigation(null);
          }}
          onCancel={() => {
            setShowUnsavedWarning(false);
            setPendingNavigation(null);
          }}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          pages={pages}
          currentPage={currentPage?.path ?? null}
          onSelectPage={handleSelectPage}
          isLoading={isLoading}
        />

        <main className="flex-1 overflow-auto">
          {error && (
            <div className="bg-red-50 border-b border-red-200 text-red-600 px-6 py-4">
              {error}
            </div>
          )}

          {isLoading && !currentPage ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading page...</p>
              </div>
            </div>
          ) : currentPage ? (
            <div className="p-8 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Editing: {currentPage.name}
              </h2>

              {currentPage.name === 'about.json' ? (
                <AboutVisualEditor
                  page={currentPage}
                  onChange={handleContentChange}
                />
              ) : (
                <JSONVisualEditor
                  page={currentPage}
                  onChange={handleContentChange}
                />
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg">Select a page from the sidebar to begin editing</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function JSONVisualEditor({ page, onChange }: { page: EditorPage; onChange: (content: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const parsed = JSON.parse(page.content);
      setData(parsed);
      setError('');
    } catch (err) {
      setError('Invalid JSON format');
      setData(null);
    }
  }, [page.content]);

  const updateField = (path: string[], value: any) => {
    if (!data) return;
    
    const newData = JSON.parse(JSON.stringify(data)); // Deep copy
    let current = newData;
    
    // Navigate to the nested field
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    // Update the final field
    current[path[path.length - 1]] = value;
    
    setData(newData);
    onChange(JSON.stringify(newData, null, 2));
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {error}
        <pre className="mt-4 bg-white p-4 rounded border border-red-300 overflow-auto text-xs">
          {page.content}
        </pre>
      </div>
    );
  }

  if (!data) {
    return <div>Loading...</div>;
  }

  // Render different sections based on what's in the JSON
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Edit Fields</h3>
        <div className="space-y-6">
          {/* Config & Footer Sections */}
          {data.QuickLinks && (
            <LinkSectionEditor
              title="Quick Links"
              links={data.QuickLinks}
              onChange={(links) => updateField(['QuickLinks'], links)}
            />
          )}
          
          {data.Resources && (
            <LinkSectionEditor
              title="Resources"
              links={data.Resources}
              onChange={(links) => updateField(['Resources'], links)}
            />
          )}

          {data.Contact && (
            <ContactSectionEditor
              contact={data.Contact}
              onChange={(contact) => updateField(['Contact'], contact)}
            />
          )}

          {data.Banner && (
            <BannerSectionEditor
              banner={data.Banner}
              bannerLink={data.BannerLink}
              bannerRedirect={data.BannerRedirect}
              onChange={(banner, link, redirect) => {
                updateField(['Banner'], banner);
                updateField(['BannerLink'], link);
                updateField(['BannerRedirect'], redirect);
              }}
            />
          )}

          {/* About.json sections */}
          {data.missionStatement && (
            <TextSectionEditor
              title="Mission Statement"
              content={data.missionStatement}
              onChange={(content: any) => updateField(['missionStatement'], content)}
            />
          )}

          {data.creed && (
            <CreedSectionEditor
              creed={data.creed}
              onChange={(creed: any) => updateField(['creed'], creed)}
            />
          )}

          {data.history && (
            <HistorySectionEditor
              history={data.history}
              onChange={(history: any) => updateField(['history'], history)}
            />
          )}

          {data.stateOfficers && (
            <StateOfficersEditor
              officers={data.stateOfficers}
              onChange={(officers: any) => updateField(['stateOfficers'], officers)}
            />
          )}

          {data.advisoryCouncil && (
            <AdvisoryCouncilEditor
              council={data.advisoryCouncil}
              onChange={(council: any) => updateField(['advisoryCouncil'], council)}
            />
          )}

          {data.documents && (
            <DocumentsEditor
              documents={data.documents}
              onChange={(documents: any) => updateField(['documents'], documents)}
            />
          )}

          {/* Events/Competitions sections */}
          {Array.isArray(data) && data.length > 0 && data[0]?.name && data[0]?.description && (
            <CompetitionsEditor
              competitions={data}
              onChange={(comps: any) => onChange(JSON.stringify(comps, null, 2))}
            />
          )}

          {data.events && (
            <EventsEditor
              events={data.events}
              onChange={(events: any) => updateField(['events'], events)}
            />
          )}

          {/* Support Us sections */}
          {data.sponsorshipLevels && (
            <SponsorshipEditor
              levels={data.sponsorshipLevels}
              onChange={(levels: any) => updateField(['sponsorshipLevels'], levels)}
            />
          )}

          {data.majorEvents && (
            <MajorEventsEditor
              events={data.majorEvents}
              onChange={(events: any) => updateField(['majorEvents'], events)}
            />
          )}

          {data.currentSponsors && (
            <CurrentSponsorsEditor
              sponsors={data.currentSponsors}
              onChange={(sponsors: any) => updateField(['currentSponsors'], sponsors)}
            />
          )}

          {data.paymentAddress && (
            <PaymentAddressEditor
              address={data.paymentAddress}
              onChange={(address: any) => updateField(['paymentAddress'], address)}
            />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Live Preview</h3>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 overflow-auto max-h-96">
          <JSONPreview data={data} />
        </div>
      </div>
    </div>
  );
}

function LinkSectionEditor({ 
  title, 
  links, 
  onChange 
}: { 
  title: string; 
  links: Array<{ title: string; url: string }>; 
  onChange: (links: any) => void;
}) {
  const addLink = () => {
    onChange([...links, { title: 'New Link', url: 'https://example.com' }]);
  };

  const removeLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, field: 'title' | 'url', value: string) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    onChange(newLinks);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">{title}</h3>
      </div>

      <div className="p-6 space-y-4">
        {links.map((link, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Title
                </label>
                <input
                  type="text"
                  value={link.title}
                  onChange={(e) => updateLink(index, 'title', e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 text-gray-900"
                  placeholder="e.g., High School Competitions"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <button
                  onClick={() => removeLink(index)}
                  className="w-full px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium text-sm transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <input
                type="url"
                value={link.url}
                onChange={(e) => updateLink(index, 'url', e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 text-gray-900"
                placeholder="e.g., https://example.com"
              />
            </div>
          </div>
        ))}

        <button
          onClick={addLink}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + Add Link
        </button>
      </div>
    </div>
  );
}

function ContactSectionEditor({ 
  contact, 
  onChange 
}: { 
  contact: any; 
  onChange: (contact: any) => void;
}) {
  const updateField = (field: string, value: any) => {
    onChange({ ...contact, [field]: value });
  };

  const updateAddress = (index: number, value: string) => {
    const newAddress = [...(contact.Address || [])];
    newAddress[index] = value;
    updateField('Address', newAddress);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">Contact Information</h3>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name/Title
          </label>
          <input
            type="text"
            value={contact.Name || ''}
            onChange={(e) => updateField('Name', e.target.value)}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
            placeholder="e.g., Bradley Hoffarth, ND TSA State Advisor"
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={contact.Email || ''}
            onChange={(e) => updateField('Email', e.target.value)}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
            placeholder="e.g., tsa@nd.gov"
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={contact.Phone || ''}
            onChange={(e) => updateField('Phone', e.target.value)}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
            placeholder="e.g., 7013283159"
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address
          </label>
          <div className="space-y-2">
            {(contact.Address || []).map((line: string, index: number) => (
              <input
                key={index}
                type="text"
                value={line}
                onChange={(e) => updateAddress(index, e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                placeholder={`Address line ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BannerSectionEditor({ 
  banner, 
  bannerLink, 
  bannerRedirect, 
  onChange 
}: { 
  banner: string; 
  bannerLink: string; 
  bannerRedirect: boolean; 
  onChange: (banner: string, link: string, redirect: boolean) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">Announcement Banner</h3>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <strong>Preview:</strong> <span className="italic">{banner || 'Your announcement will appear here'}</span>
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Banner Text
          </label>
          <input
            type="text"
            value={banner}
            onChange={(e) => onChange(e.target.value, bannerLink, bannerRedirect)}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
            placeholder="e.g., 2024-2025 TSA Chapter Affiliation Opens On: 09/09/2024"
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Banner Link
          </label>
          <input
            type="url"
            value={bannerLink}
            onChange={(e) => onChange(banner, e.target.value, bannerRedirect)}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
            placeholder="e.g., https://tsamembership.registermychapter.com/"
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="bannerRedirect"
              checked={bannerRedirect}
              onChange={(e) => onChange(banner, bannerLink, e.target.checked)}
              className="w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="bannerRedirect" className="ml-2 text-sm font-medium text-gray-700">
              Open link in new window
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigModal({ onSubmit, onClose }: { onSubmit: (config: any) => void; onClose: () => void }) {
  const [repoUrl, setRepoUrl] = useState('https://github.com/ItsNicko/North-Dakota-TSA-Website');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!repoUrl || !branch || !token) {
        setError('All fields are required');
        return;
      }

      onSubmit({ repoUrl, branch, token });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">GitHub Configuration</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repository URL
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-4 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-4 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full px-4 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Your token is stored in browser localStorage
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white border-2 border-gray-400 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnsavedChangesModal({ 
  onSave, 
  onDiscard, 
  onCancel 
}: { 
  onSave: () => void; 
  onDiscard: () => void; 
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Unsaved Changes</h2>
        <p className="text-gray-600 mb-6">
          You have unsaved changes. Do you want to save them before leaving this page?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-white border-2 border-gray-400 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function TextSectionEditor({ title, content, onChange }: { title: string; content: string; onChange: (content: string) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
            rows={3}
            placeholder="Enter content"
          />
        </div>
      </div>
    </div>
  );
}

function CreedSectionEditor({ creed, onChange }: { creed: string[]; onChange: (creed: string[]) => void }) {
  const updateCreed = (index: number, value: string) => {
    const newCreed = [...creed];
    newCreed[index] = value;
    onChange(newCreed);
  };

  const addCreedItem = () => {
    onChange([...creed, '']);
  };

  const removeCreedItem = (index: number) => {
    onChange(creed.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">Creed Items</h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {creed.map((item, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex gap-3 mb-3">
                <label className="text-sm font-medium text-gray-700">Item {index + 1}</label>
                <button
                  onClick={() => removeCreedItem(index)}
                  className="ml-auto px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded text-xs font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={item}
                onChange={(e) => updateCreed(index, e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                rows={2}
                placeholder="Creed item text"
              />
            </div>
          ))}
        </div>
        <button
          onClick={addCreedItem}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + Add Creed Item
        </button>
      </div>
    </div>
  );
}

function HistorySectionEditor({ history, onChange }: { history: any; onChange: (history: any) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">History</h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year Founded</label>
            <input
              type="number"
              value={history.founded}
              onChange={(e) => onChange({ ...history, founded: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
              placeholder="e.g., 1960"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Charter Status</label>
            <input
              type="text"
              value={history.chartered}
              onChange={(e) => onChange({ ...history, chartered: e.target.value })}
              className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
              placeholder="e.g., Chartered 1970"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={history.description}
              onChange={(e) => onChange({ ...history, description: e.target.value })}
              className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
              rows={3}
              placeholder="Historical description"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StateOfficersEditor({ officers, onChange }: { officers: any[]; onChange: (officers: any[]) => void }) {
  const GITHUB_PAGES_BASE = 'https://itsnicko.github.io/North-Dakota-TSA-Website';
  const [imageLoadStates, setImageLoadStates] = useState<{[key: number]: 'loading' | 'loaded' | 'error'}>({});
  
  // Normalize image URL to ensure it uses the GitHub Pages base URL
  const normalizeImageUrl = (url: string): string => {
    if (!url) return '';
    
    const GITHUB_PAGES_BASE = 'https://itsnicko.github.io/North-Dakota-TSA-Website';
    
    // Remove any leading/trailing whitespace
    url = url.trim();
    
    // If it's already a full GitHub Pages URL, check for double images folder
    if (url.startsWith('https://itsnicko.github.io/North-Dakota-TSA-Website/')) {
      // Fix double /images/images/ issue
      if (url.includes('/images/images/')) {
        return url.replace('/images/images/', '/images/');
      }
      return url;
    }
    
    // If it's a relative path like /images/..., convert to full URL
    if (url.startsWith('/images/')) {
      // Check for double /images/
      if (url.startsWith('/images/images/')) {
        return GITHUB_PAGES_BASE + url.replace('/images/images/', '/images/');
      }
      return GITHUB_PAGES_BASE + url;
    }
    
    // If it's just a filename or path like "images/filename", handle it
    if (url.startsWith('images/')) {
      // If it's "images/images/filename", remove the duplicate
      if (url.startsWith('images/images/')) {
        return `${GITHUB_PAGES_BASE}/${url.replace('images/images/', 'images/')}`;
      }
      return `${GITHUB_PAGES_BASE}/${url}`;
    }
    
    // If it's just a filename, create full URL
    if (!url.startsWith('http')) {
      return `${GITHUB_PAGES_BASE}/images/${url}`;
    }
    
    return url;
  };

  const updateOfficer = (index: number, field: string, value: string) => {
    const newOfficers = [...officers];
    newOfficers[index] = { ...newOfficers[index], [field]: value };
    onChange(newOfficers);
  };

  const removeOfficer = (index: number) => {
    onChange(officers.filter((_, i) => i !== index));
  };

  const addOfficer = () => {
    onChange([...officers, { name: '', position: '', school: '', image: '' }]);
  };

  const handleImageUpload = async (index: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const oldImageUrl = officers[index]?.image;
    let oldFileName = '';
    
    // Extract filename from old image URL if it exists
    if (oldImageUrl) {
      const match = oldImageUrl.match(/\/images\/(.+?)(?:\?|$)/);
      if (match) {
        oldFileName = match[1];
      }
    }
    
    if (oldFileName) {
      formData.append('oldFileName', oldFileName);
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        updateOfficer(index, 'image', data.path);
      } else {
        console.error('Upload failed:', data.error);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  const deleteImage = (index: number) => {
    const imageUrl = officers[index]?.image;
    if (imageUrl) {
      // Extract filename from URL
      const match = imageUrl.match(/\/images\/(.+?)(?:\?|$)/);
      if (match) {
        const fileName = match[1];
        fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName }),
        }).catch(err => console.error('Error deleting image:', err));
      }
    }
    updateOfficer(index, 'image', '');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">State Officers ({officers.length})</h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {officers.map((officer, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={officer.name || ''}
                    onChange={(e) => updateOfficer(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm font-semibold text-gray-900"
                    placeholder="Officer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                  <button
                    onClick={() => removeOfficer(index)}
                    className="w-full px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium text-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input
                    type="text"
                    value={officer.position || ''}
                    onChange={(e) => updateOfficer(index, 'position', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
                    placeholder="Position"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                  <input
                    type="text"
                    value={officer.school || ''}
                    onChange={(e) => updateOfficer(index, 'school', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
                    placeholder="School"
                  />
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border-2 border-gray-300 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                {officer.image && officer.image.trim() ? (
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="relative">
                      <img 
                        src={normalizeImageUrl(officer.image)} 
                        alt={officer.name}
                        className="h-20 w-20 object-cover rounded border-2 border-gray-300"
                        onLoad={() => setImageLoadStates({...imageLoadStates, [index]: 'loaded'})}
                        onError={() => setImageLoadStates({...imageLoadStates, [index]: 'error'})}
                      />
                      {imageLoadStates[index] === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center h-20 w-20 bg-red-50 rounded border-2 border-red-300 text-red-600 text-xs font-medium">
                          Failed
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteImage(index)}
                      className="px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded text-xs font-medium transition-colors self-start"
                    >
                      Delete Image
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mb-3">No image uploaded</p>
                )}
                <label className="block w-full px-3 py-2 bg-blue-100 border-2 border-dashed border-blue-400 rounded-lg text-center cursor-pointer hover:bg-blue-200 transition-colors text-sm font-medium text-blue-700 mb-2">
                  {officer.image ? 'Replace Photo' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(index, file);
                    }}
                    className="hidden"
                  />
                </label>
                {officer.image && officer.image.trim() && (
                  <button
                    onClick={() => {
                      const url = normalizeImageUrl(officer.image);
                      window.open(url, '_blank');
                    }}
                    className="w-full px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Open Image URL in New Tab
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addOfficer}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + Add Officer
        </button>
      </div>
    </div>
  );
}

function EventsEditor({ events, onChange }: { events: any[]; onChange: (events: any[]) => void }) {
  const updateEvent = (index: number, field: string, value: any) => {
    const newEvents = [...events];
    newEvents[index] = { ...newEvents[index], [field]: value };
    onChange(newEvents);
  };

  const updateNestedField = (index: number, path: string[], value: any) => {
    const newEvents = [...events];
    let current = newEvents[index];
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    onChange(newEvents);
  };

  const addEvent = () => {
    onChange([...events, { name: 'New Event', location: '', dates: { start: '', end: '' }, deadlines: [], notes: {} }]);
  };

  const removeEvent = (index: number) => {
    onChange(events.filter((_, i) => i !== index));
  };

  const addDeadline = (eventIndex: number) => {
    const newEvents = [...events];
    if (!newEvents[eventIndex].deadlines) {
      newEvents[eventIndex].deadlines = [];
    }
    newEvents[eventIndex].deadlines.push({ name: '', date: '', note: '' });
    onChange(newEvents);
  };

  const removeDeadline = (eventIndex: number, deadlineIndex: number) => {
    const newEvents = [...events];
    newEvents[eventIndex].deadlines.splice(deadlineIndex, 1);
    onChange(newEvents);
  };

  const updateDeadline = (eventIndex: number, deadlineIndex: number, field: string, value: string) => {
    const newEvents = [...events];
    newEvents[eventIndex].deadlines[deadlineIndex][field] = value;
    onChange(newEvents);
  };

  const addNote = (eventIndex: number) => {
    const newEvents = [...events];
    if (!newEvents[eventIndex].notes) {
      newEvents[eventIndex].notes = {};
    }
    // Find a unique key name
    let keyName = 'note_1';
    let count = 1;
    while (newEvents[eventIndex].notes[keyName]) {
      count++;
      keyName = `note_${count}`;
    }
    newEvents[eventIndex].notes[keyName] = '';
    onChange(newEvents);
  };

  const updateNote = (eventIndex: number, noteKey: string, value: string) => {
    const newEvents = [...events];
    newEvents[eventIndex].notes[noteKey] = value;
    onChange(newEvents);
  };

  const removeNote = (eventIndex: number, noteKey: string) => {
    const newEvents = [...events];
    delete newEvents[eventIndex].notes[noteKey];
    onChange(newEvents);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">Events/Conferences ({events.length})</h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-6 max-h-screen overflow-y-auto">
          {events.map((event, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
              {/* Event Header */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                  <input
                    type="text"
                    value={event.name || ''}
                    onChange={(e) => updateEvent(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg text-sm font-bold bg-white text-gray-900"
                    placeholder="Event name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                  <button
                    onClick={() => removeEvent(index)}
                    className="w-full px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium text-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Location */}
              {event.location !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={event.location || ''}
                    onChange={(e) => updateEvent(index, 'location', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg text-sm bg-white text-gray-900"
                    placeholder="Location"
                  />
                </div>
              )}

              {/* Single Date */}
              {event.date !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={event.date || ''}
                    onChange={(e) => updateEvent(index, 'date', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg text-sm bg-white text-gray-900"
                  />
                </div>
              )}

              {/* Date Range */}
              {event.dates && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={event.dates.start || ''}
                    onChange={(e) => updateNestedField(index, ['dates', 'start'], e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg text-sm bg-white text-gray-900"
                  />
                  <label className="text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    value={event.dates.end || ''}
                    onChange={(e) => updateNestedField(index, ['dates', 'end'], e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg text-sm bg-white text-gray-900"
                  />
                </div>
              )}

              {/* Deadlines Section */}
              <div className="border-t pt-4">
                <h5 className="text-sm font-semibold text-gray-800 mb-3">Deadlines</h5>
                <div className="space-y-3">
                  {(event.deadlines || []).map((deadline: any, dlIndex: number) => (
                    <div key={dlIndex} className="bg-white rounded p-3 border border-gray-300 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Deadline Name</label>
                          <input
                            type="text"
                            value={deadline.name || ''}
                            onChange={(e) => updateDeadline(index, dlIndex, 'name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900"
                            placeholder="Deadline name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
                          <button
                            onClick={() => removeDeadline(index, dlIndex)}
                            className="w-full px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded text-xs font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                        <input
                          type="date"
                          value={deadline.date || ''}
                          onChange={(e) => updateDeadline(index, dlIndex, 'date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
                        <input
                          type="text"
                          value={deadline.note || ''}
                          onChange={(e) => updateDeadline(index, dlIndex, 'note', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900"
                          placeholder="Additional note"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addDeadline(index)}
                  className="w-full mt-2 px-3 py-1 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded text-xs font-medium transition-colors"
                >
                  + Add Deadline
                </button>
              </div>

              {/* Notes Section */}
              <div className="border-t pt-4">
                <h5 className="text-sm font-semibold text-gray-800 mb-3">Notes</h5>
                <div className="space-y-3">
                  {Object.entries(event.notes || {}).map(([noteKey, noteValue]: [string, any]) => (
                    <div key={noteKey} className="bg-white rounded p-3 border border-gray-300 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Note Key</label>
                          <input
                            type="text"
                            value={noteKey}
                            disabled
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-100 text-gray-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
                          <button
                            onClick={() => removeNote(index, noteKey)}
                            className="w-full px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded text-xs font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Note Content</label>
                        <textarea
                          value={noteValue || ''}
                          onChange={(e) => updateNote(index, noteKey, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900"
                          rows={2}
                          placeholder="Note content"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addNote(index)}
                  className="w-full mt-2 px-3 py-1 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded text-xs font-medium transition-colors"
                >
                  + Add Note
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addEvent}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + Add Event
        </button>
      </div>
    </div>
  );
}

function DocumentsEditor({ documents, onChange }: { documents: any[]; onChange: (documents: any[]) => void }) {
  // Upload a document file to GitHub and update the documents list
  const handleDocumentUpload = async (index: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'pdfs');

    const oldUrl = documents[index]?.url;
    let oldFileName = '';
    if (oldUrl) {
      // extract filename from various possible formats
      const m1 = oldUrl.match(/\/pdfs\/(.+?)(?:\?|$)/);
      const m2 = oldUrl.match(/pdfs\/(.+?)(?:\?|$)/);
      if (m1) oldFileName = m1[1];
      else if (m2) oldFileName = m2[1];
      else if (!oldUrl.startsWith('http')) oldFileName = oldUrl.replace(/^\/+/, '');
    }

    if (oldFileName) formData.append('oldFileName', oldFileName);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        const newDocs = [...documents];
        newDocs[index] = { ...newDocs[index], url: data.path };
        onChange(newDocs);
      } else {
        console.error('Upload failed', data.error);
      }
    } catch (err) {
      console.error('Upload error', err);
    }
  };

  const deleteDocumentFile = async (index: number) => {
    const url = documents[index]?.url;
    if (!url) return;
    let fileName = '';
    const m1 = url.match(/\/pdfs\/(.+?)(?:\?|$)/);
    const m2 = url.match(/^pdfs\/(.+?)(?:\?|$)/);
    if (m1) fileName = m1[1];
    else if (m2) fileName = m2[1];
    else if (!url.startsWith('http')) fileName = url.replace(/^\/+/, '');

    if (fileName) {
      try {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName, folder: 'pdfs' }),
        });
      } catch (err) {
        console.error('Delete failed', err);
      }
    }

    const newDocs = documents.filter((_, i) => i !== index);
    onChange(newDocs);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">Documents ({documents.length})</h3>
      </div>
      <div className="p-6 space-y-4">
        {documents.map((doc, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={doc.title}
                onChange={(e) => {
                  const newDocs = [...documents];
                  newDocs[index] = { ...doc, title: e.target.value };
                  onChange(newDocs);
                }}
                className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                placeholder="Document title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={doc.url}
                  onChange={(e) => {
                    const newDocs = [...documents];
                    newDocs[index] = { ...doc, url: e.target.value };
                    onChange(newDocs);
                  }}
                  className="flex-1 px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                  placeholder="Document URL"
                />
                <label className="px-3 py-2 bg-blue-100 border-2 border-dashed border-blue-400 rounded-lg text-center cursor-pointer hover:bg-blue-200 transition-colors text-sm font-medium text-blue-700">
                  Upload
                  <input
                    type="file"
                    accept="*/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocumentUpload(index, file);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <button
              onClick={() => deleteDocumentFile(index)}
              className="w-full px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
            >
              Remove Document
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            const newDoc = { title: '', url: '' };
            onChange([...documents, newDoc]);
          }}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
        >
          + Add Document
        </button>
      </div>
    </div>
  );
}

function AdvisoryCouncilEditor({ council, onChange }: { council: any; onChange: (council: any) => void }) {
  const [currentMembers, setCurrentState] = useState<any[]>(() => {
    if (council?.current && Array.isArray(council.current)) {
      return council.current;
    }
    return [];
  });

  const [pastMembers, setPastState] = useState<any[]>(() => {
    if (council?.past && Array.isArray(council.past)) {
      return council.past;
    }
    return [];
  });

  // Sync with parent when council prop changes
  useEffect(() => {
    if (council?.current && Array.isArray(council.current)) {
      setCurrentState(council.current);
    }
    if (council?.past && Array.isArray(council.past)) {
      setPastState(council.past);
    }
  }, [council]);

  const updateCouncil = () => {
    onChange({
      current: currentMembers,
      past: pastMembers,
    });
  };

  const addCurrentMember = () => {
    const newMembers = [...currentMembers, { name: '', school: '', years: '' }];
    setCurrentState(newMembers);
    onChange({ current: newMembers, past: pastMembers });
  };

  const removeCurrentMember = (index: number) => {
    const newMembers = currentMembers.filter((_, i) => i !== index);
    setCurrentState(newMembers);
    onChange({ current: newMembers, past: pastMembers });
  };

  const updateCurrentMember = (index: number, field: string, value: string) => {
    const newMembers = [...currentMembers];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setCurrentState(newMembers);
    onChange({ current: newMembers, past: pastMembers });
  };

  const addPastMember = () => {
    const newMembers = [...pastMembers, { name: '', role: '', years: '' }];
    setPastState(newMembers);
    onChange({ current: currentMembers, past: newMembers });
  };

  const removePastMember = (index: number) => {
    const newMembers = pastMembers.filter((_, i) => i !== index);
    setPastState(newMembers);
    onChange({ current: currentMembers, past: newMembers });
  };

  const updatePastMember = (index: number, field: string, value: string) => {
    const newMembers = [...pastMembers];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setPastState(newMembers);
    onChange({ current: currentMembers, past: newMembers });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">Advisory Council</h3>
      </div>
      <div className="p-6 space-y-6">
        {/* Current Members Section */}
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-4">Current Members</h4>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {currentMembers.map((member, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={member?.name || ''}
                      onChange={(e) => updateCurrentMember(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                      placeholder="Council member name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                    <button
                      onClick={() => removeCurrentMember(index)}
                      className="w-full px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium text-sm transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                    <input
                      type="text"
                      value={member?.school || ''}
                      onChange={(e) => updateCurrentMember(index, 'school', e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                      placeholder="School"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Years</label>
                    <input
                      type="text"
                      value={member?.years || ''}
                      onChange={(e) => updateCurrentMember(index, 'years', e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                      placeholder="e.g., 2023-2025"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addCurrentMember}
            className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add Current Member
          </button>
        </div>

        {/* Past Members Section */}
        <div className="border-t pt-6">
          <h4 className="text-md font-semibold text-gray-800 mb-4">Past Members</h4>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {pastMembers.map((member, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={member?.name || ''}
                      onChange={(e) => updatePastMember(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                      placeholder="Council member name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                    <button
                      onClick={() => removePastMember(index)}
                      className="w-full px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium text-sm transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <input
                      type="text"
                      value={member?.role || ''}
                      onChange={(e) => updatePastMember(index, 'role', e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                      placeholder="e.g., Chair Person"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Years</label>
                    <input
                      type="text"
                      value={member?.years || ''}
                      onChange={(e) => updatePastMember(index, 'years', e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                      placeholder="e.g., 2021-2022"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addPastMember}
            className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add Past Member
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitionsEditor({ competitions, onChange }: { competitions: any[]; onChange: (comps: any[]) => void }) {
  const addCompetition = () => {
    onChange([...competitions, { name: 'New Competition', description: '' }]);
  };

  const removeCompetition = (index: number) => {
    onChange(competitions.filter((_, i) => i !== index));
  };

  const updateCompetition = (index: number, field: 'name' | 'description', value: string) => {
    const newComps = [...competitions];
    newComps[index] = { ...newComps[index], [field]: value };
    onChange(newComps);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h3 className="text-lg font-bold">Competitions ({competitions.length})</h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {competitions.map((comp, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={comp.name || ''}
                    onChange={(e) => updateCompetition(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm font-bold text-gray-900"
                    placeholder="Competition name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                  <button
                    onClick={() => removeCompetition(index)}
                    className="w-full px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium text-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={comp.description || ''}
                  onChange={(e) => updateCompetition(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
                  rows={2}
                  placeholder="Competition description"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addCompetition}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + Add Competition
        </button>
      </div>
    </div>
  );
}

function SponsorshipEditor({ levels, onChange }: { levels: any[]; onChange: (levels: any[]) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="bg-blue-600 text-white px-6 py-3 rounded-t-lg">
        <h4 className="font-medium">Sponsorship Levels ({levels.length})</h4>
      </div>
      <div className="p-6 space-y-4">
        {levels.map((level, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tier Name
              </label>
              <input
                type="text"
                value={level.name || ''}
                onChange={(e) => {
                  const newLevels = [...levels];
                  newLevels[index] = { ...level, name: e.target.value };
                  onChange(newLevels);
                }}
                className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
                placeholder="e.g., Gold, Silver, Bronze"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price
              </label>
              <input
                type="number"
                value={level.price || 0}
                onChange={(e) => {
                  const newLevels = [...levels];
                  newLevels[index] = { ...level, price: Number(e.target.value) };
                  onChange(newLevels);
                }}
                className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
                placeholder="Price amount"
              />
            </div>
            <button
              onClick={() => {
                const newLevels = levels.filter((_, i) => i !== index);
                onChange(newLevels);
              }}
              className="w-full px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
            >
              Remove Level
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            const newLevel = { name: '', price: 0 };
            onChange([...levels, newLevel]);
          }}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
        >
          + Add Sponsorship Level
        </button>
      </div>
    </div>
  );
}

function MajorEventsEditor({ events, onChange }: { events: any[]; onChange: (events: any[]) => void }) {
  const updateEvent = (index: number, field: string, value: any) => {
    const newEvents = [...events];
    newEvents[index] = { ...newEvents[index], [field]: value };
    onChange(newEvents);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="bg-orange-600 text-white px-6 py-3 rounded-t-lg">
        <h4 className="font-medium">Major Events ({events.length})</h4>
      </div>
      <div className="p-6 space-y-4">
        {events.map((event, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Name
              </label>
              <input
                type="text"
                value={event.name || ''}
                onChange={(e) => updateEvent(index, 'name', e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm font-semibold text-gray-900"
                placeholder="Event name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={event.description || ''}
                onChange={(e) => updateEvent(index, 'description', e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
                placeholder="Description"
              />
            </div>
            {event.date !== undefined && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={event.date || ''}
                  onChange={(e) => updateEvent(index, 'date', e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
                />
              </div>
            )}
            <button
              onClick={() => {
                const newEvents = events.filter((_, i) => i !== index);
                onChange(newEvents);
              }}
              className="w-full px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
            >
              Remove Event
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            const newEvent = { name: '', description: '', date: '' };
            onChange([...events, newEvent]);
          }}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
        >
          + Add Event
        </button>
      </div>
    </div>
  );
}

function CurrentSponsorsEditor({ sponsors, onChange }: { sponsors: any; onChange: (sponsors: any) => void }) {
  const updateLevel = (level: string, value: string[]) => {
    onChange({ ...sponsors, [level]: value });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="bg-blue-600 text-white px-6 py-3 rounded-t-lg">
        <h4 className="font-medium">Current Sponsors</h4>
      </div>
      <div className="p-6 space-y-4">
        {Object.entries(sponsors).map(([level, names]: any) => (
          <div key={level} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">{level} Sponsors</label>
            <textarea
              value={Array.isArray(names) ? names.join(', ') : ''}
              onChange={(e) => updateLevel(level, e.target.value.split(',').map(n => n.trim()))}
              className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
              rows={3}
              placeholder="Comma-separated sponsor names"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentAddressEditor({ address, onChange }: { address: any; onChange: (address: any) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="bg-blue-600 text-white px-6 py-3 rounded-t-lg">
        <h4 className="font-medium">Payment Address</h4>
      </div>
      <div className="p-6 space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organization
          </label>
          <input
            type="text"
            value={address.organization || ''}
            onChange={(e) => onChange({ ...address, organization: e.target.value })}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
            placeholder="Organization name"
          />
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PO Box
          </label>
          <input
            type="text"
            value={address.poBox || ''}
            onChange={(e) => onChange({ ...address, poBox: e.target.value })}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
            placeholder="PO Box number"
          />
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City, State ZIP
          </label>
          <input
            type="text"
            value={address.city || ''}
            onChange={(e) => onChange({ ...address, city: e.target.value })}
            className="w-full px-3 py-2 bg-white border-2 border-gray-400 rounded-lg text-sm text-gray-900"
            placeholder="e.g., Chicago, IL 60601"
          />
        </div>
      </div>
    </div>
  );
}

function JSONPreview({ data }: { data: any }) {
  const normalizeImageUrl = (url: string): string => {
    if (!url) return '';
    const GITHUB_PAGES_BASE = 'https://itsnicko.github.io/North-Dakota-TSA-Website';
    if (url.startsWith('https://itsnicko.github.io/North-Dakota-TSA-Website/images/')) {
      return url;
    }
    if (url.startsWith('/images/')) {
      return GITHUB_PAGES_BASE + url;
    }
    if (!url.startsWith('http')) {
      return `${GITHUB_PAGES_BASE}/images/${url}`;
    }
    return url;
  };

  return (
    <div className="space-y-4 text-sm">
      {data.Banner && (
        <div className="bg-blue-600 text-white border-l-4 border-blue-900 p-3 rounded font-semibold">
          {data.Banner}
        </div>
      )}

      {data.missionStatement && (
        <div className="bg-gray-50 border-l-4 border-blue-600 p-3 rounded">
          <p className="font-bold text-gray-800 mb-1">Mission:</p>
          <p className="text-gray-700 text-xs leading-relaxed">{data.missionStatement}</p>
        </div>
      )}

      {data.Contact && (
        <div className="bg-gray-50 border-l-4 border-green-600 p-3 rounded">
          <p className="font-bold text-gray-800 mb-1">Contact:</p>
          <p className="text-gray-700 text-xs font-semibold">{data.Contact.Name}</p>
          <p className="text-gray-700 text-xs">{data.Contact.Email}</p>
        </div>
      )}

      {data.QuickLinks && (
        <div className="bg-gray-50 border-l-4 border-purple-600 p-3 rounded">
          <p className="font-bold text-gray-800 mb-1">Quick Links:</p>
          <ul className="text-xs text-purple-700 space-y-1">
            {data.QuickLinks.map((link: any, i: number) => (
              <li key={i}>• {link.title}</li>
            ))}
          </ul>
        </div>
      )}

      {data.events && (
        <div className="bg-gray-50 border-l-4 border-green-600 p-3 rounded">
          <p className="font-bold text-gray-800 mb-1">Events ({data.events.length})</p>
          <ul className="text-xs text-gray-700 space-y-1 max-h-24 overflow-y-auto">
            {data.events.map((event: any, i: number) => (
              <li key={i}>• {event.name}</li>
            ))}
          </ul>
        </div>
      )}

      {data.stateOfficers && (
        <div className="bg-gray-50 border-l-4 border-blue-600 p-3 rounded">
          <p className="font-bold text-gray-800 mb-2">Officers ({data.stateOfficers.length})</p>
          <div className="flex flex-wrap gap-3 max-h-32 overflow-y-auto">
            {data.stateOfficers.map((officer: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                {officer.image ? (
                  <img 
                    src={normalizeImageUrl(officer.image)} 
                    alt={officer.name}
                    className="h-12 w-12 rounded object-cover border border-gray-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect fill=%22%23e5e7eb%22 width=%2248%22 height=%2248%22/%3E%3C/svg%3E';
                    }}
                  />
                ) : (
                  <div className="h-12 w-12 rounded border border-gray-300 bg-gray-200"></div>
                )}
                <div className="text-xs">
                  <p className="font-semibold text-gray-800">{officer.name}</p>
                  <p className="text-gray-600">{officer.position}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(data) && data.length > 0 && data[0]?.name && (
        <div className="bg-gray-50 border-l-4 border-orange-600 p-3 rounded">
          <p className="font-bold text-gray-800 mb-1">Competitions ({data.length})</p>
          <ul className="text-xs text-gray-700 space-y-1 max-h-24 overflow-y-auto">
            {data.map((comp: any, i: number) => (
              <li key={i}>• {comp.name}</li>
            ))}
          </ul>
        </div>
      )}

      {data.sponsorshipLevels && (
        <div className="bg-gray-50 border-l-4 border-red-600 p-3 rounded">
          <p className="font-bold text-gray-800 mb-1">Sponsorship Tiers</p>
          <ul className="text-xs text-gray-700 space-y-1">
            {data.sponsorshipLevels.map((level: any, i: number) => (
              <li key={i} className="font-semibold">• {level.name} <span className="font-normal text-gray-600">${level.price}</span></li>
            ))}
          </ul>
        </div>
      )}

      {data.majorEvents && (
        <div className="bg-gray-50 border-l-4 border-orange-600 p-3 rounded">
          <p className="font-bold text-gray-800 mb-1">Major Events ({data.majorEvents.length})</p>
          <ul className="text-xs text-gray-700 space-y-1">
            {data.majorEvents.map((event: any, i: number) => (
              <li key={i}>• {event.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AboutVisualEditor({ page, onChange }: { page: EditorPage; onChange: (content: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const parsed = JSON.parse(page.content);
      setData(parsed);
      setError('');
    } catch (err) {
      setError('Invalid JSON format');
      setData(null);
    }
  }, [page.content]);

  const updateField = (path: string[], value: any) => {
    if (!data) return;
    
    const newData = JSON.parse(JSON.stringify(data));
    let current = newData;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    
    setData(newData);
    onChange(JSON.stringify(newData, null, 2));
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {data.missionStatement && (
        <TextSectionEditor
          title="Mission Statement"
          content={data.missionStatement}
          onChange={(content: any) => updateField(['missionStatement'], content)}
        />
      )}

      {data.creed && (
        <CreedSectionEditor
          creed={data.creed}
          onChange={(creed: any) => updateField(['creed'], creed)}
        />
      )}

      {data.history && (
        <HistorySectionEditor
          history={data.history}
          onChange={(history: any) => updateField(['history'], history)}
        />
      )}

      {data.stateOfficers && (
        <StateOfficersEditor
          officers={data.stateOfficers}
          onChange={(officers: any) => updateField(['stateOfficers'], officers)}
        />
      )}

      {data.advisoryCouncil && (
        <AdvisoryCouncilEditor
          council={data.advisoryCouncil}
          onChange={(council: any) => updateField(['advisoryCouncil'], council)}
        />
      )}

      {data.documents && (
        <DocumentsEditor
          documents={data.documents}
          onChange={(documents: any) => updateField(['documents'], documents)}
        />
      )}
    </div>
  );
}


