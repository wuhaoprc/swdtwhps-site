// POST /api/inquiry —— 官网「提交工况」表单的接收端（Cloudflare Pages Functions）
//
// 环境变量（在 Pages 项目设置里配，不需要写进仓库）：
//   INQUIRY_WEBHOOK       群机器人 webhook，支持飞书 / 企业微信 / 通用 JSON 端点
//   RESEND_API_KEY        可选，Resend 邮件 API Key
//   INQUIRY_EMAIL_TO      可选，收件邮箱（多个用逗号分隔）
//   INQUIRY_EMAIL_FROM    可选，发件地址（需在 Resend 里已验证过的域名）
//
// 两个都没配时返回 503 { error: 'not_configured' }，前端据此提示改用电话/邮箱。
// 本站不落库、不写 D1/KV：一条工况只做即时转发，减少个人信息留存面。

const MAX = { company: 80, person: 40, phone: 40, email: 120, place: 80, capacity: 30, note: 800 };

// 基础频次限制：同一 IP 10 分钟内最多 6 次，超限返回 429。
// 只在当前 isolate 内存里计数，属于尽力而为的第一道闸，不落库、不写 KV。
const RATE = { windowMs: 10 * 60 * 1000, max: 6, keep: 4000 };
const hits = new Map();

function overLimit(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  arr.push(now);
  if (hits.size > RATE.keep) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > RATE.windowMs) hits.delete(k);
    }
  }
  hits.set(ip, arr);
  return arr.length > RATE.max;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function clip(v, n) {
  return typeof v === 'string' ? v.trim().slice(0, n) : '';
}

// 短字段压成单行，避免换行/制表符把转发消息的结构打乱
function one(v, n) {
  return clip(v, n).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '0.0.0.0';
}

function buildText(d) {
  const lines = [
    '【官网工况提交】',
    `公司：${d.company}`,
    `联系人：${d.person}`,
    `电话/微信：${d.phone}`,
    d.email ? `邮箱：${d.email}` : '',
    d.place ? `项目地：${d.place}` : '',
    d.capacity ? `需求水量：${d.capacity} t/d` : '',
    d.source ? `源水：${d.source}` : '',
    d.use ? `用途：${d.use}` : '',
    d.note ? `补充：${d.note}` : '',
    `来源页：${d.ref}`,
    `时间：${d.ts}（UTC）`,
    `IP：${d.ip}`,
  ];
  return lines.filter(Boolean).join('\n');
}

async function postWebhook(url, text) {
  let payload;
  if (/qyapi\.weixin\.qq\.com/.test(url)) {
    payload = { msgtype: 'text', text: { content: text } };            // 企业微信群机器人
  } else if (/open\.(feishu|larksuite)\.(cn|larksuite\.com)|open\.larksuite/.test(url)) {
    payload = { msg_type: 'text', content: { text } };                 // 飞书自定义机器人
  } else {
    payload = { text };                                                // 通用端点
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('webhook ' + res.status);
  return true;
}

async function sendMail(env, d, text) {
  const key = env.RESEND_API_KEY;
  const to = (env.INQUIRY_EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || !to.length) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.INQUIRY_EMAIL_FROM || 'onboarding@resend.dev',
      to,
      subject: `官网工况：${d.company}｜${d.capacity || '水量待定'} t/d`,
      text,
    }),
  });
  if (!res.ok) throw new Error('resend ' + res.status);
  return true;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  if (overLimit(clientIp(request))) {
    return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Retry-After': '600',
      },
    });
  }

  let raw;
  try {
    raw = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  if (!raw || typeof raw !== 'object') return json({ ok: false, error: 'bad_payload' }, 400);

  // 蜜罐：机器人填了隐藏字段，直接假装成功，不给对方反馈
  if (typeof raw.website === 'string' && raw.website.trim() !== '') {
    return json({ ok: true, skipped: true });
  }

  const d = {
    company: one(raw.company, MAX.company),
    person: one(raw.person, MAX.person),
    phone: one(raw.phone, MAX.phone),
    email: one(raw.email, MAX.email),
    place: one(raw.place, MAX.place),
    capacity: one(raw.capacity, MAX.capacity),
    source: one(raw.source, 40),
    use: one(raw.use, 40),
    note: clip(raw.note, MAX.note),
    ref: one(raw.ref, 200),
    ts: one(raw.ts, 40),
    ip: clientIp(request),
  };

  if (!d.company || !d.person || !d.phone) return json({ ok: false, error: 'missing_fields' }, 400);
  if (d.phone.replace(/\D/g, '').length < 7) return json({ ok: false, error: 'bad_phone' }, 400);
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return json({ ok: false, error: 'bad_email' }, 400);

  const text = buildText(d);
  const hook = env.INQUIRY_WEBHOOK;
  const mailReady = !!(env.RESEND_API_KEY && env.INQUIRY_EMAIL_TO);

  if (!hook && !mailReady) return json({ ok: false, error: 'not_configured' }, 503);

  const results = { webhook: false, mail: false };
  const errors = [];

  if (hook) {
    try { results.webhook = await postWebhook(hook, text); } catch (e) { errors.push('webhook: ' + e.message); }
  }
  if (mailReady) {
    try { results.mail = await sendMail(env, d, text); } catch (e) { errors.push('mail: ' + e.message); }
  }

  if (results.webhook || results.mail) return json({ ok: true, channels: results });
  return json({ ok: false, error: 'delivery_failed', detail: errors.join('; ').slice(0, 200) }, 502);
}
