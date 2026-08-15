import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, AlertTriangle, CheckCircle, Video, Image as ImageIcon, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/api/detect', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || 'Error connecting to the detection server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-content">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} /> BACK TO HOME
        </Link>
        
        <header className="dash-header">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            SYSTEM <span className="red">DASHBOARD</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            HybridSafetyNet Core v2.1 — Active Node Analyzing Real-time Feed
          </motion.p>
        </header>

        <div className="main-grid">
          {/* Left: Input Terminal */}
          <motion.div 
            className="glass-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2>Inference Input</h2>
            <div 
              className={`drop-zone ${file ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileChange}
                accept="image/*,video/*"
              />
              
              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div 
                    key="file"
                    className="file-info"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    {file.type.startsWith('video') ? <Video size={48} className="upload-icon-wrapper" /> : <ImageIcon size={48} className="upload-icon-wrapper" />}
                    <p className="primary-text">{file.name}</p>
                    <p className="secondary-text">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button 
                      className="btn-outline" 
                      style={{ marginTop: '1rem', padding: '0.4rem 1rem', fontSize: '0.7rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      SWITCH MEDIA
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="prompt"
                    className="upload-prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="upload-icon-wrapper">
                      <UploadCloud size={48} />
                    </div>
                    <p className="primary-text">FEED UPLOAD</p>
                    <p className="secondary-text">JPG, PNG, MP4, AVI</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              className="action-btn" 
              onClick={handleUpload} 
              disabled={!file || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="spinner" size={20} />
                  PROCESSING...
                </>
              ) : (
                'INITIALIZE DETECTION'
              )}
            </button>

            {error && <div className="error-message" style={{ marginTop: '1rem', color: 'var(--red)', fontSize: '0.8rem' }}>{error}</div>}
          </motion.div>

          {/* Right: Results Terminal */}
          <motion.div 
            className="glass-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {loading && <div className="scan-line" />}
            <h2>Analysis Output</h2>
            
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div 
                  key="loading"
                  className="loading-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ textAlign: 'center', padding: '4rem 0' }}
                >
                  <div className="hexagon-loader"></div>
                  <p className="secondary-text" style={{ letterSpacing: '0.2rem' }}>RUNNING YOLOv8 CORE...</p>
                </motion.div>
              ) : result ? (
                <motion.div 
                  key="result"
                  className="result-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className={`status-indicator ${result.accident_detected ? result.severity.toLowerCase() : 'safe'}`}>
                    {result.accident_detected ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    <span>{result.accident_detected ? `SYSTEM_ALERT: ${result.severity.toUpperCase()} COLLISION` : 'SECTOR_STATUS: NOMINAL'}</span>
                  </div>

                  <div className="metrics-grid">
                    <div className="metric-card">
                      <span className="metric-label">Confidence</span>
                      <span className="metric-value">{result.confidence}%</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Severity</span>
                      <span className="metric-value">{result.severity?.toUpperCase() || 'N/A'}</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Latency</span>
                      <span className="metric-value">{result.processing_time}s</span>
                    </div>
                  </div>

                  {result.annotated_image && (
                    <div className="image-preview">
                      <p className="preview-label">ANNOTATED_FEED_01</p>
                      <img src={`http://localhost:5000${result.annotated_image}`} alt="Detection Result" />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  className="empty-state"
                  style={{ textAlign: 'center', padding: '6rem 0', opacity: 0.3 }}
                >
                  <p className="secondary-text">AWAITING SYSTEM INITIALIZATION</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
