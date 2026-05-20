import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';
import { useApi } from '../../context/ApiContext';



const UNITS = ['tablets', 'capsules', 'ml', 'syrup (bottle)', 'sachets', 'vials', 'ampoules', 'strips', 'tubes', 'injections', 'cream (tube)', 'ointment', 'drops', 'powder', 'suppositories'];
const CATEGORIES = ['General', 'Antibiotic', 'Analgesic', 'Antacid', 'Antidiabetic', 'Antihypertensive', 'Antihistamine', 'Antifungal', 'Antiviral', 'Cardiovascular', 'Dermatology', 'ENT', 'Gastrointestinal', 'Gynaecology', 'Neurology', 'Ophthalmology', 'Orthopaedic', 'Paediatric', 'Psychiatric', 'Respiratory', 'Urology', 'Vitamins & Supplements', 'Other'];

const EMPTY_ADD_FORM = {
  name: '', brandName: '', stockCount: '', expiryDate: '', oldStockExpiryDate: '',
  batchNumber: '', manufacturer: '', category: 'General', reorderLevel: '20',
  unit: 'tablets', pricePerUnit: '', notes: '', oldBalance: '', oldBalanceDate: '',
  supplier: '', invoiceNumber: '', receivedDate: new Date().toISOString().split('T')[0]
};

// ─── Tiny helpers ──────────────────────────────────────────────────────────
const today = new Date();
const getDaysToExpiry = (date) =>
  Math.max(0, Math.ceil((new Date(date) - today) / (1000 * 60 * 60 * 24)));

const getMedStatus = (med) => {
  if (med.stockCount === 0) return { label: 'Out of Stock', cls: 'pharm-badge-red', severity: 3 };
  if (med.stockCount < (med.reorderLevel || 20)) return { label: 'Low Stock', cls: 'pharm-badge-amber', severity: 2 };
  const days = getDaysToExpiry(med.expiryDate);
  if (days === 0) return { label: 'Expired', cls: 'pharm-badge-red', severity: 3 };
  if (days <= 30) return { label: `Exp in ${days}d`, cls: 'pharm-badge-red', severity: 3 };
  if (days <= 90) return { label: `Exp in ${days}d`, cls: 'pharm-badge-red', severity: 2 };
  return { label: 'Good', cls: 'pharm-badge-green', severity: 0 };
};

const getIndentTag = (med) => {
  if (med.stockCount === 0) return { label: 'INDENT', cls: 'pharm-badge pharm-badge-red' };
  if (med.stockCount < (med.reorderLevel || 20)) return { label: 'LOW INDENT', cls: 'pharm-badge pharm-badge-amber' };
  return { label: 'OK', cls: 'pharm-badge pharm-badge-green' };
};

const txIcon = (type) => ({ ADDITION: 'Add', OPENING_BALANCE: 'Start', ADJUSTMENT: 'Adj', EXPIRY_REMOVAL: 'Rem', RETURN: 'Ret', ISSUANCE: 'Iss' }[type] || 'Note');
const txColor = (type) => {
  if (['ADDITION', 'OPENING_BALANCE', 'RETURN'].includes(type)) return 'var(--pharm-green)';
  if (['EXPIRY_REMOVAL', 'ISSUANCE'].includes(type)) return 'var(--pharm-red)';
  return 'var(--pharm-amber)';
};

// ─── FIFO batch helpers ───────────────────────────────────────────────────
const parseDate = (d) => (d ? new Date(d) : null);
const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

const cmpExpiry = (a, b) => {
  if (!a.expiryDate && !b.expiryDate) return 0;
  if (!a.expiryDate) return 1;
  if (!b.expiryDate) return -1;
  return new Date(a.expiryDate) - new Date(b.expiryDate);
};

const runFIFOConsumption = (batches, qtyToConsume) => {
  let remaining = qtyToConsume;
  const sorted = [...batches].sort((a, b) => cmpExpiry(a, b) || new Date(a.receivedDate || a.createdAt) - new Date(b.receivedDate || b.createdAt));
  const consumedRows = [];

  for (const batch of sorted) {
    if (!batch.qty || remaining <= 0) continue;
    const take = Math.min(batch.qty, remaining);
    batch.qty -= take;
    remaining -= take;
    consumedRows.push({ batchId: batch.id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, quantity: take });
  }

  return { remaining, consumedRows };
};

const computeBatchesFromTransactions = (med, transactions = []) => {
  const batches = [];
  const txs = [...transactions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const addBatch = (tx, qty) => {
    if (qty <= 0) return;
    const definedExpiry = tx.newExpiryDate || med.expiryDate || null;
    const id = `${tx._id || tx.id || Math.random().toString(36).slice(2)}-${Date.now()}`;
    batches.push({
      id,
      batchNumber: tx.batchNumber || `Batch-${id.slice(-5)}`,
      qty,
      expiryDate: definedExpiry,
      createdAt: tx.createdAt,
      receivedDate: tx.receivedDate || tx.createdAt,
      source: tx.transactionType,
      notes: tx.notes || '',
      supplier: tx.supplier || '',
      invoiceNumber: tx.invoiceNumber || ''
    });
  };

  for (const tx of txs) {
    const change = Number(tx.quantityChanged || 0);
    if (tx.transactionType === 'ADDITION' || tx.transactionType === 'OPENING_BALANCE' || tx.transactionType === 'RETURN' || (tx.transactionType === 'ADJUSTMENT' && change > 0)) {
      addBatch(tx, change);
    } else if (tx.transactionType === 'ISSUANCE' || tx.transactionType === 'EXPIRY_REMOVAL' || (tx.transactionType === 'ADJUSTMENT' && change < 0)) {
      const removeQty = Math.abs(change);
      const { remaining } = runFIFOConsumption(batches, removeQty);
      if (remaining > 0) {
        // adjust for mismatched data from back-dated entries; keep negative via adjustment batch so totals still reconcile
        const id = `${tx._id || tx.id || Math.random().toString(36).slice(2)}-adj-${Date.now()}`;
        batches.push({
          id,
          batchNumber: tx.batchNumber || `Unmatched-${id.slice(-6)}`,
          qty: -remaining,
          expiryDate: tx.newExpiryDate || med.expiryDate || null,
          createdAt: tx.createdAt,
          receivedDate: tx.receivedDate || tx.createdAt,
          source: tx.transactionType,
          notes: `Auto-balancing mismatch: ${remaining} units`,
          supplier: tx.supplier || '',
          invoiceNumber: tx.invoiceNumber || ''
        });
      }
    }
  }

  return batches;
};

// ─── Excel / CSV parser ────────────────────────────────────────────────────
function parseImportFile(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['File appears empty'] };

  // Detect separator
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase());

  const col = (keywords) => {
    for (const kw of keywords) {
      const idx = headers.findIndex(h => h.includes(kw));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colName    = col(['name of the medicine', 'medicine name', 'name']);
  const colBrand   = col(['brand name', 'brand']);
  const colStock   = col(['new stock', 'stock', 'quantity', 'qty', 'balance till']);
  const colExpiry  = col(['new stock exp', 'exp date', 'expiry', 'expiry date']);
  const colOldExp  = col(['old stock exp', 'old exp']);
  const colOldBal  = col(['old balance', 'old stock']);
  const colBatch   = col(['batch']);
  const colMfr     = col(['manufacturer', 'mfr']);
  const colSupp    = col(['supplier']);
  const colInv     = col(['invoice']);
  const colPrice   = col(['price', 'rate', 'mrp']);
  const colCat     = col(['category', 'cat']);
  const colUnit    = col(['unit']);
  const colReorder = col(['reorder', 'minimum']);
  const colRemarks = col(['remarks', 'notes', 'remark']);

  const rows = [];
  const errors = [];

  lines.slice(1).forEach((line, i) => {
    const cells = line.split(sep).map(c => c.replace(/"/g, '').trim());
    const get = (idx) => (idx !== -1 && idx < cells.length ? cells[idx] : '');

    const name = get(colName);
    if (!name) return; // skip empty rows

    // Parse expiry - accept MM/YY, MM-YY, MM/YYYY, YYYY-MM-DD
    const parseExpiry = (raw) => {
      if (!raw) return '';
      raw = raw.trim();
      // Already ISO
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      // DD/MM/YYYY or DD-MM-YYYY
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(raw)) {
        const [d, m, y] = raw.split(/[\/\-]/);
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // MM/YY or Mon-YY (e.g. Aug-27)
      const monthMap = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
      const mMatch = raw.match(/^([a-zA-Z]{3})[\/\-](\d{2,4})$/);
      if (mMatch) {
        const m = monthMap[mMatch[1].toLowerCase()];
        const y = mMatch[2].length === 2 ? `20${mMatch[2]}` : mMatch[2];
        return `${y}-${String(m).padStart(2,'0')}-28`; // last-ish day of month
      }
      // MM/YY numeric
      const nmMatch = raw.match(/^(\d{1,2})[\/\-](\d{2,4})$/);
      if (nmMatch) {
        const y = nmMatch[2].length === 2 ? `20${nmMatch[2]}` : nmMatch[2];
        return `${y}-${nmMatch[1].padStart(2,'0')}-28`;
      }
      return '';
    };

    const stockRaw = get(colStock);
    const stockNum = parseInt(stockRaw);

    const row = {
      name,
      brandName:        get(colBrand),
      stockCount:       isNaN(stockNum) ? 0 : stockNum,
      expiryDate:       parseExpiry(get(colExpiry)),
      oldStockExpiryDate: parseExpiry(get(colOldExp)),
      oldBalance:       parseInt(get(colOldBal)) || 0,
      batchNumber:      get(colBatch),
      manufacturer:     get(colMfr),
      supplier:         get(colSupp),
      invoiceNumber:    get(colInv),
      pricePerUnit:     parseFloat(get(colPrice)) || 0,
      category:         get(colCat) || 'General',
      unit:             get(colUnit) || 'tablets',
      reorderLevel:     parseInt(get(colReorder)) || 20,
      notes:            get(colRemarks),
    };

    if (!row.expiryDate) {
      errors.push(`Row ${i + 2}: "${name}" — expiry date missing or unreadable (raw: "${get(colExpiry)}")`);
      row.expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    rows.push(row);
  });

  return { rows, errors };
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function PharmacistMedicineStock() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const API = `${useApi()}/api`;
  // Filters / Sort
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addLoading, setAddLoading] = useState(false);

  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const [historyModal, setHistoryModal] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);

  // FIFO Batch modal
  const [batchModal, setBatchModal] = useState(null);
  const [batchData, setBatchData] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Excel Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef();

  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // ── Load medicines ──
  const loadMedicines = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/medicines`, authHeader);
      setMedicines(res.data.medicines || []);
    } catch (e) {
      setError('Failed to load medicines. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMedicines(); }, [loadMedicines]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // ── Filtering + Sorting ──
  const categories = [...new Set(medicines.map(m => m.category).filter(Boolean))].sort();

  const filtered = medicines
    .filter(m => {
      const s = search.toLowerCase();
      const searchMatch = !search ||
        m.name.toLowerCase().includes(s) ||
        (m.brandName || '').toLowerCase().includes(s) ||
        (m.manufacturer || '').toLowerCase().includes(s) ||
        (m.batchNumber || '').toLowerCase().includes(s) ||
        (m.category || '').toLowerCase().includes(s);
      if (!searchMatch) return false;
      if (categoryFilter && m.category !== categoryFilter) return false;
      if (filter === 'out') return m.stockCount === 0;
      if (filter === 'low') return m.stockCount > 0 && m.stockCount < (m.reorderLevel || 20);
      if (filter === 'expiring30') return getDaysToExpiry(m.expiryDate) <= 30;
      if (filter === 'expiring90') return getDaysToExpiry(m.expiryDate) <= 90 && getDaysToExpiry(m.expiryDate) > 30;
      if (filter === 'expired') return getDaysToExpiry(m.expiryDate) === 0;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'stock') cmp = a.stockCount - b.stockCount;
      else if (sortBy === 'expiry') cmp = new Date(a.expiryDate) - new Date(b.expiryDate);
      else if (sortBy === 'status') cmp = getMedStatus(b).severity - getMedStatus(a).severity;
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  const counts = {
    all:        medicines.length,
    out:        medicines.filter(m => m.stockCount === 0).length,
    low:        medicines.filter(m => m.stockCount > 0 && m.stockCount < (m.reorderLevel || 20)).length,
    expiring30: medicines.filter(m => getDaysToExpiry(m.expiryDate) <= 30 && getDaysToExpiry(m.expiryDate) > 0).length,
    expiring90: medicines.filter(m => getDaysToExpiry(m.expiryDate) <= 90 && getDaysToExpiry(m.expiryDate) > 30).length,
    expired:    medicines.filter(m => getDaysToExpiry(m.expiryDate) === 0 && m.stockCount > 0).length,
  };

  // ── Add new medicine ──
  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.stockCount || !addForm.expiryDate) {
      setError('Medicine name, stock count, and expiry date are required.');
      return;
    }
    setAddLoading(true);
    setError('');
    try {
      await axios.post(`${API}/medicines`, addForm, authHeader);
      setShowAddModal(false);
      setAddForm(EMPTY_ADD_FORM);
      showSuccess(`"${addForm.name}" added to inventory!`);
      loadMedicines();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to add medicine');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Edit modal ──
  const openEditModal = (med, mode = 'addStock') => {
    setEditModal({ med, mode });
    setEditForm({
      addStock: '',
      stockCount: med.stockCount,
      expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '',
      oldStockExpiryDate: med.oldStockExpiryDate ? new Date(med.oldStockExpiryDate).toISOString().split('T')[0] : '',
      batchNumber: med.batchNumber || '',
      manufacturer: med.manufacturer || '',
      brandName: med.brandName || '',
      category: med.category || 'General',
      reorderLevel: med.reorderLevel || 20,
      unit: med.unit || 'tablets',
      pricePerUnit: med.pricePerUnit || '',
      notes: med.notes || '',
      supplier: '',
      invoiceNumber: '',
      receivedDate: new Date().toISOString().split('T')[0],
      adjustmentReason: ''
    });
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setEditLoading(true);
    setError('');
    const { med, mode } = editModal;
    try {
      const payload = { ...editForm };
      if (mode === 'addStock') {
        if (!payload.addStock || parseInt(payload.addStock) <= 0) {
          setError('Please enter a positive quantity to add.');
          setEditLoading(false);
          return;
        }
        delete payload.stockCount;
        delete payload.adjustmentReason;
      } else {
        delete payload.addStock;
      }
      await axios.put(`${API}/medicines/${med._id}`, payload, authHeader);
      setEditModal(null);
      showSuccess(`"${med.name}" updated!`);
      loadMedicines();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update medicine');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (med) => {
    if (!window.confirm(`Remove "${med.name}" from inventory? It will be deactivated.`)) return;
    try {
      await axios.delete(`${API}/medicines/${med._id}`, authHeader);
      showSuccess(`"${med.name}" removed from inventory.`);
      loadMedicines();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to remove medicine');
    }
  };

  const handleToggleIndent = async (med) => {
    try {
      const hasIndent = med.notes?.toUpperCase().includes('INDENT');
      const newNotes = hasIndent
        ? (med.notes || '').replace(/\s*INDENT[^\n]*\s*/i, '').trim() || 'Auto …'
        : `${med.notes ? med.notes + '; ' : ''}INDENT requested: ${new Date().toLocaleDateString('en-IN')}`;

      await axios.put(`${API}/medicines/${med._id}`, { notes: newNotes }, authHeader);
      showSuccess(hasIndent ? `Indent marker cleared for ${med.name}` : `Indent marker added for ${med.name}`);
      loadMedicines();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to toggle indent marker');
    }
  };

  // ── Stock history ──
  const openHistoryModal = async (med) => {
    setHistoryModal(med);
    setTxLoading(true);
    setTransactions([]);
    try {
      const res = await axios.get(`${API}/medicines/${med._id}/transactions`, { ...authHeader, params: { limit: 50 } });
      setTransactions(res.data.transactions || []);
    } catch (e) {
      setError('Failed to load stock history');
    } finally {
      setTxLoading(false);
    }
  };

  const openBatchModal = async (med) => {
    setBatchModal(med);
    setBatchLoading(true);
    setBatchError('');
    setBatchData([]);

    try {
      const res = await axios.get(`${API}/medicines/${med._id}/transactions`, {
        ...authHeader,
        params: { limit: 300 }
      });

      const batches = computeBatchesFromTransactions(med, res.data.transactions || []);
      setBatchData(batches);
    } catch (err) {
      setBatchError('Unable to load batch breakdown.');
    } finally {
      setBatchLoading(false);
    }
  };

  const closeBatchModal = () => {
    setBatchModal(null);
    setBatchData([]);
    setBatchError('');
  };

  // ── Excel / CSV import ──
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const { rows, errors } = parseImportFile(text);
      setImportRows(rows);
      setImportErrors(errors);
      setImportDone(false);
      setImportProgress({ done: 0, total: rows.length, failed: 0 });
      setShowImportModal(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importRows.length) return;
    setImportLoading(true);
    setImportDone(false);
    let done = 0, failed = 0;
    const failedRows = [];

    for (const row of importRows) {
      try {
        // Try POST first; if 409 (duplicate), do a stock update via PUT
        await axios.post(`${API}/medicines`, row, authHeader);
      } catch (e) {
        if (e.response?.status === 400 && e.response?.data?.error?.includes('unique')) {
          // Medicine already exists — add stock if provided
          try {
            const existRes = await axios.get(`${API}/medicines`, { ...authHeader, params: { search: row.name } });
            const existing = (existRes.data.medicines || []).find(m => m.name.toLowerCase() === row.name.toLowerCase());
            if (existing && row.stockCount > 0) {
              await axios.put(`${API}/medicines/${existing._id}`, {
                addStock: row.stockCount,
                expiryDate: row.expiryDate,
                batchNumber: row.batchNumber,
                supplier: row.supplier,
                invoiceNumber: row.invoiceNumber,
                notes: `Imported update: +${row.stockCount}`,
              }, authHeader);
            }
          } catch {
            failed++;
            failedRows.push(row.name);
          }
        } else {
          failed++;
          failedRows.push(row.name);
        }
      }
      done++;
      setImportProgress({ done, total: importRows.length, failed });
    }

    setImportLoading(false);
    setImportDone(true);
    if (failed === 0) showSuccess(`Imported ${done} medicines successfully!`);
    else showSuccess(`Import done: ${done - failed} added, ${failed} failed.`);
    loadMedicines();
  };

  // ─────────────────────────────────────────────────────────────────────
  if (loading) return <div className="pharm-loading">Loading medicine inventory...</div>;

  const criticalCount = counts.out + counts.expired + counts.expiring30;

  return (
    <div className="pharm-layout">
      <div className="pharm-root">

        {/* ── Header ── */}
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">Medicine Stock</h1>
            <p className="pharm-subtitle">
              {medicines.length} medicines &nbsp;·&nbsp; {medicines.reduce((s, m) => s + m.stockCount, 0).toLocaleString()} total units
              {criticalCount > 0 && <span style={{ color: 'var(--pharm-red)', fontWeight: 600 }}> &nbsp;·&nbsp; {criticalCount} need attention</span>}
            </p>
          </div>
          <div className="pharm-header-actions">
            <button className="pharm-btn pharm-btn-ghost" onClick={loadMedicines}>Refresh</button>
            <button className="pharm-btn pharm-btn-ghost" onClick={() => fileInputRef.current?.click()}>
              Import Excel/CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={handleFileSelect} />
            <button className="pharm-btn pharm-btn-teal" onClick={() => { setShowAddModal(true); setError(''); }}>
              + Add Medicine
            </button>
          </div>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div className="pharm-alert pharm-alert-danger" onClick={() => setError('')} style={{ cursor: 'pointer' }}>
            {error} <span style={{ marginLeft: 'auto', opacity: 0.6 }}>✕ (click to dismiss)</span>
          </div>
        )}
        {successMsg && <div className="pharm-alert pharm-alert-success">{successMsg}</div>}

        {/* ── Quick Stats Row ── */}
        <div className="pharm-stats-grid" style={{ marginBottom: '1rem' }}>
          {[
            { key: 'all',        label: 'Total',          color: 'var(--pharm-plum)', cls: 'info' },
            { key: 'out',        label: 'Out of Stock',    color: 'var(--pharm-red)',  cls: 'danger' },
            { key: 'low',        label: 'Low Stock',       color: 'var(--pharm-gold)', cls: 'warning' },
            { key: 'expiring30', label: 'Exp ≤30d',        color: 'var(--pharm-red)',  cls: 'danger' },
            { key: 'expiring90', label: 'Exp 31–90d',      color: 'var(--pharm-red)',  cls: 'danger' },
            { key: 'expired',    label: 'Expired (in stock)',color:'var(--pharm-red)',  cls: 'danger' },
          ].map(s => (
            <div key={s.key}
              className={`pharm-stat-card ${s.cls} ${filter === s.key ? 'active-filter' : ''}`}
              style={{ 
                cursor: 'pointer', 
                borderBottom: filter === s.key ? '4px solid var(--pharm-gold)' : '4px solid transparent',
                transform: filter === s.key ? 'scale(1.02)' : 'none',
                opacity: filter === s.key ? 1 : 0.85
              }}
              onClick={() => setFilter(s.key)}>
              <div className="pharm-stat-label" style={{ fontWeight: 600 }}>{s.label}</div>
              <div className="pharm-stat-value" style={{ color: s.color, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>{counts[s.key]}</div>
            </div>
          ))}
        </div>

        {/* ── Filters / Search ── */}
        <div className="pharm-section">
          <div className="pharm-filter-bar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <input
              className="pharm-input"
              style={{ flex: '1 1 240px', maxWidth: 320 }}
              placeholder="Search name, brand, batch, manufacturer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="pharm-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span className="pharm-filter-label">Sort:</span>
              <select className="pharm-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="name">Name</option>
                <option value="stock">Stock</option>
                <option value="expiry">Expiry</option>
                <option value="status">Status</option>
              </select>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm"
                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--pharm-gray-400)', fontSize: '0.82rem', alignSelf: 'center' }}>
              Showing {filtered.length} / {medicines.length}
            </span>
          </div>

          {/* ── Table ── */}
          <div className="pharm-table-container" style={{ marginTop: '0.5rem' }}>
            {filtered.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-text">No medicines match the current filters</div>
              </div>
            ) : (
              <table className="pharm-table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Medicine Name</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Reorder Lvl</th>
                    <th>Unit</th>
                    <th>Expiry Date</th>
                    <th>Old Exp</th>
                    <th>Batch #</th>
                    <th>Manufacturer</th>
                    <th>₹/Unit</th>
                    <th>Indent</th>
                    <th>Status</th>
                    <th style={{ width: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((med, idx) => {
                    const status = getMedStatus(med);
                    const days = getDaysToExpiry(med.expiryDate);
                    const rowCls = med.stockCount === 0 ? 'row-out-of-stock' : status.severity >= 2 ? 'row-low-stock' : '';
                    return (
                      <tr key={med._id} className={rowCls}>
                        <td className="mono" style={{ color: 'var(--pharm-gray-400)', fontSize: '0.72rem' }}>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{med.name}</div>
                          {med.notes && <div style={{ fontSize: '0.7rem', color: 'var(--pharm-gray-400)', maxWidth: 200 }}>{med.notes}</div>}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--pharm-gray-500)' }}>{med.brandName || '—'}</td>
                        <td>
                          <span className="pharm-badge pharm-badge-navy" style={{ fontSize: '0.7rem' }}>{med.category || 'General'}</span>
                        </td>
                        <td>
                          <span className={`pharm-stock-num ${med.stockCount === 0 ? 'out' : med.stockCount < (med.reorderLevel || 20) ? 'low' : 'ok'}`}>
                            {med.stockCount}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: '0.82rem' }}>{med.reorderLevel || 20}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-400)' }}>{med.unit}</td>
                        <td>
                          <div className="mono" style={{ fontSize: '0.82rem', color: days <= 90 ? 'var(--pharm-red)' : 'inherit' }}>
                            {new Date(med.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                          </div>
                          {days <= 90 && days > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--pharm-red)' }}>{days}d left</div>}
                          {days === 0 && <div style={{ fontSize: '0.68rem', color: 'var(--pharm-red)', fontWeight: 700 }}>EXPIRED</div>}
                        </td>
                        <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-400)' }}>
                          {med.oldStockExpiryDate ? new Date(med.oldStockExpiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '—'}
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>{med.batchNumber || '—'}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-400)' }}>{med.manufacturer || '—'}</td>
                        <td className="mono" style={{ fontSize: '0.82rem' }}>{med.pricePerUnit > 0 ? `₹${med.pricePerUnit}` : '—'}</td>
                        <td><span className={getIndentTag(med).cls} style={{ fontSize: '0.7rem' }}>{getIndentTag(med).label}</span></td>
                        <td><span className={`pharm-badge ${status.cls}`}>{status.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={() => openEditModal(med, 'addStock')} title="Add Stock">+Stock</button>
                            <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => openEditModal(med, 'adjust')} title="Edit Details">Edit</button>
                            <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => handleToggleIndent(med)} title="Toggle Indent">Indent</button>
                            <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => openBatchModal(med)} title="Batch FIFO">Batches</button>
                            <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => openHistoryModal(med)} title="View History">History</button>
                            <button className="pharm-btn pharm-btn-sm" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--pharm-red)', border: 'none' }}
                              onClick={() => handleDelete(med)} title="Remove">Remove</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ══ ADD MEDICINE MODAL ══ */}
      {showAddModal && (
        <div className="pharm-modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="pharm-modal" style={{ maxWidth: 720 }}>
            <div className="pharm-modal-header">
              <h3 className="pharm-modal-title">Add New Medicine</h3>
              <button className="pharm-btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="pharm-modal-body">
              {error && <div className="pharm-alert pharm-alert-danger">{error}</div>}
              <div className="pharm-form-grid">
                <div className="pharm-form-section-title" style={{ gridColumn: '1/-1' }}>Basic Information</div>

                <div className="pharm-form-group span-2">
                  <label className="pharm-label">Medicine Name <span className="required">*</span></label>
                  <input className="pharm-input" placeholder="e.g. Paracetamol 500mg"
                    value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Brand Name</label>
                  <input className="pharm-input" placeholder="e.g. Dolo 650"
                    value={addForm.brandName} onChange={e => setAddForm({ ...addForm, brandName: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Manufacturer</label>
                  <input className="pharm-input" placeholder="Company name"
                    value={addForm.manufacturer} onChange={e => setAddForm({ ...addForm, manufacturer: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Category</label>
                  <select className="pharm-select pharm-input" value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Unit</label>
                  <select className="pharm-select pharm-input" value={addForm.unit} onChange={e => setAddForm({ ...addForm, unit: e.target.value })}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                <div className="pharm-form-section-title" style={{ gridColumn: '1/-1', marginTop: '0.5rem' }}>Stock & Expiry</div>

                <div className="pharm-form-group">
                  <label className="pharm-label">Opening Stock <span className="required">*</span></label>
                  <input className="pharm-input" type="number" min="0" placeholder="0"
                    value={addForm.stockCount} onChange={e => setAddForm({ ...addForm, stockCount: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Old Balance (from Excel)</label>
                  <input className="pharm-input" type="number" min="0" placeholder="0"
                    value={addForm.oldBalance} onChange={e => setAddForm({ ...addForm, oldBalance: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">New Stock Expiry Date <span className="required">*</span></label>
                  <input className="pharm-input" type="date"
                    value={addForm.expiryDate} onChange={e => setAddForm({ ...addForm, expiryDate: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Old Stock Expiry Date</label>
                  <input className="pharm-input" type="date"
                    value={addForm.oldStockExpiryDate} onChange={e => setAddForm({ ...addForm, oldStockExpiryDate: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Reorder Level</label>
                  <input className="pharm-input" type="number" min="0"
                    value={addForm.reorderLevel} onChange={e => setAddForm({ ...addForm, reorderLevel: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Price per Unit (₹)</label>
                  <input className="pharm-input" type="number" step="0.01" min="0" placeholder="0.00"
                    value={addForm.pricePerUnit} onChange={e => setAddForm({ ...addForm, pricePerUnit: e.target.value })} />
                </div>

                <div className="pharm-form-section-title" style={{ gridColumn: '1/-1', marginTop: '0.5rem' }}>Procurement Details</div>

                <div className="pharm-form-group">
                  <label className="pharm-label">Batch Number</label>
                  <input className="pharm-input" placeholder="Batch #"
                    value={addForm.batchNumber} onChange={e => setAddForm({ ...addForm, batchNumber: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Supplier</label>
                  <input className="pharm-input" placeholder="Supplier name"
                    value={addForm.supplier} onChange={e => setAddForm({ ...addForm, supplier: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Invoice Number</label>
                  <input className="pharm-input" placeholder="Invoice #"
                    value={addForm.invoiceNumber} onChange={e => setAddForm({ ...addForm, invoiceNumber: e.target.value })} />
                </div>
                <div className="pharm-form-group">
                  <label className="pharm-label">Received Date</label>
                  <input className="pharm-input" type="date"
                    value={addForm.receivedDate} onChange={e => setAddForm({ ...addForm, receivedDate: e.target.value })} />
                </div>
                <div className="pharm-form-group span-2">
                  <label className="pharm-label">Notes / Remarks</label>
                  <input className="pharm-input" placeholder="Any additional notes..."
                    value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="pharm-modal-footer">
              <button className="pharm-btn pharm-btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="pharm-btn pharm-btn-teal" onClick={handleAdd} disabled={addLoading}>
                {addLoading ? '⏳ Adding...' : '✅ Add to Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EDIT / ADD-STOCK MODAL ══ */}
      {editModal && (
        <div className="pharm-modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div className="pharm-modal" style={{ maxWidth: 660 }}>
            <div className="pharm-modal-header">
              <div>
                <h3 className="pharm-modal-title">
                  {editModal.mode === 'addStock' ? '📦 Add Stock' : '⚙️ Edit Medicine'} — {editModal.med.name}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-400)', marginTop: 2 }}>
                  Current: <strong>{editModal.med.stockCount} {editModal.med.unit || 'units'}</strong>
                  {editModal.mode === 'addStock' && editForm.addStock > 0 &&
                    <span style={{ color: 'var(--pharm-teal)', marginLeft: 8 }}>→ After: {editModal.med.stockCount + parseInt(editForm.addStock || 0)}</span>
                  }
                </div>
              </div>
              <button className="pharm-btn-icon" onClick={() => setEditModal(null)}>✕</button>
            </div>
            <div className="pharm-modal-body">
              {error && <div className="pharm-alert pharm-alert-danger">{error}</div>}

              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button className={`pharm-btn pharm-btn-sm ${editModal.mode === 'addStock' ? 'pharm-btn-teal' : 'pharm-btn-ghost'}`}
                  onClick={() => setEditModal({ ...editModal, mode: 'addStock' })}>📦 Add Stock</button>
                <button className={`pharm-btn pharm-btn-sm ${editModal.mode === 'adjust' ? 'pharm-btn-teal' : 'pharm-btn-ghost'}`}
                  onClick={() => setEditModal({ ...editModal, mode: 'adjust' })}>⚙️ Edit / Adjust</button>
              </div>

              {editModal.mode === 'addStock' ? (
                <div className="pharm-form-grid">
                  <div className="pharm-form-group">
                    <label className="pharm-label">Units to Add <span className="required">*</span></label>
                    <input className="pharm-input" type="number" min="1" placeholder="e.g. 100" autoFocus
                      value={editForm.addStock} onChange={e => setEditForm({ ...editForm, addStock: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Received Date</label>
                    <input className="pharm-input" type="date"
                      value={editForm.receivedDate} onChange={e => setEditForm({ ...editForm, receivedDate: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">New Stock Expiry Date</label>
                    <input className="pharm-input" type="date"
                      value={editForm.expiryDate} onChange={e => setEditForm({ ...editForm, expiryDate: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Old Stock Expiry Date</label>
                    <input className="pharm-input" type="date"
                      value={editForm.oldStockExpiryDate} onChange={e => setEditForm({ ...editForm, oldStockExpiryDate: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Batch Number</label>
                    <input className="pharm-input" placeholder="Batch #"
                      value={editForm.batchNumber} onChange={e => setEditForm({ ...editForm, batchNumber: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Supplier</label>
                    <input className="pharm-input" placeholder="Supplier name"
                      value={editForm.supplier} onChange={e => setEditForm({ ...editForm, supplier: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Invoice Number</label>
                    <input className="pharm-input" placeholder="Invoice #"
                      value={editForm.invoiceNumber} onChange={e => setEditForm({ ...editForm, invoiceNumber: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Notes</label>
                    <input className="pharm-input" placeholder="Remarks..."
                      value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="pharm-form-grid">
                  <div className="pharm-form-group">
                    <label className="pharm-label">Set Stock Count (direct override)</label>
                    <input className="pharm-input" type="number" min="0"
                      value={editForm.stockCount} onChange={e => setEditForm({ ...editForm, stockCount: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Reason for Adjustment</label>
                    <input className="pharm-input" placeholder="e.g. Damaged stock, Physical count correction"
                      value={editForm.adjustmentReason} onChange={e => setEditForm({ ...editForm, adjustmentReason: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Brand Name</label>
                    <input className="pharm-input" value={editForm.brandName}
                      onChange={e => setEditForm({ ...editForm, brandName: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Manufacturer</label>
                    <input className="pharm-input" value={editForm.manufacturer}
                      onChange={e => setEditForm({ ...editForm, manufacturer: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">New Expiry Date</label>
                    <input className="pharm-input" type="date" value={editForm.expiryDate}
                      onChange={e => setEditForm({ ...editForm, expiryDate: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Old Stock Expiry</label>
                    <input className="pharm-input" type="date" value={editForm.oldStockExpiryDate}
                      onChange={e => setEditForm({ ...editForm, oldStockExpiryDate: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Category</label>
                    <select className="pharm-select pharm-input" value={editForm.category}
                      onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Unit</label>
                    <select className="pharm-select pharm-input" value={editForm.unit}
                      onChange={e => setEditForm({ ...editForm, unit: e.target.value })}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Reorder Level</label>
                    <input className="pharm-input" type="number" min="0" value={editForm.reorderLevel}
                      onChange={e => setEditForm({ ...editForm, reorderLevel: e.target.value })} />
                  </div>
                  <div className="pharm-form-group">
                    <label className="pharm-label">Price per Unit (₹)</label>
                    <input className="pharm-input" type="number" step="0.01" value={editForm.pricePerUnit}
                      onChange={e => setEditForm({ ...editForm, pricePerUnit: e.target.value })} />
                  </div>
                  <div className="pharm-form-group span-2">
                    <label className="pharm-label">Notes</label>
                    <input className="pharm-input" value={editForm.notes}
                      onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
            <div className="pharm-modal-footer">
              <button className="pharm-btn pharm-btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="pharm-btn pharm-btn-teal" onClick={handleEdit} disabled={editLoading}>
                {editLoading ? '⏳ Saving...' : editModal.mode === 'addStock' ? '📦 Record Stock Addition' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ STOCK HISTORY MODAL ══ */}
      {historyModal && (
        <div className="pharm-modal-overlay" onClick={e => e.target === e.currentTarget && setHistoryModal(null)}>
          <div className="pharm-modal" style={{ maxWidth: 780 }}>
            <div className="pharm-modal-header">
              <div>
                <h3 className="pharm-modal-title">🕐 Stock History — {historyModal.name}</h3>
                {historyModal.brandName && <div style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-400)' }}>{historyModal.brandName}</div>}
              </div>
              <button className="pharm-btn-icon" onClick={() => setHistoryModal(null)}>✕</button>
            </div>
            <div className="pharm-modal-body">
              {txLoading ? (
                <div className="pharm-loading" style={{ minHeight: '150px' }}>⏳ Loading history...</div>
              ) : transactions.length === 0 ? (
                <div className="pharm-empty">
                  <div className="pharm-empty-icon">📭</div>
                  <div className="pharm-empty-text">No stock history recorded yet</div>
                </div>
              ) : (
                <div className="pharm-timeline">
                  {transactions.map(tx => (
                    <div key={tx._id} className="pharm-timeline-item">
                      <div className={`pharm-timeline-dot`} style={{ background: txColor(tx.transactionType), color: '#fff', fontSize: '0.9rem' }}>
                        {txIcon(tx.transactionType)}
                      </div>
                      <div className="pharm-timeline-content">
                        <div className="pharm-timeline-title" style={{ color: txColor(tx.transactionType) }}>
                          {tx.transactionType.replace(/_/g, ' ')}
                          {tx.batchNumber && <span style={{ fontSize: '0.73rem', color: 'var(--pharm-gray-400)', marginLeft: '0.5rem' }}>Batch: {tx.batchNumber}</span>}
                        </div>
                        <div className="pharm-timeline-meta">
                          {new Date(tx.createdAt).toLocaleString('en-IN')}
                          {tx.performedBy?.name && ` · ${tx.performedBy.name}`}
                          {tx.supplier && ` · Supplier: ${tx.supplier}`}
                          {tx.invoiceNumber && ` · Inv: ${tx.invoiceNumber}`}
                        </div>
                        <div className={`pharm-timeline-delta ${tx.quantityChanged >= 0 ? 'pos' : 'neg'}`}>
                          {tx.quantityChanged >= 0 ? '+' : ''}{tx.quantityChanged} units
                          <span style={{ color: 'var(--pharm-gray-400)', fontWeight: 400, marginLeft: '0.5rem' }}>
                            ({tx.stockBefore} → {tx.stockAfter})
                          </span>
                        </div>
                        {tx.notes && <div style={{ fontSize: '0.74rem', color: 'var(--pharm-gray-400)', marginTop: '0.2rem' }}>{tx.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="pharm-modal-footer">
              <button className="pharm-btn pharm-btn-ghost" onClick={() => setHistoryModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ FIFO BATCH VIEW MODAL ══ */}
      {batchModal && (
        <div className="pharm-modal-overlay" onClick={e => e.target === e.currentTarget && closeBatchModal()}>
          <div className="pharm-modal" style={{ maxWidth: 840 }}>
            <div className="pharm-modal-header">
              <div>
                <h3 className="pharm-modal-title">🎯 Batch FIFO View — {batchModal.name}</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-400)', marginTop: 2 }}>
                  Current stock: {batchModal.stockCount} {batchModal.unit || 'units'}
                </div>
              </div>
              <button className="pharm-btn-icon" onClick={closeBatchModal}>✕</button>
            </div>
            <div className="pharm-modal-body">
              {batchError && <div className="pharm-alert pharm-alert-danger">{batchError}</div>}
              {batchLoading ? (
                <div className="pharm-loading" style={{ minHeight: 150 }}>⏳ Loading batch items...</div>
              ) : batchData.length === 0 ? (
                <div className="pharm-empty" style={{ padding: '3rem' }}>
                  <div className="pharm-empty-icon">🧾</div>
                  <div className="pharm-empty-text">No FIFO batch breakdown available yet</div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <span className="pharm-filter-label">Filled by FIFO (earliest expiry first)</span>
                    <span className="pharm-badge pharm-badge-navy" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                      Total Batches: {batchData.length}
                    </span>
                    <span className="pharm-badge pharm-badge-amber" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                      Total qty: {batchData.reduce((c, b) => c + (b.qty || 0), 0)}
                    </span>
                  </div>
                  <div className="pharm-table-container" style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <table className="pharm-table" style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Batch #</th>
                          <th>Qty</th>
                          <th>Expiry</th>
                          <th>Received</th>
                          <th>Source Tx</th>
                          <th>Supplier</th>
                          <th>Invoice</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchData
                          .filter(b => b.qty > 0)
                          .sort((a, b) => cmpExpiry(a, b))
                          .map((batch, idx) => {
                            const days = getDaysToExpiry(batch.expiryDate);
                            return (
                              <tr key={batch.id} className={batch.qty === 0 ? 'row-out-of-stock' : days <= 30 ? 'row-low-stock' : ''}>
                                <td>{idx + 1}</td>
                                <td>{batch.batchNumber}</td>
                                <td>{batch.qty}</td>
                                <td style={{ fontFamily: 'var(--pharm-mono)' }}>
                                  {batch.expiryDate ? formatDate(batch.expiryDate) : '—'}{days === 0 ? ' (EXP)' : days > 0 ? ` (${days}d)` : ''}
                                </td>
                                <td>{batch.receivedDate ? formatDate(batch.receivedDate) : '—'}</td>
                                <td>{batch.source || '—'}</td>
                                <td>{batch.supplier || '—'}</td>
                                <td>{batch.invoiceNumber || '—'}</td>
                                <td>{batch.notes || '—'}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="pharm-modal-footer">
              <button className="pharm-btn pharm-btn-ghost" onClick={closeBatchModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EXCEL IMPORT MODAL ══ */}
      {showImportModal && (
        <div className="pharm-modal-overlay" onClick={e => e.target === e.currentTarget && !importLoading && setShowImportModal(false)}>
          <div className="pharm-modal" style={{ maxWidth: 860 }}>
            <div className="pharm-modal-header">
              <div>
                <h3 className="pharm-modal-title">📥 Import from Excel / CSV</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-400)' }}>
                  Detected {importRows.length} medicines from your file
                </div>
              </div>
              {!importLoading && <button className="pharm-btn-icon" onClick={() => setShowImportModal(false)}>✕</button>}
            </div>
            <div className="pharm-modal-body">

              {/* Progress bar during import */}
              {importLoading && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <span>Importing... {importProgress.done} / {importProgress.total}</span>
                    <span style={{ color: 'var(--pharm-red)' }}>{importProgress.failed} failed</span>
                  </div>
                  <div style={{ background: 'var(--pharm-gray-100)', borderRadius: 4, height: 10 }}>
                    <div style={{
                      width: `${(importProgress.done / importProgress.total) * 100}%`,
                      background: 'var(--pharm-teal)', height: '100%', borderRadius: 4,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              )}

              {importDone && (
                <div className="pharm-alert pharm-alert-success">
                  ✅ Import complete! {importProgress.done - importProgress.failed} medicines imported, {importProgress.failed} failed.
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="pharm-alert pharm-alert-warning" style={{ marginBottom: '0.75rem' }}>
                  <strong>⚠️ {importErrors.length} warnings:</strong>
                  <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem', fontSize: '0.78rem' }}>
                    {importErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {importErrors.length > 5 && <li>...and {importErrors.length - 5} more</li>}
                  </ul>
                </div>
              )}

              <div style={{ fontSize: '0.82rem', color: 'var(--pharm-gray-500)', marginBottom: '0.75rem' }}>
                Preview of first 10 rows. If a medicine already exists, its stock will be topped up.
              </div>

              <div className="pharm-table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="pharm-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>#</th><th>Medicine Name</th><th>Brand</th><th>Stock</th>
                      <th>Expiry</th><th>Old Exp</th><th>Batch</th><th>Supplier</th><th>Price ₹</th><th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td>{r.brandName || '—'}</td>
                        <td className="mono">{r.stockCount}</td>
                        <td className="mono" style={{ color: !r.expiryDate ? 'var(--pharm-red)' : 'inherit' }}>
                          {r.expiryDate || '⚠️ Missing'}
                        </td>
                        <td className="mono">{r.oldStockExpiryDate || '—'}</td>
                        <td>{r.batchNumber || '—'}</td>
                        <td>{r.supplier || '—'}</td>
                        <td>{r.pricePerUnit > 0 ? `₹${r.pricePerUnit}` : '—'}</td>
                        <td>{r.category}</td>
                      </tr>
                    ))}
                    {importRows.length > 10 && (
                      <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--pharm-gray-400)' }}>
                        ...and {importRows.length - 10} more rows
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--pharm-teal-pale)', borderRadius: 6, fontSize: '0.8rem', color: 'var(--pharm-teal)' }}>
                <strong>ℹ️ Import rules:</strong> New medicines are created. If a medicine name already exists, its stock quantity will be added (top-up). All stock movements are recorded in the audit trail.
              </div>
            </div>
            <div className="pharm-modal-footer">
              <button className="pharm-btn pharm-btn-ghost" onClick={() => setShowImportModal(false)} disabled={importLoading}>
                {importDone ? 'Close' : 'Cancel'}
              </button>
              {!importDone && (
                <button className="pharm-btn pharm-btn-teal" onClick={handleImport} disabled={importLoading || importRows.length === 0}>
                  {importLoading ? `⏳ Importing ${importProgress.done}/${importProgress.total}...` : `📥 Import ${importRows.length} Medicines`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}