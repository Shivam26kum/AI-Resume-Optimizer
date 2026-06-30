import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import * as html2pdf from 'html2pdf.js'; // Robust CommonJS bundle matching rules for Vite
import { 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  Copy, 
  Check,
  RefreshCw,
  History,
  Calendar,
  Layers,
  Terminal,
  Zap,
  MessageSquare,
  Lock,
  Mail,
  User,
  LogOut,
  Download,
  Eye as ViewIcon,
  Menu,
  X,
  MoreVertical,
  Trash2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  // Authentication States
  const [token, setToken] = useState(localStorage.getItem('userToken') || null);
  const [username, setUsername] = useState(localStorage.getItem('userName') || '');
  const [isRegister, setIsRegister] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Core App States
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Responsive Navigation & UI Action States
  const [activeTab, setActiveTab] = useState('chat');
  const [isMobileVaultOpen, setIsMobileVaultOpen] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState(null); // Tracks which 3-dots menu is currently visible
  const resumePrintRef = useRef(null);

  const getAuthConfig = useCallback(() => {
    return { headers: { Authorization: `Bearer ${token}` } };
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    setToken(null);
    setUsername('');
    setHistoryList([]);
    setResults(null);
    setFile(null);
    setJobDescription('');
    setShowPassword(false);
    setActiveTab('chat');
    setIsMobileVaultOpen(false);
    setActiveDropdownId(null);
  };

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/history`, getAuthConfig());
      setHistoryList(response.data);
    } catch (error) {
      console.error("Failed to load history metrics:", error);
      if (error.response?.status === 401) handleLogout();
    } finally {
      setHistoryLoading(false);
    }
  }, [token, getAuthConfig]);

  useEffect(() => {
    if (token) fetchHistory();
  }, [token, fetchHistory]);

  // Global click tracking listener to dismiss 3-dots menus when clicking away
  useEffect(() => {
    const closeDropdowns = () => setActiveDropdownId(null);
    window.addEventListener('click', closeDropdowns);
    return () => window.removeEventListener('click', closeDropdowns);
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isRegister ? 'register' : 'login';
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/${endpoint}`, authForm);
      const { token: receivedToken, username: receivedName } = response.data;
      localStorage.setItem('userToken', receivedToken);
      localStorage.setItem('userName', receivedName);
      setToken(receivedToken);
      setUsername(receivedName);
      setAuthForm({ username: '', email: '', password: '' });
      setShowPassword(false);
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Authentication failed');
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles[0]) setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: !token
  });

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file || !jobDescription.trim()) return;

    setLoading(true);
    setResults(null);
    setActiveTab('chat');

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobDescription', jobDescription);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/analyze`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      setResults(response.data);
      fetchHistory();
    } catch (error) {
      alert(error.response?.data?.error || "Pipeline processing failure.");
    } finally {
      setLoading(false);
    }
  };

  const loadPastScan = async (id) => {
    setLoading(true);
    setIsMobileVaultOpen(false);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/history/${id}`, getAuthConfig());
      setResults(response.data);
      setJobDescription(response.data.jobDescription || '');
      setFile({ name: response.data.fileName });
      setActiveTab('chat');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Secure API connection method to handle vault purges
  const handleDeleteScan = async (e, id) => {
    e.stopPropagation(); // Prevents loading the scan when clicking delete
    if (!window.confirm("Are you sure you want to permanently delete this optimization scan?")) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/history/${id}`, getAuthConfig());
      
      // If the currently viewed scan is the one being deleted, reset the workspace view
      if (results && results._id === id) {
        setResults(null);
        setFile(null);
        setJobDescription('');
      }
      
      fetchHistory();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to remove item from vault.");
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleExportPDF = () => {
    const element = resumePrintRef.current;
    if (!element) return;

    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5],
      filename:     `Optimized_Resume_${username || 'User'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false, letterRendering: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    const pdfEngine = html2pdf.default || html2pdf;
    pdfEngine().set(opt).from(element).save();
  };

  const renderOptimizedResumeBody = () => {
    if (!results || !results.resumeRawText) {
      return <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Raw layout text unavailable. Please complete a fresh scan.</p>;
    }

    let dynamicBodyText = results.resumeRawText;

    results.actionableImprovements?.forEach((item) => {
      if (item.currentText && item.suggestedText) {
        const cleanCurrent = item.currentText.trim();
        if (dynamicBodyText.includes(cleanCurrent)) {
          dynamicBodyText = dynamicBodyText.split(cleanCurrent).join(
            `__OPTIMIZED_START__${item.suggestedText}__OPTIMIZED_END__`
          );
        }
      }
    });

    return dynamicBodyText.split('\n').map((line, idx) => {
      if (!line.trim()) return <div key={idx} className="h-2" />;

      if (line.includes('__OPTIMIZED_START__')) {
        const cleanLine = line
          .replace(/__OPTIMIZED_START__/g, '')
          .replace(/__OPTIMIZED_END__/g, '');
        return (
          <p 
            key={idx} 
            style={{ 
              color: '#065f46', 
              backgroundColor: '#ecfdf5', 
              fontWeight: '500', 
              borderLeft: '2px solid #10b981', 
              paddingLeft: '8px', 
              margin: '4px 0', 
              borderRadius: '4px',
              userSelect: 'none'
            }}
          >
            {cleanLine}
          </p>
        );
      }

      return <p key={idx} style={{ color: '#1e293b', margin: '2px 0', textAlign: 'justify' }}>{line}</p>;
    });
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden relative">
      
      {/* AUTH OVERLAY MODAL */}
      {!token && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden mx-auto">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="text-center space-y-1">
              <div className="mx-auto w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-500 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center mb-2">
                <Sparkles size={20} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">Welcome to ResuAI</h2>
              <p className="text-xs text-slate-400">Unlock private optimization diagnostics tracking</p>
            </div>
            <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button type="button" onClick={() => { setIsRegister(false); setAuthError(''); setShowPassword(false); }} className={`py-1.5 text-xs font-semibold rounded-md transition ${!isRegister ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Login</button>
              <button type="button" onClick={() => { setIsRegister(true); setAuthError(''); setShowPassword(false); }} className={`py-1.5 text-xs font-semibold rounded-md transition ${isRegister ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Sign Up</button>
            </div>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input type="text" required value={authForm.username} onChange={(e) => setAuthForm({...authForm, username: e.target.value})} placeholder="shivam_dev" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition" />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} placeholder="name@domain.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Security Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete="current-password" value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {authError && <p className="text-xs text-rose-400 font-medium font-mono text-center pt-1">{authError}</p>}
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase text-xs tracking-wider rounded-xl transition shadow-lg active:scale-[0.98]">
                {isRegister ? 'Create Secure Account' : 'Authenticate Identity'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="border-b border-slate-800/60 bg-slate-900/40 backdrop-blur shrink-0 px-4 sm:px-6 py-4 flex justify-between items-center z-40">
        <div className="flex items-center gap-3">
          {token && (
            <button 
              type="button" 
              onClick={() => setIsMobileVaultOpen(!isMobileVaultOpen)} 
              className="lg:hidden p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition cursor-pointer"
              title="Toggle Audit Vault"
            >
              {isMobileVaultOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          )}
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <Sparkles size={20} />
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center">
            ResuAI <span className="hidden sm:inline bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent text-xs font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-md ml-2 border border-indigo-500/20">Optimizer Engine</span>
          </h1>
        </div>
        
        {token && (
          <div className="flex items-center gap-2 sm:gap-4 animate-fade-in">
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 py-1.5 pl-2 pr-3 sm:pr-4 rounded-xl shadow-inner transition-all duration-300">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm shrink-0">
                {username.charAt(0)}
              </div>
              <div className="flex flex-col text-left max-w-[80px] sm:max-w-[120px]">
                <span className="text-xs font-semibold text-slate-200 tracking-wide capitalize truncate">{username}</span>
                <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-1 font-mono leading-none mt-0.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0" /> <span className="hidden xs:inline">Active</span> Workspace
                </span>
              </div>
            </div>
            <button type="button" onClick={handleLogout} className="p-2.5 bg-slate-900 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/30 rounded-xl transition cursor-pointer">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </header>

      {/* WORKSPACE MAIN CONTAINER */}
      <div className="flex-1 w-full p-4 sm:p-6 flex flex-col lg:flex-row gap-6 overflow-y-auto lg:overflow-hidden relative scrollbar-none">
        
        {/* PANEL 1: DESKTOP VAULT INDEX & MOBILE OVERLAY SLIDE-OUT */}
        <aside className={`
          fixed inset-y-0 left-0 z-30 w-[280px] bg-slate-900 border-r border-slate-800 p-4 flex flex-col overflow-hidden transition-transform duration-300 transform mt-[73px] lg:mt-0
          lg:static lg:w-[22%] lg:bg-slate-900/40 lg:border lg:border-slate-800/60 lg:rounded-2xl lg:transform-none
          ${isMobileVaultOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2 px-1">
            <History size={14} className="text-indigo-400" /> Audit Vault
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {historyLoading && (
              <div className="text-center py-12 text-xs text-slate-500 animate-pulse">Loading vault logs...</div>
            )}
            {!historyLoading && historyList.length === 0 && (
              <div className="text-center py-12 text-xs text-slate-500 font-mono">Vault entry buffer empty.</div>
            )}
            {historyList.map((log) => (
              <button 
                key={log._id} 
                onClick={() => loadPastScan(log._id)} 
                className="w-full text-left bg-slate-900/40 hover:bg-indigo-950/20 border border-slate-800/60 hover:border-indigo-500/30 p-3.5 rounded-xl transition active:scale-[0.99] block cursor-pointer group relative"
              >
                <div className="flex justify-between items-start gap-3 mb-2 pr-6">
                  <p className="text-xs font-medium text-slate-300 truncate flex-1 group-hover:text-indigo-400 transition">{log.fileName}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${log.matchPercentage >= 80 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{log.matchPercentage}%</span>
                </div>
                
                {/* 3-DOTS CONTEXT TOGGLE LINK CONTAINER */}
                <div className="absolute right-2.5 top-3.5 z-10">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // Block default card loading trigger
                      setActiveDropdownId(activeDropdownId === log._id ? null : log._id);
                    }}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-md transition cursor-pointer"
                  >
                    <MoreVertical size={14} />
                  </button>
                  
                  {/* FLOATING ACTION DROPDOWN */}
                  {activeDropdownId === log._id && (
                    <div className="absolute right-0 mt-1 w-28 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1 z-20 animate-fade-in">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteScan(e, log._id)}
                        className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-rose-400 hover:bg-rose-950/30 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Trash2 size={12} /> Delete Scan
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                  <Calendar size={10} />{formatTimestamp(log.createdAt)}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* MOBILE BLUR BACKDROP FOR SLIDE-OUT SLIDER */}
        {isMobileVaultOpen && (
          <div 
            onClick={() => setIsMobileVaultOpen(false)} 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-20 lg:hidden mt-[73px]"
          />
        )}

        {/* PANEL 2: INPUT TARGETS */}
        <section className="w-full lg:w-[28%] bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col overflow-visible lg:overflow-hidden shadow-xl shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center gap-2">
            <Layers size={14} className="text-indigo-400" /> Target Parameters
          </h2>
          <form onSubmit={handleAnalyze} className="flex-1 flex flex-col justify-between overflow-visible lg:overflow-hidden space-y-4">
            <div className="flex-1 flex flex-col space-y-4 overflow-visible lg:overflow-y-auto pr-1 scrollbar-thin">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Input Dossier (.pdf)</label>
                <div {...getRootProps()} className={`border rounded-xl py-8 px-4 min-h-[120px] flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}>
                  <input {...getInputProps()} />
                  <UploadCloud className="mx-auto mb-2 text-slate-500" size={24} />
                  {file ? (
                    <div className="flex items-center justify-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 py-1.5 px-3 rounded-lg max-w-full">
                      <FileText size={12} className="text-indigo-400 shrink-0" />
                      <p className="text-xs font-medium text-indigo-300 truncate">{file.name}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Drop resume or <span className="text-indigo-400 font-semibold underline underline-offset-2">browse</span></p>
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col min-h-[140px] lg:min-h-[180px]">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Benchmark (JD)</label>
                <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste job profile parameters or technical requirements..." className="w-full flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none leading-relaxed min-h-[120px] lg:min-h-0" />
              </div>
            </div>
            <button type="submit" disabled={loading || !file || !jobDescription.trim()} className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 border border-transparent text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg flex justify-center items-center gap-2 cursor-pointer shrink-0 active:scale-[0.99] mt-2">
              {loading ? <RefreshCw className="animate-spin" size={13} /> : <><Zap size={13} />Run AI Optimization</>}
            </button>
          </form>
        </section>

        {/* PANEL 3: DYNAMIC WORKSPACE PORTAL */}
        <section className="w-full lg:w-[50%] min-h-[480px] lg:min-h-0 bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
          <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-5 py-3 flex justify-between items-center shrink-0 gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <button type="button" onClick={() => setActiveTab('chat')} className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 py-2 border-b-2 transition cursor-pointer ${activeTab === 'chat' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <MessageSquare size={13} /> <span className="hidden xxs:inline">Stream</span><span className="xxs:hidden">AI</span>
              </button>
              {results && (
                <button type="button" onClick={() => setActiveTab('preview')} className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 py-2 border-b-2 transition cursor-pointer ${activeTab === 'preview' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                  <ViewIcon size={13} /> <span className="hidden xxs:inline">Exporter</span><span className="xxs:hidden">PDF</span>
                </button>
              )}
            </div>
            {results && (
              <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border shrink-0 ${results.matchPercentage >= 80 ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/5 text-rose-400 border-rose-500/20'}`}>
                Match: {results.matchPercentage}%
              </span>
            )}
          </div>

          {/* TAB 1: OPTIMIZATION STREAM */}
          {activeTab === 'chat' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-950/20 scrollbar-thin">
              {loading && (
                <div className="flex items-start gap-3 max-w-[85%] animate-pulse">
                  <div className="h-8 w-8 rounded-xl bg-slate-800 shrink-0" />
                  <div className="space-y-2 flex-1"><div className="h-4 bg-slate-800 rounded w-1/4" /><div className="h-20 bg-slate-800 rounded-2xl w-full" /></div>
                </div>
              )}
              {!loading && !results && (
                <div className="h-full w-full flex flex-col justify-center items-center text-center text-slate-500 p-6 font-mono min-h-[220px]">
                  <Terminal size={28} className="mb-2 text-slate-700 stroke-1" />
                  <p className="text-xs font-semibold text-slate-400">CONSOLE AWAITING ATTACHMENT</p>
                </div>
              )}
              {!loading && results && (
                <div className="space-y-5 animate-fade-in pb-4">
                  <div className="flex items-start gap-3 max-w-[95%] sm:max-w-[92%]">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs shrink-0 font-bold shadow-md">AI</div>
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-md"><p className="text-xs text-slate-300 leading-relaxed">{results.summary}</p></div>
                  </div>
                  <div className="flex items-start gap-3 max-w-[95%] sm:max-w-[92%]">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs shrink-0 font-bold shadow-md">AI</div>
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-md w-full space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <h4 className="text-[11px] font-bold text-emerald-400 font-mono mb-1 tracking-wider uppercase">Matrix Passes</h4>
                          {results.strengths?.map((str, idx) => <div key={idx} className="text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-900/60 leading-normal">{str}</div>)}
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="text-[11px] font-bold text-rose-400 font-mono mb-1 tracking-wider uppercase">Gaps Found</h4>
                          {results.weaknesses?.map((weak, idx) => <div key={idx} className="text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-900/60 leading-normal">{weak}</div>)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 max-w-[95%] sm:max-w-[92%]">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs shrink-0 font-bold shadow-md">AI</div>
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-md space-y-2 w-full">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono block">Missing Context Vectors</span>
                      <div className="flex flex-wrap gap-1.5">{results.missingKeywords?.map((kw, idx) => <span key={idx} className="text-[10px] font-medium px-2.5 py-1 bg-rose-500/5 border border-rose-500/20 text-rose-400 rounded-md">{kw}</span>)}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 max-w-[95%] sm:max-w-[92%]">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs shrink-0 font-bold shadow-md">AI</div>
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-md w-full space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono block">Line Tuning Optimization</span>
                      {results.actionableImprovements?.map((item, idx) => (
                        <div key={idx} className="bg-slate-950/60 border border-slate-900 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-900/40 px-3 py-1.5 border-b border-slate-900 text-[9px] font-bold uppercase text-indigo-400">{item.section || 'General'}</div>
                          <div className="p-3 space-y-2">
                            <p className="text-[11px] text-slate-500 line-through leading-normal">{item.currentText}</p>
                            <div className="relative bg-emerald-950/10 p-2.5 rounded-lg border border-emerald-900/20 pr-10">
                              <p className="text-[11px] text-emerald-400 font-medium leading-normal">{item.suggestedText}</p>
                              <button type="button" onClick={() => copyToClipboard(item.suggestedText, idx)} className="absolute right-2.5 bottom-2.5 p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-slate-200 transition-all cursor-pointer">
                                {copiedId === idx ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOCUMENT EXPORTER CANVASES */}
          {activeTab === 'preview' && results && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/20">
              <div className="p-3 bg-slate-950/40 border-b border-slate-800 flex flex-col xs:flex-row justify-between items-start xs:items-center shrink-0 gap-2">
                <span className="text-[11px] text-slate-400 font-mono">Original Document Structure (Optimized Live)</span>
                <button 
                  type="button" 
                  onClick={handleExportPDF} 
                  className="w-full xs:w-auto py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer"
                >
                  <Download size={13} /> Export Official PDF
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-start items-start bg-slate-950/40 scrollbar-thin">
                <div className="min-w-[816px] bg-slate-900 p-1 border border-slate-800 shadow-xl rounded-md mx-auto">
                  <div 
                    ref={resumePrintRef}
                    className="w-[8.5in] min-h-[11in] flex flex-col text-left text-xs leading-relaxed overflow-hidden shadow-inner"
                    style={{ 
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      backgroundColor: '#ffffff',
                      padding: '48px'
                    }}
                  >
                    <div className="whitespace-pre-line max-w-full font-sans tracking-normal text-[11px]" style={{ color: '#1e293b' }}>
                      {renderOptimizedResumeBody()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

export default App;