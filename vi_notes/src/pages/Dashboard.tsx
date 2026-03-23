import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Bell, Type, AlignLeft, Bold, Italic, Underline,
  AlertTriangle, ClipboardList, CheckCircle2
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

// Default mock data array modeling natural human typing
const defaultChartData = [
  { time: '1', speed: 45 }, { time: '2', speed: 52 },
  { time: '3', speed: 40 }, { time: '4', speed: 60 },
  { time: '5', speed: 55 }, { time: '6', speed: 48 },
  { time: '7', speed: 65 }, { time: '8', speed: 70 },
  { time: '9', speed: 75 },
];

// Flat line mock data demonstrating abnormally constant speed (AI/Paste)
const pastedChartData = [
  { time: '1', speed: 120 }, { time: '2', speed: 120 },
  { time: '3', speed: 120 }, { time: '4', speed: 120 },
  { time: '5', speed: 120 }, { time: '6', speed: 120 },
  { time: '7', speed: 120 }, { time: '8', speed: 120 },
  { time: '9', speed: 120 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [pasteEvents, setPasteEvents] = useState<{timestamp: Date, length: number, content: string}[]>([]);
  const [showPasteAlert, setShowPasteAlert] = useState(false);
  
  const [authScore, setAuthScore] = useState(82);
  const [chartData, setChartData] = useState(defaultChartData);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);
  const [analysisFeedback, setAnalysisFeedback] = useState("Likely Human");
  
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Initial user check
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
    }
  }, [navigate]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText && pastedText.length > 0) {
      const newEvent = {
        timestamp: new Date(),
        length: pastedText.length,
        content: pastedText
      };
      setPasteEvents(prev => [...prev, newEvent]);
      setShowPasteAlert(true);
      
      setChartData(pastedChartData);
      
      if (pasteEvents.length === 0) setAuthScore(23);
      setAnalysisFeedback("Waiting for analysis...");
    }
  };

  const handleAnalyzeAndSave = async () => {
    if (!content.trim()) {
      showToast('Cannot save/analyze empty document. Start writing!', 'info');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    setIsAnalyzing(true);
    
    try {
      const res = await fetch('http://localhost:5000/api/documents/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, pasteEvents })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error);
      
      setAuthScore(data.authScore);
      setAnalysisFeedback(data.analysisDetails);
      
      if (data.authScore >= 70) {
        setChartData(defaultChartData);
        showToast('Verified: ' + data.analysisDetails, 'success');
      } else {
         setChartData(pastedChartData);
         showToast('Alert: ' + data.analysisDetails, 'info');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Server error during analysis', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (!content.trim()) {
      showToast('No document content to export.', 'info');
      return;
    }
    const reportText = `Vi-Notes Authenticity Report
-----------------------------
Confidence Score: ${authScore}%
Evaluation: ${analysisFeedback}
Total Pasted Chunks: ${pasteEvents.length}

Document Content:
${content}`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vi-notes-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Document and report exported successfully.', 'success');
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showToast('Logging out...', 'info');
    setTimeout(() => {
      navigate('/login');
    }, 500);
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : toast.type === 'info' ? 'toast-info' : 'success'}`} style={{ borderLeftColor: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : 'var(--success)' }}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="toast-icon" size={20} style={{ color: 'var(--success)' }} />
            ) : (
              <AlertTriangle className="toast-icon text-warning" size={20} style={{color: toast.type === 'error' ? '#ef4444' : '#3b82f6'}} />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header section */}
      <header className="header">
        <div className="logo-section">
          <div className="logo-icon">V</div>
          <div className="logo-text">
            <h1>Vi-Notes</h1>
            <p>Human Authenticity Platform</p>
          </div>
        </div>

        <div className="nav-section">
          <nav className="nav-links">
            <Link to="/dashboard" className="nav-link active">Dashboard</Link>
            <div className="nav-divider"></div>
            <Link to="/history" className="nav-link">History</Link>
            <div className="nav-divider"></div>
            <a href="#" className="nav-link" onClick={handleLogout}>Log Out</a>
          </nav>

          <div className="user-actions">
            <button className="bell-btn" aria-label="Notifications">
              <Bell size={20} />
            </button>
            <div className="avatar">
              {localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Left Column: Editor */}
        <div className="editor-column">
          <div className="page-header">
            <h2 className="page-title">Welcome to Vi-Notes</h2>
            <p className="page-subtitle">Verify your writing's authenticity.</p>
          </div>

          <div className="editor-container">
            <div className="editor-toolbar">
              <button className="toolbar-btn" aria-label="Format Type"><Type size={18} /></button>
              <button className="toolbar-btn" aria-label="Bold"><Bold size={18} /></button>
              <button className="toolbar-btn" aria-label="Italic"><Italic size={18} /></button>
              <button className="toolbar-btn" aria-label="Underline"><Underline size={18} /></button>
              <button className="toolbar-btn" aria-label="Align Left"><AlignLeft size={18} /></button>
            </div>
            
            <textarea 
              ref={editorRef}
              className="editor-textarea"
              placeholder="Start writing here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
            />

            {showPasteAlert && pasteEvents.length > 0 && (
              <div className="paste-alert-banner fade-in">
                <div className="paste-alert-info">
                  <div className="paste-alert-icon">
                    <AlertTriangle fill="currentColor" size={20} className="text-warning" />
                  </div>
                  <div className="paste-alert-text">
                    <strong>Pasted Content Detected!</strong>
                    <p>Copied text detected in this session ({pasteEvents[pasteEvents.length - 1].length} characters).</p>
                  </div>
                </div>
                <button className="paste-alert-dismiss" onClick={() => setShowPasteAlert(false)}>
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={handleAnalyzeAndSave} disabled={isAnalyzing}>
               {isAnalyzing ? 'Saving & Analyzing...' : 'Save & Analyze Progress'}
            </button>
            <button className="btn btn-outline" onClick={handleExport}>Export Report</button>
          </div>
        </div>

        {/* Right Column: Analysis */}
        <div className="analysis-column">
          <h3 className="analysis-title">Authenticity Analysis</h3>
          
          <div className="analysis-cards">
            {/* Authenticity Score Card */}
            <div className="analysis-card">
              <h4 className="card-title">Human Authenticity Score</h4>
              <div className="score-display">
                <div className="score-value" style={{color: authScore >= 70 ? 'var(--success)' : authScore >= 40 ? 'var(--warning)' : '#ef4444'}}>
                  {authScore}<span style={{fontSize: '1.5rem'}}>%</span>
                </div>
                <div className="score-label" style={{color: authScore >= 70 ? 'var(--success)' : authScore >= 40 ? 'var(--warning)' : '#ef4444', textAlign: 'center', marginTop: '0.25rem'}}>
                  {analysisFeedback}
                </div>
              </div>
            </div>

            {/* Keystroke Timing Card */}
            <div className="analysis-card">
              <h4 className="card-title">Keystroke Timing</h4>
              <div className="timing-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#15172a', border: '1px solid #272a45', borderRadius: '4px' }}
                      itemStyle={{ color: authScore >= 70 ? '#10b981' : '#ef4444' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="speed" 
                      stroke={authScore >= 70 ? "#10b981" : "#ef4444"} 
                      strokeWidth={2}
                      dot={{ r: 3, fill: authScore >= 70 ? "#10b981" : "#ef4444", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#7c3aed' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-label">
                {authScore >= 70 ? 'Variable Typing Rhythm (Human)' : 'Constant Typography (Anomalous)'}
              </div>
            </div>

            {/* Paste Alerts Card */}
            <div className="analysis-card">
              <h4 className="card-title">Paste Alerts</h4>
              <div className="paste-alert-card">
                <div className="info">
                  <div className="paste-icon-bg">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <div className="paste-count">
                      {pasteEvents.length} <span>Detected Pastes</span>
                    </div>
                    {pasteEvents.length > 0 && (
                      <div className="paste-status">Review Needed</div>
                    )}
                  </div>
                </div>
                {pasteEvents.length > 0 && (
                  <AlertTriangle className="warning-icon-right" size={20} />
                )}
              </div>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
