import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, FileText, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import '../index.css';

interface DocHistory {
  _id: string;
  content: string;
  authScore: number;
  pasteEvents: any[];
  createdAt: string;
  analysisDetails: string;
}

export default function History() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch('http://localhost:5000/api/documents/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
         if (!res.ok) throw new Error('Unauthorized');
         return res.json();
      })
      .then(data => {
        setDocuments(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        navigate('/login');
      });
  }, [navigate]);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="app-container">
      {/* Header section */}
      <header className="header" style={{borderBottom: '1px solid var(--border-color)'}}>
        <div className="logo-section">
          <div className="logo-icon">V</div>
          <div className="logo-text">
             <h1>Vi-Notes</h1>
             <p>Human Authenticity Platform</p>
          </div>
        </div>

        <div className="nav-section">
          <nav className="nav-links">
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            <div className="nav-divider"></div>
            <Link to="/history" className="nav-link active">History</Link>
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
      <main className="main-content" style={{ display: 'block', maxWidth: '1000px', margin: '0 auto', width: '100%'}}>
        <div className="page-header" style={{ marginTop: '2rem' }}>
          <h2 className="page-title">Document History</h2>
          <p className="page-subtitle">View your past writing authenticity verified sessions.</p>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history...</div>
        ) : documents.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
             <FileText size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem', opacity: 0.5 }} />
             <h3>No Documents Found</h3>
             <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Write your first document in the Dashboard to see it here.</p>
             <Link to="/dashboard" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>Go to Dashboard</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {documents.map((doc) => (
              <div key={doc._id} style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '80px', height: '80px',
                  borderRadius: '12px',
                  backgroundColor: doc.authScore >= 70 ? 'var(--success-bg)' : 'var(--warning-bg)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${doc.authScore >= 70 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: doc.authScore >= 70 ? 'var(--success)' : '#ef4444' }}>
                    {doc.authScore}%
                  </div>
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                     <Calendar size={14} />
                     {new Date(doc.createdAt).toLocaleDateString()} at {new Date(doc.createdAt).toLocaleTimeString()}
                  </div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                     {doc.content.substring(0, 60)}{doc.content.length > 60 ? '...' : ''}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {doc.authScore >= 70 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--success)' }}>
                         <CheckCircle2 size={14} /> Genuine Human Composition
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#ef4444' }}>
                         <AlertTriangle size={14} /> Advanced Warning: AI/Paste Detected ({doc.pasteEvents.length} distinct pastes)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
