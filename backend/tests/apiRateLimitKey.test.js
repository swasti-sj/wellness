const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const apiRateLimitKey = require('../utils/apiRateLimitKey');

test('authenticated requests share a rate-limit bucket across client IPs', () => {
  process.env.JWT_SECRET = 'rate-limit-test-secret';
  const token = jwt.sign({ id: 'patient-1', role: 'doctor' }, process.env.JWT_SECRET);

  const firstKey = apiRateLimitKey({
    headers: { authorization: `Bearer ${token}` },
    ip: '192.0.2.1',
  });
  const secondKey = apiRateLimitKey({
    headers: { authorization: `Bearer ${token}` },
    ip: '192.0.2.2',
  });

  assert.equal(firstKey, 'user:doctor:patient-1');
  assert.equal(secondKey, firstKey);
});

test('unauthenticated requests remain rate limited by IP', () => {
  const key = apiRateLimitKey({ headers: {}, ip: '192.0.2.10' });
  assert.equal(key, 'ip:192.0.2.10');
});
