import { Thought, View, User } from './types';
import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { ThoughtCard } from './components/ThoughtCard';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Trash2, AlertCircle, Info } from 'lucide-react';
import { api } from './services/api';

export default function App() {
  const [view, setView] = useState<View>('discovery');
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [newThought, setNewThought] = useState({ title: '', content: '' });
  const [editingPost, setEditingPost] = useState<Thought | null>(null);
  const [categories, setCategories] = useState<{ name: string }[]>([]);
  const [availableTags, setAvailableTags] = useState<{ name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState<'idle' | 'loading' | 'success'>('idle');
  const [curtain, setCurtain] = useState<'none' | 'down' | 'up'>('none');
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' } | null>(null);

  const notify = (message: string, type: 'error' | 'info' = 'info') => setNotification({ message, type });

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); }
      catch { localStorage.removeItem('user'); }
    }
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const data = await api.getPosts();
        setThoughts(data);
        setError(null);
      } catch (err: any) {
        setError(`Failed to load thoughts: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    if (view === 'discovery' || view === 'profile') fetchPosts();
  }, [view]);

  useEffect(() => {
    if (view === 'compose') {
      Promise.all([api.getCategories(), api.getTags()]).then(([cats, tags]) => {
        setCategories(cats);
        setAvailableTags(tags);
        if (!editingPost && cats.length > 0) setSelectedCategory(cats[0].name);
      });
    }
  }, [view]);

  const handlePublish = async () => {
    if (!newThought.content || !newThought.title || !selectedCategory || selectedTags.length === 0) {
      notify('Please fill in title, content, category and at least one tag.', 'info');
      return;
    }

    const payload = {
      title: newThought.title,
      content: newThought.content,
      status: 'PUBLISHED' as const,
      category: { name: selectedCategory },
      tags: selectedTags.map(name => ({ name })),
    };

    setPublishing('loading');
    try {
      if (editingPost) {
        const updated = await api.updatePost(editingPost.id, payload);
        setThoughts(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await api.createPost(payload);
        setThoughts(prev => [created, ...prev]);
      }

      setPublishing('success');
      await new Promise(r => setTimeout(r, 700));
      setCurtain('down');
      await new Promise(r => setTimeout(r, 400));
      setView('discovery');
      setNewThought({ title: '', content: '' });
      setSelectedTags([]);
      setEditingPost(null);
      setPublishing('idle');
      setCurtain('up');
      await new Promise(r => setTimeout(r, 400));
      setCurtain('none');
    } catch (err) {
      console.error('Failed to publish:', err);
      setPublishing('idle');
      notify('Failed to publish. Please try again.', 'error');
    }
  };

  const handleEdit = (thought: Thought) => {
    setEditingPost(thought);
    setNewThought({ title: thought.title, content: thought.content });
    setSelectedCategory(thought.category.name);
    setSelectedTags(thought.tags.map(t => t.name));
    setView('compose');
  };

  const handleDelete = (id: string) => {
    const post = thoughts.find(t => t.id === id);
    if (post) setDeleteConfirm({ id, title: post.title });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.deletePost(deleteConfirm.id);
      setThoughts(prev => prev.filter(t => t.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete:', err);
      notify('Failed to delete post.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogin = async (credentials: { email: string; password: string }) => {
    const data = await api.login(credentials);
    setUser(data.user);
  };

  const handleRegister = async (data: { username: string; email: string; password: string }) => {
    const result = await api.register(data);
    setUser(result.user);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setView('discovery');
  };

  const handleViewChange = (newView: View) => {
    if ((newView === 'compose' || newView === 'profile') && !user) {
      notify('Please log in to access this feature.', 'info');
      setView('discovery');
      return;
    }
    if (newView !== 'compose') {
      setEditingPost(null);
      setNewThought({ title: '', content: '' });
      setSelectedTags([]);
    }
    setView(newView);
  };

  return (
      <div className="min-h-screen bg-white relative">

        {/* Curtain transition */}
        <AnimatePresence>
          {curtain !== 'none' && (
              <motion.div
                  key="curtain"
                  className="fixed inset-0 z-[500] bg-zinc-950 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: curtain === 'down' ? 1 : 0 }}
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
              />
          )}
        </AnimatePresence>

        {/* Notification modal */}
        <AnimatePresence>
          {notification && (
              <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setNotification(null)}
                  className="fixed inset-0 z-[200] flex items-center justify-center px-6 bg-black/20 backdrop-blur-xl cursor-pointer"
              >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-sm bg-white border border-black/10 p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] cursor-default"
                >
                  <div className={`w-12 h-12 flex items-center justify-center mb-6 ${notification.type === 'error' ? 'bg-red-50 border border-red-100' : 'bg-zinc-50 border border-zinc-100'}`}>
                    {notification.type === 'error' ? <AlertCircle size={20} className="text-red-500" /> : <Info size={20} className="text-zinc-500" />}
                  </div>
                  <h2 className="text-xl font-black tracking-tighter mb-2">
                    {notification.type === 'error' ? 'Something went wrong.' : 'Heads up.'}
                  </h2>
                  <p className="text-sm text-black/50 mb-8 leading-relaxed">{notification.message}</p>
                  <button onClick={() => setNotification(null)} className="w-full bg-black text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all">
                    Got it
                  </button>
                </motion.div>
              </motion.div>
          )}
        </AnimatePresence>

        {/* Delete confirmation modal */}
        <AnimatePresence>
          {deleteConfirm && (
              <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setDeleteConfirm(null)}
                  className="fixed inset-0 z-[200] flex items-center justify-center px-6 bg-black/20 backdrop-blur-xl cursor-pointer"
              >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-sm bg-white border border-black/10 p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] cursor-default"
                >
                  <div className="w-12 h-12 bg-red-50 border border-red-100 flex items-center justify-center mb-6">
                    <Trash2 size={20} className="text-red-500" />
                  </div>
                  <h2 className="text-xl font-black tracking-tighter mb-2">Delete this post?</h2>
                  <p className="text-sm text-black/50 mb-1 font-medium line-clamp-2">"{deleteConfirm.title}"</p>
                  <p className="text-xs text-black/30 uppercase tracking-widest mb-8">This action cannot be undone.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-black/20 px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black/5 transition-all">
                      Cancel
                    </button>
                    <button onClick={confirmDelete} disabled={deleting} className="flex-1 bg-red-500 text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50">
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
          )}
        </AnimatePresence>

        <TopBar
            showPublish={view === 'compose'}
            onPublish={handlePublish}
            publishing={publishing}
            currentView={view}
            onViewChange={handleViewChange}
            user={user}
            onLogout={handleLogout}
            onLogin={handleLogin}
            onRegister={handleRegister}
            isEditing={!!editingPost}
        />

        <main className="pt-16 max-w-5xl mx-auto">
          <AnimatePresence mode="wait">

            {view === 'discovery' && (
                <motion.div
                    key="discovery"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                  <div className="px-4 py-3 border-b border-black/8">
                    <h1 className="text-[17px] font-black tracking-tight">Home</h1>
                  </div>

                  {loading ? (
                      <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <Loader2 className="animate-spin text-black/20" size={28} />
                      </div>
                  ) : error ? (
                      <div className="px-4 py-12 text-center">
                        <p className="text-sm font-bold text-black mb-2">Cannot reach backend.</p>
                        <p className="text-xs text-black/40 mb-6">{error}</p>
                        <button onClick={() => window.location.reload()} className="text-xs font-bold uppercase tracking-widest underline underline-offset-4">
                          Retry
                        </button>
                      </div>
                  ) : thoughts.length === 0 ? (
                      <div className="py-32 text-center">
                        <p className="text-sm text-black/30">No posts yet.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                        <AnimatePresence initial={false}>
                          {thoughts.map((thought) => (
                              <motion.div
                                  key={thought.id}
                                  className="h-full"
                                  exit={{ opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
                                  transition={{ duration: 0.25 }}
                              >
                                <ThoughtCard
                                    thought={thought}
                                    currentUser={user}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                              </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                  )}
                </motion.div>
            )}

            {view === 'compose' && (
                <motion.div
                    key="compose"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="px-4 py-8 max-w-xl mx-auto"
                >
                  <div className="mb-10">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-black/30">
                  {editingPost ? 'Edit Entry' : 'New Entry'}
                </span>
                    <h1 className="mt-3 text-3xl font-extrabold tracking-tighter text-black">
                      {editingPost ? 'Update your thought.' : "What's on your mind?"}
                    </h1>
                  </div>

                  <div className="space-y-6">
                    <input
                        type="text"
                        placeholder="Title..."
                        value={newThought.title}
                        onChange={(e) => setNewThought({ ...newThought, title: e.target.value })}
                        className="w-full border border-black/15 px-4 py-3 text-xl font-bold text-black placeholder-zinc-300 outline-none focus:border-black transition-colors"
                    />
                    <textarea
                        placeholder="Start writing..."
                        value={newThought.content}
                        onChange={(e) => setNewThought({ ...newThought, content: e.target.value })}
                        className="w-full min-h-[300px] border border-black/15 px-4 py-3 text-base leading-relaxed text-zinc-700 placeholder-zinc-300 resize-none outline-none focus:border-black transition-colors"
                    />
                  </div>

                  <div className="mt-10 space-y-6">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-black/40 block mb-3">Category</span>
                      <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full border border-black/15 p-3 text-sm outline-none focus:border-black transition-colors"
                      >
                        <option value="">Select a category...</option>
                        {categories.map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-black/40 block mb-3">Tags</span>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map(tag => (
                            <button
                                key={tag.name}
                                type="button"
                                onClick={() => setSelectedTags(prev =>
                                    prev.includes(tag.name) ? prev.filter(t => t !== tag.name) : [...prev, tag.name]
                                )}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${selectedTags.includes(tag.name) ? 'bg-black text-white border-black' : 'border-black/20 text-black/60 hover:border-black/40'}`}
                            >
                              #{tag.name}
                            </button>
                        ))}
                        {availableTags.length === 0 && (
                            <p className="text-xs text-black/30">No tags yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-2 text-xs text-black/30">
                      <span><Sparkles size={12} className="inline mr-1" />{newThought.content.split(/\s+/).filter(Boolean).length} words</span>
                      <span>~{Math.max(1, Math.ceil(newThought.content.split(/\s+/).filter(Boolean).length / 200))} min read</span>
                    </div>
                  </div>
                </motion.div>
            )}

            {view === 'profile' && (
                <motion.div
                    key="profile"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                  <div className="px-4 py-6 border-b border-black/8">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-white text-xl font-black">
                        {user?.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <h1 className="text-xl font-black tracking-tight">{user?.username || 'User'}</h1>
                        <p className="text-sm text-black/40">{user?.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-sm">
                  <span>
                    <strong className="font-black">{thoughts.filter(t => t.author.email === user?.email).length}</strong>
                    <span className="text-black/40 ml-1">Posts</span>
                  </span>
                    </div>
                  </div>

                  {loading ? (
                      <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-black/20" size={24} />
                      </div>
                  ) : thoughts.filter(t => t.author.email === user?.email).length === 0 ? (
                      <p className="text-center text-black/30 py-16 text-sm">No posts yet.</p>
                  ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                        <AnimatePresence initial={false}>
                          {thoughts
                              .filter(t => t.author.email === user?.email)
                              .map(thought => (
                                  <motion.div
                                      key={thought.id}
                                      className="h-full"
                                      exit={{ opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
                                      transition={{ duration: 0.25 }}
                                  >
                                    <ThoughtCard
                                        thought={thought}
                                        currentUser={user}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                    />
                                  </motion.div>
                              ))}
                        </AnimatePresence>
                      </div>
                  )}
                </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
  );
}
