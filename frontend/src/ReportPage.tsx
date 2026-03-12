import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ArrowLeft, Download, Search } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/api`;


function fmtHM(seconds: number): string {
    if (!seconds || seconds <= 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
}

const ReportPage: React.FC = () => {
    const today = new Date().toISOString().slice(0, 10);
    const [dateFrom, setDateFrom] = useState(today);
    const [dateTo, setDateTo] = useState(today);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [grouped, setGrouped] = useState<any[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Держим URL в синхронизации со страницей отчёта, чтобы не сбрасывало на главную
    useEffect(() => {
        if ((window.location.hash || '').toLowerCase() !== '#report') {
            window.history.replaceState(null, '', (window.location.pathname || '/') + (window.location.search || '') + '#report');
        }
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await axios.get(`${API_BASE}/report`, { params: { dateFrom, dateTo } });
            let list: any[] = [];
            if (Array.isArray(res.data)) list = res.data;
            else if (res.data && Array.isArray((res.data as any).sessions)) list = (res.data as any).sessions;
            else if (res.data && Array.isArray((res.data as any).data)) list = (res.data as any).data;
            setSessions(list);
        } catch (e: any) {
            setSessions([]);
            const msg = e?.response?.status === 404 ? 'Эндпоинт отчёта не найден' : e?.response?.data?.message || e?.message || 'Ошибка загрузки отчёта';
            setLoadError(msg);
        }
        setLoading(false);
    }, [dateFrom, dateTo]);

    useEffect(() => { loadData(); }, [loadData]);

    // Group sessions by employee + date
    useEffect(() => {
        const map: Record<string, any> = {};
        const list = Array.isArray(sessions) ? sessions : [];
        list.forEach((s: any) => {
            const d = s.date ? new Date(s.date).toISOString().slice(0, 10) : '';
            const key = `${s.employeeBarcode || ''}_${d}`;
            if (!map[key]) map[key] = { employeeBarcode: s.employeeBarcode, date: d, fullName: s.fullName || '', bossId: s.bossId ?? '', departmentName: s.departmentName ?? '', sessions: [] };
            map[key].sessions.push(s);
        });
        setGrouped(Object.values(map));
    }, [sessions]);

    const handleDownload = () => {
        const params = new URLSearchParams();
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);
        const url = `${API_BASE}/report/excel?${params.toString()}`;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#fff', borderBottom: '1px solid #d1dbe8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button onClick={() => window.location.hash = ''} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #b8c8d8', background: '#f4f8fc', cursor: 'pointer', color: '#1e3a5f', fontWeight: 600, fontSize: 14 }}>
                        <ArrowLeft size={16} /> Назад
                    </button>
                    <span style={{ fontWeight: 700, fontSize: 18, color: '#1e3a5f' }}>Отчёт по сменам</span>
                </div>
                <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
                    <Download size={16} /> Скачать Excel
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>С:</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, color: '#1e3a5f' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>По:</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, color: '#1e3a5f' }} />
                </div>
                <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, color: '#1e3a5f', fontSize: 14 }}>
                    <Search size={14} /> Показать
                </button>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Найдено: {grouped.length} записей</span>
                <span style={{ fontSize: 11, color: '#cbd5e1' }} title="Куда уходит запрос">API: {API_BASE}</span>
            </div>

            {loadError && (
                <div style={{ margin: '16px 24px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 14, fontWeight: 600 }}>
                    {loadError}
                </div>
            )}

            {/* Table */}
            <div style={{ padding: 24, overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 16 }}>Загрузка...</div>
                ) : grouped.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 16 }}>Нет данных за выбранный период</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                                <th style={th}>ШК сотрудника</th>
                                <th style={th}>Boss ID</th>
                                <th style={th}>ФИО</th>
                                <th style={th}>Дата</th>
                                <th style={th}>Подразделение</th>
                                <th style={th}>Код активности</th>
                                <th style={th}>Активность</th>
                                <th style={th}>Приход</th>
                                <th style={th}>Уход</th>
                                <th style={th}>Отработано</th>
                                <th style={th}>Перерыв</th>
                                <th style={th}>Ночь</th>
                                <th style={th}>Коэфф.</th>
                                <th style={th}>Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((g, gi) => (
                                (Array.isArray(g.sessions) ? g.sessions : []).map((s: any, si: number) => {
                                    const inTime = new Date(s.inTime);
                                    const outTime = s.outTime ? new Date(s.outTime) : null;
                                    const worked = outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 1000) - (s.breakTotalSeconds || 0) : 0;
                                    const statusColor = s.status === 'WORK' ? '#16a34a' : s.status === 'BREAK' ? '#f59e0b' : s.status === 'OUT' ? '#94a3b8' : '#64748b';
                                    const statusLabel = s.status === 'WORK' ? 'РАБОТА' : s.status === 'BREAK' ? 'ПЕРЕРЫВ' : s.status === 'OUT' ? 'УХОД' : s.status;
                                    return (
                                        <tr key={`${gi}-${si}`} style={{ borderBottom: '1px solid #f1f5f9', background: si % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            {si === 0 ? (
                                                <>
                                                    <td style={{ ...td, fontWeight: 700 }} rowSpan={(g.sessions && g.sessions.length) || 1}>{g.employeeBarcode ?? '—'}</td>
                                                    <td style={{ ...td, fontFamily: 'monospace' }} rowSpan={(g.sessions && g.sessions.length) || 1}>{g.bossId ?? '—'}</td>
                                                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} rowSpan={(g.sessions && g.sessions.length) || 1}>{g.fullName ?? '—'}</td>
                                                    <td style={td} rowSpan={(g.sessions && g.sessions.length) || 1}>{g.date ? new Date(g.date).toLocaleDateString('ru-RU') : '—'}</td>
                                                    <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} rowSpan={(g.sessions && g.sessions.length) || 1}>{g.departmentName ?? '—'}</td>
                                                </>
                                            ) : null}
                                            <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{s.activityBarcode}</td>
                                            <td style={{ ...td, fontSize: 12 }}>{s.shortName || ''}</td>
                                            <td style={td}>{inTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td style={td}>{outTime ? outTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                            <td style={{ ...td, fontWeight: 600 }}>{worked > 0 ? fmtHM(worked) : '—'}</td>
                                            <td style={td}>{fmtHM(s.breakTotalSeconds || 0) || '—'}</td>
                                            <td style={td}>{fmtHM(s.nightWorkedSeconds || 0) || '—'}</td>
                                            <td style={{ ...td, fontWeight: 600 }}>{s.timeType?.replace('_', '.') || 'X1'}</td>
                                            <td style={td}>
                                                <span style={{ padding: '2px 8px', borderRadius: 6, background: statusColor + '18', color: statusColor, fontWeight: 700, fontSize: 12 }}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const th: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 12,
    textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
    padding: '8px 12px', whiteSpace: 'nowrap', color: '#1e3a5f',
};

export default ReportPage;
