'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  ShieldAlert, CheckCircle, ClipboardList, BarChart3, FileText, 
  MapPin, Mic, Camera, Send, FileCode, Users, Trash2, Edit3, X, RefreshCw,
  Clock, TrendingDown
} from 'lucide-react';

// 3D BIM Viewer module has been decommissioned. Defect tracking is managed via visual timelines.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000/api';
const UPLOADS_BASE = process.env.NEXT_PUBLIC_API_BASE ? process.env.NEXT_PUBLIC_API_BASE.replace('/api', '/uploads') : 'http://127.0.0.1:8000/uploads';

export default function DashboardPage() {
  const [activeRole, setActiveRole] = useState<'manager' | 'inspector' | 'worker' | 'simulator'>('manager');
  const [currentTab, setCurrentTab] = useState<'overview' | 'dashboard' | 'capture' | 'analytics' | 'reports' | 'simulator' | 'queue' | 'tasks' | 'log'>('overview');
  
  // Data States
  const [issues, setIssues] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({
    openCount: 0, captured: 0, resolved: 0, reportLag: 3.4, lagTrend: '', lagGood: true,
    reworkRate: 6.1, reworkTrend: '', reworkGood: true, criticalCount: 0
  });
  const [zoneStats, setZoneStats] = useState<any>({});
  const [workers, setWorkers] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [feedLogs, setFeedLogs] = useState<any[]>([]);
  
  // Selection States
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number>(4); // Default to Civil Team contractor (id=4)
  const [activeIssue, setActiveIssue] = useState<any | null>(null);
  const [activeIssueAudit, setActiveIssueAudit] = useState<{ logs: any[]; progress: any[] }>({ logs: [], progress: [] });

  useEffect(() => {
    if (activeIssue?.id) {
      fetch(`${API_BASE}/issues/${activeIssue.id}/audit`)
        .then(res => res.json())
        .then(data => {
          setActiveIssueAudit(data);
        })
        .catch(err => console.error("Error loading audit data:", err));
    } else {
      setActiveIssueAudit({ logs: [], progress: [] });
    }
  }, [activeIssue]);

  // Field Capture Form States
  const [issueDesc, setIssueDesc] = useState('');
  const [issueZone, setIssueZone] = useState('');
  const [issueSeverity, setIssueSeverity] = useState('LOW — Minor observation');
  const [issueTags, setIssueTags] = useState<string[]>(['Safety', 'MEP']);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFilename, setCapturedFilename] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Voice recording states
  const [recording, setRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Tap mic to start voice recording');
  const [voiceTranscript, setVoiceTranscript] = useState('Spoken text will auto-transcribe here…');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Daily Logs Speech State
  const [dailyLogText, setDailyLogText] = useState('');
  const [formattedLogReport, setFormattedLogReport] = useState('');
  const [loadingLogAI, setLoadingLogAI] = useState(false);

  // Camera stream simulation states
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Modals Visibility
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Modal Input States
  const [reviewSeverity, setReviewSeverity] = useState('LOW — Minor observation');
  const [reviewAssignee, setReviewAssignee] = useState<number>(4);
  const [reviewDeadline, setReviewDeadline] = useState('');
  const [progressPct, setProgressPct] = useState(50);
  const [progressComments, setProgressComments] = useState('');
  const [simBeforeAttached, setSimBeforeAttached] = useState(false);
  const [simAfterAttached, setSimAfterAttached] = useState(false);
  const [progressAfterImage, setProgressAfterImage] = useState<string | null>(null);
  const [progressAfterFilename, setProgressAfterFilename] = useState<string | null>(null);
  const [simCreateMode, setSimCreateMode] = useState(false);

  // Chat widget states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([
    { role: 'ai', text: "Hello! I'm your AI Site Partner. Ask me anything about projects, active contractor workorders, safety hazards or delay risks!" }
  ]);
  const [loadingChat, setLoadingChat] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Project State (Removed mock projects)
  
  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Registration Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('inspector');
  const [regTeam, setRegTeam] = useState('');
  
  // Theme Toggle
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // --- AUTH LOGIC ---
  useEffect(() => {
    const storedToken = localStorage.getItem('ai_inspect_token');
    if (storedToken) {
      verifyToken(storedToken);
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const verifyToken = async (storedToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setToken(storedToken);
        setUser(userData);
        setActiveRole(userData.role as any);
        
        // Auto-route based on role
        if (userData.role === 'inspector') setCurrentTab('capture');
        if (userData.role === 'worker') setCurrentTab('dashboard');
        if (userData.role === 'manager') setCurrentTab('dashboard');
        
      } else {
        localStorage.removeItem('ai_inspect_token');
      }
    } catch (err) {
      console.error("Auth check failed", err);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('ai_inspect_token', data.access_token);
        await verifyToken(data.access_token);
      } else {
        setLoginError(data.detail || 'Login failed');
      }
    } catch (err) {
      setLoginError('Network error connecting to server');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: regName,
          email: loginEmail, 
          password: loginPassword,
          role: regRole,
          team: regTeam
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        // Auto-login after registration
        await handleLogin(e);
      } else {
        setLoginError(data.detail || 'Registration failed');
      }
    } catch (err) {
      setLoginError('Network error connecting to server');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ai_inspect_token');
    setToken(null);
    setUser(null);
  };

  // --- INITIAL DATA SYNC ---
  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async (isRefresh = false) => {
    try {
      const [dashRes, feedRes, workersRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard`),
        fetch(`${API_BASE}/feed`),
        fetch(`${API_BASE}/workers`),
        fetch(`${API_BASE}/daily-logs`)
      ]);

      const dashData = await dashRes.json();
      const feedData = await feedRes.json();
      const workersData = await workersRes.json();
      const logsData = await logsRes.json();

      setIssues(dashData.issues);
      setKpis(dashData.kpis);
      setZoneStats(dashData.zoneStats);
      setFeedLogs(feedData);
      setWorkers(workersData);
      setDailyLogs(logsData);

      if (isRefresh) triggerToast('Dashboard metrics re-synced ✓');
      return dashData.issues;
    } catch (e) {
      triggerToast('Error connecting to local FastAPI server');
      return [];
    }
  };

  const triggerToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 3000);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    triggerToast(next === 'dark' ? '🌙 Dark UI Active' : '☀️ Light UI Active');
  };

  // --- ROLE SWITCHING ---
  const handleRoleChange = (role: 'manager' | 'inspector' | 'worker') => {
    setActiveRole(role);
    setSelectedZone(null);
    setActiveIssue(null);
    triggerToast(`Role simulated: ${role.toUpperCase()}`);
    
    if (role === 'manager') {
      setCurrentTab('dashboard');
    } else if (role === 'inspector') {
      setCurrentTab('capture');
    } else {
      setCurrentTab('dashboard');
    }
  };

  // --- MODALS TOGGLING ---
  const openReviewModal = (issue: any) => {
    setActiveIssue(issue);
    setReviewSeverity(issue.severity || 'LOW — Minor observation');
    setReviewAssignee(workers[0]?.id || 4);
    setReviewDeadline('');
    setShowReviewModal(true);
  };

  const openWorkerProgressModal = (issue: any) => {
    setActiveIssue(issue);
    setProgressPct(50);
    setProgressComments('');
    setSimBeforeAttached(false);
    setSimAfterAttached(false);
    setShowProgressModal(true);
  };

  const openVerificationModal = async (issue: any) => {
    setActiveIssue(issue);
    setShowVerificationModal(true);
  };

  // --- API OPERATIONS ---
  const submitInspectorIssue = async () => {
    if (!issueDesc.trim()) {
      triggerToast('Please write or dictate an issue description.');
      return;
    }

    setLoadingAI(true);
    triggerToast('Multimodal AI: Analyzing photo & description...');

    try {
      let finalFilename = capturedFilename;
      if (capturedImage && capturedImage.startsWith('data:image/')) {
        // Upload image to backend first
        const uploadRes = await fetch(`${API_BASE}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: capturedImage })
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalFilename = uploadData.filename;
        }
      }

      // Step 2: AI Vision processing
      const aiRes = await fetch(`${API_BASE}/ai-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: issueDesc, image: capturedImage })
      });
      const aiData = await aiRes.json();

      let sevLabel = 'LOW';
      if (aiData.risk?.toUpperCase().includes('HIGH')) sevLabel = 'HIGH';
      else if (aiData.risk?.toUpperCase().includes('CRITICAL')) sevLabel = 'CRITICAL';
      else if (aiData.risk?.toUpperCase().includes('MED')) sevLabel = 'MED';

      const sev = `${sevLabel} — AI Assessed`;
      const finalDesc = `<strong>${aiData.summary}</strong><br><br><span style="color:var(--text3);font-size:1.15em"><em><strong>AI Recommendation:</strong> ${aiData.recommendation}</em></span><br><br><span style="opacity:0.9;font-size:1.1em"><strong>Original:</strong> ${issueDesc}</span>`;

      // Step 3: Insert Issue into Manager queue
      const res = await fetch(`${API_BASE}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desc: finalDesc,
          severity: sev,
          zone: issueZone,
          tags: issueTags.join(','),
          image: finalFilename,
          solution_rec: aiData.recommendation,
          team_rec: aiData.team_rec,
          author: user?.name,
          project_id: null
        })
      });

      if (res.ok) {
        const resData = await res.json();
        triggerToast('AI analysis complete! Defect logged.');
        setIssueDesc('');
        setCapturedImage(null);
        setCapturedFilename(null);
        const freshIssues = await loadDashboardData();
        setSimCreateMode(false);
        if (resData.id) {
          const newIssueObj = freshIssues.find((i: any) => i.id === resData.id);
          if (newIssueObj) {
            setActiveIssue(newIssueObj);
          }
        }
        if (activeRole !== 'simulator') {
          setCurrentTab('dashboard');
        }
      }
    } catch (e) {
      triggerToast('Failed to analyze defect.');
    } finally {
      setLoadingAI(false);
    }
  };

  const submitManagerReview = async () => {
    if (!reviewDeadline) {
      triggerToast('Please specify a task completion deadline.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/issues/${activeIssue.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          severity: reviewSeverity,
          assignee_id: reviewAssignee,
          deadline: reviewDeadline,
          manager_name: user?.name || 'Manager'
        })
      });

      if (res.ok) {
        setShowReviewModal(false);
        triggerToast('Workorder approved & task dispatched to contractor');
        const freshIssues = await loadDashboardData();
        const updated = freshIssues.find((i: any) => i.id === activeIssue.id);
        if (updated) {
          setActiveIssue(updated);
        }
      }
    } catch (e) {
      triggerToast('Failed to save review details.');
    }
  };

  const submitWorkerProgress = async () => {
    if (!progressComments.trim()) {
      triggerToast('Please add comments detailing work progress.');
      return;
    }

    const status = progressPct === 100 ? 'waiting_for_approval' : 'in_progress';

    try {
      let finalAfterFilename = progressAfterFilename;
      if (progressAfterImage && progressAfterImage.startsWith('data:image/')) {
        // Upload progress after image
        const uploadRes = await fetch(`${API_BASE}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: progressAfterImage })
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalAfterFilename = uploadData.filename;
        }
      }

      // If no custom image is selected, use fallback remote placeholder
      if (!finalAfterFilename) {
        finalAfterFilename = 'https://images.unsplash.com/photo-1541888086225-ee8259f42c4b?q=80&w=640&auto=format&fit=crop';
      }

      const res = await fetch(`${API_BASE}/issues/${activeIssue.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress_pct: progressPct,
          status,
          comments: progressComments,
          before_img: activeIssue.image || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=640&auto=format&fit=crop',
          after_img: finalAfterFilename,
          worker_id: selectedWorkerId
        })
      });

      if (res.ok) {
        setShowProgressModal(false);
        triggerToast('Progress update submitted successfully.');
        const freshIssues = await loadDashboardData();
        const updated = freshIssues.find((i: any) => i.id === activeIssue.id);
        if (updated) {
          setActiveIssue(updated);
        }
      }
    } catch (e) {
      triggerToast('Error uploading progress.');
    }
  };

  const submitPMVerify = async (action: 'approve' | 'rework') => {
    try {
      const res = await fetch(`${API_BASE}/issues/${activeIssue.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          manager_name: user?.name || 'Manager'
        })
      });

      if (res.ok) {
        setShowVerificationModal(false);
        triggerToast(action === 'approve' ? 'Work verified! Audit log resolved' : 'Task returned for contractor rework');
        const freshIssues = await loadDashboardData();
        const updated = freshIssues.find((i: any) => i.id === activeIssue.id);
        if (updated) {
          setActiveIssue(updated);
        }
      }
    } catch (e) {
      triggerToast('Verification update failed.');
    }
  };

  const submitWorkerDailyLog = async () => {
    if (!dailyLogText.trim()) {
      triggerToast('Please write or speak your daily updates log.');
      return;
    }

    setLoadingLogAI(true);
    triggerToast('AI formatting daily progress report...');

    try {
      const res = await fetch(`${API_BASE}/daily-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_id: selectedWorkerId,
          log_text: dailyLogText
        })
      });

      const data = await res.json();
      if (res.ok) {
        setFormattedLogReport(data.formatted_report);
        setDailyLogText('');
        triggerToast('Daily progress log saved & formatted!');
        loadDashboardData();
      }
    } catch (e) {
      triggerToast('Failed to save log.');
    } finally {
      setLoadingLogAI(false);
    }
  };

  // --- WHISPER VOICE TRANSCRIPTION ---
  const toggleRecording = async () => {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'report.webm');

          setVoiceStatus('Whisper AI transcribing...');
          try {
            const res = await fetch(`${API_BASE}/transcribe`, {
              method: 'POST',
              body: formData
            });
            const data = await res.json();
            if (data.text) {
              setIssueDesc(data.text);
              setVoiceTranscript(data.text);
              setVoiceStatus('Voice log transcribed!');
            }
          } catch (err) {
            setVoiceStatus('Transcribe server offline.');
          }
        };

        mediaRecorder.start();
        setRecording(true);
        setVoiceStatus('Recording defect details (Speak now)...');
      } catch (e) {
        triggerToast('Microphone access denied.');
      }
    } else {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setRecording(false);
    }
  };

  // --- CAMERA SIMULATION FALLBACK ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (e) {
      // Local simulation fallback
      setCameraActive(true);
      triggerToast('Local camera feed simulator active.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Add watermark overlay
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
        ctx.fillStyle = '#00C9A7';
        ctx.font = '12px Arial';
        ctx.fillText(`GPS: 13.0827°N, 80.2707°E · ${new Date().toLocaleTimeString()}`, 10, canvas.height - 10);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
        setCapturedFilename(`capture-${Date.now()}.jpg`);
        stopCamera();
        triggerToast('Site Image captured and GPS tagged!');
      }
    } else {
      // Simulate fake photo attachment in development
      setCapturedImage('/logo.png');
      setCapturedFilename(`simulation-${Date.now()}.jpg`);
      setCameraActive(false);
      triggerToast('Mock Defect Image Attached.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCapturedImage(dataUrl);
        setCapturedFilename(`upload-${Date.now()}-${file.name}`);
        triggerToast('Photo attached successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProgressAfterImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setProgressAfterImage(dataUrl);
        setProgressAfterFilename(`after-${Date.now()}-${file.name}`);
        triggerToast('Completion photo attached!');
      };
      reader.readAsDataURL(file);
    }
  };

  // --- CONVERSATIONAL CHATBOT ---
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setLoadingChat(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Chat assistant connection lost. Check backend logs.' }]);
    } finally {
      setLoadingChat(false);
    }
  };

  // --- REPORT EXPORTS ---
  const handleExport = async (type: string) => {
    triggerToast(`Generating ${type} report...`);
    const isPDF = type.toUpperCase() === 'PDF';
    const filename = `AIInspect_Pro_Inspection_Report.${isPDF ? 'pdf' : 'csv'}`;

    try {
      const response = await fetch(`${API_BASE}/export/${isPDF ? 'pdf' : 'csv'}`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      // Use octet-stream so Chrome doesn't intercept PDFs with its viewer
      // (which ignores the download attribute and uses a UUID filename)
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
      triggerToast(`${type} report downloaded! ✓`);
    } catch (error) {
      console.error('Export failed:', error);
      triggerToast(`Export failed. Please try again.`);
    }
  };

  // --- HELPERS ---
  const getIssuesForSelectedZone = () => {
    if (!selectedZone) return issues;
    return issues.filter(i => i.zone === selectedZone);
  };

  const getWorkerAssignedTasks = () => {
    let list = issues.filter(i => i.assignee_id === selectedWorkerId && i.status !== 'resolved');
    if (selectedZone) {
      list = list.filter(i => i.zone === selectedZone);
    }
    return list;
  };

  const getFilteredIssues = (statusList: string[]) => {
    let list = issues.filter(i => statusList.includes(i.status));
    if (selectedZone) {
      list = list.filter(i => i.zone === selectedZone);
    }
    return list;
  };

  const getImageUrl = (filename: string | null) => {
    if (!filename) return null;
    if (filename.startsWith('data:') || filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('/')) {
      return filename;
    }
    return `${UPLOADS_BASE}/${filename}`;
  };

  if (isCheckingAuth) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[var(--bg)] text-[var(--text1)]">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--teal)] mb-4" />
        <p className="font-semibold text-sm">Authenticating...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[var(--bg)] p-4 relative overflow-hidden">
        <div className="absolute w-[130%] h-[130%] -top-[15%] -left-[15%] bg-[radial-gradient(circle,var(--teal-mid)_0%,transparent_70%)] opacity-20 pointer-events-none" />
        
        <div className="card w-full max-w-md p-8 rounded-2xl bg-[var(--bg4)] border border-[var(--border)] shadow-xl relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 mb-4">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-full border-2 border-[var(--teal)]" />
          </div>
          <h1 className="font-display font-800 text-2xl mb-1 text-[var(--text1)]">
            {isRegistering ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-sm text-[var(--text3)] mb-8 text-center">
            {isRegistering ? "Join AI Inspect Pro to get started." : "Login to your AI Inspect Pro dashboard."}
          </p>
          
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="w-full space-y-4">
            {isRegistering && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={regName} 
                    onChange={e => setRegName(e.target.value)} 
                    className="field-input w-full py-3"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Role</label>
                  <select 
                    value={regRole} 
                    onChange={e => setRegRole(e.target.value)} 
                    className="field-input w-full py-3 bg-[var(--bg3)]"
                  >
                    <option value="inspector">Inspector</option>
                    <option value="manager">Manager</option>
                    <option value="worker">Contractor Worker</option>
                  </select>
                </div>
                {regRole === 'worker' && (
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Contracting Company & Trade</label>
                    <input 
                      type="text" 
                      value={regTeam} 
                      onChange={e => setRegTeam(e.target.value)} 
                      className="field-input w-full py-3"
                      placeholder="e.g. Acme Plumbing - MEP"
                      required
                    />
                  </div>
                )}
                {regRole === 'manager' && (
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Project Department / Title</label>
                    <input 
                      type="text" 
                      value={regTeam} 
                      onChange={e => setRegTeam(e.target.value)} 
                      className="field-input w-full py-3"
                      placeholder="e.g. Site Manager, Quality Assurance"
                      required
                    />
                  </div>
                )}
                {regRole === 'inspector' && (
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Inspection Specialty & Primary Zone</label>
                    <input 
                      type="text" 
                      value={regTeam} 
                      onChange={e => setRegTeam(e.target.value)} 
                      className="field-input w-full py-3"
                      placeholder="e.g. Structural QA - Tower A"
                      required
                    />
                  </div>
                )}
              </>
            )}
            
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Email</label>
              <input 
                type="email" 
                value={loginEmail} 
                onChange={e => setLoginEmail(e.target.value)} 
                className="field-input w-full py-3"
                required
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Password</label>
              <input 
                type="password" 
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)} 
                className="field-input w-full py-3"
                required
              />
            </div>
            
            {loginError && <div className="text-xs text-[var(--red)] bg-red-500/10 border border-red-500/20 p-2 rounded">{loginError}</div>}
            
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-[var(--teal)] text-white font-bold py-3.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity mt-2 flex justify-center items-center gap-2 text-base"
            >
              {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {isRegistering ? "Sign Up" : "Sign In"}
            </button>
            
            <div className="text-center pt-2">
              <button 
                type="button" 
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setLoginEmail('');
                  setLoginPassword('');
                  setLoginError('');
                }}
                className="text-xs text-[var(--teal)] font-semibold hover:underline"
              >
                {isRegistering ? "Already have an account? Login" : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 flex flex-col pt-[var(--nav-h)] relative">
      <datalist id="zones-list">
        {Array.from(new Set(issues.map(i => i.zone))).filter(Boolean).map((zone, idx) => (
          <option key={idx} value={zone} />
        ))}
      </datalist>
      
      {/* ── HEADER NAVIGATION ── */}
      <nav className="flex items-center justify-between px-4 md:px-8 border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md fixed top-0 left-0 right-0 z-[200] h-[var(--nav-h)]">
        <a href="#" className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className="absolute w-[130%] h-[130%] -top-[15%] -left-[15%] bg-[radial-gradient(circle,var(--teal-mid)_0%,transparent_70%)] opacity-50 logo-halo-active" />
            <img src="/logo.png" alt="AIInspect Pro" className="w-full h-full object-contain rounded-full border-2 border-[var(--teal)] shadow-lg" />
          </div>
          <div className="flex flex-col hidden sm:flex">
            <span className="font-display font-800 text-base leading-none tracking-tight">AI<span className="text-[var(--teal)]">Inspect</span> Pro</span>
            <span className="text-[10px] text-[var(--text3)] font-medium leading-none mt-0.5 tracking-wide">Construction Intelligence</span>
          </div>
        </a>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-4">
          {/* Team / Workspace Display */}
          {user?.team && (
            <div className="text-xs sm:text-sm font-semibold bg-[var(--bg3)] border border-[var(--border2)] text-[var(--teal)] rounded-lg px-2 sm:px-3 py-1.5 max-w-[150px] sm:max-w-[200px] truncate">
              {user.team}
            </div>
          )}

          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] sm:text-xs font-bold text-[var(--text1)] leading-tight">{user?.name}</span>
            <span className="text-[9px] sm:text-[10px] font-semibold text-[var(--teal)] uppercase tracking-wider">{activeRole}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="text-xs font-semibold bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text1)] rounded-lg px-3 py-1.5 hover:bg-[var(--red)] border-transparent hover:text-white transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>

        <button 
          onClick={toggleTheme} 
          className="w-10 h-10 rounded-full bg-[var(--bg3)] border border-[var(--border2)] flex items-center justify-center cursor-pointer hover:border-[var(--teal)] hover:bg-[var(--teal-dim)] transition-all"
        >
          {theme === 'dark' ? (
            <svg className="w-4.5 h-4.5 stroke-[var(--text2)] fill-none" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg className="w-4.5 h-4.5 stroke-[var(--text2)] fill-none" viewBox="0 0 24 24" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </nav>

      {/* ── HERO BANNER MOVED TO OVERVIEW TAB ── */}

      {/* ── CORE APP SECTION ── */}
      <section className="app-section px-4">
        <div className="max-w-[1340px] mx-auto">
          
          <div className="app-frame">
            {/* App Top bar tab selectors */}
            <div className="app-topbar">
              <div className="flex items-center gap-3">
                <span className={`badge text-[11px] font-bold px-3 py-1 ${
                  activeRole === 'manager' ? 'badge-blue' :
                  activeRole === 'inspector' ? 'badge-teal' :
                  activeRole === 'worker' ? 'badge-amber' :
                  'badge-purple'
                }`}>
                  {activeRole === 'manager' ? '⚙ Project Manager' :
                   activeRole === 'inspector' ? '🔍 Site Inspector' :
                   activeRole === 'worker' ? '🔧 Contractor' :
                   '⚡ Unified Hub'}
                </span>
              </div>

              <div className="hidden sm:flex gap-0 overflow-x-auto whitespace-nowrap pb-2 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <button onClick={() => setCurrentTab('overview')} className={`app-tab ${currentTab === 'overview' ? 'active' : ''}`}>
                  <BarChart3 className="w-4 h-4" />
                  Overview
                </button>
                {activeRole === 'manager' && (
                  <>
                    <button onClick={() => setCurrentTab('dashboard')} className={`app-tab ${currentTab === 'dashboard' ? 'active' : ''}`}>
                      <ClipboardList className="w-4 h-4" />
                      Workflow Queue
                    </button>
                    <button onClick={() => setCurrentTab('analytics')} className={`app-tab ${currentTab === 'analytics' ? 'active' : ''}`}>
                      <BarChart3 className="w-4 h-4" />
                      Contractor Analytics
                    </button>
                    <button onClick={() => setCurrentTab('reports')} className={`app-tab ${currentTab === 'reports' ? 'active' : ''}`}>
                      <FileText className="w-4 h-4" />
                      Reports Hub
                    </button>
                  </>
                )}
                {activeRole === 'inspector' && (
                  <button onClick={() => setCurrentTab('capture')} className={`app-tab ${currentTab === 'capture' ? 'active' : ''}`}>
                    <Camera className="w-4 h-4" />
                    Field Capture
                  </button>
                )}
                {activeRole === 'worker' && (
                  <button onClick={() => setCurrentTab('dashboard')} className={`app-tab ${currentTab === 'dashboard' ? 'active' : ''}`}>
                    <ClipboardList className="w-4 h-4" />
                    My Tasks
                  </button>
                )}
              </div>
            </div>

            {/* ── TAB CONTENT: UNIFIED OVERVIEW ── */}
            <div className="panel anim-fade-up" style={{ display: currentTab === 'overview' ? 'block' : 'none', padding: '28px' }}>
              <div className="flex flex-col items-center justify-center text-center relative overflow-hidden mb-8">
                <div className="hero-badge mb-5">
                  <span className="w-2 h-2 rounded-full bg-[var(--teal)] live-dot-blink" />
                  AIInspect Pro — Live Intelligence Platform
                </div>
                <h1 className="hero-title mb-4">
                  AI Construction Inspection &
                  <span className="block text-[var(--teal)]">Workforce Command</span>
                </h1>
                <p className="hero-subtitle mb-8 mx-auto max-w-2xl">
                  Real-time AI defect detection, voice-to-text field logging, automated contractor dispatch, and live compliance audit trails — all in one platform.
                </p>
                <div className="grid grid-cols-2 md:flex flex-wrap justify-center gap-3 relative z-10 w-full max-w-2xl mx-auto">
                  <div className="hero-stat-pill">
                    <span className="hero-stat-num">{kpis.openCount + kpis.resolved + (kpis.criticalCount || 0)}</span>
                    Total Issues Tracked
                  </div>
                  <div className="hero-stat-pill">
                    <span className="hero-stat-num">{kpis.resolved}</span>
                    Resolved
                  </div>
                  <div className="hero-stat-pill">
                    <span style={{color: 'var(--red)', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--font-outfit, sans-serif)'}}>{kpis.criticalCount || 0}</span>
                    Critical Active
                  </div>
                  <div className="hero-stat-pill">
                    <span className="hero-stat-num">{kpis.reworkRate}%</span>
                    Rework Rate
                  </div>
                </div>
              </div>
                  {/* KPI Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="kpi-glass" style={{'--kpi-accent': 'var(--red)'} as any}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="kpi-label">Active Risks</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-500/10 text-[var(--red)] flex-shrink-0">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="kpi-num text-[var(--red)]">{kpis.openCount}</div>
                      <div className="kpi-sub">Pending review or action</div>
                    </div>

                    <div className="kpi-glass" style={{'--kpi-accent': 'var(--green)'} as any}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="kpi-label">Resolved</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/10 text-[var(--green)] flex-shrink-0">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="kpi-num text-[var(--green)]">{kpis.resolved}</div>
                      <div className="kpi-sub">Audited &amp; closed</div>
                    </div>

                    <div className="kpi-glass" style={{'--kpi-accent': 'var(--amber)'} as any}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="kpi-label">Rework Rate</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-500/10 text-[var(--amber)] flex-shrink-0">
                          <TrendingDown className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="kpi-num text-[var(--amber)]">{kpis.reworkRate}%</div>
                      <div className={`kpi-sub font-semibold ${kpis.reworkGood ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>{kpis.reworkTrend || 'Stable'}</div>
                    </div>

                    <div className="kpi-glass" style={{'--kpi-accent': 'var(--blue)'} as any}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="kpi-label">Report Lag</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-500/10 text-[var(--blue)] flex-shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="kpi-num text-[var(--blue)]">{kpis.reportLag}h</div>
                      <div className={`kpi-sub font-semibold ${kpis.lagGood ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>{kpis.lagTrend || 'On target'}</div>
                    </div>
                  </div>

                  {/* Heatmap concentration representer */}
                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="font-bold text-base text-[var(--text1)]">Site Defect Heatmap</div>
                        <div className="text-sm text-[var(--text3)] mt-0.5">Click a zone to filter the issue queue</div>
                      </div>
                      <div className="badge badge-teal">Live</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {issues.filter(i => i.status !== 'resolved').length === 0 ? (
                        <div className="col-span-full text-center text-xs text-[var(--text3)] py-8 border border-dashed border-[var(--border2)] rounded-xl">
                          No active defects found across any zones.
                        </div>
                      ) : (
                        Array.from(new Set(issues.filter(i => i.status !== 'resolved').map(i => i.zone))).map((z) => {
                          const count = issues.filter(i => i.zone === z && i.status !== 'resolved').length;
                        const isSelected = selectedZone === z;
                        return (
                          <div 
                            key={z} 
                            onClick={() => setSelectedZone(selectedZone === z ? null : z)}
                            className={`p-4 rounded-xl text-center border cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md ${
                              isSelected ? 'ring-2 ring-[var(--teal)] border-[var(--teal)] bg-[var(--teal-dim)]' :
                              count === 0 ? 'border-[var(--border)] bg-[var(--bg3)] hover:border-[var(--border2)]' :
                              count === 1 ? 'border-amber-500/40 bg-amber-500/10' :
                              'border-red-500/40 bg-red-500/10'
                            }`}
                          >
                            <div className={`text-2xl font-black font-display ${
                              isSelected ? 'text-[var(--teal)]' :
                              count === 0 ? 'text-[var(--text3)]' :
                              count === 1 ? 'text-[var(--amber)]' :
                              'text-[var(--red)]'
                            }`}>{count}</div>
                            <div className="text-[11px] uppercase font-bold text-[var(--text3)] mt-1.5 tracking-wide">{z}</div>
                          </div>
                        );
                        })
                      )}
                    </div>
                  </div>
            </div>

            {/* ── TAB CONTENT: UNIFIED SIMULATOR HUB ── */}
            <div className="panel anim-fade-up" style={{ display: currentTab === 'simulator' ? 'block' : 'none', padding: '28px' }}>
              <div className="mb-6 p-4 rounded-xl bg-[var(--bg4)] border border-[var(--teal-mid)] flex items-start justify-between gap-3 text-xs leading-relaxed">
                <div className="flex items-start gap-3">
                  <span className="text-base text-[var(--teal)]">🚀</span>
                  <div>
                    <strong className="text-[var(--text1)] block mb-0.5">Unified Simulator Flow Hub</strong>
                    <span className="text-[var(--text2)]">Test and manage the complete defect lifecycle (Log ➔ Dispatch ➔ Progress ➔ Audit) from a single screen! Click on any issue in the left queue to drive its process inline, or click <strong>Log New Defect</strong> to initiate a new inspection report.</span>
                  </div>
                </div>
                <button 
                  onClick={() => { setSimCreateMode(true); setActiveIssue(null); }}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--teal)] text-white hover:opacity-90 font-semibold cursor-pointer text-xs"
                >
                  + Log New Defect
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* Left Side: Defect Queue (width 2/5) */}
                <div className={`lg:col-span-2 space-y-4 ${(activeIssue || simCreateMode) ? 'hidden lg:block' : 'block'}`}>
                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-5 shadow-md">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text3)] mb-4">Inspection Defect Queue</h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {issues.map(issue => {
                        const statusColors: Record<string, string> = {
                          pending_review: 'bg-orange-500/10 border-orange-500/20 text-[var(--amber)]',
                          open: 'bg-blue-500/10 border-blue-500/20 text-[var(--blue)]',
                          in_progress: 'bg-blue-500/10 border-blue-500/20 text-[var(--blue)]',
                          waiting_for_approval: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
                          resolved: 'bg-emerald-500/10 border-emerald-500/20 text-[var(--green)]'
                        };
                        return (
                          <div 
                            key={issue.id}
                            onClick={() => { setActiveIssue(issue); setSimCreateMode(false); }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${activeIssue?.id === issue.id && !simCreateMode ? 'border-[var(--teal)] bg-[var(--bg2)]' : 'border-[var(--border)] bg-[var(--bg3)] hover:border-[var(--border2)]'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-[8px] font-bold px-2 py-0.5 rounded border ${statusColors[issue.status] || ''}`}>
                                  {issue.status.toUpperCase().replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-[var(--text3)] font-semibold">{issue.zone}</span>
                              </div>
                              <div className="text-xs truncate text-[var(--text2)] font-medium" dangerouslySetInnerHTML={{ __html: issue.raw_desc || issue.desc.split('<br>')[0] }} />
                              <div className="text-[9px] text-[var(--text3)] mt-1.5">ID: #{issue.id}</div>
                            </div>
                            {issue.image && (
                              <img src={getImageUrl(issue.image) || ''} className="w-12 h-12 object-cover rounded-lg border border-[var(--border2)]" alt="thumbnail" />
                            )}
                          </div>
                        );
                      })}
                      {issues.length === 0 && (
                        <div className="text-center text-xs text-[var(--text3)] py-10">No issues found. Click "Log New Defect" above to create one.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Active Workspace Detail & Actions (width 3/5) */}
                <div className={`lg:col-span-3 space-y-6 ${(!activeIssue && !simCreateMode) ? 'hidden lg:block' : 'block'}`}>
                  
                  {/* Mobile Back Button */}
                  <div className="lg:hidden mb-2 flex items-center">
                    <button 
                      onClick={() => { setActiveIssue(null); setSimCreateMode(false); }}
                      className="px-4 py-2 bg-[var(--bg3)] rounded-lg text-xs font-bold text-[var(--text2)] flex items-center gap-2 shadow-sm border border-[var(--border)] active:scale-95 transition-transform"
                    >
                      &larr; Back to Queue
                    </button>
                  </div>

                  {simCreateMode ? (
                    /* 1. Simulator Create Defect Panel */
                    <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                      <div className="flex justify-between items-center mb-4 border-b border-[var(--border)] pb-3">
                        <h3 className="font-bold text-sm tracking-tight text-[var(--text1)]">Simulator: Log New Field Defect (Step 1)</h3>
                        <button 
                          onClick={() => { setSimCreateMode(false); if(issues.length > 0) setActiveIssue(issues[0]); }}
                          className="text-xs text-[var(--text3)] hover:text-[var(--text1)] hover:underline"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Issue Description / Voice Log</label>
                          <textarea 
                            value={issueDesc} 
                            onChange={(e) => setIssueDesc(e.target.value)}
                            rows={3} 
                            placeholder="Steel rebar exposure noticed under segment joints..."
                            className="field-input w-full text-xs" 
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Location Zone</label>
                            <input 
                              type="text"
                              list="zones-list"
                              value={issueZone} 
                              onChange={(e) => setIssueZone(e.target.value)}
                              className="field-input w-full text-xs"
                              placeholder="e.g. Ground Floor, Lobby"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Severity Assessment</label>
                            <select 
                              value={issueSeverity} 
                              onChange={(e) => setIssueSeverity(e.target.value)}
                              className="field-select w-full text-xs"
                            >
                              <option>LOW — Minor observation</option>
                              <option>MED — Workmanship defect</option>
                              <option>HIGH — Critical structural non-compliance</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-2">Category Tags</label>
                          <div className="flex flex-wrap gap-2">
                            {['Safety', 'Structural', 'MEP', 'Civil', 'Utilities', 'Quality'].map(t => (
                              <div 
                                key={t}
                                onClick={() => {
                                  if(issueTags.includes(t)) setIssueTags(prev => prev.filter(x => x !== t));
                                  else setIssueTags(prev => [...prev, t]);
                                }}
                                className={`px-2.5 py-1 text-xs border rounded-full cursor-pointer hover:border-[var(--teal)] ${
                                  issueTags.includes(t) ? 'bg-[var(--teal-dim)] border-[var(--teal-mid)] text-[var(--teal)]' : 'border-[var(--border)] text-[var(--text3)]'
                                }`}
                              >
                                {t}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Defect Image</label>
                            <div className="h-28 bg-[var(--bg3)] rounded-lg flex flex-col items-center justify-center border border-[var(--border)] relative overflow-hidden text-center">
                              {capturedImage ? (
                                <img src={capturedImage} alt="Defect" className="w-full h-full object-cover" />
                              ) : (
                                <div className="p-2">
                                  <Camera className="w-5 h-5 text-[var(--text3)] mx-auto mb-1" />
                                  <span className="text-[9px] text-[var(--text3)]">No photo attached</span>
                                </div>
                              )}
                            </div>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleFileChange}
                              className="text-[9px] text-[var(--text2)] mt-2 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:bg-[var(--teal-dim)] file:text-[var(--teal)] cursor-pointer w-full"
                            />
                          </div>

                          <div className="bg-[var(--bg3)] rounded-lg p-3 border border-[var(--border)] flex flex-col justify-center">
                            <span className="text-[10px] uppercase font-bold text-[var(--text3)] block mb-1">Whisper Voice Assist</span>
                            <button 
                              onClick={toggleRecording}
                              className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${recording ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-[var(--bg4)] border-[var(--border2)] text-[var(--text2)] hover:border-[var(--teal)]'}`}
                            >
                              <Mic className="w-3.5 h-3.5" />
                              {recording ? 'Stop (Transcribe)' : 'Start Dictation'}
                            </button>
                            <span className="text-[8px] text-[var(--text3)] mt-2 italic text-center truncate">{voiceStatus}</span>
                          </div>
                        </div>

                        <button 
                          onClick={submitInspectorIssue} 
                          disabled={loadingAI}
                          className="cap-btn-main w-full py-3 text-xs font-bold flex items-center justify-center gap-2 mt-2"
                        >
                          {loadingAI ? 'AI Vision Analyzing...' : 'Submit to Manager Queue'}
                        </button>
                      </div>
                    </div>
                  ) : activeIssue ? (
                    /* 2. Simulator driving selected issue lifecycle */
                    <div className="space-y-6">
                      
                      {/* Active Step Panel */}
                      <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md border-l-4 border-l-[var(--teal)]">
                        <div className="flex justify-between items-center mb-4 border-b border-[var(--border)] pb-3">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text3)]">
                            Driving Action: {
                              activeIssue.status === 'pending_review' ? 'Manager Review & Dispatch (Step 2)' :
                              activeIssue.status === 'open' || activeIssue.status === 'in_progress' ? 'Contractor Repair Operations (Step 3)' :
                              activeIssue.status === 'waiting_for_approval' ? 'Project Manager Audit (Step 4)' :
                              'Defect lifecycle completed'
                            }
                          </h4>
                          <span className="live-badge-sm">{activeIssue.status.toUpperCase().replace('_', ' ')}</span>
                        </div>

                        {activeIssue.status === 'pending_review' && (
                          /* PM Dispatch Inline Form */
                          <div className="space-y-4">
                            <p className="text-xs text-[var(--text2)]">As the Project Manager, you must assign a responsible contractor team and set a task completion deadline.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Contractor Team</label>
                                <select 
                                  value={reviewAssignee}
                                  onChange={(e) => setReviewAssignee(parseInt(e.target.value, 10))}
                                  className="field-select w-full text-xs"
                                >
                                  {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.team})</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Deadline Target</label>
                                <input 
                                  type="date" 
                                  value={reviewDeadline}
                                  onChange={(e) => setReviewDeadline(e.target.value)}
                                  className="field-input w-full text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end mt-2">
                              <button 
                                onClick={submitManagerReview} 
                                className="px-4 py-2 rounded-lg bg-[var(--teal)] text-white text-xs font-bold hover:opacity-90 cursor-pointer"
                              >
                                Approve & Dispatch Task
                              </button>
                            </div>
                          </div>
                        )}

                        {(activeIssue.status === 'open' || activeIssue.status === 'in_progress') && (
                          /* Contractor Progress Inline Form */
                          <div className="space-y-4">
                            <p className="text-xs text-[var(--text2)]">As the Assigned Contractor (<strong>{activeIssue.assignee_team || 'Civil Team'}</strong>), log progress and upload verification photos.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Progress Completed: {progressPct}%</label>
                                <input 
                                  type="range" 
                                  min="0" max="100" step="25"
                                  value={progressPct}
                                  onChange={(e) => setProgressPct(parseInt(e.target.value, 10))}
                                  className="w-full cursor-pointer h-1.5 bg-[var(--bg3)] rounded-lg mt-3"
                                />
                                <div className="text-[9px] text-[var(--text3)] mt-2">Set to 100% to submit for final PM verification audit.</div>
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Completion Evidence Comments</label>
                                <textarea 
                                  value={progressComments}
                                  onChange={(e) => setProgressComments(e.target.value)}
                                  rows={2}
                                  placeholder="Completed alignment checks, re-fitted anchors..."
                                  className="field-input w-full text-xs"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Before Photo (Visual Reference)</label>
                                <div className="h-28 bg-[var(--bg3)] rounded-lg flex items-center justify-center border border-[var(--border)] overflow-hidden">
                                  {activeIssue.image ? (
                                    <img src={getImageUrl(activeIssue.image) || ''} className="w-full h-full object-cover" alt="Before" />
                                  ) : (
                                    <span className="text-[10px] text-[var(--text3)]">No photo logged</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">After Photo (Evidence File)</label>
                                <div className="h-28 bg-[var(--bg3)] rounded-lg flex flex-col items-center justify-center border border-[var(--border)] relative overflow-hidden">
                                  {progressAfterImage ? (
                                    <img src={progressAfterImage} className="w-full h-full object-cover" alt="After" />
                                  ) : (
                                    <div className="p-2 text-center">
                                      <Camera className="w-4 h-4 text-[var(--text3)] mx-auto mb-1" />
                                      <span className="text-[9px] text-[var(--text3)]">No upload selected</span>
                                    </div>
                                  )}
                                </div>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleProgressAfterImageChange}
                                  className="text-[9px] text-[var(--text2)] mt-2 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:bg-[var(--teal-dim)] file:text-[var(--teal)] cursor-pointer w-full"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end mt-2">
                              <button 
                                onClick={submitWorkerProgress} 
                                className="px-4 py-2 rounded-lg bg-[var(--teal)] text-white text-xs font-bold hover:opacity-90 cursor-pointer"
                              >
                                Submit Progress Updates
                              </button>
                            </div>
                          </div>
                        )}

                        {activeIssue.status === 'waiting_for_approval' && (
                          /* PM Verification Panel */
                          <div className="space-y-4">
                            <p className="text-xs text-[var(--text2)]">As the Project Manager, perform the final audit on contractor repairs. Inspect the before and after photos below.</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Before Picture (Defect)</span>
                                <div className="h-28 bg-[var(--bg3)] rounded-lg flex items-center justify-center border border-[var(--border)] overflow-hidden">
                                  {activeIssue.image ? (
                                    <img src={getImageUrl(activeIssue.image) || ''} className="w-full h-full object-cover" alt="Before" />
                                  ) : (
                                    <span className="text-[10px] text-[var(--text3)]">No defect photo logged</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">After Picture (Completion)</span>
                                <div className="h-28 bg-[var(--bg3)] rounded-lg flex items-center justify-center border border-[var(--border)] overflow-hidden">
                                  {activeIssueAudit.progress?.[0]?.after_img ? (
                                    <img src={getImageUrl(activeIssueAudit.progress[0].after_img) || ''} className="w-full h-full object-cover" alt="After" />
                                  ) : (
                                    <span className="text-[10px] text-[var(--text3)]">No completion photo uploaded</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center mt-4 border-t border-[var(--border)] pt-3">
                              <button 
                                onClick={() => submitPMVerify('rework')} 
                                className="px-3.5 py-1.5 border border-red-500 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-500/10 cursor-pointer"
                              >
                                Order Rework
                              </button>
                              <button 
                                onClick={() => submitPMVerify('approve')} 
                                className="px-4 py-2 rounded-lg bg-[var(--teal)] text-white text-xs font-bold hover:opacity-90 cursor-pointer"
                              >
                                Approve & Close Defect
                              </button>
                            </div>
                          </div>
                        )}

                        {activeIssue.status === 'resolved' && (
                          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[var(--green)] text-xs font-semibold flex items-center gap-2">
                            <span>✓</span>
                            <span>Lifecycle completed: Defect resolved, verified, and audit trail closed.</span>
                          </div>
                        )}
                      </div>

                      {/* Timeline & Details */}
                      <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text3)] mb-4">Interactive Audit Trail & Logs</h3>
                        
                        <div className="space-y-4 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--border)]">
                          {activeIssueAudit.logs.map((log, index) => (
                            <div key={log.id || index} className="flex gap-4 relative">
                              <div className="w-7 h-7 rounded-full bg-[var(--bg2)] border border-[var(--border2)] flex items-center justify-center text-[10px] font-bold text-[var(--text2)] bg-[var(--bg4)] z-10">
                                {activeIssueAudit.logs.length - index}
                              </div>
                              <div className="flex-1 pb-3">
                                <div className="text-xs font-bold text-[var(--text1)]">{log.action}</div>
                                <div className="text-[10px] text-[var(--text3)] mt-0.5">{log.timestamp} · User: {log.user}</div>
                              </div>
                            </div>
                          ))}
                          {activeIssueAudit.logs.length === 0 && (
                            <div className="text-center text-xs text-[var(--text3)] py-4 pl-8">No audit logs recorded for this defect.</div>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-12 text-center shadow-md">
                      <div className="text-4xl mb-4">🔍</div>
                      <h3 className="font-bold text-sm text-[var(--text1)] mb-2">No Defect Selected</h3>
                      <p className="text-xs text-[var(--text3)] max-w-sm mx-auto leading-relaxed">
                        Select a defect card from the queue on the left to drive its workflow, or click <strong>Log New Defect</strong> to trigger a new inspection uploader.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* ── TAB CONTENT: DASHBOARD (MANAGER) ── */}
            <div className="panel anim-fade-up" style={{ display: currentTab === 'dashboard' && activeRole === 'manager' ? 'block' : 'none', padding: '28px' }}>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 border-l-4 border-l-[var(--amber)] mb-6">
                <span className="text-xl">⚠️</span>
                <div>
                  <div className="font-bold text-[var(--amber)] text-sm">Schedule Slip Detected</div>
                  <div className="text-sm text-[var(--text2)] mt-0.5">Contractor delays on Zone C pipe alignment predicted to push milestone by 36h. Critical verification audit required.</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">

                  {/* Active Manager review tables */}
                  <div className="card p-6">
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <h3 className="font-bold text-base text-[var(--text1)]">Manager Workflow Queue</h3>
                        {selectedZone && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="badge badge-teal">Filtered: {selectedZone}</span>
                            <button 
                              onClick={() => setSelectedZone(null)}
                              className="text-xs text-[var(--text3)] hover:text-[var(--red)] hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => loadDashboardData(true)} className="w-9 h-9 rounded-full bg-[var(--bg3)] border border-[var(--border)] hover:border-[var(--teal)] hover:bg-[var(--teal-dim)] flex items-center justify-center cursor-pointer transition-all">
                        <RefreshCw className="w-4 h-4 text-[var(--text3)]" />
                      </button>
                    </div>

                    <div className="space-y-5">
                      {/* 1. Pending reviews */}
                      {getFilteredIssues(['pending_review']).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="section-label text-[var(--amber)] flex items-center gap-2"><span>⌛</span> Awaiting Manager Review</h4>
                          {getFilteredIssues(['pending_review']).map(issue => (
                            <div 
                              key={issue.id} 
                              onClick={() => setActiveIssue(issue)}
                              className={`issue-card flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 ${activeIssue?.id === issue.id ? 'active' : ''}`}
                            >
                              <div className="flex-1 min-w-0 w-full">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="badge badge-red">New Defect</span>
                                  <span className="text-sm text-[var(--text3)]">{issue.zone} · {issue.author}</span>
                                </div>
                                <div className="text-sm text-[var(--text2)] line-clamp-2" dangerouslySetInnerHTML={{ __html: issue.desc }} />
                              </div>
                              {issue.image && (
                                <img src={getImageUrl(issue.image) || ''} className="w-full h-32 sm:w-16 sm:h-16 object-cover rounded-xl border border-[var(--border2)] shrink-0" alt="thumbnail" />
                              )}
                              <button onClick={(e) => { e.stopPropagation(); openReviewModal(issue); }} className="action-btn resolve-btn w-full sm:w-auto hover:border-emerald-500 hover:text-emerald-500 shrink-0">
                                Review &amp; Dispatch
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 2. Verification pending */}
                      {getFilteredIssues(['waiting_for_approval']).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="section-label text-[var(--teal)] flex items-center gap-2"><span>✓</span> Awaiting PM Verification</h4>
                          {getFilteredIssues(['waiting_for_approval']).map(issue => (
                            <div 
                              key={issue.id} 
                              onClick={() => setActiveIssue(issue)}
                              className={`issue-card flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 ${activeIssue?.id === issue.id ? 'active' : ''}`}
                            >
                              <div className="flex-1 min-w-0 w-full">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="badge badge-green">Completed</span>
                                  <span className="text-sm text-[var(--text3)]">{issue.zone} · {issue.assignee_name}</span>
                                </div>
                                <div className="text-sm text-[var(--text2)] line-clamp-2" dangerouslySetInnerHTML={{ __html: issue.desc }} />
                              </div>
                              {issue.image && (
                                <img src={getImageUrl(issue.image) || ''} className="w-full h-32 sm:w-16 sm:h-16 object-cover rounded-xl border border-[var(--border2)] shrink-0" alt="thumbnail" />
                              )}
                              <button onClick={(e) => { e.stopPropagation(); openVerificationModal(issue); }} className="action-btn resolve-btn w-full sm:w-auto hover:border-emerald-500 hover:text-emerald-500 shrink-0">
                                Verify Work
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 3. In progress dispatches */}
                      <div className="space-y-3">
                        <h4 className="section-label text-[var(--text3)] flex items-center gap-2"><span>🔧</span> Dispatched — In Progress</h4>
                        {getFilteredIssues(['open', 'in_progress']).map(issue => (
                          <div 
                            key={issue.id} 
                            onClick={() => setActiveIssue(issue)}
                            className={`issue-card flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 ${activeIssue?.id === issue.id ? 'active' : ''}`}
                          >
                            <div className="flex-1 min-w-0 w-full">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`badge ${issue.sevClass === 'high' || issue.sevClass === 'critical' ? 'badge-red' : 'badge-amber'}`}>{issue.sevLabel}</span>
                                <span className="text-sm text-[var(--text3)]">{issue.zone} · Due: {issue.deadline || 'Pending'}</span>
                              </div>
                              <div className="text-sm text-[var(--text2)] line-clamp-2" dangerouslySetInnerHTML={{ __html: issue.desc }} />
                              <div className="text-xs text-[var(--text3)] mt-2">
                                Assigned: <strong className="text-[var(--teal)]">{issue.assignee_name || 'Unassigned'}</strong>
                              </div>
                            </div>
                            {issue.image && (
                              <img src={getImageUrl(issue.image) || ''} className="w-full h-32 sm:w-16 sm:h-16 object-cover rounded-xl border border-[var(--border2)] shrink-0" alt="thumbnail" />
                            )}
                          </div>
                        ))}
                        {getFilteredIssues(['open', 'in_progress']).length === 0 && (
                          <div className="text-center text-sm text-[var(--text3)] py-6">
                            No active dispatches at this time.
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Interactive Visual Issue Lifecycle Timeline */}
                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--teal)]">Interactive Visual Issue Lifecycle Timeline</span>
                        <h3 className="font-bold text-sm tracking-tight text-[var(--text1)]">
                          {activeIssue ? `Defect Lifecycle: Issue #${activeIssue.id}` : 'Select an issue card to view timeline'}
                        </h3>
                      </div>
                      {activeIssue && (
                        <button 
                          onClick={() => setActiveIssue(null)}
                          className="w-7 h-7 rounded-full bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text3)] hover:text-[var(--text1)] flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {activeIssue ? (
                      <div className="space-y-6 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--border)]">
                        
                        {/* Step 1: Logged */}
                        <div className="flex gap-4 relative">
                          <div className="w-7.5 h-7.5 rounded-full bg-emerald-500/10 border-2 border-[var(--green)] flex items-center justify-center text-[var(--green)] font-bold text-xs z-10 bg-[var(--bg4)]">✓</div>
                          <div className="flex-1 pb-4 border-b border-[var(--border)]">
                            <div className="flex justify-between items-baseline mb-1">
                              <h4 className="font-bold text-xs text-[var(--text1)]">Step 1: Defect Logged & Audited</h4>
                              <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950/20 text-[var(--green)]">Completed</span>
                            </div>
                            <p className="text-sm text-[var(--text3)] mb-2">Logged by {activeIssue.author} in {activeIssue.zone}</p>
                            <div className="text-sm text-[var(--text2)] leading-relaxed mb-3 bg-[var(--bg3)] p-4 rounded-lg border-l-2 border-[var(--teal)]" dangerouslySetInnerHTML={{ __html: activeIssue.desc }} />
                            
                            {activeIssue.image && (
                              <div>
                                <span className="text-xs font-bold uppercase text-[var(--text3)] block mb-2">Original Defect Photo:</span>
                                <img 
                                  src={getImageUrl(activeIssue.image) || ''} 
                                  alt="Defect" 
                                  className="rounded-lg max-w-[220px] h-auto border border-[var(--border2)] hover:scale-105 transition-transform" 
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 2: Dispatched */}
                        {(() => {
                          const isDispatched = activeIssue.status !== 'pending_review';
                          return (
                            <div className="flex gap-4 relative">
                              <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center font-bold text-xs z-10 bg-[var(--bg4)] border-2 ${
                                isDispatched ? 'bg-emerald-500/10 border-[var(--green)] text-[var(--green)]' : 'border-[var(--border2)] text-[var(--text3)]'
                              }`}>
                                {isDispatched ? '✓' : '2'}
                              </div>
                              <div className="flex-1 pb-4 border-b border-[var(--border)]">
                                <div className="flex justify-between items-baseline mb-1">
                                  <h4 className="font-bold text-xs text-[var(--text1)]">Step 2: Manager Review & Dispatch</h4>
                                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                                    isDispatched ? 'bg-emerald-950/20 text-[var(--green)]' : 'bg-[var(--bg3)] text-[var(--text3)]'
                                  }`}>
                                    {isDispatched ? 'Completed' : 'Awaiting PM Review'}
                                  </span>
                                </div>
                                {isDispatched ? (
                                  <div className="text-xs text-[var(--text2)] space-y-1">
                                    <div>Assigned Team: <strong className="text-[var(--text1)]">{activeIssue.assignee_team || 'Civil Team'}</strong></div>
                                    <div>Contractor Assignee: <strong className="text-[var(--teal)]">{activeIssue.assignee_name || 'Contractor'}</strong></div>
                                    <div>Target Deadline: <strong className="text-[var(--red)]">{activeIssue.deadline}</strong></div>
                                    <div>Severity: <strong className="text-[var(--amber)]">{activeIssue.severity}</strong></div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-[var(--text3)]">Awaiting PM dispatch. Defect is currently pending review in the Manager Workflow Queue.</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Step 3: Progress Logged */}
                        {(() => {
                          const hasProgress = activeIssue.status === 'waiting_for_approval' || activeIssue.status === 'resolved';
                          const inProgress = activeIssue.status === 'open' || activeIssue.status === 'in_progress';
                          
                          const progressInfo = activeIssueAudit.progress?.[0];
                          
                          return (
                            <div className="flex gap-4 relative">
                              <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center font-bold text-xs z-10 bg-[var(--bg4)] border-2 ${
                                hasProgress ? 'bg-emerald-500/10 border-[var(--green)] text-[var(--green)]' : 
                                inProgress ? 'bg-amber-500/10 border-[var(--amber)] text-[var(--amber)] animate-pulse' : 
                                'border-[var(--border2)] text-[var(--text3)]'
                              }`}>
                                {hasProgress ? '✓' : '3'}
                              </div>
                              <div className="flex-1 pb-4 border-b border-[var(--border)]">
                                <div className="flex justify-between items-baseline mb-1">
                                  <h4 className="font-bold text-xs text-[var(--text1)]">Step 3: Contractor Repair & Progress Update</h4>
                                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                                    hasProgress ? 'bg-emerald-950/20 text-[var(--green)]' : 
                                    inProgress ? 'bg-amber-950/20 text-[var(--amber)]' : 
                                    'bg-[var(--bg3)] text-[var(--text3)]'
                                  }`}>
                                    {hasProgress ? 'Completed' : inProgress ? 'In Progress' : 'Pending'}
                                  </span>
                                </div>
                                {hasProgress && progressInfo ? (
                                  <div className="space-y-3">
                                    <div className="text-xs text-[var(--text2)] leading-relaxed bg-[var(--bg3)] p-3 rounded-lg border-l-2 border-[var(--teal)]">
                                      <strong>Comments:</strong> "{progressInfo.comments}"
                                    </div>
                                    <div className="text-[11px] text-[var(--text2)]">
                                      Progress Completed: <strong className="text-[var(--teal)]">{progressInfo.progress_pct}%</strong>
                                    </div>
                                    
                                    {(progressInfo.before_img || progressInfo.after_img) && (
                                      <div className="grid grid-cols-2 gap-3 mt-2">
                                        {progressInfo.before_img && (
                                          <div>
                                            <span className="text-[9px] uppercase font-bold text-[var(--text3)] block mb-1">1. Before Photo:</span>
                                            <img 
                                              src={getImageUrl(progressInfo.before_img) || ''} 
                                              alt="Before" 
                                              className="rounded-lg max-w-full h-24 object-cover border border-[var(--border2)]" 
                                            />
                                          </div>
                                        )}
                                        {progressInfo.after_img && (
                                          <div>
                                            <span className="text-[9px] uppercase font-bold text-[var(--text3)] block mb-1">2. After Completion:</span>
                                            <img 
                                              src={getImageUrl(progressInfo.after_img) || ''} 
                                              alt="After" 
                                              className="rounded-lg max-w-full h-24 object-cover border border-[var(--border2)]" 
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : inProgress ? (
                                  <p className="text-[11px] text-[var(--text3)]">Contractor team is currently performing repair operations on site.</p>
                                ) : (
                                  <p className="text-[11px] text-[var(--text3)]">Awaiting task dispatch details.</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Step 4: Resolved & Closed */}
                        {(() => {
                          const isResolved = activeIssue.status === 'resolved';
                          const isVerifying = activeIssue.status === 'waiting_for_approval';
                          return (
                            <div className="flex gap-4 relative">
                              <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center font-bold text-xs z-10 bg-[var(--bg4)] border-2 ${
                                isResolved ? 'bg-emerald-500/10 border-[var(--green)] text-[var(--green)]' : 
                                isVerifying ? 'bg-purple-500/10 border-purple-500 text-[var(--purple)] animate-pulse' : 
                                'border-[var(--border2)] text-[var(--text3)]'
                              }`}>
                                {isResolved ? '✓' : '4'}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                  <h4 className="font-bold text-xs text-[var(--text1)]">Step 4: PM Audit & Close</h4>
                                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                                    isResolved ? 'bg-emerald-950/20 text-[var(--green)]' : 
                                    isVerifying ? 'bg-purple-950/20 text-purple-400' : 
                                    'bg-[var(--bg3)] text-[var(--text3)]'
                                  }`}>
                                    {isResolved ? 'Resolved' : isVerifying ? 'Awaiting Audit' : 'Pending'}
                                  </span>
                                </div>
                                {isResolved ? (
                                  <p className="text-[11px] text-[var(--green)] font-semibold mt-1">✓ Audit complete! Repair work verified closed on {activeIssue.deadline || 'schedule'}.</p>
                                ) : isVerifying ? (
                                  <p className="text-[11px] text-[var(--text3)]">Contractor has submitted repair verification logs. Awaiting PM final audit.</p>
                                ) : (
                                  <p className="text-[11px] text-[var(--text3)]">Awaiting work completion from contractor.</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    ) : (
                      <div className="text-center text-xs text-[var(--text3)] py-10">
                        Click on any issue card in the Workflow Queue above to view its interactive visual lifecycle timeline.
                      </div>
                    )}
                  </div>

                </div>

                {/* PM Right sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 text-center shadow-md">
                    <div className="card-title text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] mb-4">AI Project Delay Gauge</div>
                    <div className="relative inline-flex items-center justify-center my-4">
                      <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-[var(--bg3)]" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                        <path 
                          className="text-[var(--amber)] transition-all duration-500" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                          stroke="currentColor" 
                          fill="none" 
                          strokeDasharray={`${Math.min(100, Math.max(10, kpis.openCount * 18))}, 100`} 
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-bold text-[var(--amber)]">{Math.min(100, Math.max(10, kpis.openCount * 18))}%</span>
                        <span className="text-[8px] uppercase tracking-wider text-[var(--text3)]">Delay Risk</span>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--amber)]">Medium Timeline Lag Impact</div>
                    <p className="text-sm text-[var(--text3)] mt-2">AI predictive models estimate delays based on contractor performance speeds.</p>
                  </div>

                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md max-h-[350px] overflow-hidden flex flex-col">
                    <div className="font-bold text-sm text-[var(--text1)] mb-4">Site Action Logs</div>
                    <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                      {feedLogs.map(feed => (
                        <div key={feed.id} className="flex gap-3 text-sm leading-relaxed">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            feed.type === 'red' ? 'bg-red-500' :
                            feed.type === 'amber' ? 'bg-amber-500' :
                            feed.type === 'blue' ? 'bg-blue-500' :
                            'bg-emerald-500'
                          }`} />
                          <div className="flex-1">
                            <div className="text-[var(--text2)]" dangerouslySetInnerHTML={{ __html: feed.text }} />
                            <span className="text-xs text-[var(--text3)] block mt-0.5">{feed.time} ago</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TAB CONTENT: WORKER CONTRACTOR WORKSPACE ── */}
            <div className="panel anim-fade-up" style={{ display: currentTab === 'dashboard' && activeRole === 'worker' ? 'block' : 'none', padding: '28px' }}>
              {/* Contractor Workspace Guide */}
              <div className="mb-6 p-4 rounded-xl bg-[var(--bg4)] border border-[var(--teal-mid)] flex items-start gap-3 leading-relaxed">
                <span className="text-lg text-[var(--teal)]">💡</span>
                <div>
                  <strong className="text-[var(--text1)] text-sm block mb-1">Contractor Team Quick-Start Guide</strong>
                  <span className="text-sm text-[var(--text2)]">1. Select your contractor team from the dropdown. 2. Click a task card to view its lifecycle. 3. Click <strong>Update Progress</strong> to log repairs and attach photos. 4. Use the sidebar to submit daily worklogs.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Contractor assignments list left */}
                <div className="md:col-span-2 space-y-6">
                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] whitespace-nowrap">Viewing Tasks for:</span>
                        <select 
                          value={selectedWorkerId}
                          onChange={(e) => setSelectedWorkerId(parseInt(e.target.value, 10))}
                          className="text-xs bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text1)] rounded-md px-3 py-2 sm:py-1 focus:outline-none w-full sm:w-auto"
                        >
                          {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.team})</option>)}
                        </select>
                      </div>
                      <span className="live-badge-sm">{getWorkerAssignedTasks().length} active tasks</span>
                    </div>

                    <div className="space-y-4">
                      {getWorkerAssignedTasks().map(issue => (
                        <div 
                          key={issue.id} 
                          onClick={() => setActiveIssue(issue)}
                          className={`p-4 rounded-xl bg-[var(--bg2)] border transition-all cursor-pointer hover:border-[var(--teal)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${activeIssue?.id === issue.id ? 'border-[var(--teal)]' : 'border-[var(--border)]'}`}
                        >
                        <div className="flex-1 w-full">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`badge ${issue.sevClass === 'high' ? 'badge-red' : 'badge-amber'}`}>{issue.sevLabel}</span>
                              <span className="text-sm text-[var(--text3)]">{issue.zone} · {issue.category} · Due: <strong className="text-[var(--red)]">{issue.deadline}</strong></span>
                            </div>
                            <div className="text-sm text-[var(--text2)] leading-relaxed" dangerouslySetInnerHTML={{ __html: issue.desc }} />
                            {issue.image && (
                              <div className="mt-3">
                                <span className="text-xs font-bold uppercase text-[var(--text3)] block mb-1.5">Defect Reference Image:</span>
                                <img 
                                  src={getImageUrl(issue.image) || ''} 
                                  alt="Defect" 
                                  className="rounded-lg w-full sm:max-h-32 sm:w-auto object-cover border border-[var(--border2)]"
                                />
                              </div>
                            )}
                            <div className="text-sm text-[var(--text3)] mt-2">
                              Current Status: <strong className="text-[var(--amber)]">{issue.status.toUpperCase()}</strong>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); openWorkerProgressModal(issue); }} 
                            className="action-btn resolve-btn w-full sm:w-auto hover:border-emerald-500 hover:text-emerald-500"
                          >
                            Update Progress
                          </button>
                        </div>
                      ))}

                      {getWorkerAssignedTasks().length === 0 && (
                        <div className="text-center text-xs text-[var(--text3)] py-10">No outstanding task orders assigned to this contractor.</div>
                      )}
                    </div>
                  </div>

                  {/* Interactive Visual Issue Lifecycle Timeline */}
                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--teal)]">Interactive Visual Issue Lifecycle Timeline</span>
                        <h3 className="font-bold text-sm tracking-tight text-[var(--text1)]">
                          {activeIssue ? `Defect Lifecycle: Issue #${activeIssue.id}` : 'Select an issue card to view timeline'}
                        </h3>
                      </div>
                      {activeIssue && (
                        <button 
                          onClick={() => setActiveIssue(null)}
                          className="w-7 h-7 rounded-full bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text3)] hover:text-[var(--text1)] flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {activeIssue ? (
                      <div className="space-y-6 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--border)]">
                        
                        {/* Step 1: Logged */}
                        <div className="flex gap-4 relative">
                          <div className="w-7.5 h-7.5 rounded-full bg-emerald-500/10 border-2 border-[var(--green)] flex items-center justify-center text-[var(--green)] font-bold text-xs z-10 bg-[var(--bg4)]">✓</div>
                          <div className="flex-1 pb-4 border-b border-[var(--border)]">
                            <div className="flex justify-between items-baseline mb-1">
                              <h4 className="font-bold text-xs text-[var(--text1)]">Step 1: Defect Logged & Audited</h4>
                              <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950/20 text-[var(--green)]">Completed</span>
                            </div>
                            <p className="text-sm text-[var(--text3)] mb-2">Logged by {activeIssue.author} in {activeIssue.zone}</p>
                            <div className="text-sm text-[var(--text2)] leading-relaxed mb-3 bg-[var(--bg3)] p-4 rounded-lg border-l-2 border-[var(--teal)]" dangerouslySetInnerHTML={{ __html: activeIssue.desc }} />
                            
                            {activeIssue.image && (
                              <div>
                                <span className="text-xs font-bold uppercase text-[var(--text3)] block mb-2">Original Defect Photo:</span>
                                <img 
                                  src={getImageUrl(activeIssue.image) || ''} 
                                  alt="Defect" 
                                  className="rounded-lg max-w-[220px] h-auto border border-[var(--border2)] hover:scale-105 transition-transform" 
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 2: Dispatched */}
                        {(() => {
                          const isDispatched = activeIssue.status !== 'pending_review';
                          return (
                            <div className="flex gap-4 relative">
                              <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center font-bold text-xs z-10 bg-[var(--bg4)] border-2 ${
                                isDispatched ? 'bg-emerald-500/10 border-[var(--green)] text-[var(--green)]' : 'border-[var(--border2)] text-[var(--text3)]'
                              }`}>
                                {isDispatched ? '✓' : '2'}
                              </div>
                              <div className="flex-1 pb-4 border-b border-[var(--border)]">
                                <div className="flex justify-between items-baseline mb-1">
                                  <h4 className="font-bold text-sm text-[var(--text1)]">Step 2: Manager Review & Dispatch</h4>
                                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                                    isDispatched ? 'bg-emerald-950/20 text-[var(--green)]' : 'bg-[var(--bg3)] text-[var(--text3)]'
                                  }`}>
                                    {isDispatched ? 'Completed' : 'Awaiting PM Review'}
                                  </span>
                                </div>
                                {isDispatched ? (
                                  <div className="text-xs text-[var(--text2)] space-y-1">
                                    <div>Assigned Team: <strong className="text-[var(--text1)]">{activeIssue.assignee_team || 'Civil Team'}</strong></div>
                                    <div>Contractor Assignee: <strong className="text-[var(--teal)]">{activeIssue.assignee_name || 'Contractor'}</strong></div>
                                    <div>Target Deadline: <strong className="text-[var(--red)]">{activeIssue.deadline}</strong></div>
                                    <div>Severity: <strong className="text-[var(--amber)]">{activeIssue.severity}</strong></div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-[var(--text3)] mt-1">Awaiting PM dispatch. Defect is currently pending review in the Manager Workflow Queue.</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Step 3: Progress Logged */}
                        {(() => {
                          const hasProgress = activeIssue.status === 'waiting_for_approval' || activeIssue.status === 'resolved';
                          const inProgress = activeIssue.status === 'open' || activeIssue.status === 'in_progress';
                          
                          const progressInfo = activeIssueAudit.progress?.[0];
                          
                          return (
                            <div className="flex gap-4 relative">
                              <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center font-bold text-xs z-10 bg-[var(--bg4)] border-2 ${
                                hasProgress ? 'bg-emerald-500/10 border-[var(--green)] text-[var(--green)]' : 
                                inProgress ? 'bg-amber-500/10 border-[var(--amber)] text-[var(--amber)] animate-pulse' : 
                                'border-[var(--border2)] text-[var(--text3)]'
                              }`}>
                                {hasProgress ? '✓' : '3'}
                              </div>
                              <div className="flex-1 pb-4 border-b border-[var(--border)]">
                                <div className="flex justify-between items-baseline mb-1">
                                  <h4 className="font-bold text-sm text-[var(--text1)]">Step 3: Contractor Repair & Progress Update</h4>
                                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                                    hasProgress ? 'bg-emerald-950/20 text-[var(--green)]' : 
                                    inProgress ? 'bg-amber-950/20 text-[var(--amber)]' : 
                                    'bg-[var(--bg3)] text-[var(--text3)]'
                                  }`}>
                                    {hasProgress ? 'Completed' : inProgress ? 'In Progress' : 'Pending'}
                                  </span>
                                </div>
                                {hasProgress && progressInfo ? (
                                  <div className="space-y-3">
                                    <div className="text-xs text-[var(--text2)] leading-relaxed bg-[var(--bg3)] p-3 rounded-lg border-l-2 border-[var(--teal)]">
                                      <strong>Comments:</strong> "{progressInfo.comments}"
                                    </div>
                                    <div className="text-sm text-[var(--text2)]">
                                      Progress Completed: <strong className="text-[var(--teal)]">{progressInfo.progress_pct}%</strong>
                                    </div>
                                    
                                    {(progressInfo.before_img || progressInfo.after_img) && (
                                      <div className="grid grid-cols-2 gap-3 mt-2">
                                        {progressInfo.before_img && (
                                          <div>
                                            <span className="text-xs font-bold uppercase text-[var(--text3)] block mb-1.5">1. Before Photo:</span>
                                            <img 
                                              src={getImageUrl(progressInfo.before_img) || ''} 
                                              alt="Before" 
                                              className="rounded-lg max-w-full h-24 object-cover border border-[var(--border2)]" 
                                            />
                                          </div>
                                        )}
                                        {progressInfo.after_img && (
                                          <div>
                                            <span className="text-xs font-bold uppercase text-[var(--text3)] block mb-1.5">2. After Completion:</span>
                                            <img 
                                              src={getImageUrl(progressInfo.after_img) || ''} 
                                              alt="After" 
                                              className="rounded-lg max-w-full h-24 object-cover border border-[var(--border2)]" 
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : inProgress ? (
                                  <p className="text-sm text-[var(--text3)] mt-1">Contractor team is currently performing repair operations on site.</p>
                                ) : (
                                  <p className="text-sm text-[var(--text3)] mt-1">Awaiting task dispatch details.</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Step 4: Resolved & Closed */}
                        {(() => {
                          const isResolved = activeIssue.status === 'resolved';
                          const isVerifying = activeIssue.status === 'waiting_for_approval';
                          return (
                            <div className="flex gap-4 relative">
                              <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center font-bold text-xs z-10 bg-[var(--bg4)] border-2 ${
                                isResolved ? 'bg-emerald-500/10 border-[var(--green)] text-[var(--green)]' : 
                                isVerifying ? 'bg-purple-500/10 border-purple-500 text-[var(--purple)] animate-pulse' : 
                                'border-[var(--border2)] text-[var(--text3)]'
                              }`}>
                                {isResolved ? '✓' : '4'}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                  <h4 className="font-bold text-xs text-[var(--text1)]">Step 4: PM Audit & Close</h4>
                                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                                    isResolved ? 'bg-emerald-950/20 text-[var(--green)]' : 
                                    isVerifying ? 'bg-purple-950/20 text-purple-400' : 
                                    'bg-[var(--bg3)] text-[var(--text3)]'
                                  }`}>
                                    {isResolved ? 'Resolved' : isVerifying ? 'Awaiting Audit' : 'Pending'}
                                  </span>
                                </div>
                                {isResolved ? (
                                  <p className="text-sm text-[var(--green)] font-semibold mt-1">✓ Audit complete! Repair work verified closed on {activeIssue.deadline || 'schedule'}.</p>
                                ) : isVerifying ? (
                                  <p className="text-sm text-[var(--text3)] mt-1">Contractor has submitted repair verification logs. Awaiting PM final audit.</p>
                                ) : (
                                  <p className="text-sm text-[var(--text3)] mt-1">Awaiting work completion from contractor.</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    ) : (
                      <div className="text-center text-xs text-[var(--text3)] py-10">
                        Click on any active task in the list above to view its interactive visual lifecycle timeline.
                      </div>
                    )}
                  </div>
                </div>

                {/* Contractor Daily Work log dictation right */}
                <div className="space-y-6">
                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                    <div className="card-title text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] mb-4">Contractor Daily Progress Log</div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text3)] block mb-2">What was completed today?</label>
                        <textarea 
                          value={dailyLogText}
                          onChange={(e) => setDailyLogText(e.target.value)}
                          placeholder="Crack cleaned, alignment prepared..." 
                          className="field-input w-full min-h-[100px]"
                        />
                      </div>
                      <button 
                        onClick={submitWorkerDailyLog} 
                        disabled={loadingLogAI}
                        className="cap-btn-main w-full py-2.5 flex items-center justify-center gap-2"
                      >
                        {loadingLogAI ? 'AI Formatting...' : 'Submit Log & AI Format'}
                      </button>
                      
                      {formattedLogReport && (
                        <div className="mt-4 p-4 rounded-xl bg-[var(--bg3)] border border-[var(--teal-mid)]">
                          <span className="text-xs font-bold uppercase text-[var(--teal)] tracking-wide block mb-3">✓ AI Formatted Daily Report</span>
                          <div className="text-sm text-[var(--text2)] leading-relaxed whitespace-pre-line">{formattedLogReport}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ── TAB CONTENT: FIELD CAPTURE (INSPECTORS) ── */}
            <div className="panel anim-fade-up" style={{ display: currentTab === 'capture' ? 'block' : 'none', padding: '28px' }}>
              {/* Site Inspector Guide */}
              <div className="mb-6 p-4 rounded-xl bg-[var(--bg4)] border border-[var(--teal-mid)] flex items-start gap-3 leading-relaxed">
                <span className="text-lg text-[var(--teal)]">💡</span>
                <div>
                  <strong className="text-sm text-[var(--text1)] block mb-1">Site Inspector Quick-Start Guide</strong>
                  <span className="text-sm text-[var(--text2)]">1. Activate viewfinder or upload a defect image. 2. Speak or write the description — click the Microphone for Whisper AI transcription. 3. Select a structural zone and click <strong>Submit to Manager Queue</strong>.</span>
                </div>
              </div>
              <div className="capture-layout">
                
                {/* Left side: Viewfinder & recorder */}
                <div className="capture-left space-y-6">
                  <div className="viewfinder border border-[var(--border2)] rounded-xl relative h-64 overflow-hidden bg-[var(--bg2)]" id="viewfinder">
                    <div className="vf-scan absolute top-0 left-0 right-0 h-0.5 bg-[var(--teal)] opacity-60" />
                    <div className="vf-corner vf-tl absolute top-2.5 left-2.5 border-t-2 border-l-2 border-[var(--teal)] w-4.5 h-4.5" />
                    <div className="vf-corner vf-tr absolute top-2.5 right-2.5 border-t-2 border-r-2 border-[var(--teal)] w-4.5 h-4.5" />
                    <div className="vf-corner vf-bl absolute bottom-2.5 left-2.5 border-b-2 border-l-2 border-[var(--teal)] w-4.5 h-4.5" />
                    <div className="vf-corner vf-br absolute bottom-2.5 right-2.5 border-b-2 border-r-2 border-[var(--teal)] w-4.5 h-4.5" />
                    
                    {cameraActive && !capturedImage && (
                      <button 
                        onClick={stopCamera}
                        className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/80 flex items-center justify-center cursor-pointer transition-all"
                        title="Cancel & Go Back"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    <div className="w-full h-full flex flex-col items-center justify-center text-center">
                      <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover rounded-xl ${cameraActive && !capturedImage ? 'block' : 'hidden'}`} />
                      <canvas ref={canvasRef} className="hidden" />
                      
                      {capturedImage && (
                        <img src={capturedImage} alt="Captured defect" className="w-full h-full object-cover rounded-xl" />
                      )}

                      {!cameraActive && !capturedImage && (
                        <div className="flex flex-col items-center p-4">
                          <div className="w-10 h-10 rounded-full bg-[var(--bg4)] border border-[var(--border2)] flex items-center justify-center mb-2"><Camera className="w-4 h-4 text-[var(--text3)]" /></div>
                          <span className="text-xs text-[var(--text3)]">No image attached</span>
                          <div className="flex flex-col gap-2 mt-3 items-center">
                            <button onClick={startCamera} className="cap-btn-sec text-xs py-1.5 px-3">Activate Viewfinder</button>
                            <span className="text-[10px] text-[var(--text3)] font-semibold uppercase">Or Upload Defect Image:</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleFileChange}
                              className="text-[10px] text-[var(--text2)] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-[var(--teal-dim)] file:text-[var(--teal)] hover:file:opacity-80 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {cameraActive && (
                      <>
                        <button onClick={capturePhoto} className="cap-btn-main flex-1 py-2.5 font-semibold">📷 Capture Defect Image</button>
                        <button onClick={stopCamera} className="cap-btn-sec py-2.5 px-4 font-semibold">Cancel</button>
                      </>
                    )}
                    {capturedImage && (
                      <button onClick={() => { setCapturedImage(null); startCamera(); }} className="cap-btn-sec flex-1 py-2.5">Retake Photo</button>
                    )}
                  </div>

                  {/* Whisper recorder block */}
                  <div className="voice-block bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={toggleRecording} 
                        className={`w-10 h-10 rounded-full bg-[var(--bg4)] border border-[var(--border2)] flex items-center justify-center cursor-pointer hover:border-[var(--teal)] ${recording ? 'bg-red-500/10 border-red-500 mic-recording' : ''}`}
                      >
                        <Mic className={`w-4 h-4 ${recording ? 'text-red-500' : 'text-[var(--text2)]'}`} />
                      </button>
                      <div>
                        <div className={`text-sm font-semibold ${recording ? 'text-[var(--red)]' : 'text-[var(--text2)]'}`}>{voiceStatus}</div>
                        {recording && (
                          <div className="flex items-center gap-0.5 h-4 mt-0.5">
                            <div className="w-0.5 bg-[var(--red)] h-2 wbar-active" style={{ animationDelay: '0s' }} />
                            <div className="w-0.5 bg-[var(--red)] h-4 wbar-active" style={{ animationDelay: '0.1s' }} />
                            <div className="w-0.5 bg-[var(--red)] h-3 wbar-active" style={{ animationDelay: '0.2s' }} />
                            <div className="w-0.5 bg-[var(--red)] h-2 wbar-active" style={{ animationDelay: '0s' }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-[var(--bg3)] rounded-xl border border-[var(--border)] border-l-2 border-l-[var(--teal)]">
                      <p className="text-base font-medium text-[var(--text1)] leading-relaxed flex-1">
                        <span className="text-sm font-bold uppercase text-[var(--teal)] block mb-1.5 tracking-wide">Whisper Transcription Output</span>
                        {voiceTranscript}
                      </p>
                    </div>
                  </div>

                </div>

                {/* Right side: Input and submit */}
                <div className="capture-right space-y-6">
                  <div className="field-block bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-[var(--text3)] block mb-2">Issue Description / Spoken Log</label>
                      <textarea 
                        value={issueDesc} 
                        onChange={(e) => setIssueDesc(e.target.value)}
                        rows={3} 
                        placeholder="Concrete anchor crack logged near primary span deck..."
                        className="field-input w-full" 
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-[var(--text3)] block mb-2">Structural Zone</label>
                      <input 
                        type="text"
                        list="zones-list"
                        value={issueZone} 
                        onChange={(e) => setIssueZone(e.target.value)}
                        className="field-input w-full"
                        placeholder="e.g. Ground Floor, Lobby"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-[var(--text3)] block mb-2">Category Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {['Safety', 'Structural', 'MEP', 'Civil', 'Utilities', 'Quality'].map(t => (
                          <div 
                            key={t}
                            onClick={() => {
                              if(issueTags.includes(t)) setIssueTags(prev => prev.filter(x => x !== t));
                              else setIssueTags(prev => [...prev, t]);
                            }}
                            className={`px-3 py-1.5 text-sm font-medium border rounded-full cursor-pointer transition-all hover:border-[var(--teal)] ${
                              issueTags.includes(t) ? 'bg-[var(--teal-dim)] border-[var(--teal-mid)] text-[var(--teal)]' : 'border-[var(--border)] text-[var(--text3)]'
                            }`}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bim-match bg-[var(--bg4)] border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><FileCode className="w-4 h-4 text-[var(--blue)]" /></div>
                      <div className="flex-1 text-left">
                        <div className="text-xs font-semibold">BIM Spatial Coordinate Binder</div>
                        <div className="text-[10px] text-[var(--text3)]">Watermarked GPS bindings attached</div>
                      </div>
                      <span className="text-[10px] text-[var(--green)] font-semibold">✓ Localized</span>
                    </div>

                    <button 
                      onClick={submitInspectorIssue} 
                      disabled={loadingAI}
                      className="cap-btn-main w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      {loadingAI ? 'AI Vision Analyzing...' : 'Submit to Manager Queue'}
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* BIM View decommissioned. Defect tracking is managed via visual timelines. */}

            {/* ── TAB CONTENT: CONTRACTOR ANALYTICS ── */}
            <div className="panel anim-fade-up" style={{ display: currentTab === 'analytics' ? 'block' : 'none', padding: '28px' }}>
              <div className="space-y-6">
                
                {/* Contractor metrics table */}
                <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                  <div className="card-title text-xs uppercase font-bold tracking-wider text-[var(--text3)] mb-4">Contractor Performance Dashboard</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workers.map(w => {
                      const assigned = issues.filter(i => i.assignee_id === w.id).length;
                      const resolved = issues.filter(i => i.assignee_id === w.id && i.status === 'resolved').length;
                      const completion = assigned > 0 ? Math.round((resolved / assigned) * 100) : 100;
                      return (
                        <div key={w.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg2)] flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                          <div className="font-bold text-[var(--text1)] flex justify-between items-center">
                            <span>{w.name}</span>
                            <span className="text-[10px] bg-[var(--bg3)] px-2 py-1 rounded text-[var(--text3)]">Team</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[var(--text3)] font-medium">Tasks: {resolved}/{assigned}</span>
                            <span className="text-[var(--teal)] font-bold">{completion}% Done</span>
                          </div>
                          <div className="w-full bg-[var(--bg3)] h-2 rounded-full overflow-hidden">
                            <div className="bg-[var(--teal)] h-full transition-all duration-500" style={{ width: `${completion}%` }} />
                          </div>
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold mt-1">
                            <span className="text-[var(--text3)]">Avg. Close: 24h</span>
                            <span className="text-[var(--green)]">100% Quality Score</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* contractor logs cards list */}
                <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                  <div className="card-title text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] mb-4">Contractor Daily Log Submissions</div>
                  <div className="space-y-4">
                    {dailyLogs.map(log => (
                      <div key={log.id} className="p-4 rounded-xl bg-[var(--bg2)] border border-[var(--border)] space-y-2">
                        <div className="flex justify-between items-baseline text-xs text-[var(--text3)]">
                          <strong className="text-[var(--text1)]">{log.worker_name} ({log.worker_team})</strong>
                          <span>{log.date}</span>
                        </div>
                        <div className="text-xs text-[var(--text2)] bg-[var(--bg4)] p-3 rounded-lg border-l-2 border-[var(--teal)] whitespace-pre-line leading-relaxed">
                          {log.formatted_report}
                        </div>
                      </div>
                    ))}

                    {dailyLogs.length === 0 && (
                      <div className="text-center text-xs text-[var(--text3)] py-10">No daily logs recorded.</div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* ── TAB CONTENT: REPORTS ── */}
            <div className="panel anim-fade-up" style={{ display: currentTab === 'reports' ? 'block' : 'none', padding: '28px' }}>
              <div className="reports-layout">
                <div className="space-y-6">
                  
                  {/* Site briefing overview card */}
                  <div className="report-summary bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="font-bold text-sm tracking-tight text-[var(--text1)]">Executive Morning Site Briefing</div>
                        <div className="text-[10px] text-[var(--text3)]">Auto-generated via Llama 3.3 Site Director models</div>
                      </div>
                      <span className="ai-badge">AI Briefing</span>
                    </div>

                    <div className="rs-ai-text text-xs text-[var(--text2)] leading-relaxed bg-[var(--bg3)] p-4 border-l-3 border-[var(--teal)] rounded-xl mb-4">
                      Overall project health is strong, showing 19 resolved logs. West bridge deck remains a concern due to alignment discrepancies flagged in Zone C. Rework metrics show 6% values. Recommend immediate dispatch on Zone C before 14:00 today.
                    </div>
                  </div>

                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                    <div className="card-title text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] mb-4">Zone Compliance Checklist</div>
                    <div className="space-y-3">
                      {['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'].map((z, idx) => (
                        <div key={z} className="flex items-center gap-3 text-xs">
                          <span className="w-14 text-[var(--text3)]">{z}</span>
                          <div className="flex-1 bg-[var(--bg3)] h-2 rounded-full overflow-hidden">
                            <div className="bg-[var(--teal)] h-full transition-all duration-300" style={{ width: `${88 - idx*10}%` }} />
                          </div>
                          <span className="w-8 text-right font-bold">{88 - idx*10}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                <div className="space-y-6">
                  <div className="card bg-[var(--bg4)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
                    <div className="card-title text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] mb-4">Export Branded Records</div>
                    <div className="space-y-3">
                      <div className="p-3 bg-[var(--bg2)] border border-[var(--border)] rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <div className="font-semibold">Full PDF Inspection Report</div>
                          <div className="text-[10px] text-[var(--text3)]">Includes branded letterhead and photo records</div>
                        </div>
                        <button onClick={() => handleExport('PDF')} className="exp-btn">Export PDF</button>
                      </div>
                      <div className="p-3 bg-[var(--bg2)] border border-[var(--border)] rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <div className="font-semibold">Defect Audit CSV Logs</div>
                          <div className="text-[10px] text-[var(--text3)]">Export excel compatible defect audit trails</div>
                        </div>
                        <button onClick={() => handleExport('CSV')} className="exp-btn">Export CSV</button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>{/* /app-frame */}

        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg)] px-10 py-12 text-xs text-[var(--text3)] mt-auto">
        <div className="max-w-[1300px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AIInspect Pro" className="w-8 h-8 rounded-full border border-[var(--teal)] opacity-60" />
            <span className="font-bold text-[var(--text1)]">AI<span className="text-[var(--teal)]">Inspect Pro</span></span>
          </div>
          <div>© 2026 AIInspect Pro Platform. Powered by Sortyx Ventures.</div>
        </div>
      </footer>

      {/* ── MODALS (REVIEW, PROGRESS, VERIFICATION) ── */}

      {/* 1. REVIEW MODAL */}
      {showReviewModal && activeIssue && (
        <div className="modal-overlay active">
          <div className="modal-card">
            <div className="modal-header">Review Inspection Defect</div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Observation Description</label>
                <div className="p-4 bg-[var(--bg3)] rounded-xl text-[14px] leading-relaxed text-[var(--text2)] border border-[var(--border)]" dangerouslySetInnerHTML={{ __html: activeIssue.desc }} />
              </div>
              {activeIssue.image && (
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Damaged/Defect Photo</label>
                  <div className="h-32 bg-[var(--bg3)] rounded-lg flex items-center justify-center border border-[var(--border)] overflow-hidden">
                    <img src={getImageUrl(activeIssue.image) || ''} className="w-full h-full object-contain" alt="Damaged Component" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Assignee Contractor Team</label>
                <select 
                  value={reviewAssignee}
                  onChange={(e) => setReviewAssignee(parseInt(e.target.value, 10))}
                  className="field-select w-full"
                >
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.team})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Deadline Date</label>
                <input 
                  type="date" 
                  value={reviewDeadline}
                  onChange={(e) => setReviewDeadline(e.target.value)}
                  className="field-input w-full"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowReviewModal(false)} className="btn-ghost py-1.5 px-4 text-xs">Cancel</button>
              <button onClick={submitManagerReview} className="btn-teal py-1.5 px-4 text-xs">Approve & Dispatch Task</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROGRESS MODAL */}
      {showProgressModal && activeIssue && (
        <div className="modal-overlay active">
          <div className="modal-card">
            <div className="modal-header">Log Work Progress</div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Progress Percentage: {progressPct}%</label>
                <input 
                  type="range" 
                  min="0" max="100" step="25"
                  value={progressPct}
                  onChange={(e) => setProgressPct(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer h-1.5 bg-[var(--bg3)] rounded-lg"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Evidence Notes / Comments</label>
                <textarea 
                  value={progressComments}
                  onChange={(e) => setProgressComments(e.target.value)}
                  rows={2}
                  placeholder="Completed alignment checks, re-fitted anchors..."
                  className="field-input w-full"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Before Photo (Defect)</label>
                  <div className="h-28 bg-[var(--bg3)] rounded-lg flex items-center justify-center border border-[var(--border)] overflow-hidden">
                    {activeIssue.image ? (
                      <img src={getImageUrl(activeIssue.image) || ''} className="w-full h-full object-cover" alt="Defect Before" />
                    ) : (
                      <span className="text-[10px] text-[var(--text3)]">No defect photo logged</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">After Photo (Completion)</label>
                  <div className="h-28 bg-[var(--bg3)] rounded-lg flex flex-col items-center justify-center border border-[var(--border)] relative overflow-hidden">
                    {progressAfterImage ? (
                      <img src={progressAfterImage} className="w-full h-full object-cover" alt="Progress After" />
                    ) : (
                      <div className="flex flex-col items-center p-2 text-center">
                        <Camera className="w-5 h-5 text-[var(--text3)] mb-1" />
                        <span className="text-[9px] text-[var(--text3)]">No image uploaded</span>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProgressAfterImageChange}
                    className="text-[9px] text-[var(--text2)] mt-2 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:bg-[var(--teal-dim)] file:text-[var(--teal)] cursor-pointer w-full"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowProgressModal(false)} className="btn-ghost py-1.5 px-4 text-xs">Cancel</button>
              <button onClick={submitWorkerProgress} className="btn-teal py-1.5 px-4 text-xs">Submit Progress Updates</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. VERIFICATION MODAL */}
      {showVerificationModal && activeIssue && (
        <div className="modal-overlay active">
          <div className="modal-card">
            <div className="modal-header">Task Verification Checklist</div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Issue Details</label>
                <div className="p-4 bg-[var(--bg3)] rounded-xl text-[14px] leading-relaxed text-[var(--text2)] border border-[var(--border)]" dangerouslySetInnerHTML={{ __html: activeIssue.desc }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">Before Picture (Defect)</span>
                  <div className="h-28 bg-[var(--bg3)] rounded-lg flex items-center justify-center border border-[var(--border)] overflow-hidden">
                    {activeIssue.image ? (
                      <img src={getImageUrl(activeIssue.image) || ''} className="w-full h-full object-cover" alt="Before" />
                    ) : (
                      <span className="text-[10px] text-[var(--text3)]">No defect photo logged</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text3)] block mb-1">After Picture (Completion)</span>
                  <div className="h-28 bg-[var(--bg3)] rounded-lg flex items-center justify-center border border-[var(--border)] overflow-hidden">
                    {activeIssueAudit.progress?.[0]?.after_img ? (
                      <img src={getImageUrl(activeIssueAudit.progress[0].after_img) || ''} className="w-full h-full object-cover" alt="After" />
                    ) : (
                      <span className="text-[10px] text-[var(--text3)]">No completion photo uploaded</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer justify-between">
              <button onClick={() => submitPMVerify('rework')} className="action-btn delete-btn py-1.5 px-4 text-xs border border-red-500 text-red-500 hover:bg-red-500/10">Order Rework</button>
              <div className="flex gap-2">
                <button onClick={() => setShowVerificationModal(false)} className="btn-ghost py-1.5 px-4 text-xs">Cancel</button>
                <button onClick={() => submitPMVerify('approve')} className="btn-teal py-1.5 px-4 text-xs">Approve & Close Issue</button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ── FLOAT TOAST ── */}
      <div className={`toast ${toast.show ? 'show' : ''} fixed bottom-7 left-7`}>
        <div className="toast-dot" />
        <span id="toast-msg" className="text-xs font-semibold text-[var(--text2)]">{toast.msg}</span>
      </div>

      {/* ── FLOATING CHAT WIDGET ── */}
      <div 
        onClick={() => setChatOpen(!chatOpen)}
        className="chat-fab fixed bottom-7 right-7 bg-[var(--teal)] text-white w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-lg z-[1000]"
      >
        <Send className="w-5 h-5" />
      </div>

      <div className={`chat-window fixed bottom-24 right-7 bg-[var(--nav-bg)] border border-[var(--border2)] rounded-2xl w-[360px] h-[480px] flex flex-col z-[1000] shadow-2xl transition-all duration-300 ${chatOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        <div className="chat-header flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg2)] rounded-t-2xl">
          <div className="flex items-center gap-2 font-bold text-xs tracking-tight">
            <span className="w-2 h-2 rounded-full bg-[var(--teal)] live-dot-blink" />
            AI Site Partner
          </div>
          <button onClick={() => setChatOpen(false)} className="text-[var(--text3)] hover:text-[var(--text1)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="chat-messages flex-1 overflow-y-auto p-4 space-y-3">
          {chatHistory.map((m, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                m.role === 'ai' 
                  ? 'bg-[var(--bg3)] text-[var(--text2)] align-self-start mr-auto rounded-bl-none' 
                  : 'bg-[var(--teal)] text-white align-self-end ml-auto rounded-br-none'
              }`}
            >
              {m.text}
            </div>
          ))}
          {loadingChat && (
            <div className="p-3 rounded-xl text-xs bg-[var(--bg3)] text-[var(--text3)] mr-auto w-[60%] rounded-bl-none animate-pulse">
              AI checking active site reports...
            </div>
          )}
        </div>
        <div className="chat-input-area p-3 border-t border-[var(--border)] flex gap-2">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleChatSend()}
            placeholder="Ask about active issues or metrics..." 
            className="chat-input flex-1"
          />
          <button onClick={handleChatSend} className="chat-send w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--teal)] text-white hover:opacity-90">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
    
    {/* ── MOBILE BOTTOM NAVIGATION ── */}
    <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[var(--nav-bg)] backdrop-blur-md border-t border-[var(--border)] z-[200] flex justify-around items-center h-16 pb-safe px-2">
      <button 
        onClick={() => setCurrentTab('overview')} 
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'overview' ? 'text-[var(--teal)]' : 'text-[var(--text3)]'}`}
      >
        <BarChart3 className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Overview</span>
      </button>

      {(activeRole === 'manager' || activeRole === 'worker') && (
        <button 
          onClick={() => setCurrentTab('dashboard')} 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'dashboard' ? 'text-[var(--teal)]' : 'text-[var(--text3)]'}`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center -mt-4 border-4 border-[var(--bg)] ${currentTab === 'dashboard' ? 'bg-[var(--teal)] text-white shadow-lg shadow-teal-500/30' : 'bg-[var(--bg3)] text-[var(--text2)]'}`}>
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold">{activeRole === 'manager' ? 'Queue' : 'Tasks'}</span>
        </button>
      )}
      
      {activeRole === 'inspector' && (
        <button 
          onClick={() => setCurrentTab('capture')} 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'capture' ? 'text-[var(--teal)]' : 'text-[var(--text3)]'}`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center -mt-4 border-4 border-[var(--bg)] ${currentTab === 'capture' ? 'bg-[var(--teal)] text-white shadow-lg shadow-teal-500/30' : 'bg-[var(--bg3)] text-[var(--text2)]'}`}>
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold">Capture</span>
        </button>
      )}

      {activeRole === 'manager' && (
        <button 
          onClick={() => setCurrentTab('analytics')} 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'analytics' ? 'text-[var(--teal)]' : 'text-[var(--text3)]'}`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Stats</span>
        </button>
      )}
      
      {activeRole === 'manager' && (
        <button 
          onClick={() => setCurrentTab('reports')} 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'reports' ? 'text-[var(--teal)]' : 'text-[var(--text3)]'}`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Reports</span>
        </button>
      )}
    </div>
    </>
  );
}
