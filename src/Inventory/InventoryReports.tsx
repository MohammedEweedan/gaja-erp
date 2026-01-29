import React from 'react';
import axios from '../api';
import {
    Box,
    Typography,
    CircularProgress,
    LinearProgress,
    Card,
    CardContent,
    CardActions,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    Select,
    MenuItem,
    Chip,
    TextField,

} from '@mui/material';
import { ResponsiveLine } from '@nivo/line';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ExcelJS from 'exceljs';


// import alpha helper removed (unused)

type RawRow = Record<string, any>;

const InventoryReports: React.FC = () => {
    const [loading, setLoading] = React.useState(true);
    const [rows, setRows] = React.useState<RawRow[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [psMap, setPsMap] = React.useState<Record<string, string>>({});
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogChecker, setDialogChecker] = React.useState<string | null>(null);
    const [dialogLoading, setDialogLoading] = React.useState(false);
    const [dialogProductsDetails, setDialogProductsDetails] = React.useState<Array<{ label: string; id?: string; detail?: any; images?: string[]; inventory?: Record<string, any> }>>([]);
    const [dialogPage, setDialogPage] = React.useState(0);
    const [dialogRowsPerPage, setDialogRowsPerPage] = React.useState(10);
    const [comboTypesMap, setComboTypesMap] = React.useState<Record<string, string[]>>({});
    const [idFactClientMap, setIdFactClientMap] = React.useState<Record<string, string>>({});
    const [idFactTypeMapState, setIdFactTypeMapState] = React.useState<Record<string, string>>({});
    const [idFactPayloadMap, setIdFactPayloadMap] = React.useState<Record<string, any>>({});
    // "Check itemd" dialog state (lookup by id_art or CODE_EXTERNAL)
    const [checkDialogOpen, setCheckDialogOpen] = React.useState(false);
    const [checkBy, setCheckBy] = React.useState<'id_art' | 'code'>('id_art');
    const [checkQuery, setCheckQuery] = React.useState<string>('');
    const [checkLoading, setCheckLoading] = React.useState(false);
    const [checkResults, setCheckResults] = React.useState<any[]>([]);
    const [checkError, setCheckError] = React.useState<string | null>(null);
    // Chart dialog state
    const [chartOpen, setChartOpen] = React.useState(false);
    const [chartLoading, setChartLoading] = React.useState(false);
    const [chartSeries, setChartSeries] = React.useState<any[]>([]);
    const [chartTitle, setChartTitle] = React.useState<string>('');
    // zoom image dialog state
    const [zoomOpen, setZoomOpen] = React.useState(false);
    const [zoomImage, setZoomImage] = React.useState<string | null>(null);
    // Overall checkers rank dialog state
    const [rankDialogOpen, setRankDialogOpen] = React.useState(false);
    const [rankList, setRankList] = React.useState<Array<{ name: string; count: number; products: string[] }>>([]);
    // Export progress state (used to show progress while building XLSX)
    const [exportLoading, setExportLoading] = React.useState(false);
    const [exportProgress, setExportProgress] = React.useState(0); // 0..100
    const [exportMessage, setExportMessage] = React.useState<string | null>(null);
    // Date filter state
    const [filterRange, setFilterRange] = React.useState<string>('last_month');
    const [customFrom, setCustomFrom] = React.useState<string | null>(null); // ISO date string yyyy-mm-dd
    const [customTo, setCustomTo] = React.useState<string | null>(null);
    const formatISODate = (d: Date) => {
        try {
            return d.toISOString().slice(0, 10);
        } catch (e) {
            const y = String(d.getFullYear()).padStart(4, '0');
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${da}`;
        }
    };

    React.useEffect(() => {
        let mounted = true;
        const fetch = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`/Inventory/list`, { headers: { Authorization: token ? `Bearer ${token}` : undefined }, params: { limit: 10000 } });
                const data = Array.isArray(res?.data) ? res.data : (res?.data?.rows || res?.data?.data || []);
                if (!mounted) return;
                setRows(data);
            } catch (e: any) {
                console.error('Failed to load inventory list', e);
                if (!mounted) return;
                setError(e?.message || 'Failed to load');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetch();
        // fetch PS list for mapping ps id -> name_point
        (async function fetchPS() {
            try {
                const token = localStorage.getItem('token');
                const resp = await axios.get('/ps/all', { headers: { Authorization: token ? `Bearer ${token}` : undefined } });
                const data = Array.isArray(resp?.data) ? resp.data : (resp?.data?.rows || resp?.data?.data || []);
                const m: Record<string, string> = {};
                for (const p of data) {
                    if (p?.Id_point != null) m[String(p.Id_point)] = p?.name_point ?? String(p?.name_point ?? '');
                }
                if (mounted) setPsMap(m);
            } catch (e) {
                // ignore PS fetch errors silently
            }
        })();
        return () => { mounted = false; };
    }, []);

    // helper to normalize various supplier/type strings (including common misspellings) to canonical types
    const normalizeTypeString = (raw?: any) => {
        if (!raw) return undefined;
        const s = String(raw).toLowerCase();
        if (/d[i1]a?m+o?n?d|dimaond|diamond|diamon/i.test(s)) return 'Diamond';
        if (/watch/i.test(s)) return 'Watch';
        if (/gold/i.test(s)) return 'Gold';
        return undefined;
    };

    // Handler: search item by id_art or CODE_EXTERNAL
    const tryRemoteFetchForItem = async (q: string, by: 'id_art' | 'code', acc: any[]) => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: token ? `Bearer ${token}` : undefined };
            // try common product/detail endpoints used in the app
            if (by === 'id_art') {
                try {
                    const res = await axios.get(`/products/getitem/${encodeURIComponent(q)}`, { headers });
                    if (res?.data) acc.push({ source: 'remoteProduct', detail: res.data });
                } catch (e) { /* ignore */ }
                try {
                    const res2 = await axios.get(`/GetPICs/PIC/${encodeURIComponent(q)}`, { headers });
                    if (res2?.data) acc.push({ source: 'remotePics', images: Array.isArray(res2.data) ? res2.data : [res2.data] });
                } catch (e) { /* ignore */ }
            } else {
                // code-based lookup: try /products/getitem/code/:code and fallback to /products/getitem/:code
                try {
                    const res = await axios.get(`/products/getitem/code/${encodeURIComponent(q)}`, { headers });
                    if (res?.data) acc.push({ source: 'remoteProduct', detail: res.data });
                } catch (e) { /* ignore */ }
                try {
                    const res2 = await axios.get(`/products/getitem/${encodeURIComponent(q)}`, { headers });
                    if (res2?.data) acc.push({ source: 'remoteProduct', detail: res2.data });
                } catch (e) { /* ignore */ }
            }
        } catch (e) {
            console.warn('remote fetch for item failed', e);
        }
    };

    const handleCheckSearch = async () => {
        try {
            setCheckLoading(true);
            setCheckError(null);
            setCheckResults([]);
            const q = String(checkQuery || '').trim();
            if (!q) {
                setCheckError('Please provide an id or code to search');
                setCheckLoading(false);
                return;
            }

            const found: any[] = [];

            // Search local inventory rows first
            for (const r of rows || []) {
                try {
                    const idVal = r?.id_art ?? r?.Id_art ?? r?.id ?? r?.Id ?? r?.id_fact ?? r?.id_fact ?? null;
                    const codeVal = r?.CODE_EXTERNAL ?? r?.Code_external ?? r?.code ?? r?.code_external ?? r?.CODE ?? r?.Ref ?? r?.reference ?? '';
                    if (checkBy === 'id_art' && idVal != null && String(idVal) === q) {
                        found.push({ source: 'inventory', row: r });
                        continue;
                    }
                    if (checkBy === 'code' && codeVal && String(codeVal).toLowerCase() === q.toLowerCase()) {
                        found.push({ source: 'inventory', row: r });
                        continue;
                    }
                } catch (e) { /* ignore per-row errors */ }
            }

            // also check payload map cached earlier
            for (const k of Object.keys(idFactPayloadMap || {})) {
                try {
                    const payload = idFactPayloadMap[k];
                    const payloadCode = payload?.CODE_EXTERNAL ?? payload?.code ?? payload?.reference ?? '';
                    if (checkBy === 'id_art' && String(k) === q) {
                        found.push({ source: 'payload', detail: payload });
                    }
                    if (checkBy === 'code' && payloadCode && String(payloadCode).toLowerCase() === q.toLowerCase()) {
                        found.push({ source: 'payload', detail: payload });
                    }
                } catch (e) { }
            }

            // if nothing local, try remote endpoints
            if (found.length === 0) {
                await tryRemoteFetchForItem(q, checkBy, found);
            }

            // Deduplicate results: prefer system id (id_art/id), then CODE_EXTERNAL, then fallback to image/url
            const getKey = (it: any) => {
                const r = it.row ?? it.detail ?? null;
                try {
                    if (r) {
                        const idVal = r?.id_art ?? r?.Id_art ?? r?.id ?? r?.Id ?? r?.id_fact ?? r?.id_fact;
                        if (idVal != null && String(idVal) !== '') return `id:${String(idVal)}`;
                        const codeVal = r?.CODE_EXTERNAL ?? r?.Code_external ?? r?.code ?? r?.code_external ?? r?.CODE ?? r?.Ref ?? r?.reference;
                        if (codeVal) return `code:${String(codeVal).toLowerCase()}`;
                    }
                } catch (e) { }
                try {
                    if (it.images && Array.isArray(it.images) && it.images.length) return `img:${String(it.images[0])}`;
                } catch (e) { }
                try {
                    // final fallback (short stringified preview)
                    return `raw:${JSON.stringify(r || it).slice(0, 200)}`;
                } catch (e) { return `raw:${String(Math.random())}`; }
            };

            const seen = new Set<string>();
            const unique: any[] = [];
            for (const it of found) {
                const k = getKey(it);
                if (!seen.has(k)) {
                    seen.add(k);
                    unique.push(it);
                }
            }

            setCheckResults(unique);

            // Asynchronously enrich results with images when missing (same approach as Products dialog)
            setTimeout(async () => {
                try {
                    const token = localStorage.getItem('token');
                    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
                    const enriched = await Promise.all(unique.map(async (it) => {
                        try {
                            const row = it.row ?? it.detail ?? null;
                            // existing provided image list
                            let imagesList: any[] = [];
                            try {
                                if (it.images && Array.isArray(it.images)) imagesList = it.images;
                                else if (row) imagesList = row.images || row.Images || row.pictures || row.Pictures || row.imageUrls || row.imagesList || row.ImageList || row.gallery || [];
                                if (!imagesList.length) {
                                    const single = row?.PIC ?? row?.pic ?? row?.image_url ?? row?.Image ?? row?.url ?? null;
                                    if (single) imagesList = [single];
                                }
                            } catch (e) { imagesList = []; }

                            // normalize any existing images
                            const fallbackId = row?.id_art ?? row?.Id_art ?? row?.id ?? row?.Id ?? it?.id ?? undefined;
                            let images = (imagesList || []).map((x: any) => toAbsoluteImageUrl(typeof x === 'string' ? x : (x?.url || x?.path || String(x)), fallbackId)).filter(Boolean);

                            if ((!images || images.length === 0)) {
                                // attempt to fetch from /images endpoints using candidate ids
                                const candidateIds: string[] = [];
                                if (fallbackId) candidateIds.push(String(fallbackId));
                                try {
                                    const code = row?.CODE_EXTERNAL ?? row?.code ?? row?.Ref ?? row?.reference ?? '';
                                    const m = String(code || '').match(/\(([^)]+)\)/);
                                    if (m && m[1]) candidateIds.push(m[1]);
                                    const nums = (String(code || '').match(/\d+/g) || []).filter(Boolean);
                                    candidateIds.push(...nums);
                                } catch (e) { }

                                for (const tryId of Array.from(new Set(candidateIds))) {
                                    if (!tryId) continue;
                                    const endpoints = [`/images/list/diamond/${tryId}`, `/images/list/${tryId}`];
                                    for (const ep of endpoints) {
                                        try {
                                            const resp = await axios.get(ep, { headers });
                                            const data = resp?.data;
                                            let urls: string[] = [];
                                            if (Array.isArray(data)) urls = data.map((x: any) => (typeof x === 'string' ? x : (x?.url || x))).filter(Boolean);
                                            else if (typeof data === 'string') urls = [data];
                                            if (urls && urls.length) {
                                                images = urls.map(u => toAbsoluteImageUrl(u, tryId));
                                                break;
                                            }
                                        } catch (e) { /* try next endpoint */ }
                                    }
                                    if (images && images.length) break;
                                }
                            }

                            if (images && images.length) it.images = images;
                        } catch (e) { /* ignore enrichment errors per-item */ }
                        return it;
                    }));
                    setCheckResults(enriched);
                } catch (e) { /* ignore overall enrichment errors */ }
            }, 20);
            if (unique.length === 0) setCheckError('No matches found');
        } catch (e: any) {
            console.error('Search failed', e);
            setCheckError(e?.message || 'Search failed');
        } finally {
            setCheckLoading(false);
        }
    };




    // Compute filteredRows according to selected date range (used by combos)
    const filteredRows = React.useMemo(() => {
        try {
            if (!rows || !rows.length) return rows;
            if (!filterRange) return rows;

            const now = new Date();
            const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
            const endOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

            let startMs: number | undefined;
            let endMs: number | undefined;

            switch (filterRange) {
                case 'last_week': {
                    const past = new Date(now);
                    past.setDate(past.getDate() - 7);
                    startMs = startOfDayLocal(past);
                    endMs = endOfDayLocal(now);
                    break;
                }
                case 'last_month': {
                    const past = new Date(now);
                    past.setMonth(past.getMonth() - 1);
                    startMs = startOfDayLocal(past);
                    endMs = endOfDayLocal(now);
                    break;
                }
                case 'last_quarter': {
                    const past = new Date(now);
                    past.setMonth(past.getMonth() - 3);
                    startMs = startOfDayLocal(past);
                    endMs = endOfDayLocal(now);
                    break;
                }
                case 'last_6_months': {
                    const past = new Date(now);
                    past.setMonth(past.getMonth() - 6);
                    startMs = startOfDayLocal(past);
                    endMs = endOfDayLocal(now);
                    break;
                }
                case 'last_year': {
                    const past = new Date(now);
                    past.setFullYear(past.getFullYear() - 1);
                    startMs = startOfDayLocal(past);
                    endMs = endOfDayLocal(now);
                    break;
                }
                case 'custom': {
                    if (customFrom) startMs = startOfDayLocal(new Date(customFrom));
                    if (customTo) endMs = endOfDayLocal(new Date(customTo));
                    break;
                }
                default:
                    break;
            }

            // if neither start nor end specified, return all
            if (startMs == null && endMs == null) return rows;

            // helper: parse date_inv as yyyy-mm-dd into local Date at midnight
            const parseDateInvToLocal = (raw: any): Date | null => {
                if (!raw) return null;
                const s = String(raw).trim().slice(0, 10);
                const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (m) {
                    const y = Number(m[1]);
                    const mo = Number(m[2]) - 1;
                    const da = Number(m[3]);
                    const d = new Date(y, mo, da, 0, 0, 0, 0);
                    if (!isNaN(d.getTime())) return d;
                }
                // fallback: try parseTimestamp or Date
                try {
                    const p = parseTimestamp(String(raw), true);
                    if (p && !isNaN(p.getTime())) return p;
                } catch (e) { }
                const dd = new Date(String(raw));
                return isNaN(dd.getTime()) ? null : dd;
            };

            return rows.filter((r) => {
                const raw = r?.date_inv ?? null;
                if (!raw) return false; // filter by date_inv only
                const d = parseDateInvToLocal(raw);
                if (!d) return false;
                const t = d.getTime();
                if (startMs != null && t < startMs) return false;
                if (endMs != null && t > endMs) return false;
                return true;
            });
        } catch (e) {
            return rows;
        }
    }, [rows, filterRange, customFrom, customTo]);

    // Build distinct combinations grouped by date_inv (date-only) and Teams
    const combos = React.useMemo(() => {
        // First pass: group rows into buckets by date|teams|ps and keep the original rows
        const m = new Map<string, { date: string; ps: string; teams: string[]; rows: RawRow[] }>();
        for (const r of filteredRows) {
            const rawDate = r?.date_inv ?? r?.date ?? null;
            const dateKey = rawDate ? String(rawDate).slice(0, 10) : 'Unknown';
            const psRaw = r?.ps ?? r?.Ps ?? r?.PS ?? '';
            const psKey = String(psRaw || '').trim() || '-';
            const teamsRaw = r?.Teams ?? r?.teams ?? '';
            const tokens = String(teamsRaw || '').split(',').map((s) => s.trim()).filter(Boolean);
            const unique = Array.from(new Set(tokens));
            const teamsKey = unique.length ? unique.join(',') : '-';
            const key = `${dateKey}|${teamsKey}|${psKey}`;
            const prev = m.get(key);
            if (prev) {
                prev.rows.push(r);
            } else {
                m.set(key, { date: dateKey, ps: psKey, teams: unique, rows: [r] });
            }
        }

        // Second pass: build combo summaries (counts, checked, notes) from stored rows
        const combosArr: Array<{ key: string; date: string; ps: string; teams: string[]; count: number; checked: number; distinctChecked: number; distinctCheckers: string[]; checkerStats: Record<string, number>; checkerProducts: Record<string, string[]>; notes: string[]; types: string[]; rows: RawRow[] }> = [];
        for (const [comboKey, { date, ps, teams, rows: bucketRows }] of Array.from(m.entries())) {
            const notesSet = new Set<string>();
            let total = 0;
            let totalChecked = 0;
            const distinctSet = new Set<string>();
            const checkerCounts: Record<string, number> = {};
            const checkerProducts: Record<string, string[]> = {};
            const typesSet = new Set<string>();
            for (const r of bucketRows) {
                total += 1;
                const rawCheckedBy = r?.checked_by ?? r?.checkedBy ?? null;
                const checker = rawCheckedBy != null ? String(rawCheckedBy).trim() : '';
                const isChecked = checker !== '';
                if (isChecked) {
                    totalChecked += 1;
                    distinctSet.add(checker);
                    checkerCounts[checker] = (checkerCounts[checker] || 0) + 1;
                    // collect product identifier for this checker (unique)
                    const code = r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? null;
                    const idArt = r?.id_art ?? r?.idArt ?? r?.Id_art ?? r?.IdArt ?? r?.id ?? null;
                    const prodLabel = code ? String(code) + (idArt ? ` (${String(idArt)})` : '') : (idArt ? String(idArt) : 'Unknown');
                    if (!checkerProducts[checker]) checkerProducts[checker] = [];
                    if (!checkerProducts[checker].includes(prodLabel)) checkerProducts[checker].push(prodLabel);
                }
                const noteRaw = r?.Notes ?? r?.notes ?? r?.note ?? '';
                const note = String(noteRaw || '').trim();
                if (note) notesSet.add(note);
                // try to extract TYPE_SUPPLIER from the row if present under common variants
                const typeCandidate = r?.Fournisseur?.TYPE_SUPPLIER ?? r?.TYPE_SUPPLIER ?? r?.type_supplier ?? r?.type ?? r?.Type ?? null;
                if (typeCandidate) {
                    const norm = normalizeTypeString(typeCandidate);
                    if (norm) typesSet.add(norm);
                    else typesSet.add(String(typeCandidate));
                }
            }
            combosArr.push({ key: comboKey, date, ps, teams, count: total, checked: totalChecked, distinctChecked: distinctSet.size, distinctCheckers: Array.from(distinctSet), checkerStats: checkerCounts, checkerProducts, notes: Array.from(notesSet), types: Array.from(typesSet), rows: bucketRows });
        }

        return combosArr.sort((a, b) => (a.date < b.date ? 1 : (a.date > b.date ? -1 : 0)));
    }, [filteredRows]);

    // Enrich combos by fetching active products per PS (same approach as ListInventories)
    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: token ? `Bearer ${token}` : undefined };
                // collect PS values from combos
                const psSet = new Set<string>();
                for (const c of combos) {
                    const psVal = String((c as any).ps || '').trim();
                    if (psVal && psVal !== '-') psSet.add(psVal);
                }

                const idFactTypeLocal: Record<string, string> = {};
                const idFactClientLocal: Record<string, string> = {};
                const idFactPayloadLocal: Record<string, any> = {};

                // Run per-PS requests in parallel to reduce total latency
                try {
                    const psArray = Array.from(psSet);
                    const reqs = psArray.map((psVal) =>
                        axios.get(`http://localhost:9000/api/Inventory/allActiveDesactive`, { headers, params: { ps: Number(psVal) } })
                            .then(res => Array.isArray(res?.data) ? res.data : (res?.data?.rows || res?.data?.data || []))
                            .catch(() => [])
                    );

                    const results = await Promise.all(reqs);
                    if (cancelled) return;
                    for (const arr of results) {
                        for (const p of arr) {
                            const idf = p?.id_fact ?? p?.Id_fact ?? p?.idFact ?? null;
                            const rawType = p?.Fournisseur?.TYPE_SUPPLIER ?? p?.TYPE_SUPPLIER ?? p?.type_supplier ?? p?.type ?? p?.Type ?? '';
                            const norm = normalizeTypeString(rawType);
                            if (idf != null && norm) idFactTypeLocal[String(idf)] = norm;
                            // capture client_name if present
                            const clientName = p?.Fournisseur?.client_name ?? p?.Fournisseur?.clientName ?? p?.Fournisseur?.client ?? p?.Fournisseur?.name ?? null;
                            if (idf != null && clientName) idFactClientLocal[String(idf)] = String(clientName);
                            // store full payload so dialog can use /allActive data directly (avoids extra getitem calls)
                            if (idf != null) idFactPayloadLocal[String(idf)] = p;
                        }
                    }
                } catch (e) {
                    // ignore overall errors
                }

                const map: Record<string, string[]> = {};
                for (const c of combos) {
                    if (cancelled) return;
                    // prefer types already present on rows
                    const existing = (c as any).types as string[] | undefined;
                    if (existing && existing.length) continue;
                    const typesSet = new Set<string>();
                    for (const r of (c as any).rows || []) {
                        const idArt = r?.id_art ?? r?.Id_art ?? r?.id ?? r?.Id ?? null;
                        if (idArt != null) {
                            const t = idFactTypeLocal[String(idArt)];
                            if (t) typesSet.add(t);
                        }
                        const code = r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? '';
                        const m = String(code || '').match(/\(([^)]+)\)/);
                        if (m && m[1]) {
                            const t = idFactTypeLocal[m[1]];
                            if (t) typesSet.add(t);
                        }
                    }
                    if (typesSet.size) map[(c as any).key] = Array.from(typesSet);
                }

                if (!cancelled) {
                    setComboTypesMap(map);
                    // merge collected client names into global map
                    setIdFactClientMap((prev) => ({ ...prev, ...idFactClientLocal }));
                    // store id->type mapping globally for per-product base selection
                    setIdFactTypeMapState((prev) => ({ ...prev, ...idFactTypeLocal }));
                    // store payloads globally so dialog can read details without extra fetches
                    setIdFactPayloadMap((prev) => ({ ...prev, ...idFactPayloadLocal }));
                }
            } catch (e) {
                // ignore
            }
        };
        run();
        return () => { cancelled = true; };
    }, [combos]);

    // Helper to format possible date-like values into a friendly string
    const formatDate = (val: any) => {
        if (val == null) return '';
        try {
            const s = String(val).trim();
            if (!s) return '';
            const d = parseTimestamp(s, true);
            if (d) return d.toLocaleString();
        } catch (e) {
            // fall through
        }
        return String(val);
    };

    // Format a date-like value into yyyy-mm-dd (UTC when possible)
    const formatDateYYYYMMDD = (val: any) => {
        if (val == null) return '';
        try {
            const d = parseTimestamp(val, true) || parseTimestamp(val, false);
            if (!d) return '';
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const da = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${da}`;
        } catch (e) {
            return String(val);
        }
    };

    // Format a Date into HH:mm (24-hour) optionally using UTC
    const formatTimeHM = (d: Date | null, useUTC = false) => {
        if (!d) return '';
        try {
            const hh = useUTC ? d.getUTCHours() : d.getHours();
            const mm = useUTC ? d.getUTCMinutes() : d.getMinutes();
            return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        } catch (e) {
            return '';
        }
    };

    // Robust timestamp parser for common DB formats like "2025-11-01 19:41:26.000"
    const parseTimestamp = (val: any, assumeUTC = false): Date | null => {
        try {
            if (val == null) return null;
            if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
            if (typeof val === 'number') {
                const d = new Date(val);
                return isNaN(d.getTime()) ? null : d;
            }
            let s = String(val).trim();
            if (!s) return null;

            // If contains timezone (Z or +hh:mm) or 'T' with timezone, let Date parse it
            if (/[Tt].*(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(s)) {
                const d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            }

            // Match common DB format: YYYY-MM-DD HH:MM:SS(.sss)
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
            if (m) {
                const y = Number(m[1]);
                const mo = Number(m[2]) - 1;
                const day = Number(m[3]);
                const hh = Number(m[4]);
                const mm = Number(m[5]);
                const ss = Number(m[6]);
                const ms = m[7] ? Number((m[7] + '000').slice(0, 3)) : 0;
                return assumeUTC ? new Date(Date.UTC(y, mo, day, hh, mm, ss, ms)) : new Date(y, mo, day, hh, mm, ss, ms);
            }

            // Fallback: try replacing space with T and parse
            const iso = s.includes('T') ? s : s.replace(' ', 'T');
            const d = new Date(iso);
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {
            return null;
        }
    };

    // Normalize image URLs coming from various payload shapes
    const toAbsoluteImageUrl = (raw: any, fallbackId?: string) => {
        try {
            if (!raw && raw !== 0) return '';
            const token = localStorage.getItem('token');
            let s = typeof raw === 'string' ? raw : (raw?.url || raw?.path || String(raw));
            if (!s) return '';
            s = String(s).trim();

            // If already absolute URL, ensure protocol and attach token if present
            if (/^https?:\/\//i.test(s)) {
                if (token && !s.includes('token=')) s += (s.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                return s;
            }

            // If path starts with a slash, prefix with API host if available, otherwise with window.location.origin
            const API_HOST = (process.env.REACT_APP_API_IP as string) || '';
            if (s.startsWith('/')) {
                s = API_HOST ? `${API_HOST}${s}` : `${window.location.origin}${s}`;
                if (token && !s.includes('token=')) s += (s.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                return s;
            }

            // If looks like a filename (no slash), try to attach it under /images/<id>/<filename> if id provided,
            // otherwise under /images/<filename>
            if (!s.includes('/')) {
                if (fallbackId) {
                    s = API_HOST ? `${API_HOST}/images/${fallbackId}/${s}` : `${window.location.origin}/images/${fallbackId}/${s}`;
                } else {
                    s = API_HOST ? `${API_HOST}/images/${s}` : `${window.location.origin}/images/${s}`;
                }
                if (token && !s.includes('token=')) s += (s.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
                return s;
            }

            // Fallback: contains a path but not protocol; prefix API_HOST or origin
            s = API_HOST ? `${API_HOST}/${s.replace(/^\//, '')}` : `${window.location.origin}/${s.replace(/^\//, '')}`;
            if (token && !s.includes('token=')) s += (s.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
            return s;
        } catch (e) {
            return String(raw || '');
        }
    };

    // Helper to fetch base64 image for export by fetching the image blob (appending token if needed)
    // and converting to a base64 string. Used when embedding images into Excel files.
    const getBase64FromUrl = async (url: string): Promise<{ base64: string | null; ext?: string }> => {
        try {
            if (!url) return { base64: null };
            if (url.startsWith('data:')) {
                const idx = url.indexOf(',');
                const header = url.substring(5, idx);
                const mime = header.split(';')[0];
                let ext = 'png';
                if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpeg';
                else if (mime === 'image/gif') ext = 'gif';
                return { base64: idx === -1 ? url : url.substring(idx + 1), ext };
            }
            let fetchUrl = url;
            const token = localStorage.getItem('token');

            const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
                const bytes = new Uint8Array(buffer);
                let binary = '';
                const chunkSize = 0x8000;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const slice = bytes.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, Array.from(slice) as any);
                }
                return btoa(binary);
            };

            try {
                if (fetchUrl.startsWith('/')) fetchUrl = window.location.origin + fetchUrl;
                let fetchUrlWithToken = fetchUrl;
                try {
                    const u = new URL(fetchUrl);
                    if (token && !u.searchParams.has('token')) u.searchParams.set('token', token);
                    fetchUrlWithToken = u.toString();
                } catch (e) {
                    if (token && !fetchUrlWithToken.includes('token=')) fetchUrlWithToken = fetchUrlWithToken + (fetchUrlWithToken.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
                }
                const res = await fetch(fetchUrlWithToken);
                if (res.ok) {
                    const contentType = res.headers.get('content-type') || '';
                    const buffer = await res.arrayBuffer();
                    const base64 = arrayBufferToBase64(buffer);
                    let ext = 'png';
                    if (/jpeg|jpg/.test(contentType)) ext = 'jpeg';
                    else if (/gif/.test(contentType)) ext = 'gif';
                    return { base64, ext };
                }
            } catch (err) {
                // fallthrough
            }

            try {
                const resAuth = await fetch(fetchUrl, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                if (resAuth.ok) {
                    const contentType = resAuth.headers.get('content-type') || '';
                    const buffer = await resAuth.arrayBuffer();
                    const base64 = arrayBufferToBase64(buffer);
                    let ext = 'png';
                    if (/jpeg|jpg/.test(contentType)) ext = 'jpeg';
                    else if (/gif/.test(contentType)) ext = 'gif';
                    return { base64, ext };
                }
            } catch (err) {
                // ignore
            }

            try {
                const axiosRes = await axios.get(fetchUrl, { responseType: 'arraybuffer', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                if (axiosRes && axiosRes.status === 200 && axiosRes.data) {
                    const buffer = axiosRes.data as ArrayBuffer;
                    const base64 = arrayBufferToBase64(buffer);
                    const contentType = (axiosRes.headers && axiosRes.headers['content-type']) || '';
                    let ext3 = 'png';
                    if (/jpeg|jpg/.test(contentType)) ext3 = 'jpeg';
                    else if (/gif/.test(contentType)) ext3 = 'gif';
                    return { base64, ext: ext3 };
                }
            } catch (err) {
                // ignore
            }

            return { base64: null };
        } catch (err) {
            return { base64: null };
        }
    };

    // (removed global totalRows) — progress is shown per-combo: checked / combo total

    const openProductsDialog = async (comboKey: string, checker: string, products: string[], allowOpenIfNoType = false) => {
        // If no type is available for this combo or any of the products, do not open the dialog
        const comboTypes = comboTypesMap[comboKey] || [];
        let hasType = Array.isArray(comboTypes) && comboTypes.length > 0;
        if (!hasType) {
            // try to detect per-product mapped types using idFactTypeMapState
            for (const label of (products || [])) {
                const m = String(label || '').match(/\(([^)]+)\)/);
                const candidateIds = [] as string[];
                if (m && m[1]) candidateIds.push(m[1]);
                const nums = (String(label || '').match(/\d+/g) || []).filter(Boolean);
                candidateIds.push(...nums);
                for (const id of candidateIds) {
                    if (id && idFactTypeMapState[String(id)]) { hasType = true; break; }
                }
                if (hasType) break;
            }
        }
        if (!hasType && !allowOpenIfNoType) {
            // no type information available; do not open dialog
            console.warn('[InventoryReports] No type mapping found for products; dialog will not open', { comboKey, checker, products });
            return;
        }

        setDialogChecker(checker);
        // build lightweight inventory metadata per product from the current rows state so UI shows inventory info immediately
        const buildInventoryMeta = (label: string) => {
            try {
                // normalize label to find ids or codes
                const ids: string[] = [];
                const m = String(label || '').match(/\(([^)]+)\)/);
                if (m && m[1]) ids.push(m[1]);
                const nums = (String(label || '').match(/\d+/g) || []).filter(Boolean);
                ids.push(...nums);
                ids.push(String(label || '').trim());

                // find rows that match this checker and one of the candidate ids or codes
                const candidates = rows.filter((r) => {
                    const rawChecker = r?.checked_by ?? r?.checkedBy ?? r?.checker ?? r?.CheckedBy ?? '';
                    if (String(rawChecker).trim() !== String(checker).trim()) return false;
                    const idArt = r?.id_art ?? r?.Id_art ?? r?.id ?? r?.Id ?? null;
                    const code = r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? r?.CODE ?? '';
                    const combined = [] as string[];
                    if (idArt != null) combined.push(String(idArt));
                    if (code) combined.push(String(code));
                    // also include full row string for fallback
                    combined.push(String(r?.id ?? r?.Id ?? r?.code ?? r?.CODE ?? ''));
                    for (const cand of ids) {
                        if (!cand) continue;
                        for (const v of combined) {
                            if (!v) continue;
                            if (String(v).trim() === String(cand).trim()) return true;
                        }
                    }
                    return false;
                });

                // prefer the most-recent candidate by date fields if available
                if (candidates.length) {
                    const sorted = candidates.sort((a, b) => {
                        const daD = parseTimestamp(a?.date_time_check ?? a?.dateChecked ?? a?.date_inv ?? a?.date ?? a?.created_at ?? 0, true);
                        const dbD = parseTimestamp(b?.date_time_check ?? b?.dateChecked ?? b?.date_inv ?? b?.date ?? b?.created_at ?? 0, true);
                        const da = daD ? daD.getTime() : 0;
                        const db = dbD ? dbD.getTime() : 0;
                        return db - da;
                    });
                    const chosen = sorted[0];
                    return {
                        date_time_check: chosen?.date_time_check ?? chosen?.dateChecked ?? chosen?.date_inv ?? chosen?.date ?? chosen?.checked_at ?? null,
                        checked_by: chosen?.checked_by ?? chosen?.checkedBy ?? null,
                        device: chosen?.device ?? chosen?.Device ?? chosen?.devicename ?? null,
                        ip_Address: chosen?.ip_Address ?? chosen?.ip_address ?? chosen?.ip ?? null,
                        rawRow: chosen,
                    } as Record<string, any>;
                }
            } catch (e) {
                // ignore
            }
            return undefined;
        };

        // open dialog immediately and show lightweight list so UI is responsive
        setDialogOpen(true);
        // Try to infer inventory id_art for each product from current rows so
        // the dialog can show the authoritative Sys. ID per item immediately.
        const inferIdForLabel = (label: string) => {
            try {
                const s = String(label || '');
                const m = s.match(/\(([^)]+)\)/);
                const candidateIds = [] as string[];
                if (m && m[1]) candidateIds.push(m[1]);
                const nums = (s.match(/\d+/g) || []).filter(Boolean);
                candidateIds.push(...nums);

                for (const r of rows || []) {
                    try {
                        const rawChecker = r?.checked_by ?? r?.checkedBy ?? r?.checker ?? '';
                        if (String(rawChecker).trim() !== String(checker).trim()) continue;
                        const idArt = r?.id_art ?? r?.Id_art ?? r?.id ?? r?.Id;
                        const code = String(r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? r?.CODE ?? '') || '';
                        // If idArt matches any extracted candidate, return it
                        if (idArt != null && candidateIds.includes(String(idArt))) return idArt;
                        // If product label contains the code text, return this row's idArt
                        if (code && s.indexOf(code) !== -1) return idArt;
                    } catch (e) { }
                }
            } catch (e) { }
            return undefined;
        };

        // prefill with labels + inventory meta so the list shows instantly while we fetch details
        setDialogProductsDetails((products || []).map((label: string) => ({ label, id: inferIdForLabel(label), detail: null, images: [], inventory: buildInventoryMeta(label) })));
        setDialogPage(0);
        // Fetch richer product details for the dialog.
        // Defer the heavy network work using setTimeout so the dialog can render immediately
        // and the browser can paint the prefilled items before we start many network requests.
        setDialogLoading(true);
        setTimeout(() => {
            (async () => {

                try {
                    // We no longer query multiple purchase endpoints per id. We prefer using the
                    // /Inventory/allActive payloads (collected into idFactPayloadMap) as the primary
                    // source of product details. Only when payloads miss required fields would we
                    // consider further network calls (not performed here to avoid 404s and delays).

                    // We no longer call per-base getitem endpoints here; prefer /Inventory/allActive payloads
                    // which were collected into idFactPayloadMap in the outer effect. This avoids many
                    // unnecessary network calls and 404s.

                    // Do not perform additional image network calls here. Use images included in /allActive payloads when available.

                    // For each product label, concurrently try to fetch details and images. We'll run all product fetches in parallel and then update state.
                    const productFetches = (products || []).map(async (label: string) => {
                        let candidateIds: string[] = [];
                        const m = String(label || '').match(/\(([^)]+)\)/);
                        if (m && m[1]) candidateIds.push(m[1]);
                        const nums = (String(label || '').match(/\d+/g) || []).filter(Boolean);
                        candidateIds = candidateIds.concat(nums);
                        candidateIds.push(String(label || '').trim());

                        let detail: any = null;
                        let usedId: string | undefined = undefined;

                        // try candidates in order but prefer payloads collected from /Inventory/allActive
                        for (const idCandidate of Array.from(new Set(candidateIds))) {
                            if (!idCandidate) continue;
                            try {
                                const payload = idFactPayloadMap[String(idCandidate)];
                                if (payload) {
                                    detail = payload;
                                    usedId = idCandidate;
                                    break;
                                }
                                // no payload found for this id; continue to next candidate
                            } catch (e) {
                                // ignore and try next candidate
                            }
                        }

                        // Prefer images included in the /allActive payload (if any)
                        let images: string[] = [];
                        try {
                            if (detail) {
                                const imgs = detail.images || detail.Images || detail.pictures || detail.Pictures || detail.imageUrls || detail.imagesList || detail.ImageList || detail.gallery;
                                if (Array.isArray(imgs)) {
                                    images = imgs.map((x: any) => toAbsoluteImageUrl(typeof x === 'string' ? x : (x?.url || x?.path || String(x)), usedId));
                                } else if (typeof imgs === 'string' && imgs) {
                                    images = [toAbsoluteImageUrl(imgs, usedId)];
                                }
                            }
                        } catch (e) {
                            images = [];
                        }

                        // If we still don't have images, try fetching images by id_art (or candidate ids)
                        if ((!images || images.length === 0) && (usedId || (candidateIds && candidateIds.length))) {
                            const token = localStorage.getItem('token');
                            const headers = { Authorization: token ? `Bearer ${token}` : undefined };
                            const tryIds = usedId ? [usedId, ...candidateIds] : candidateIds;
                            for (const tryId of Array.from(new Set(tryIds))) {
                                if (!tryId) continue;
                                const endpoints = [
                                    `/images/list/diamond/${tryId}`,
                                    `/images/list/${tryId}`,
                                ];
                                for (const ep of endpoints) {
                                    try {
                                        const resp = await axios.get(ep, { headers });
                                        const data = resp?.data;
                                        let urls: string[] = [];
                                        if (Array.isArray(data)) {
                                            // response may be array of strings or objects with url
                                            urls = data.map((x: any) => (typeof x === 'string' ? x : (x?.url || x))).filter(Boolean);
                                        } else if (typeof data === 'string') {
                                            urls = [data];
                                        }
                                        if (urls && urls.length) {
                                            images = urls.map(u => toAbsoluteImageUrl(u, tryId));
                                            break;
                                        }
                                    } catch (e) {
                                        // try next endpoint
                                    }
                                }
                                if (images && images.length) break;
                            }
                        }

                        // attach inventory meta (best-effort) from client-side rows
                        let inventoryMeta: Record<string, any> | undefined = undefined;
                        try {
                            const idsToMatch = new Set<string>([...(candidateIds || []).map((s) => String(s).trim())]);
                            const matched = rows.filter((r) => {
                                const rawChecker = r?.checked_by ?? r?.checkedBy ?? r?.checker ?? '';
                                if (String(rawChecker).trim() !== String(checker).trim()) return false;
                                const idArt = r?.id_art;
                                const code = r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? r?.CODE ?? '';
                                if (idArt != null && idsToMatch.has(String(idArt).trim())) return true;
                                if (code && idsToMatch.has(String(code).trim())) return true;
                                // fallback: match label text
                                if (idsToMatch.has(String(label).trim())) return true;
                                return false;
                            });
                            if (matched.length) {
                                const sorted = matched.sort((a, b) => {
                                    const daD = parseTimestamp(a?.date_time_check ?? a?.dateChecked ?? a?.date_inv ?? a?.date ?? a?.checked_at ?? 0, true);
                                    const dbD = parseTimestamp(b?.date_time_check ?? b?.dateChecked ?? b?.date_inv ?? b?.date ?? b?.checked_at ?? 0, true);
                                    const da = daD ? daD.getTime() : 0;
                                    const db = dbD ? dbD.getTime() : 0;
                                    return db - da;
                                });
                                const chosen = sorted[0];
                                inventoryMeta = {
                                    date_time_check: chosen?.date_time_check ?? chosen?.dateChecked ?? chosen?.date_inv ?? chosen?.date ?? chosen?.checked_at ?? null,
                                    checked_by: chosen?.checked_by ?? chosen?.checkedBy ?? null,
                                    device: chosen?.device ?? chosen?.Device ?? chosen?.devicename ?? null,
                                    ip_Address: chosen?.ip_Address ?? chosen?.ip_address ?? chosen?.ip ?? null,
                                    rawRow: chosen,
                                };
                            }
                        } catch (e) {
                            // ignore
                        }

                        return { label, id: usedId, detail, images, inventory: inventoryMeta };
                    });

                    const detailsArr = await Promise.all(productFetches);

                    // update state only if dialog is still open
                    setDialogProductsDetails(detailsArr);
                } catch (e) {
                    console.warn('Failed to fetch product details for dialog', e);
                } finally {
                    setDialogLoading(false);
                }
            })();
        }, 50);
    };

    const closeProductsDialog = () => {
        setDialogOpen(false);
        setDialogChecker(null);
        setDialogProductsDetails([]);
        setDialogLoading(false);
    };

    // Compute per-hour series for a given combo's rows
    const computeChartData = (combo: any) => {
        try {
            const candidates = (combo?.rows || []);
            const timestamps: number[] = [];
            for (const r of candidates) {
                const raw = r?.date_time_check ?? r?.dateChecked ?? r?.date_inv ?? r?.date ?? r?.created_at ?? r?.checked_at ?? null;
                if (!raw) continue;
                const d = parseTimestamp(raw, true);
                if (d) timestamps.push(d.getTime());
            }
            if (!timestamps.length) return null;
            timestamps.sort((a, b) => a - b);
            // Use UTC buckets so chart hours match DB times (which we parse as UTC)
            const first = new Date(timestamps[0]);
            const last = new Date(timestamps[timestamps.length - 1]);
            // startKey: floor to UTC hour
            const startKey = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate(), first.getUTCHours(), 0, 0, 0);
            // endKey: if last has minutes/seconds/ms then ceil to next UTC hour, else use that hour
            const hasFraction = last.getUTCMinutes() !== 0 || last.getUTCSeconds() !== 0 || last.getUTCMilliseconds() !== 0;
            const endHour = hasFraction ? last.getUTCHours() + 1 : last.getUTCHours();
            const endKey = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate(), endHour, 0, 0, 0);

            const counts: Record<number, number> = {};
            // initialize buckets (inclusive)
            for (let t = startKey; t <= endKey; t += 1000 * 60 * 60) {
                counts[t] = 0;
            }
            // assign timestamps to UTC hour buckets
            for (const ts of timestamps) {
                const d = new Date(ts);
                const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
                counts[key] = (counts[key] || 0) + 1;
            }

            // build Nivo-compatible series: x as Date (native), y as number
            const dataPoints = Object.keys(counts).map(k => ({ x: new Date(Number(k)), y: counts[Number(k)] }));
            // ensure sorted
            dataPoints.sort((a: any, b: any) => (a.x as Date).getTime() - (b.x as Date).getTime());
            return [{ id: 'Checks', data: dataPoints }];
        } catch (e) {
            return null;
        }
    };

    // Compute per-hour series for each distinct checker (checked_by) in the combo
    const computeCheckedBySeries = (combo: any) => {
        try {
            const candidates = (combo?.rows || []);
            // map checker -> timestamps
            const byChecker: Record<string, number[]> = {};
            for (const r of candidates) {
                const rawChecker = r?.checked_by ?? r?.checkedBy ?? r?.checker ?? '';
                const checker = rawChecker != null ? String(rawChecker).trim() : '';
                if (!checker) continue;
                const raw = r?.date_time_check ?? r?.dateChecked ?? r?.date_inv ?? r?.date ?? r?.created_at ?? r?.checked_at ?? null;
                if (!raw) continue;
                const d = parseTimestamp(raw, true);
                if (!d) continue;
                if (!byChecker[checker]) byChecker[checker] = [];
                byChecker[checker].push(d.getTime());
            }

            const allTimestamps: number[] = [];
            for (const k of Object.keys(byChecker)) {
                allTimestamps.push(...byChecker[k]);
            }
            if (!allTimestamps.length) return null;
            allTimestamps.sort((a, b) => a - b);
            const first = new Date(allTimestamps[0]);
            const last = new Date(allTimestamps[allTimestamps.length - 1]);
            const startKey = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate(), first.getUTCHours(), 0, 0, 0);
            const hasFraction = last.getUTCMinutes() !== 0 || last.getUTCSeconds() !== 0 || last.getUTCMilliseconds() !== 0;
            const endHour = hasFraction ? last.getUTCHours() + 1 : last.getUTCHours();
            const endKey = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate(), endHour, 0, 0, 0);

            // build bucket keys
            const bucketKeys: number[] = [];
            for (let t = startKey; t <= endKey; t += 1000 * 60 * 60) {
                bucketKeys.push(t);
            }

            // create series per checker
            const series: any[] = [];
            for (const checker of Object.keys(byChecker).sort()) {
                const counts: Record<number, number> = {};
                for (const k of bucketKeys) counts[k] = 0;
                for (const ts of byChecker[checker]) {
                    const d = new Date(ts);
                    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
                    counts[key] = (counts[key] || 0) + 1;
                }
                const dataPoints = bucketKeys.map(k => ({ x: new Date(k), y: counts[k] || 0 }));
                series.push({ id: checker || 'Unknown', data: dataPoints });
            }
            return series;
        } catch (e) {
            return null;
        }
    };

    const showChartForCombo = async (combo: any) => {
        try {
            setChartLoading(true);
            const series = computeChartData(combo);
            if (!series) {
                setChartSeries([]);
                setChartTitle('No timestamp data');
                setChartOpen(true);
                setChartLoading(false);
                return;
            }
            const title = `${combo.date} · ${psMap[String(combo.ps)] || combo.ps} · ${combo.count} items`;
            setChartSeries(series);
            setChartTitle(title);
            setChartOpen(true);
        } finally {
            setChartLoading(false);
        }
    };

    const showCheckedByChartForCombo = async (combo: any) => {
        try {
            setChartLoading(true);
            const series = computeCheckedBySeries(combo);
            if (!series) {
                setChartSeries([]);
                setChartTitle('No timestamp data by checker');
                setChartOpen(true);
                setChartLoading(false);
                return;
            }
            const title = `${combo.date} · ${psMap[String(combo.ps)] || combo.ps} · by checker`;
            setChartSeries(series);
            setChartTitle(title);
            setChartOpen(true);
        } finally {
            setChartLoading(false);
        }
    };

    // CSV helper that escapes values and optionally forces Excel to treat value as text
    const csvEscape = (v: any, forceText = false) => {
        if (v == null) v = '';
        const s = String(v);
        if (forceText) {
            // produce a formula that returns a string: ="<value>"
            const formula = `="${s.replace(/"/g, '""')}"`;
            // escape quotes for CSV and wrap in outer quotes
            const escaped = formula.replace(/"/g, '""');
            return `"${escaped}"`;
        }
        // default: escape double-quotes and wrap
        const escaped = s.replace(/"/g, '""');
        return `"${escaped}"`;
    };

    // Try to extract candidate ids from a row or a code-like string (used to lookup payload/type/client maps)
    const extractCandidateIdsFromRow = (r: any): string[] => {
        try {
            const ids: string[] = [];
            const idArt = r?.id_art ?? r?.Id_art ?? r?.id ?? r?.Id ?? null;
            if (idArt != null) ids.push(String(idArt));
            const code = r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? r?.CODE ?? '';
            const m = String(code || '').match(/\(([^)]+)\)/);
            if (m && m[1]) ids.push(String(m[1]));
            // also collect any numeric tokens from code
            const nums = (String(code || '').match(/\d+/g) || []).filter(Boolean);
            ids.push(...nums);
            // remove empties and duplicates
            return Array.from(new Set(ids.filter(Boolean)));
        } catch (e) {
            return [];
        }
    };

    const resolveDesignForRow = (r: any) => {
        // prefer row fields
        const rawDesign = r?.Design_art ?? r?.design_art ?? r?.design ?? r?.Designation ?? r?.Design ?? r?.DESIGN ?? r?.designation;
        if (rawDesign) return String(rawDesign);
        // fallback to payloads collected in idFactPayloadMap by id candidates
        const candidates = extractCandidateIdsFromRow(r);
        for (const id of candidates) {
            const p = idFactPayloadMap[String(id)];
            if (p) {
                const d = p?.Design_art ?? p?.design_art ?? p?.design ?? p?.Designation ?? p?.Design ?? p?.DESIGN ?? p?.designation;
                if (d) return String(d);
            }
        }
        return '';
    };

    const resolveTypeForRow = (r: any) => {
        const rawType = r?.Fournisseur?.TYPE_SUPPLIER ?? r?.TYPE_SUPPLIER ?? r?.type_supplier ?? r?.type ?? r?.Type ?? null;
        if (rawType) return String(rawType);
        // try idFactTypeMapState by id candidates
        const candidates = extractCandidateIdsFromRow(r);
        for (const id of candidates) {
            const t = idFactTypeMapState[String(id)];
            if (t) return String(t);
            const p = idFactPayloadMap[String(id)];
            if (p) {
                const pt = p?.Fournisseur?.TYPE_SUPPLIER ?? p?.TYPE_SUPPLIER ?? p?.type_supplier ?? p?.type ?? p?.Type;
                if (pt) return String(pt);
            }
        }
        return '';
    };

    const resolveClientForRow = (r: any) => {
        const rawClient = r?.Fournisseur?.client_name ?? r?.Fournisseur?.clientName ?? r?.Fournisseur?.name ?? r?.Fournisseur?.client ?? null;
        if (rawClient) return String(rawClient);
        const candidates = extractCandidateIdsFromRow(r);
        for (const id of candidates) {
            const c = idFactClientMap[String(id)];
            if (c) return String(c);
            const p = idFactPayloadMap[String(id)];
            if (p) {
                const cp = p?.Fournisseur?.client_name ?? p?.Fournisseur?.clientName ?? p?.Fournisseur?.name ?? p?.client_name ?? p?.client;
                if (cp) return String(cp);
            }
        }
        return '';
    };


    const exportComboToCsv = (combo: any) => {
        try {
            const outRows: Array<Record<string, any>> = [];
            const comboDate = (combo as any).date;
            const comboPs = (combo as any).ps;
            const comboTeams = Array.isArray((combo as any).teams) ? (combo as any).teams.join(',') : String((combo as any).teams || '');
            for (const r of (combo as any).rows || []) {
                outRows.push({
                    combo_date: comboDate,
                    ps: comboPs,
                    teams: comboTeams,
                    code: r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? '',
                    id_art: r?.id_art ?? r?.Id_art ?? r?.id ?? r?.Id ?? '',
                    design: resolveDesignForRow(r),
                    checked_by: r?.checked_by ?? r?.checkedBy ?? r?.checker ?? '',
                    date_time_check: r?.date_time_check ?? r?.dateChecked ?? r?.date_inv ?? r?.date ?? r?.created_at ?? r?.checked_at ?? '',
                    device: r?.device ?? r?.Device ?? r?.devicename ?? '',
                    ip_address: r?.ip_Address ?? r?.ip_address ?? r?.ip ?? '',
                    notes: r?.Notes ?? r?.notes ?? r?.note ?? '',
                    type_supplier: resolveTypeForRow(r),
                    client_name: resolveClientForRow(r),
                });
            }

            const headers = ['Date', 'ps', 'teams', 'code', 'Sys. ID', 'Product Name', 'checked by', 'date_time_check', 'device', 'ip_address', 'notes', 'type_supplier', 'client_name'];
            let csv = '\uFEFF' + headers.join(',') + '\n';
            for (const r of outRows) {
                const rowArr = headers.map(h => csvEscape(r[h] ?? '', (h === 'code' || h === 'id_art')));
                csv += rowArr.join(',') + '\n';
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const safePs = String(comboPs || '').replace(/[^a-z0-9\-_]/gi, '_').slice(0, 40);
            const filename = `inventory_${String(comboDate || 'unknown')}_${safePs}_${pad(now.getFullYear())}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                try { document.body.removeChild(a); } catch (e) { }
                URL.revokeObjectURL(url);
            }, 500);
        } catch (e) {
            console.error('Failed to export combo CSV', e);
        }
    };
    // avoid unused-local diagnostic when strict noUnusedLocals is enabled
    void exportComboToCsv;

    // Export a single combo's rows to an XLSX file with embedded first image per row when available
    const exportComboToExcel = async (combo: any) => {
        // show progress dialog
        setExportLoading(true);
        setExportProgress(0);
        setExportMessage('Preparing export...');
        try {
            const outRows: Array<Record<string, any>> = [];
            const comboDate = (combo as any).date;
            const comboPs = (combo as any).ps;
            const comboTeams = Array.isArray((combo as any).teams) ? (combo as any).teams.join(',') : String((combo as any).teams || '');
            for (const r of (combo as any).rows || []) {
                outRows.push({
                    combo_date: comboDate,
                    ps: comboPs,
                    teams: comboTeams,
                    code: r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? '',
                    id_art: r?.id_art ?? r?.Id_art ?? r?.id ?? r?.Id ?? '',
                    design: resolveDesignForRow(r),
                    checked_by: r?.checked_by ?? r?.checkedBy ?? r?.checker ?? '',
                    date_time_check: r?.date_time_check ?? r?.dateChecked ?? r?.date_inv ?? r?.date ?? r?.created_at ?? r?.checked_at ?? '',
                    device: r?.device ?? r?.Device ?? r?.devicename ?? '',
                    ip_address: r?.ip_Address ?? r?.ip_address ?? r?.ip ?? '',
                    notes: r?.Notes ?? r?.notes ?? r?.note ?? '',
                    type_supplier: resolveTypeForRow(r),
                    client_name: resolveClientForRow(r),
                });
            }

            const headers = ['Date', 'ps', 'teams', 'code', 'Sys. ID', 'Product Name', 'checked by', 'Checked date ', 'device', 'ip_address', 'notes', 'Type', 'Brand', 'Images'];

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Inventory');
            sheet.columns = headers.map(h => ({ header: h === 'image_url' ? 'Image' : h.replace(/_/g, ' ').toUpperCase(), key: h, width: h === 'image_url' ? 20 : 24 }));
            sheet.getRow(1).font = { bold: true } as any;

            for (let i = 0; i < outRows.length; i++) {
                const rec = outRows[i];
                // add row initially (image cell left empty)
                sheet.addRow(rec);
                // set row height to accommodate thumbnail
                sheet.getRow(i + 2).height = 80;
            }

            // Prepare to embed images
            const total = Math.max(1, (combo as any).rows.length || outRows.length);
            setExportMessage('Embedding images...');

            // For each row try to fetch a first image and embed it
            for (let i = 0; i < (combo as any).rows.length; i++) {
                const r = (combo as any).rows[i];
                // attempt to locate images in payload first
                let firstUrl: string | null = null;
                try {
                    // prefer payloads collected earlier
                    const candidates = extractCandidateIdsFromRow(r);
                    for (const cid of candidates) {
                        const payload = idFactPayloadMap[String(cid)];
                        if (payload) {
                            const imgs = payload.images || payload.Images || payload.pictures || payload.Pictures || payload.imageUrls || payload.imagesList || payload.gallery;
                            if (Array.isArray(imgs) && imgs.length) {
                                firstUrl = toAbsoluteImageUrl(typeof imgs[0] === 'string' ? imgs[0] : (imgs[0]?.url || imgs[0]?.path || String(imgs[0])), cid);
                                break;
                            } else if (typeof imgs === 'string' && imgs) {
                                firstUrl = toAbsoluteImageUrl(imgs, cid);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    // ignore
                }

                // if not found in payload, try /images endpoints using id_art or id in code
                if (!firstUrl) {
                    const ids = extractCandidateIdsFromRow(r);
                    const token = localStorage.getItem('token');
                    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
                    for (const idCandidate of ids) {
                        if (!idCandidate) continue;
                        const endpoints = [`/images/list/diamond/${idCandidate}`, `/images/list/${idCandidate}`];
                        for (const ep of endpoints) {
                            try {
                                const resp = await axios.get(ep, { headers });
                                const data = resp?.data;
                                let urls: string[] = [];
                                if (Array.isArray(data)) urls = data.map((x: any) => (typeof x === 'string' ? x : (x?.url || x))).filter(Boolean);
                                else if (typeof data === 'string') urls = [data];
                                if (urls && urls.length) {
                                    firstUrl = toAbsoluteImageUrl(urls[0], idCandidate);
                                    break;
                                }
                            } catch (e) {
                                // try next endpoint
                            }
                        }
                        if (firstUrl) break;
                    }
                }

                if (firstUrl) {
                    try {
                        const res = await getBase64FromUrl(firstUrl);
                        if (res && res.base64) {
                            const imgId = workbook.addImage({ base64: res.base64, extension: (res.ext as any) || 'png' });
                            // image column index (image_url is last)
                            const colIndex = headers.indexOf('image_url') + 1;
                            sheet.addImage(imgId, { tl: { col: colIndex - 1, row: i + 1 }, ext: { width: 80, height: 80 } });
                        } else {
                            // fallback: write URL as hyperlink
                            const colIndex = headers.indexOf('image_url') + 1;
                            const excelRow = sheet.getRow(i + 2);
                            excelRow.getCell(colIndex).value = { text: firstUrl, hyperlink: firstUrl } as any;
                            excelRow.getCell(colIndex).font = { color: { argb: 'FF0000FF' }, underline: true } as any;
                        }
                    } catch (e) {
                        // ignore embed errors
                    }
                }

                // update progress (reserve last 10% for generation/download)
                try {
                    const pct = Math.min(90, Math.round(((i + 1) / total) * 90));
                    setExportProgress(pct);
                } catch (e) { }
            }

            // style header row
            sheet.getRow(1).eachCell((cell: any) => {
                try {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17618C' } };
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                } catch (e) { }
            });

            setExportProgress(95);
            setExportMessage('Generating workbook...');
            const buffer = await workbook.xlsx.writeBuffer();

            setExportProgress(98);
            setExportMessage('Downloading file...');
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const safePs = String(comboPs || '').replace(/[^a-z0-9\-_]/gi, '_').slice(0, 40);
            a.download = `inventory_${String(comboDate || 'unknown')}_${safePs}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
            document.body.appendChild(a);
            a.click();
            setExportProgress(100);
            setExportMessage('Done');
            setTimeout(() => { try { document.body.removeChild(a); } catch (e) { } URL.revokeObjectURL(url); }, 500);
        } catch (e) {
            console.error('Failed to export combo to Excel with images', e);
            setExportMessage('Failed to export');
        } finally {
            // keep the dialog visible briefly so users can see 100%
            setTimeout(() => {
                setExportLoading(false);
                setExportProgress(0);
                setExportMessage(null);
            }, 800);
        }
    };

    return (
        <Box p={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'inherit' }}>Inventory Reports</Typography>



                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

                    {/* spacer removed: stray debug Box removed to avoid rendering */}







                    <Select
                        size="small"
                        value={filterRange}
                        onChange={(e: any) => {
                            const v = String(e?.target?.value || 'last_month');
                            setFilterRange(v);
                            if (v === 'custom' && !customFrom && !customTo) {
                                // default custom range to last 7 days
                                setCustomFrom(formatISODate(new Date(Date.now() - 7 * 24 * 3600 * 1000)));
                                setCustomTo(formatISODate(new Date()));
                            }
                        }}
                        sx={{ minWidth: 160 }}
                    >
                        <MenuItem value="last_week">Last week</MenuItem>
                        <MenuItem value="last_month">Last month</MenuItem>
                        <MenuItem value="last_quarter">Last quarter</MenuItem>
                        <MenuItem value="last_6_months">Last 6 months</MenuItem>
                        <MenuItem value="last_year">Last year</MenuItem>
                        <MenuItem value="custom">Custom range</MenuItem>
                    </Select>
                    {filterRange === 'custom' ? (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                                size="small"
                                type="date"
                                value={customFrom ?? ''}
                                onChange={(e: any) => setCustomFrom(e?.target?.value || null)}
                                sx={{ width: 150 }}
                                inputProps={{ max: customTo || undefined }}
                            />
                            <TextField
                                size="small"
                                type="date"
                                value={customTo ?? ''}
                                onChange={(e: any) => setCustomTo(e?.target?.value || null)}
                                sx={{ width: 150 }}
                                inputProps={{ min: customFrom || undefined }}
                            />
                        </Box>
                    ) : null}
                </Box>
            </Box>
            {error ? (
                <Typography color="error">{error}</Typography>
            ) : (

                <>

                    <Box sx={{ width: '100%', my: 2 }}>
                        <hr style={{ border: 0, borderTop: '1px solid #e0e0e0', margin: 0 }} />
                    </Box>

                    {/* Quick access: Check item dialog opener (Search by System id or Ref code) */}
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                setCheckQuery('');
                                setCheckResults([]);
                                setCheckError(null);
                                setCheckBy('id_art');
                                setCheckDialogOpen(true);
                            }}
                            sx={{ textTransform: 'none' }}
                        >
                            Check itemd
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                // aggregate checker counts across combos
                                const map: Record<string, { count: number; products: Set<string> }> = {};
                                for (const c of combos) {
                                    try {
                                        const stats = (c as any).checkerStats || {};
                                        const prods = (c as any).checkerProducts || {};
                                        for (const [name, cnt] of Object.entries(stats)) {
                                            if (!map[name]) map[name] = { count: 0, products: new Set<string>() };
                                            map[name].count += Number(cnt || 0);
                                            const arr = prods?.[name] || [];
                                            for (const p of arr) map[name].products.add(String(p));
                                        }
                                    } catch (e) { }
                                }
                                const list = Object.keys(map).map(n => ({ name: n, count: map[n].count, products: Array.from(map[n].products) }));
                                list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
                                setRankList(list);
                                setRankDialogOpen(true);
                            }}
                            sx={{ textTransform: 'none', ml: 1 }}
                        >
                            Checkers rank
                        </Button>
                    </Box>

                    <Box sx={{ width: '100%', my: 2 }}>
                        <hr style={{ border: 0, borderTop: '1px solid #e0e0e0', margin: 0 }} />
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>

                        {combos.length === 0 && !loading ? (
                            <Box sx={{ width: '100%' }}>
                                <Typography variant="body2" color="text.secondary">No inventory sessions found.</Typography>
                            </Box>
                        ) : combos.map((c, idx) => (
                            <Box key={`${c.date}|${idx}`} sx={{ width: { xs: '100%', sm: '33.3333%', md: '25%', lg: '20%' }, p: 0.5 }}>
                                <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', fontSize: '0.9rem' }}>
                                    <CardContent sx={{ flex: 1, p: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                            <Box>

                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.78rem' }}>{c.date}</Typography>
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={(psMap[String(c.ps)] || psMap[String((c as any).ps)] || c.ps)}
                                                        sx={{
                                                            fontWeight: 700,
                                                            fontSize: '0.72rem',
                                                            height: 22,
                                                            //backgroundColor: (theme) => alpha((Math.round(((c as any).checked / Math.max(1, c.count)) * 100) < 50 ? theme.palette.warning.main : theme.palette.success.main), 0.3),
                                                            borderColor: (theme) => (Math.round(((c as any).checked / Math.max(1, c.count)) * 100) < 50 ? theme.palette.warning.main : theme.palette.success.main),
                                                            //  color: (theme) => theme.palette.getContrastText(Math.round(((c as any).checked / Math.max(1, c.count)) * 100) < 50 ? theme.palette.warning.main : theme.palette.success.main)
                                                        }}
                                                    />
                                                    {(() => {
                                                        const types = ((c as any).types && (c as any).types.length) ? (c as any).types : (comboTypesMap[(c as any).key] || []);
                                                        return types && types.length ? (
                                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                {types.map((t: string, idx: number) => (
                                                                    <Chip key={`${t}-${idx}`} size="small" label={t} variant="outlined" sx={{
                                                                        fontSize: '0.72rem',
                                                                        height: 22,
                                                                        // backgroundColor: (theme) => alpha((Math.round(((c as any).checked / Math.max(1, c.count)) * 100) < 50 ? theme.palette.warning.main : theme.palette.success.main), 0.3),
                                                                        borderColor: (theme) => (Math.round(((c as any).checked / Math.max(1, c.count)) * 100) < 50 ? theme.palette.warning.main : theme.palette.success.main),
                                                                        // color: (theme) => theme.palette.getContrastText(Math.round(((c as any).checked / Math.max(1, c.count)) * 100) < 50 ? theme.palette.warning.main : theme.palette.success.main)
                                                                    }} />
                                                                ))}
                                                            </Box>
                                                        ) : null;
                                                    })()}
                                                </Box>
                                            </Box>

                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                {/* Percentage text (replaces circular gauge) */}
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                                        {Math.round(((c as any).checked / Math.max(1, c.count)) * 100)}%
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>{c.checked} / {c.count}</Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Box sx={{ my: 1 }}>
                                            <hr />
                                        </Box>
                                        {/* Show distinct checkers (users who performed checks) instead of Teams */}

                                        <Box sx={{ mt: 0.5 }}>
                                            {((c as any).checkerStats && Object.keys((c as any).checkerStats).length) ? (
                                                (() => {
                                                    // Sort checkers by their counts descending for a clear column view
                                                    const entries = (Object.entries((c as any).checkerStats || {}).map(([k, v]) => [k, Number(v)]) as [string, number][]).sort((a, b) => b[1] - a[1]);
                                                    return (
                                                        <Box>
                                                            {/* Header row: Sr | Checker name | Products checked */}
                                                            <Box sx={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 1, alignItems: 'center', mb: 0.5 }}>
                                                                <Typography variant="caption" sx={{ textAlign: 'right', fontWeight: 700 }}>SN</Typography>
                                                                <Typography variant="caption" sx={{ fontWeight: 700 }}>Checker name</Typography>
                                                                <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'right' }}>Products checked</Typography>
                                                            </Box>

                                                            {/* Rows */}
                                                            {entries.map(([u, cnt], i) => {
                                                                return (
                                                                    <Box key={`checker-${u}-${i}`} sx={{ mb: 0.5 }}>
                                                                        <Box sx={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 1, alignItems: 'center' }}>
                                                                            <Typography variant="body2" sx={{ textAlign: 'right' }}>{i + 1}.</Typography>
                                                                            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(u)}</Typography>
                                                                            <Button
                                                                                size="small"
                                                                                variant="outlined"
                                                                                color="info"
                                                                                onClick={() => openProductsDialog((c as any).key, u, (c as any).checkerProducts?.[u] || [])}
                                                                                sx={{ justifySelf: 'end', minWidth: 40, p: '2px 6px', height: 28, fontSize: '0.75rem' }}
                                                                                disabled={!(((c as any).types && (c as any).types.length) ? (c as any).types.length > 0 : (comboTypesMap[(c as any).key] || []).length > 0)}
                                                                                title={!(((c as any).types && (c as any).types.length) ? (c as any).types.length > 0 : (comboTypesMap[(c as any).key] || []).length > 0) ? 'Loading type information...' : undefined}
                                                                            >{cnt}</Button>
                                                                        </Box>
                                                                    </Box>
                                                                );
                                                            })}
                                                        </Box>
                                                    );
                                                })()
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">-</Typography>
                                            )}
                                        </Box>
                                        <Box sx={{ my: 1 }}>
                                            <hr />
                                        </Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Notes</Typography>
                                        <Box sx={{ mt: 0.5 }}>
                                            {c.notes && c.notes.length ? (
                                                c.notes.map((n, i) => (
                                                    <Typography key={i} variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{n}</Typography>
                                                ))
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">-</Typography>
                                            )}
                                        </Box>

                                        {/* Auto note: compute period (difference between earliest and latest timestamps) for this inventory period */}
                                        {(() => {
                                            try {
                                                const candidates = (c as any).rows || [];
                                                const dates = candidates
                                                    .map((r: any) => r?.date_time_check ?? r?.dateChecked ?? r?.date_inv ?? r?.date ?? r?.created_at ?? r?.checked_at ?? null)
                                                    .filter(Boolean)
                                                    .map((s: any) => {
                                                        const d = parseTimestamp(s, true);
                                                        return d;
                                                    })
                                                    .filter((d: any) => d != null)
                                                    .sort((a: Date, b: Date) => a.getTime() - b.getTime());

                                                if (!dates || dates.length === 0) return null;
                                                const fmt = (d: Date) => formatTimeHM(d, true);
                                                const start = dates[0];
                                                const end = dates[dates.length - 1];
                                                const diffMs = end.getTime() - start.getTime();
                                                const totalMinutes = Math.round(diffMs / 60000);
                                                const hours = Math.floor(totalMinutes / 60);
                                                const minutes = Math.abs(totalMinutes % 60);
                                                const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                                                // render as a single paragraph sentence with basic logic
                                                const startDateStr = start.toLocaleDateString();
                                                const endDateStr = end.toLocaleDateString();
                                                const includeDates = startDateStr !== endDateStr;
                                                const datePart = includeDates ? ` (${startDateStr} → ${endDateStr})` : '';

                                                // determine best checker: highest count, tie-broken by shortest duration
                                                const byChecker: Record<string, number[]> = {};
                                                for (const r of candidates) {
                                                    const rawChecker = r?.checked_by ?? r?.checkedBy ?? r?.checker ?? '';
                                                    const checker = rawChecker != null ? String(rawChecker).trim() : '';
                                                    if (!checker) continue;
                                                    const raw = r?.date_time_check ?? r?.dateChecked ?? r?.date_inv ?? r?.date ?? r?.created_at ?? r?.checked_at ?? null;
                                                    const d = parseTimestamp(raw, true);
                                                    if (!d) continue;
                                                    if (!byChecker[checker]) byChecker[checker] = [];
                                                    byChecker[checker].push(d.getTime());
                                                }

                                                let bestCheckerLabel: string | null = null;
                                                try {
                                                    const stats = Object.entries(byChecker).map(([name, ts]) => {
                                                        ts.sort((a, b) => a - b);
                                                        const count = ts.length;
                                                        const durationMs = ts.length > 0 ? (ts[ts.length - 1] - ts[0]) : 0;
                                                        return { name, count, durationMs };
                                                    });
                                                    if (stats.length) {
                                                        stats.sort((a, b) => {
                                                            if (b.count !== a.count) return b.count - a.count; // higher count first
                                                            return a.durationMs - b.durationMs; // shorter duration preferred
                                                        });
                                                        const best = stats[0];
                                                        const minutes = Math.max(0, Math.round(best.durationMs / 60000));
                                                        const durLabel = best.durationMs <= 0 ? 'instant' : (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`);
                                                        bestCheckerLabel = `${best.name} — ${best.count} check${best.count === 1 ? '' : 's'} in ${durLabel}`;
                                                    }
                                                } catch (e) {
                                                    // ignore and leave label null
                                                }

                                                return (
                                                    <Box sx={{ mt: 1 }}>
                                                        {/* Styled like a small warning chip with dotted border */}
                                                        <Box
                                                            sx={(theme) => ({
                                                                display: 'inline-block',
                                                                border: '1px dotted',
                                                                borderColor: theme.palette.warning.main,
                                                                borderRadius: 2,
                                                                px: 1,
                                                                py: 0.5,
                                                                // bgcolor: theme.palette.warning.light,
                                                                color: theme.palette.warning.dark,
                                                                fontSize: '0.70rem',
                                                                lineHeight: 1.2,
                                                            })}
                                                        >
                                                            <Typography component="span" variant="caption" sx={{ whiteSpace: 'pre-wrap' }}>
                                                                {`This inventory started at ${fmt(start)} and ended at ${fmt(end)}, lasting `}
                                                                <b>{durationLabel}</b>
                                                                {`${datePart}.`}
                                                            </Typography>

                                                            {bestCheckerLabel ? (
                                                                <Typography component="div" variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mt: 0.5, fontSize: '0.72rem' }}>
                                                                    {`Best: ${bestCheckerLabel}`}
                                                                </Typography>
                                                            ) : null}
                                                        </Box>
                                                    </Box>
                                                );
                                            } catch (e) {
                                                return null;
                                            }
                                        })()}

                                        {/* Progress moved next to date */}
                                    </CardContent>
                                    <CardActions sx={{ p: 1 }}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<ShowChartIcon fontSize="small" />}
                                            onClick={() => showChartForCombo(c)}
                                            disabled={!(((c as any).rows || []).some((r: any) => r?.date_time_check ?? r?.dateChecked ?? r?.date_inv ?? r?.date ?? r?.created_at ?? r?.checked_at))}
                                            sx={{ minWidth: 36, p: '2px 4px', height: 26, fontSize: '0.55rem', textTransform: 'none' }}
                                        >
                                            Chart global
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<ShowChartIcon fontSize="small" />}
                                            onClick={() => showCheckedByChartForCombo(c)}
                                            disabled={!(((c as any).rows || []).some((r: any) => r?.date_time_check ?? r?.dateChecked ?? r?.date_inv ?? r?.date ?? r?.created_at ?? r?.checked_at))}
                                            sx={{ minWidth: 36, p: '2px 4px', height: 26, fontSize: '0.55rem', textTransform: 'none' }}
                                        >
                                            By checker
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => exportComboToExcel(c)}
                                            disabled={exportLoading}
                                            sx={{ minWidth: 88, ml: 1, p: '2px 6px', height: 26, fontSize: '0.6rem', textTransform: 'none' }}
                                        >
                                            Export xls
                                        </Button>
                                        {(() => {
                                            // compute unchecked items (rows where checked_by is empty/null)
                                            try {
                                                const rowsArr = ((c as any).rows || []) as any[];
                                                const uncheckedRows = rowsArr.filter((r) => {
                                                    try {
                                                        const cb = r?.checked_by ?? r?.checkedBy ?? r?.checker ?? '';
                                                        return String(cb ?? '').trim() === '';
                                                    } catch (e) { return false; }
                                                });
                                                const uncheckedCount = uncheckedRows.length;
                                                if (!uncheckedCount) return null;
                                                const uncheckedLabels = uncheckedRows.map((r) => {
                                                    const code = r?.CODE_EXTERNAL ?? r?.code ?? r?.code_external ?? r?.CODE ?? '';
                                                    const idArt = r?.id_art ?? r?.id ?? r?.Id_art ?? r?.Id ?? null;
                                                    const prodLabel = code ? String(code) + (idArt ? ` (${String(idArt)})` : '') : (idArt ? String(idArt) : 'Unknown');
                                                    return prodLabel;
                                                });
                                                return (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="warning"
                                                        onClick={() => openProductsDialog((c as any).key, 'Unchecked', uncheckedLabels, true)}
                                                        sx={{ minWidth: 140, ml: 1, p: '2px 6px', height: 26, fontSize: '0.6rem', textTransform: 'none' }}
                                                    >
                                                        Unchecked items ({uncheckedCount})
                                                    </Button>
                                                );
                                            } catch (e) { return null; }
                                        })()}
                                    </CardActions>
                                </Card>
                            </Box>
                        ))}
                    </Box> </>
            )}

            {/* Check item dialog (search by System id = Id_art or Ref code = CODE_EXTERNAL) */}
            <Dialog open={checkDialogOpen} onClose={() => setCheckDialogOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Check item</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Select size="small" value={checkBy} onChange={(e: any) => setCheckBy(e?.target?.value)}>
                            <MenuItem value="id_art">System ID</MenuItem>
                            <MenuItem value="code">Ref Code</MenuItem>
                        </Select>
                        <TextField size="small" label={checkBy === 'id_art' ? 'System ID' : 'Ref. Code'} value={checkQuery} onChange={(e: any) => setCheckQuery(e?.target?.value || '')} sx={{ flex: 1 }} />
                        <Button size="small" variant="contained" onClick={handleCheckSearch} disabled={checkLoading} sx={{ textTransform: 'none' }}>Search</Button>
                    </Box>

                    {checkLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={20} /></Box>
                    ) : null}

                    {checkError ? <Typography color="error">{checkError}</Typography> : null}

                    {checkResults && checkResults.length ? (
                        <>
                            {/* Show first result image once at the top */}
                            {(() => {
                                try {
                                    const it = checkResults[0];
                                    const row = it.row ?? it.detail ?? null;
                                    let imagesRaw: any[] = [];
                                    try {
                                        if (it.images && Array.isArray(it.images)) imagesRaw = it.images;
                                        else if (row) imagesRaw = row.images || row.Images || row.pictures || row.Pictures || row.imageUrls || row.imagesList || row.ImageList || row.gallery || [];
                                        if (!imagesRaw.length) {
                                            const single = row?.PIC ?? row?.pic ?? row?.image_url ?? row?.Image ?? row?.url ?? null;
                                            if (single) imagesRaw = [single];
                                        }
                                    } catch (e) { imagesRaw = []; }

                                    const fallbackId = row?.id_art ?? row?.Id_art ?? row?.id ?? row?.Id ?? undefined;
                                    const images = (imagesRaw || []).map((x: any) => toAbsoluteImageUrl(typeof x === 'string' ? x : (x?.url || x?.path || String(x)), fallbackId)).filter(Boolean);
                                    const candidateImage = images.length ? images[0] : '';
                                    const displayImage = (images || []).find((img: any) => {
                                        try { return !/group/i.test(String(img || '')); } catch (e) { return true; }
                                    }) || candidateImage || '';

                                    if (!displayImage) return null;

                                    return (
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                                            <Box
                                                component="img"
                                                src={displayImage}
                                                alt={String(row?.CODE_EXTERNAL || '')}
                                                loading="lazy"
                                                onClick={() => { try { setZoomImage(String(displayImage)); setZoomOpen(true); } catch (e) { } }}
                                                onError={(e: any) => { try { e.currentTarget.onerror = null; e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='240'><rect width='100%' height='100%' fill='%23e0e0e0'/></svg>"; } catch (err) { e.currentTarget.src = ''; } }}
                                                style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 6, cursor: 'pointer' }}
                                            />
                                        </Box>
                                    );
                                } catch (e) {
                                    return null;
                                }
                            })()}

                            <List>
                            {checkResults.map((it, idx) => {
                                // normalize to a display object
                                const row = it.row ?? it.detail ?? null;
                                // gather candidate images from multiple common fields and normalize them to absolute URLs
                                let imagesRaw: any[] = [];
                                try {
                                    if (it.images && Array.isArray(it.images)) imagesRaw = it.images;
                                    else if (row) imagesRaw = row.images || row.Images || row.pictures || row.Pictures || row.imageUrls || row.imagesList || row.ImageList || row.gallery || [];
                                    // also accept single PIC fields
                                    if (!imagesRaw.length) {
                                        const single = row?.PIC ?? row?.pic ?? row?.image_url ?? row?.Image ?? row?.url ?? null;
                                        if (single) imagesRaw = [single];
                                    }
                                } catch (e) { imagesRaw = []; }

                                // images for each item are intentionally not rendered here (top preview shown once)

                                // additional details using existing helpers
                                const design = row ? resolveDesignForRow(row) : '';
                                const typeStr = row ? resolveTypeForRow(row) : '';
                                const clientStr = row ? resolveClientForRow(row) : '';
                                const device = row?.device ?? row?.Device ?? row?.devicename ?? '';
                                // compute checked date, time and checker
                                const rawCheckedVal = row?.date_time_check ?? row?.dateChecked ?? row?.date_inv ?? row?.date ?? row?.created_at ?? row?.checked_at ?? row?.checked_date;
                                let checkedDateStr = '';
                                let checkedTimeStr = '';
                                try {
                                    const d = parseTimestamp(rawCheckedVal, true) || parseTimestamp(rawCheckedVal, false);
                                    if (d) {
                                        const y = d.getUTCFullYear();
                                        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                                        const da = String(d.getUTCDate()).padStart(2, '0');
                                        const hh = String(d.getUTCHours()).padStart(2, '0');
                                        const mm = String(d.getUTCMinutes()).padStart(2, '0');
                                        const ss = String(d.getUTCSeconds()).padStart(2, '0');
                                        checkedDateStr = `${y}-${m}-${da}`;
                                        checkedTimeStr = `${hh}:${mm}:${ss}`;
                                    } else {
                                        checkedDateStr = formatDateYYYYMMDD(rawCheckedVal);
                                    }
                                } catch (e) {
                                    checkedDateStr = formatDateYYYYMMDD(rawCheckedVal);
                                }
                                const checkerName = String(row?.checked_by ?? row?.checkedBy ?? row?.checker ?? '') || '';
                                const ipAddr = row?.ip_Address ?? row?.ip_address ?? row?.ip ?? '';
                                const notes = row?.Notes ?? row?.notes ?? row?.note ?? '';
                                const gnew = row?.GNew_I ?? row?.GNew ?? row?.GNew_I;

                                return (
                                    <ListItem key={`check-${idx}`} disableGutters sx={{ alignItems: 'flex-start' }}>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', width: '100%' }}>
                                            {/* Image is displayed once above; keep a stable placeholder here for layout */}


                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="body1" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(design || row?.Designation || row?.design || row?.Design || row?.label || row?.CODE_EXTERNAL || '—')}</Typography>
                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                                    {row?.id_art || row?.Id_art || row?.id ? (<Typography variant="body2">ID: {String(row?.id_art ?? row?.Id_art ?? row?.id)}</Typography>) : null}
                                                    {row?.CODE_EXTERNAL || row?.code ? (<Typography variant="body2">Ref: {String(row?.CODE_EXTERNAL ?? row?.code)}</Typography>) : null}
                                                    {typeStr ? (<Typography variant="body2">Type: {typeStr}</Typography>) : null}
                                                    {clientStr ? (<Typography variant="body2" color="text.secondary">{clientStr}</Typography>) : null}
                                                </Box>

                                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
                                                    {(checkedDateStr || checkedTimeStr) ? (
                                                        <Typography variant="body2">Checked: {checkedDateStr}{checkedTimeStr ? ` ${checkedTimeStr}` : ''}</Typography>
                                                    ) : null}
                                                    {checkerName ? (<Typography variant="body2">Checked by: {checkerName}</Typography>) : null}
                                                    {device ? (<Typography variant="body2">Device: {device}</Typography>) : null}
                                                    {ipAddr ? (<Typography variant="body2">IP: {ipAddr}</Typography>) : null}
                                                    {gnew ? (<Typography variant="caption" color="text.secondary">GNew_I: {String(gnew)}</Typography>) : null}
                                                </Box>

                                                {notes ? (
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{String(notes)}</Typography>
                                                ) : null}
                                            </Box>
                                        </Box>
                                    </ListItem>
                                );
                            })}
                        </List>
                        </>
                    ) : (!checkLoading ? (
                        <Typography variant="body2" color="text.secondary">No matches</Typography>
                    ) : null)}
                </DialogContent>
                <DialogActions>
                    <Button size="small" onClick={() => setCheckDialogOpen(false)} sx={{ minWidth: 48, p: '2px 8px', height: 30, fontSize: '0.8rem' }}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Checkers rank dialog (aggregated across all combos) */}
            <Dialog open={rankDialogOpen} onClose={() => setRankDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Checkers ranking</DialogTitle>
                <DialogContent dividers>
                    {rankList && rankList.length ? (
                        <List>
                            {rankList.map((r, i) => (
                                <ListItem key={`rank-${i}`} disableGutters sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        <Typography variant="body2" sx={{ width: 28, textAlign: 'right' }}>{i + 1}.</Typography>
                                        <Box>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>{r.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{r.count} checks</Typography>
                                        </Box>
                                    </Box>
                                    <Box>
                                        <Button size="small" variant="outlined" onClick={() => {
                                            // open product dialog with aggregated products for this checker; allow opening even if no combo type available
                                            openProductsDialog('', r.name, r.products || [], true);
                                            setRankDialogOpen(false);
                                        }} sx={{ textTransform: 'none' }}>View products</Button>
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography variant="body2" color="text.secondary">No checkers data available.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button size="small" onClick={() => setRankDialogOpen(false)} sx={{ minWidth: 48, p: '2px 8px', height: 30, fontSize: '0.8rem' }}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Chart dialog (per-combo hourly performance) */}
            <Dialog open={chartOpen} onClose={() => setChartOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Performance evaluation during the hours {chartTitle ? `· ${chartTitle}` : ''}</DialogTitle>
                <DialogContent dividers>
                    {chartLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={24} /></Box>
                    ) : (
                        chartSeries && chartSeries.length ? (
                            <Box sx={{ height: 340 }}>
                                <ResponsiveLine
                                    data={chartSeries}
                                    xScale={{ type: 'time', format: 'native' }}
                                    xFormat="time:%H:%M"
                                    yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
                                    curve="monotoneX"
                                    axisLeft={{ legend: 'Count', legendPosition: 'middle', legendOffset: -40 }}
                                    axisBottom={{
                                        // format tick labels using UTC so labels match DB hour values
                                        // `format` accepts a string pattern or a function
                                        format: (value: any) => {
                                            try {
                                                const d = value instanceof Date ? value : new Date(value);
                                                return formatTimeHM(d, true);
                                            } catch (e) {
                                                return String(value);
                                            }
                                        },
                                        tickValues: 'every 1 hour',
                                        legend: 'Hour',
                                        legendOffset: 36,
                                        legendPosition: 'middle',
                                    }}
                                    colors={{ scheme: 'set2' }}
                                    // Increase right margin so the legend can be placed outside the plotted area
                                    margin={{ top: 20, right: 260, bottom: 60, left: 60 }}
                                    pointSize={8}
                                    pointBorderWidth={1}
                                    useMesh={true}
                                    enableSlices={false}
                                    enableGridX={false}
                                    enableGridY={true}
                                    legends={[
                                        {
                                            anchor: 'right',
                                            direction: 'column',
                                            justify: false,
                                            // push legend further to the right (outside the chart area)
                                            translateX: 160,
                                            translateY: 0,
                                            itemsSpacing: 6,
                                            itemDirection: 'left-to-right',
                                            itemWidth: 110,
                                            itemHeight: 20,
                                            itemOpacity: 0.9,
                                            itemTextColor: '#3c3c3c',
                                            symbolSize: 10,
                                            symbolShape: 'circle',
                                            effects: [
                                                {
                                                    on: 'hover',
                                                    style: {
                                                        itemOpacity: 1
                                                    }
                                                }
                                            ]
                                        }
                                    ]}
                                    // Disable the per-point tooltip to avoid the small in-chart floating box
                                    tooltip={() => null}
                                />
                            </Box>
                        ) : (
                            <Typography variant="body2" color="text.secondary">No timestamped checks for this session.</Typography>
                        )
                    )}
                </DialogContent>
                <DialogActions>
                    <Button size="small" onClick={() => setChartOpen(false)} sx={{ minWidth: 48, p: '2px 8px', height: 30, fontSize: '0.8rem' }}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Image zoom dialog */}
            <Dialog open={zoomOpen} onClose={() => { setZoomOpen(false); setZoomImage(null); }} maxWidth="lg" fullWidth>
                <DialogTitle>Image preview</DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
                    {zoomImage ? (
                        <Box
                            component="img"
                            src={zoomImage}
                            alt="zoomed"
                            onError={(e: any) => { try { e.currentTarget.onerror = null; e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='240'><rect width='100%' height='100%' fill='%23e0e0e0'/></svg>"; } catch (err) { e.currentTarget.src = ''; } }}
                            sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 1 }}
                        />
                    ) : (
                        <Typography variant="body2" color="text.secondary">No image available</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button size="small" onClick={() => { setZoomOpen(false); setZoomImage(null); }} sx={{ minWidth: 48, p: '2px 8px', height: 30, fontSize: '0.8rem' }}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Products dialog (placed after main content) */}
            <Dialog open={dialogOpen} onClose={closeProductsDialog} fullWidth maxWidth="sm">
                <DialogTitle>
                    Products checked by {dialogChecker}
                    {" \u00B7 "}
                    {dialogProductsDetails ? dialogProductsDetails.length : 0} item{dialogProductsDetails && dialogProductsDetails.length === 1 ? '' : 's'}

                </DialogTitle>
                <DialogContent dividers>
                    {dialogLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={24} /></Box>
                    ) : (dialogProductsDetails && dialogProductsDetails.length ? (
                        <>
                            {/* Pagination controls */}
                            {/* Legend label hint for clarity */}
                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                <Typography variant="caption" color="text.secondary">Legend: each curve represents a checker</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption">Rows per page:</Typography>
                                    <Select size="small" value={dialogRowsPerPage} onChange={(e) => { setDialogRowsPerPage(Number(e.target.value)); setDialogPage(0); }}>
                                        <MenuItem value={5}>5</MenuItem>
                                        <MenuItem value={10}>10</MenuItem>
                                        <MenuItem value={20}>20</MenuItem>
                                        <MenuItem value={50}>50</MenuItem>
                                    </Select>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {/** prev */}
                                    <Button size="small" disabled={dialogPage <= 0} onClick={() => setDialogPage((p) => Math.max(0, p - 1))} sx={{ minWidth: 36, p: '2px 6px', height: 28, fontSize: '0.75rem' }}>Prev</Button>
                                    <Typography variant="caption">{dialogPage + 1} / {Math.max(1, Math.ceil(dialogProductsDetails.length / dialogRowsPerPage))}</Typography>
                                    <Button size="small" disabled={dialogPage >= Math.max(0, Math.ceil(dialogProductsDetails.length / dialogRowsPerPage) - 1)} onClick={() => setDialogPage((p) => p + 1)} sx={{ minWidth: 36, p: '2px 6px', height: 28, fontSize: '0.75rem' }}>Next</Button>
                                </Box>
                            </Box>

                            <List>
                                {(() => {
                                    const total = dialogProductsDetails.length;
                                    const totalPages = Math.max(1, Math.ceil(total / dialogRowsPerPage));
                                    const page = Math.min(Math.max(0, dialogPage), totalPages - 1);
                                    const start = page * dialogRowsPerPage;
                                    const pageItems = dialogProductsDetails.slice(start, start + dialogRowsPerPage);
                                    return pageItems.map((it, i) => (
                                        <ListItem key={`${start + i}-${it.label}`} disableGutters sx={{ alignItems: 'flex-start' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                {(() => {
                                                    // prefer first image that does NOT contain the word 'group' in its filename or url
                                                    const displayImage = (it.images || []).find((img: any) => {
                                                        try {
                                                            return !/group/i.test(String(img || ''));
                                                        } catch (e) { return true; }
                                                    });
                                                    if (displayImage) {
                                                        return (
                                                            <Box
                                                                component="img"
                                                                src={displayImage}
                                                                alt={it.label}
                                                                loading="lazy"
                                                                onClick={() => {
                                                                    try {
                                                                        setZoomImage(String(displayImage));
                                                                        setZoomOpen(true);
                                                                    } catch (e) { }
                                                                }}
                                                                onError={(e: any) => {
                                                                    try {
                                                                        e.currentTarget.onerror = null;
                                                                        e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='100%' height='100%' fill='%23e0e0e0'/></svg>";
                                                                    } catch (err) {
                                                                        e.currentTarget.src = '';
                                                                    }
                                                                }}
                                                                sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }}
                                                            />
                                                        );
                                                    }
                                                    return <Box sx={{ width: 64, height: 64, backgroundColor: 'grey.100', borderRadius: 1 }} />;
                                                })()}
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                        <Typography variant="body1" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {(it.detail && (it.detail.Design_art || it.detail.design_art)) || it.label}
                                                        </Typography>
                                                        {((it.detail?.CODE_EXTERNAL ?? it.detail?.Code_external ?? it.detail?.code_external ?? it.detail?.CODE) ? (
                                                            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                                                Ref.: {String(it.detail?.CODE_EXTERNAL ?? it.detail?.Code_external ?? it.detail?.code_external ?? it.detail?.CODE)}
                                                                {(() => {
                                                                    // Prefer Sys ID from the inventory row (id_art / Id_art) as the
                                                                    // authoritative system identifier. Fall back to detail fields
                                                                    // only when inventory id is not available.
                                                                    const sysIdInventory = it.inventory?.id_art ?? it.inventory?.rawRow?.Id_art ?? it.inventory?.rawRow?.id ?? it.inventory?.rawRow?.Id;
                                                                    const sysIdDetail = it.detail?.id_art ?? it.detail?.Id_art ?? it.detail?.IdArt ?? it.detail?.id ?? it.id;
                                                                    const sysId = sysIdInventory ?? sysIdDetail;
                                                                    if (sysId == null) return null;
                                                                    // Always show Sys. ID (taken primarily from inventory.id_art) so
                                                                    // the UI reflects the inventory model's system id.
                                                                    return ` · Sys. ID: ${String(sysId)}`;
                                                                })()}
                                                            </Typography>
                                                        ) : null)}

                                                        {/* Brand / supplier name: prefer value from /allActive mapping (idFactClientMap) or inventory rawRow, then product detail fields */}
                                                        {(() => {
                                                            // try id from fetched detail (used when product fetch found an id), or from label like 'CODE (id)'
                                                            const label = String(it.label || '');
                                                            const m = label.match(/\(([^)]+)\)/);
                                                            const candidateId = it.id ? String(it.id) : (m ? String(m[1]) : undefined);
                                                            const brandFromMap = candidateId ? idFactClientMap[String(candidateId)] : undefined;
                                                            const brandFromInventory = it.inventory?.rawRow?.Fournisseur?.client_name ?? it.inventory?.rawRow?.Fournisseur?.clientName ?? it.inventory?.rawRow?.Fournisseur?.name;
                                                            const brandFromDetail = it.detail?.Fournisseur?.client_name ?? it.detail?.Fournisseur?.clientName ?? it.detail?.Brand ?? it.detail?.brand ?? it.detail?.brand_name ?? it.detail?.Fournisseur?.BRAND ?? it.detail?.Fournisseur?.brand ?? it.detail?.Fournisseur?.name;
                                                            const brand = brandFromMap || brandFromInventory || brandFromDetail;
                                                            return brand ? (<Typography variant="body2" color="text.secondary">{String(brand)}</Typography>) : null;
                                                        })()}

                                                    </Box>



                                                    {/* show qty when type indicates gold or qty exists */}
                                                    {it.detail ? (
                                                        <>

                                                            {it.detail?.GNew_I ? (
                                                                <Typography variant="caption" color="text.secondary">GNew_I: {String(it.detail?.GNew_I)}</Typography>
                                                            ) : null}

                                                            {/* New: show id_fact, ref, date checked and device when available (support multiple field name variants) */}


                                                            {(it.detail?.ref ?? it.detail?.Ref ?? it.detail?.reference ?? it.detail?.Reference) ? (
                                                                <Typography variant="body2" color="text.secondary">Ref: {String(it.detail?.ref ?? it.detail?.Ref ?? it.detail?.reference ?? it.detail?.Reference)}</Typography>
                                                            ) : null}

                                                            {(it.detail?.date_checked ?? it.detail?.dateChecked ?? it.detail?.Date_checked ?? it.detail?.checked_date ?? it.detail?.date) ? (
                                                                <Typography variant="body2" color="text.secondary">Checked: {formatDate(it.detail?.date_checked ?? it.detail?.dateChecked ?? it.detail?.Date_checked ?? it.detail?.checked_date ?? it.detail?.date)}</Typography>
                                                            ) : null}

                                                            {(it.detail?.device ?? it.detail?.Device ?? it.detail?.devicename) ? (
                                                                <Typography variant="body2" color="text.secondary">Device: {String(it.detail?.device ?? it.detail?.Device ?? it.detail?.devicename)}</Typography>
                                                            ) : null}

                                                            {/* Inventory metadata attached from the inventory rows (best-effort) */}
                                                            {it.inventory ? (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
                                                                    {it.inventory.date_time_check ? (
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            checked at: {(() => {
                                                                                const val = it.inventory.date_time_check;
                                                                                if (!val) return '';
                                                                                try {
                                                                                    const d = parseTimestamp(val, true) || parseTimestamp(val, false);
                                                                                    if (d) {
                                                                                        // show date in yyyy-mm-dd (UTC) and time HH:mm:ss in UTC to match DB
                                                                                        const y = d.getUTCFullYear();
                                                                                        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                                                                                        const da = String(d.getUTCDate()).padStart(2, '0');
                                                                                        const hh = String(d.getUTCHours()).padStart(2, '0');
                                                                                        const mm = String(d.getUTCMinutes()).padStart(2, '0');
                                                                                        const ss = String(d.getUTCSeconds()).padStart(2, '0');
                                                                                        return `${y}-${m}-${da} ${hh}:${mm}:${ss}`;
                                                                                    }
                                                                                } catch (e) { }
                                                                                return String(val);
                                                                            })()}
                                                                        </Typography>
                                                                    ) : null}

                                                                    {it.inventory.device ? (
                                                                        <Typography variant="body2" color="text.secondary">Device: {String(it.inventory.device)}</Typography>
                                                                    ) : null}
                                                                    {it.inventory.ip_Address ? (
                                                                        <Typography variant="body2" color="text.secondary">IP: {String(it.inventory.ip_Address)}</Typography>
                                                                    ) : null}
                                                                </Box>
                                                            ) : null}


                                                        </>
                                                    ) : (
                                                        <>
                                                            <Typography variant="body2" color="text.secondary">{it.label}</Typography>
                                                            {(() => {
                                                                const m = String(it.label || '').match(/\(([^)]+)\)/);
                                                                const cid = it.id ? String(it.id) : (m ? String(m[1]) : undefined);
                                                                const mappedType = cid ? idFactTypeMapState[String(cid)] : undefined;
                                                                return mappedType ? (<Typography variant="caption" color="text.secondary">Type: {mappedType}</Typography>) : null;
                                                            })()}
                                                        </>
                                                    )}
                                                </Box>
                                            </Box>
                                        </ListItem>
                                    ));
                                })()}
                            </List>
                        </>
                    ) : (
                        <Typography variant="body2" color="text.secondary">No products listed</Typography>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button size="small" onClick={closeProductsDialog} sx={{ minWidth: 48, p: '2px 8px', height: 30, fontSize: '0.8rem' }}>Close</Button>
                </DialogActions>
            </Dialog>
            {/* Export progress dialog */}
            <Dialog open={exportLoading} onClose={() => { }} maxWidth="xs" fullWidth>
                <DialogTitle>Exporting to Excel</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ width: '100%' }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>{exportMessage || 'Working...'}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                                <LinearProgress variant="determinate" value={exportProgress} />
                            </Box>
                            <Box sx={{ minWidth: 48 }}>
                                <Typography variant="caption">{exportProgress}%</Typography>
                            </Box>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button size="small" disabled sx={{ minWidth: 48, p: '2px 8px', height: 30, fontSize: '0.8rem' }}>Exporting...</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default InventoryReports;