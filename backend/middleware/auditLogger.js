const jwt = require('jsonwebtoken');
const { logActivity, getClientIp, parseUserAgent } = require('../utils/audit');

function getTokenFromRequest(req) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }
    if (req.body?.token) return req.body.token;
    if (req.query?.token) return req.query.token;
    return null;
}

function parseToken(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

function sanitizeObject(value) {
    if (!value || typeof value !== 'object') return value;
    const sanitized = {};

    Object.entries(value).forEach(([key, item]) => {
        if (key === 'token' || key === 'password') return;
        if (typeof item === 'object' && item !== null) {
            sanitized[key] = Array.isArray(item) ? '[array]' : '[object]';
        } else {
            sanitized[key] = item;
        }
    });

    return sanitized;
}

function getModuleFromUrl(url) {
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    if (parts.length === 0) return 'API';

    const baseSegment = parts[0] === 'api' ? parts[1] || 'API' : parts[0];
    const mapping = {
        admin: 'Admin',
        adminAudit: 'AdminAudit',
        appointments: 'Appointments',
        doctors: 'Doctors',
        users: 'Users',
        trialread: 'TrialRead',
        notes: 'Notes',
        prescriptions: 'Prescriptions',
        referrals: 'Referrals',
        vitals: 'Vitals',
        tests: 'Tests',
        medicines: 'Pharmacy',
        issuances: 'Issuances',
        nurse: 'Nurse',
        receptionist: 'Receptionist',
        pharmacists: 'Pharmacists',
        auth: 'Auth',
        dashboard: 'Dashboard'
    };

    return mapping[baseSegment] || baseSegment.charAt(0).toUpperCase() + baseSegment.slice(1);
}

module.exports = async function auditLogger(req, res, next) {
    const writeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (!writeMethods.includes(req.method)) {
        return next();
    }

    const token = getTokenFromRequest(req);
    const decoded = parseToken(token);
    const { browserInfo, deviceInfo } = parseUserAgent(req.headers['user-agent']);
    const auditEvent = {
        userId: decoded?.id || null,
        userName: decoded?.name || decoded?.email || 'Unknown',
        userEmail: decoded?.email || 'Unknown',
        role: decoded?.role || 'unknown',
        sessionId: decoded?.sessionId || null,
        module: getModuleFromUrl(req.originalUrl),
        action: `${req.method} ${req.originalUrl}`,
        description: `Mutating request: ${req.method} ${req.originalUrl}`,
        severity: 'AUDIT',
        ipAddress: getClientIp(req),
        deviceInfo,
        browserInfo,
        details: {
            params: sanitizeObject(req.params),
            query: sanitizeObject(req.query),
            body: sanitizeObject(req.body),
            contentType: req.headers['content-type'] || 'unknown'
        }
    };

    const start = Date.now();

    res.on('finish', async () => {
        auditEvent.details.statusCode = res.statusCode;
        auditEvent.details.durationMs = Date.now() - start;
        const statusText = res.statusCode >= 400 ? 'FAILED' : 'SUCCESS';
        auditEvent.details.statusText = statusText;
        if (res.statusCode >= 500) {
            auditEvent.severity = 'ERROR';
        } else if (res.statusCode >= 400) {
            auditEvent.severity = 'WARNING';
        }
        auditEvent.description += ` - completed ${statusText.toLowerCase()} with status ${res.statusCode}`;

        // If token didn't include name/email, try to resolve from DB (best-effort, non-blocking)
        if ((auditEvent.userName === 'Unknown' || auditEvent.userEmail === 'Unknown') && decoded?.id) {
            try {
                const roleToModel = {
                    admin: 'Admin',
                    doctor: 'Doctor',
                    nurse: 'Nurse',
                    receptionist: 'Receptionist',
                    pharmacist: 'Pharmacist',
                    patient: 'User'
                };

                const candidates = decoded?.role && roleToModel[decoded.role] ? [roleToModel[decoded.role]] : ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'User'];

                let userDoc = null;
                for (const modelName of candidates) {
                    try {
                        // dynamic require so we don't eagerly load all models
                        // eslint-disable-next-line global-require, import/no-dynamic-require
                        const Model = require(`../models/${modelName}`);
                        userDoc = await Model.findById(decoded.id).select('name email').lean();
                        if (userDoc) break;
                    } catch (e) {
                        // ignore and continue
                    }
                }

                if (userDoc) {
                    auditEvent.userName = userDoc.name || userDoc.email || auditEvent.userName;
                    auditEvent.userEmail = userDoc.email || auditEvent.userEmail;
                }
            } catch (e) {
                // Non-fatal — we still proceed to write the audit event
                console.warn('Audit fallback DB lookup failed:', e?.message || e);
            }
        }

        try {
            await logActivity(auditEvent);
        } catch (err) {
            console.warn('Audit logger failed:', err?.message || err);
        }
    });

    next();
};