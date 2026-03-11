import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { 
  Plus, LogOut, LayoutDashboard, 
  Trash2, ShieldCheck, Edit, 
  ArrowUpCircle, ArrowDownCircle, Calendar, Wallet, RefreshCw, User
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from './api';
import './i18n';
import './App.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const CURRENCIES = ['MDL', 'USD', 'EUR', 'RON'];

const groupTransactionsByDate = (transactions: any[]) => {
  return transactions.reduce((groups: any, tx: any) => {
    const date = new Date(tx.date).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
    return groups;
  }, {});
};

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  return (
    <div style={{ display: 'flex', gap: '8px', padding: '0 12px' }}>
      {['ru', 'ro', 'en'].map(lng => (
        <button 
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          style={{ 
            background: i18n.language === lng ? '#ebf3ff' : 'transparent',
            border: 'none', color: i18n.language === lng ? '#4a90e2' : '#7f8c8d',
            padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '11px'
          }}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ startDate: firstDayOfMonth, endDate: today });

  const [newTx, setNewTx] = useState({ amount: '', currency: 'MDL', category_id: '', type: 'expense', description: '', date: today });

  useEffect(() => { fetchData(); }, [dateRange]);

  const fetchData = async () => {
    try {
      const params = { startDate: dateRange.startDate, endDate: dateRange.endDate };
      const [s, c, tRes, lRes, rRes] = await Promise.all([
        api.get('/budget/summary', { params }),
        api.get('/budget/categories'),
        api.get('/budget/transactions', { params }),
        api.get('/budget/admin/logs').catch(() => ({ data: [] })),
        api.get('/budget/rates').catch(() => ({ data: [] }))
      ]);
      setSummary(s.data);
      setCategories(c.data);
      setTransactions(tRes.data);
      setLogs(lRes.data);
      setRates(rRes.data);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/budget/transactions', newTx);
    setShowAdd(false);
    fetchData();
  };

  if (!summary) return <div style={{ padding: '40px', textAlign: 'center' }}>{t('Loading...')}</div>;

  const groupedTx = groupTransactionsByDate(transactions);
  const balance = (parseFloat(summary.summary.total_income || 0) - parseFloat(summary.summary.total_expense || 0)).toFixed(2);

  return (
    <div className="container-zen">
      {/* Left Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card">
          <div className="balance-hero">
            <small className="section-title" style={{ marginBottom: 0 }}>{t('balance')}</small>
            <div className="balance-amount">{balance} MDL</div>
          </div>
          <div className="stats-mini-grid">
            <div className="stat-box income">
              <ArrowUpCircle size={16} />
              <div style={{ fontWeight: 700, marginTop: '4px' }}>+{parseFloat(summary.summary.total_income || 0).toFixed(0)}</div>
            </div>
            <div className="stat-box expense">
              <ArrowDownCircle size={16} />
              <div style={{ fontWeight: 700, marginTop: '4px' }}>-{parseFloat(summary.summary.total_expense || 0).toFixed(0)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={14} /> {t('currency_rates')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '12px' }}>
            {rates.map(r => (
              <div key={r.currency} style={{ textAlign: 'center', padding: '8px', background: '#f8fafd', borderRadius: '12px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--zen-primary)' }}>{r.currency}</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{parseFloat(r.rate_to_mdl).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">{t('analysis')}</h3>
          <div style={{ padding: '10px' }}>
            <Pie 
              data={{
                labels: summary.categories.map((c: any) => c.name),
                datasets: [{
                  data: summary.categories.map((c: any) => c.total),
                  backgroundColor: ['#4a90e2', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6', '#34495e', '#1abc9c']
                }]
              }}
              options={{ plugins: { legend: { display: false } } }}
            />
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">{t('activity')}</h3>
          <div style={{ fontSize: '13px', maxHeight: '200px', overflowY: 'auto' }}>
            {logs.map((log: any) => (
              <div key={log.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f2f5' }}>
                <span style={{ fontWeight: 700 }}>{log.username}</span>: {log.details}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input className="input-zen" style={{ marginTop: 0, padding: '8px 12px', fontSize: '0.9rem' }} type="date" value={dateRange.startDate} onChange={e => setDateRange({...dateRange, startDate: e.target.value})} />
            <input className="input-zen" style={{ marginTop: 0, padding: '8px 12px', fontSize: '0.9rem' }} type="date" value={dateRange.endDate} onChange={e => setDateRange({...dateRange, endDate: e.target.value})} />
          </div>
          <button className="btn-zen" style={{ width: 'auto', padding: '8px 20px' }} onClick={() => setShowAdd(true)}>
            <Plus size={18} /> <span className="desktop-only">{t('add_tx')}</span>
          </button>
        </div>

        {Object.keys(groupedTx).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#bdc3c7' }}>
            <Calendar size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <p>{t('no_transactions')}</p>
          </div>
        ) : (
          Object.keys(groupedTx).map(date => (
            <div key={date} className="day-group">
              <div className="day-header">
                <span>{date}</span>
                <span>{groupedTx[date].reduce((acc: number, curr: any) => acc + (curr.type === 'expense' ? -parseFloat(curr.amount_mdl) : parseFloat(curr.amount_mdl)), 0).toFixed(2)} MDL</span>
              </div>
              <div className="card" style={{ padding: '8px 20px' }}>
                {groupedTx[date].map((tx: any) => (
                  <div key={tx.id} className="transaction-row">
                    <div className="cat-icon">
                      {tx.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                    </div>
                    <div className="tx-info">
                      <div className="tx-name">{tx.category_name}</div>
                      <div className="tx-desc">
                        {tx.description || t('no_description')} <br />
                        <small style={{ color: 'var(--zen-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={10} /> {tx.owner_name}
                        </small>
                      </div>
                    </div>
                    <div className="tx-amount">
                      <div className="amount-main" style={{ color: tx.type === 'income' ? 'var(--zen-success)' : 'var(--zen-text)' }}>
                        {tx.type === 'income' ? '+' : ''}{parseFloat(tx.amount).toFixed(2)} {tx.currency}
                      </div>
                      {tx.currency !== 'MDL' && <div className="amount-sub">{parseFloat(tx.amount_mdl).toFixed(2)} MDL</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <button className="fab" onClick={() => setShowAdd(true)}><Plus size={32} /></button>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(44, 62, 80, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', margin: 0 }}>
            <h3 style={{ marginBottom: '24px' }}>{t('add_tx')}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px' }}>
                <input className="input-zen" type="number" step="0.01" placeholder="0.00" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} required autoFocus />
                <select className="input-zen" value={newTx.currency} onChange={e => setNewTx({...newTx, currency: e.target.value})}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <select className="input-zen" value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value})}>
                  <option value="expense">{t('expense')}</option>
                  <option value="income">{t('income')}</option>
                </select>
                <select className="input-zen" value={newTx.category_id} onChange={e => setNewTx({...newTx, category_id: e.target.value})} required>
                  <option value="">{t('category')}</option>
                  {categories.filter(c => c.type === newTx.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <input className="input-zen" type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} required style={{ marginTop: '12px' }} />
              <input className="input-zen" type="text" placeholder={t('description')} value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} style={{ marginTop: '12px', marginBottom: '24px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-zen" type="submit" style={{ flex: 2 }}>{t('save')}</button>
                <button className="btn-zen" type="button" style={{ background: '#ecf0f1', color: '#7f8c8d', flex: 1 }} onClick={() => setShowAdd(false)}>{t('cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Settings = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('expense');
  const [editingId, setEditingId] = useState<number | null>(null);
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  useEffect(() => { fetchCategories(); }, []);
  const fetchCategories = async () => { const res = await api.get('/budget/categories'); setCategories(res.data); };

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.put(`/budget/categories/${editingId}`, { name: newName, type: newType });
      setEditingId(null);
    } else {
      await api.post('/budget/categories', { name: newName, type: newType });
    }
    setNewName('');
    fetchCategories();
  };

  const handleEdit = (category: any) => { setEditingId(category.id); setNewName(category.name); setNewType(category.type); };
  const handleDelete = async (id: number) => { if (window.confirm(t('delete') + '?')) { await api.delete(`/budget/categories/${id}`); fetchCategories(); } };

  return (
    <div className="container-zen" style={{ display: 'block', maxWidth: '800px' }}>
      <div className="card">
        <h3 className="section-title">{editingId ? t('edit_category') : t('manage_categories')}</h3>
        <form onSubmit={handleAddOrUpdate} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input className="input-zen" style={{ flex: 2, marginTop: 0 }} placeholder={t('name')} value={newName} onChange={e => setNewName(e.target.value)} required />
          <select className="input-zen" style={{ flex: 1, marginTop: 0 }} value={newType} onChange={e => setNewType(e.target.value)}><option value="expense">{t('expense')}</option><option value="income">{t('income')}</option></select>
          <button className="btn-zen" type="submit" style={{ width: 'auto' }}>{editingId ? t('save') : t('add_category')}</button>
          {editingId && <button className="btn-zen" style={{ background: '#ecf0f1', color: '#7f8c8d', width: 'auto' }} onClick={() => { setEditingId(null); setNewName(''); }}>{t('cancel')}</button>}
        </form>
        <div style={{ borderTop: '1px solid #f0f2f5', paddingTop: '12px' }}>
          {categories.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f9fbff' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <small style={{ color: '#7f8c8d' }}>{t(c.type)}</small>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(c.user_id || isAdmin) && (<><button onClick={() => handleEdit(c)} style={{ background: 'none', border: 'none', color: '#bdc3c7', cursor: 'pointer' }}><Edit size={18} /></button><button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: '#bdc3c7', cursor: 'pointer' }}><Trash2 size={18} /></button></>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Admin = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [regEnabled, setRegEnabled] = useState(true);
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: false });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => { const [u, s] = await Promise.all([api.get('/budget/admin/users'), api.get('/auth/registration-status')]); setUsers(u.data); setRegEnabled(s.data.enabled); };

  const handleAddUser = async (e: React.FormEvent) => { e.preventDefault(); try { await api.post('/budget/admin/users', newUser); setNewUser({ username: '', password: '', is_admin: false }); fetchData(); } catch (err: any) { alert(err.response?.data?.error || 'Error'); } };
  const toggleReg = async () => { await api.post('/budget/admin/registration', { enabled: !regEnabled }); setRegEnabled(!regEnabled); };
  const deleteUser = async (id: number) => { if (window.confirm('Delete user?')) { await api.delete(`/budget/admin/users/${id}`); fetchData(); } };

  return (
    <div className="container-zen" style={{ display: 'block', maxWidth: '800px' }}>
      <div className="card">
        <h3 className="section-title">{t('add_user')}</h3>
        <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input className="input-zen" style={{ flex: 1, marginTop: 0 }} placeholder={t('username')} value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
          <input className="input-zen" style={{ flex: 1, marginTop: 0 }} type="password" placeholder={t('password')} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={newUser.is_admin} onChange={e => setNewUser({...newUser, is_admin: e.target.checked})} /> Admin</label>
          <button className="btn-zen" type="submit" style={{ width: 'auto' }}>{t('add_user')}</button>
        </form>
      </div>
      <div className="card">
        <h3 className="section-title">{t('registration')}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('registration')}: <strong>{regEnabled ? t('enabled') : t('disabled')}</strong></span>
          <button className="btn-zen" onClick={toggleReg} style={{ width: 'auto', background: regEnabled ? '#ffeded' : '#f0fff4', color: regEnabled ? '#e74c3c' : '#2ecc71' }}>{regEnabled ? t('disabled') : t('enabled')}</button>
        </div>
      </div>
      <div className="card">
        <h3 className="section-title">{t('users')}</h3>
        {users.map(u => (
          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f9fbff' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{u.username}</div>
              <small style={{ color: '#7f8c8d' }}>{u.is_admin ? 'Admin' : 'User'}</small>
            </div>
            {!u.is_admin && <button onClick={() => deleteUser(u.id)} style={{ color: '#bdc3c7', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
};

const Auth = ({ type }: { type: 'login' | 'register' }) => {
  const { t } = useTranslation();
  const [user, setUser] = useState({ username: '', password: '' });
  const [regStatus, setRegStatus] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { if (type === 'register') api.get('/auth/registration-status').then(res => setRegStatus(res.data.enabled)); }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post(`/auth/${type}`, user);
      if (type === 'login') { localStorage.setItem('token', res.data.token); localStorage.setItem('is_admin', res.data.is_admin); window.location.href = '/'; }
      else { navigate('/login'); }
    } catch (err: any) { alert(err.response?.data?.error || 'Error'); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw', background: '#f8fafd' }}>
      <div className="card" style={{ width: '100%', maxWidth: '380px', padding: '40px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '32px', fontWeight: 800, color: '#4a90e2' }}>Family Budget</h2>
        {type === 'register' && !regStatus ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#7f8c8d', marginBottom: '24px' }}>{t('reg_closed')}</p>
            <Link to="/login" className="btn-zen">{t('back_to_login')}</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input className="input-zen" placeholder={t('username')} value={user.username} onChange={e => setUser({...user, username: e.target.value})} required />
            <input className="input-zen" type="password" placeholder={t('password')} value={user.password} onChange={e => setUser({...user, password: e.target.value})} required style={{ marginTop: '12px' }} />
            <button className="btn-zen" type="submit" style={{ marginTop: '24px' }}>{t(type)}</button>
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              {type === 'login' ? <Link to="/register" style={{ color: '#4a90e2', textDecoration: 'none', fontWeight: 600 }}>{t('create_account')}</Link> : <Link to="/login" style={{ color: '#4a90e2', textDecoration: 'none', fontWeight: 600 }}>{t('back_to_login')}</Link>}
            </div>
          </form>
        )}
        <div style={{ marginTop: '32px', borderTop: '1px solid #f0f2f5', paddingTop: '20px', display: 'flex', justifyContent: 'center' }}><LanguageSwitcher /></div>
      </div>
    </div>
  );
};

function App() {
  const { t } = useTranslation();
  const location = useLocation();
  const isAuth = !!localStorage.getItem('token');
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  return (
    <div className="layout">
      {isAuth && (
        <aside className="sidebar">
          <h2>Budget</h2>
          <nav style={{ flex: 1 }}>
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}><LayoutDashboard size={20} /> {t('Dashboard')}</Link>
            <Link to="/settings" className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}><Wallet size={20} /> {t('settings')}</Link>
            {isAdmin && <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}><ShieldCheck size={20} /> {t('admin')}</Link>}
          </nav>
          <div style={{ marginTop: 'auto' }}>
            <LanguageSwitcher />
            <button className="nav-link" style={{ width: '100%', marginTop: '16px', border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>
              <LogOut size={20} /> {t('logout')}
            </button>
          </div>
        </aside>
      )}
      <main className="main-wrap">
        <Routes>
          <Route path="/login" element={!isAuth ? <Auth type="login" /> : <Navigate to="/" />} />
          <Route path="/register" element={!isAuth ? <Auth type="register" /> : <Navigate to="/" />} />
          <Route path="/" element={isAuth ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/settings" element={isAuth ? <Settings /> : <Navigate to="/login" />} />
          <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
