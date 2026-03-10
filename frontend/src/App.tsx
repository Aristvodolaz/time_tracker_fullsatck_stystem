import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Settings, X, Plus, Trash2, Upload } from 'lucide-react';
import ReportPage from './ReportPage';

const API_BASE = import.meta.env.VITE_API_BASE ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/api`;

type Status = 'IDLE' | 'WORK' | 'BREAK' | 'OUT';

interface AppState {
  zoneId: string;
  activity: any | null;
  employee: any | null;
  session: any | null;
  status: Status;
  message: string;
  isError: boolean;
  timer: number;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    zoneId: '',
    activity: null,
    employee: null,
    session: null,
    status: 'IDLE',
    message: 'Выберите зону для начала работы',
    isError: false,
    timer: 0,
  });

  const [scannedValue, setScannedValue] = useState('');
  const [isFocused, setIsFocused] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [now, setNow] = useState(new Date());
  const [showAdmin, setShowAdmin] = useState(false);
  const [page, setPage] = useState<'main' | 'report'>('main');
  const [activities, setActivities] = useState<any[]>([]);
  const [adminZone, setAdminZone] = useState('ZONE1');
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [singleForm, setSingleForm] = useState({ zoneId: 'ZONE1', activityBarcode: '', fullName: '', shortName: '', metric: '' });
  const inputRef = useRef<HTMLInputElement>(null);
  const clearId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleHash = () => {
      setPage(window.location.hash === '#report' ? 'report' : 'main');
    };
    window.addEventListener('hashchange', handleHash);
    handleHash(); // Initial check
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const loadActivities = useCallback(async () => {
    try { const r = await axios.get(`${API_BASE}/activities`); setActivities(r.data); } catch { }
  }, []);

  useEffect(() => { if (showAdmin) loadActivities(); }, [showAdmin, loadActivities]);

  // Live clock
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Refocus hidden input unless an interactive element is focused, or testMode/admin is open
  useEffect(() => {
    if (testMode || showAdmin) return;
    const interval = setInterval(() => {
      const active = document.activeElement;
      const isInteractive =
        active &&
        active !== inputRef.current &&
        (active.tagName === 'SELECT' ||
          active.tagName === 'BUTTON' ||
          active.tagName === 'TEXTAREA' ||
          (active.tagName === 'INPUT' && active !== inputRef.current));
      if (inputRef.current && !isInteractive) {
        inputRef.current.focus();
      }
    }, 300);
    return () => clearInterval(interval);
  }, [testMode, showAdmin]);

  // Break timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (state.status === 'BREAK' && state.session) {
      interval = setInterval(() => {
        setState(prev => ({ ...prev, timer: prev.timer + 1 }));
      }, 1000);
    } else {
      setState(prev => ({ ...prev, timer: 0 }));
    }
    return () => { if (interval) clearInterval(interval); };
  }, [state.status, state.session]);

  const processResponse = async (type: string, payload: any, message: string) => {
    if (type === 'ERROR') { triggerFeedback(message, true); return; }
    if (type === 'ACTIVITY_SELECTED') {
      setState(prev => ({ ...prev, activity: payload, message: `Активность: ${payload.shortName}`, isError: false }));
      startAutoClear();
      return;
    }
    if (type === 'EMPLOYEE_SHOWN') {
      const { employee, activeSession } = payload;
      setState(prev => ({
        ...prev, employee, session: activeSession,
        activity: activeSession ? { id: activeSession.activityId, shortName: activeSession.shortName, activityBarcode: activeSession.activityBarcode } : prev.activity,
        status: activeSession ? activeSession.status : 'IDLE', message, isError: false,
      }));
    } else if (type === 'CHECKIN_DONE') {
      const actUpdate = payload.autoDetectedActivity
        ? { id: payload.autoDetectedActivity.id, shortName: payload.autoDetectedActivity.shortName, activityBarcode: payload.autoDetectedActivity.activityBarcode }
        : undefined;
      setState(prev => ({
        ...prev, employee: payload.employee, session: payload.session, status: 'WORK', message, isError: false,
        ...(actUpdate ? { activity: actUpdate } : {}),
      }));
    } else if (['BREAK_STARTED', 'BREAK_STOPPED', 'TIME_TYPE_SELECTED'].includes(type)) {
      const statusRes = await axios.get(`${API_BASE}/status/employee?barcode=${state.employee.barcode}`);
      setState(prev => ({ ...prev, session: statusRes.data, status: statusRes.data.status, message, isError: false }));
    } else if (type === 'CHECKOUT_DONE') {
      setState(prev => ({ ...prev, status: 'OUT', message, isError: false, session: payload }));
    }
    startAutoClear();
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = scannedValue.trim();
    if (!value) return;
    setScannedValue('');
    if (!state.zoneId) { triggerFeedback('Сначала выберите зону!', true); return; }
    try {
      const res = await axios.post(`${API_BASE}/scan`, {
        zoneId: state.zoneId, scannedValue: value,
        currentEmployeeBarcode: state.employee?.barcode,
        currentActivityId: state.activity?.id
      });
      await processResponse(res.data.type, res.data.payload, res.data.message);
    } catch { triggerFeedback('Ошибка связи с сервером', true); }
  };

  const handleCoeff = async (cmdBarcode: string) => {
    if (!state.session || !state.employee) return;
    try {
      const res = await axios.post(`${API_BASE}/scan`, {
        zoneId: state.zoneId, scannedValue: cmdBarcode,
        currentEmployeeBarcode: state.employee?.barcode,
        currentActivityId: state.activity?.id
      });
      const statusRes = await axios.get(`${API_BASE}/status/employee?barcode=${state.employee.barcode}`);
      setState(prev => ({ ...prev, session: statusRes.data, status: statusRes.data.status, message: res.data.message, isError: false }));
    } catch { triggerFeedback('Ошибка при смене коэффициента', true); }
  };



  const triggerFeedback = (message: string, isError: boolean) => {
    setState(prev => ({ ...prev, message, isError }));
    startAutoClear();
  };

  const startAutoClear = () => {
    if (clearId.current) clearTimeout(clearId.current);
    clearId.current = setTimeout(() => {
      setState(prev => ({
        ...prev, employee: null, session: null,
        status: 'IDLE', message: 'Ожидание сканирования ШК', isError: false
      }));
    }, 30000);
  };

  const formatDT = (d?: string | Date | null) => {
    if (!d) return formatDT(now);
    const dt = typeof d === 'string' ? new Date(d) : d;
    const date = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${date} ${time}`;
  };

  const formatHM = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  // Live worked time: use now for active sessions, outTime after checkout
  const netSeconds = state.session
    ? (() => {
      const end = state.session.outTime ? new Date(state.session.outTime) : now;
      const gross = Math.round((end.getTime() - new Date(state.session.inTime).getTime()) / 1000);
      const breakSoFar = (state.session.breakTotalSeconds || 0) +
        (state.status === 'BREAK' && state.session.breakStartedAt
          ? Math.round((now.getTime() - new Date(state.session.breakStartedAt).getTime()) / 1000)
          : 0);
      return Math.max(0, gross - breakSoFar);
    })()
    : 0;

  const breakSeconds = state.status === 'BREAK'
    ? state.timer + (state.session?.breakTotalSeconds || 0)
    : (state.session?.breakTotalSeconds || 0);

  const currentCoeff = state.session?.timeType || 'X1';

  if (page === 'report') {
    return <ReportPage />;
  }


  return (
    <div style={{ minHeight: '100vh', background: '#e8eef5', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#fff', borderBottom: '1px solid #d1dbe8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#1e3a5f' }}>TimeTracker</span>
          <select
            value={state.zoneId}
            onChange={e => setState(prev => ({ ...prev, zoneId: e.target.value, message: 'Ожидание сканирования ШК активности' }))}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #b8c8d8', fontSize: 14, background: '#f4f8fc', cursor: 'pointer', color: '#1e3a5f', fontWeight: 600 }}
          >
            <option value="">— Выберите зону —</option>
            <option value="ZONE1">Склад (ZONE1)</option>
            <option value="ZONE2">Логистика (ZONE2)</option>
          </select>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isFocused ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
            <span style={{ color: isFocused ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {isFocused ? 'Сканер активен' : 'Сканер не активен'}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setTestMode(prev => !prev)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${testMode ? '#f59e0b' : '#b8c8d8'}`, background: testMode ? '#fef3c7' : '#f4f8fc', cursor: 'pointer', color: testMode ? '#b45309' : '#1e3a5f', fontWeight: 700, fontSize: 13 }}
          >
            {testMode ? '✔ Тест-режим' : 'Тест-режим'}
          </button>
          <button title="Админ: Активности" onClick={() => setShowAdmin(true)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #b8c8d8', background: '#f4f8fc', cursor: 'pointer', color: '#1e3a5f' }}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Test Mode Manual Input Bar */}
      {testMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 24px', background: '#fef9ec', borderBottom: '2px solid #f59e0b' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>• Тест — ручной ввод: </span>
          <input
            type="text"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const val = manualInput.trim();
                if (!val) return;
                setManualInput('');
                // process directly without state timing issue
                (async () => {
                  if (!state.zoneId) { triggerFeedback('Сначала выберите зону!', true); return; }
                  try {
                    const res = await axios.post(`${API_BASE}/scan`, {
                      zoneId: state.zoneId, scannedValue: val,
                      currentEmployeeBarcode: state.employee?.barcode,
                      currentActivityId: state.activity?.id
                    });
                    await processResponse(res.data.type, res.data.payload, res.data.message);
                  } catch { triggerFeedback('Ошибка связи с сервером', true); }
                })();
              }
            }}
            placeholder="Введите код ШК и нажмите Enter..."
            style={{ flex: 1, maxWidth: 400, padding: '6px 12px', borderRadius: 8, border: '1px solid #f59e0b', fontSize: 15, outline: 'none', background: '#fffbf0' }}
            autoFocus
          />
        </div>
      )}

      {/* Main Card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          background: '#dde8f2',
          border: '2px solid #b0c4d8',
          borderRadius: 24,
          padding: '36px 40px',
          width: '100%',
          maxWidth: 900,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px 48px',
        }}>
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Activity */}
            <div>
              <div style={{ fontSize: 15, color: '#3a5a7a', marginBottom: 8, textAlign: 'center' }}>
                Сканируйте ШК активности
              </div>
              <div style={{
                background: '#fff',
                border: '1px solid #a0b8cc',
                borderRadius: 12,
                padding: '14px 20px',
                fontSize: 22,
                fontWeight: 700,
                color: state.activity ? '#1e3a5f' : '#a0b8cc',
                textAlign: 'center',
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {state.activity ? state.activity.shortName : '—'}
              </div>
            </div>

            {/* Employee */}
            <div>
              <div style={{ fontSize: 15, color: '#3a5a7a', marginBottom: 8, textAlign: 'center' }}>
                Сканируйте ШК сотрудника
              </div>
              <div style={{
                background: '#fff',
                border: '1px solid #a0b8cc',
                borderRadius: 12,
                padding: '14px 20px',
                fontSize: 20,
                fontWeight: 600,
                color: state.employee ? '#1e3a5f' : '#a0b8cc',
                textAlign: 'center',
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {state.employee ? state.employee.fullName : '—'}
              </div>
            </div>

            {/* Status */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
              <span style={{
                fontSize: 40,
                fontWeight: 900,
                color: state.status === 'WORK' ? '#16a34a' : '#d1d5db',
                letterSpacing: 1,
                transition: 'color 0.2s',
              }}>
                РАБОТА
              </span>
              <span style={{
                fontSize: 40,
                fontWeight: 900,
                color: state.status === 'BREAK' ? '#f59e0b' : '#d1d5db',
                letterSpacing: 1,
                transition: 'color 0.2s',
              }}>
                ПЕРЕРЫВ
              </span>
              <span style={{
                fontSize: 40,
                fontWeight: 900,
                color: state.status === 'OUT' ? '#dc2626' : '#d1d5db',
                letterSpacing: 1,
                transition: 'color 0.2s',
              }}>
                УХОД
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Arrival */}
            <div>
              <div style={{ fontSize: 14, color: '#3a5a7a', marginBottom: 6 }}>Дата и время прихода</div>
              <div style={inputBox}>{state.session?.inTime ? formatDT(state.session.inTime) : formatDT()}</div>
            </div>

            {/* Departure */}
            <div>
              <div style={{ fontSize: 14, color: '#3a5a7a', marginBottom: 6 }}>Дата и время ухода</div>
              <div style={inputBox}>{state.session?.outTime ? formatDT(state.session.outTime) : '—'}</div>
            </div>

            {/* Worked + Coeff */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#3a5a7a', marginBottom: 6 }}>Отработано</div>
                <div style={inputBox}>{netSeconds > 0 ? formatHM(netSeconds) : '—'}</div>
              </div>
              <div style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([['X1', 'CMD_X1', 'x1'], ['X1_5', 'CMD_X1_5', 'x1,5'], ['X2', 'CMD_X2', 'x2']] as const).map(([type, cmd, label]) => {
                  const isActive = currentCoeff === type;
                  return (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: state.session ? 'pointer' : 'default', fontSize: 15, fontWeight: 600, color: '#1e3a5f' }}>
                      <input
                        type="radio"
                        name="coeff"
                        checked={isActive}
                        onChange={() => handleCoeff(cmd)}
                        disabled={!state.session}
                        style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: state.session ? 'pointer' : 'default' }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Break */}
            <div>
              <div style={{ fontSize: 14, color: '#3a5a7a', marginBottom: 6 }}>Перерыв</div>
              <div style={inputBox}>{breakSeconds > 0 ? formatHM(breakSeconds) : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        maxWidth: 900, margin: '0 auto', padding: '0 24px 12px',
        display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {[
          { step: '1', text: 'Сканируйте ШК активности (участка)', color: '#2563eb' },
          { step: '2', text: 'Сканируйте ШК сотрудника — рабочий день начнётся автоматически', color: '#16a34a' },
          { step: '3', text: 'Перерыв → сканируйте ШК-ПЕРЕРЫВ Уход → сканируйте ШК-УХОД', color: '#f59e0b' },
        ].map(s => (
          <div key={s.step} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 14px',
            fontSize: 13, color: '#475569',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', background: s.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, flexShrink: 0,
            }}>{s.step}</span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>

      {/* Bottom Message */}
      <div style={{
        padding: '12px 24px',
        borderTop: '1px solid #c8d8e8',
        background: state.isError ? '#fef2f2' : '#f0f6ff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: state.isError ? '#ef4444' : '#3b82f6',
        }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: state.isError ? '#b91c1c' : '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Системное сообщение
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: state.isError ? '#7f1d1d' : '#1e3a5f' }}>
            {state.message}
          </div>
        </div>
      </div>

      {/* Hidden Scanner Input */}
      <form onSubmit={handleScan} style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <input
          ref={inputRef}
          type="text"
          value={scannedValue}
          onChange={e => setScannedValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus
        />
      </form>

      {/* Activities Admin Modal */}
      {showAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>Управление активностями</h2>
              <button onClick={() => { setShowAdmin(false); setBulkResult(null); setBulkText(''); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            {/* Bulk Import from Excel */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, color: '#1e3a5f', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={16} /> Массовый импорт из Excel (вставьте колонки: Наименование, ШК, Метрика)
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Зона:</span>
                <select value={adminZone} onChange={e => setAdminZone(e.target.value)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
                  <option value="ZONE1">Склад (ZONE1)</option>
                  <option value="ZONE2">Логистика (ZONE2)</option>
                </select>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Скопируйте ячейки из Excel и вставьте в поле ниже</span>
              </div>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={'Наименование\tШК\tМетрика\nРЦ_Домодедово_...\t000001111\tсмена 3'}
                style={{ width: '100%', height: 100, borderRadius: 8, border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: 13, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
                <button
                  onClick={async () => {
                    setBulkResult(null);
                    const lines = bulkText.trim().split('\n').filter(l => l.trim());
                    const acts = lines.map(line => {
                      const [fullName, activityBarcode, metric] = line.split('\t').map(s => s.trim());
                      // shortName: last meaningful segment of fullName (up to 100 chars)
                      const parts = fullName?.split('_').filter(Boolean);
                      const shortName = (parts?.slice(-3).join('_') || fullName || '').slice(0, 99);
                      return { zoneId: adminZone, activityBarcode, fullName, shortName, metric };
                    }).filter(a => a.activityBarcode && a.fullName);
                    if (!acts.length) { setBulkResult({ error: 'Нет данных для импорта' }); return; }
                    try {
                      const r = await axios.post(`${API_BASE}/activities/bulk`, { activities: acts });
                      setBulkResult(r.data);
                      setBulkText('');
                      loadActivities();
                    } catch (e: any) { setBulkResult({ error: e.message }); }
                  }}
                  style={{ padding: '6px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  <Plus size={14} style={{ display: 'inline', marginRight: 4 }} />
                  Импортировать
                </button>
                {bulkResult && (
                  <span style={{ fontSize: 13, color: bulkResult.error ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    {bulkResult.error || `✔ Добавлено: ${bulkResult.created}, пропущено: ${bulkResult.skipped}`}
                  </span>
                )}
              </div>
            </div>

            {/* Single Add Form */}
            <details style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#1e3a5f', fontSize: 14 }}>+ Добавить одну активность вручную</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, marginTop: 10, alignItems: 'end' }}>
                {[
                  { key: 'activityBarcode', placeholder: 'ШК' },
                  { key: 'fullName', placeholder: 'Полное название' },
                  { key: 'shortName', placeholder: 'Короткое' },
                  { key: 'metric', placeholder: 'Метрика' },
                ].map(f => (
                  <input key={f.key} placeholder={f.placeholder} value={(singleForm as any)[f.key]}
                    onChange={e => setSingleForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
                ))}
                <button onClick={async () => {
                  if (!singleForm.activityBarcode || !singleForm.fullName || !singleForm.shortName) return;
                  await axios.post(`${API_BASE}/activities`, { ...singleForm });
                  setSingleForm({ zoneId: 'ZONE1', activityBarcode: '', fullName: '', shortName: '', metric: '' });
                  loadActivities();
                }} style={{ padding: '6px 14px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  Добавить
                </button>
              </div>
            </details>

            {/* Activity List */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                    {['Зона', 'ШК', 'Полное название', 'Короткое', 'Метрика', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activities.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Нет активностей</td></tr>
                  )}
                  {activities.map((act: any) => (
                    <tr key={act.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 10px', color: '#64748b' }}>{act.zoneId}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{act.activityBarcode}</td>
                      <td style={{ padding: '6px 10px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={act.fullName}>{act.fullName}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1e3a5f' }}>{act.shortName}</td>
                      <td style={{ padding: '6px 10px', color: '#64748b' }}>{act.metric}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <button onClick={async () => {
                          if (!confirm(`Удалить "${act.shortName}"?`)) return;
                          await axios.delete(`${API_BASE}/activities/${act.id}`);
                          loadActivities();
                        }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const inputBox: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #a0b8cc',
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 18,
  fontWeight: 600,
  color: '#1e3a5f',
  minHeight: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default App;
