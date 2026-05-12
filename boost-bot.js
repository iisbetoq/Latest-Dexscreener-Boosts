#!/usr/bin/env node

const API_BASE = 'https://api.dexscreener.com';
const DEFAULT_LIMIT = 10;
const DEFAULT_TIME_ZONE = 'Asia/Jakarta';
const BOOST_MIN_HOURS = 12;
const BOOST_MAX_HOURS = 24;

function parseArgs(argv) {
  const args = {
    limit: DEFAULT_LIMIT,
    watch: false,
    intervalSec: 60,
    timezone: DEFAULT_TIME_ZONE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--limit' && argv[i + 1]) {
      args.limit = Math.max(1, Math.min(50, Number(argv[i + 1]) || DEFAULT_LIMIT));
      i += 1;
      continue;
    }
    if (token === '--watch') {
      args.watch = true;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.intervalSec = Math.max(5, Number(next) || 60);
        i += 1;
      }
      continue;
    }
    if (token === '--tz' && argv[i + 1]) {
      args.timezone = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
    }
  }

  return args;
}

function helpText() {
  return `
Usage:
  node boost-bot.js [--limit 10] [--watch [seconds]] [--tz Asia/Jakarta]

What it does:
  - Fetches latest token boosts from Dexscreener
  - Shows up to 10 newest boosts by default
  - Adds start time from paid order data when available
  - Adds end time as an estimate based on Dexscreener's published 12-24 hour boost duration
`;
}

function toDate(ms, timeZone) {
  if (!Number.isFinite(ms)) return '-';
  const dtf = new Intl.DateTimeFormat('id-ID', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
  });
  return dtf.format(new Date(ms));
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text;
  return text + ' '.repeat(width - text.length);
}

function truncate(text, width) {
  const value = String(text ?? '');
  if (value.length <= width) return value;
  if (width <= 3) return value.slice(0, width);
  return `${value.slice(0, width - 3)}...`;
}

function normalizeBoosts(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'cekboost-cli/1.0',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}${body ? ` - ${body.slice(0, 200)}` : ''}`);
  }

  return response.json();
}

function extractStartTimestamp(ordersPayload) {
  const orders = Array.isArray(ordersPayload) ? ordersPayload : [];
  const approved = orders.filter((order) => order && order.status === 'approved' && Number.isFinite(order.paymentTimestamp));
  if (approved.length === 0) return null;

  const tokenAds = approved.filter((order) => order.type === 'tokenAd');
  const candidates = tokenAds.length > 0 ? tokenAds : approved;
  candidates.sort((a, b) => (b.paymentTimestamp ?? 0) - (a.paymentTimestamp ?? 0));
  return candidates[0].paymentTimestamp;
}

function formatRange(startMs, minHours, maxHours, timeZone) {
  if (!Number.isFinite(startMs)) return '-';
  const minEnd = startMs + minHours * 60 * 60 * 1000;
  const maxEnd = startMs + maxHours * 60 * 60 * 1000;
  return `${toDate(minEnd, timeZone)} s/d ${toDate(maxEnd, timeZone)}`;
}

async function loadLatestBoosts(limit, timeZone) {
  const payload = await fetchJson(`${API_BASE}/token-boosts/latest/v1`);
  const boosts = normalizeBoosts(payload).slice(0, limit);

  const rows = await Promise.all(
    boosts.map(async (boost) => {
      let startTimestamp = null;

      if (boost.chainId && boost.tokenAddress) {
        try {
          const orders = await fetchJson(`${API_BASE}/orders/v1/${encodeURIComponent(boost.chainId)}/${encodeURIComponent(boost.tokenAddress)}`);
          startTimestamp = extractStartTimestamp(orders);
        } catch {
          // The public boost row is still useful even when order lookup is unavailable.
        }
      }

      return {
        chainId: boost.chainId ?? '-',
        tokenAddress: boost.tokenAddress ?? '-',
        amount: boost.amount ?? '-',
        totalAmount: boost.totalAmount ?? '-',
        url: boost.url ?? '-',
        start: Number.isFinite(startTimestamp) ? toDate(startTimestamp, timeZone) : '-',
        end: Number.isFinite(startTimestamp)
          ? formatRange(startTimestamp, BOOST_MIN_HOURS, BOOST_MAX_HOURS, timeZone)
          : '-',
      };
    })
  );

  return rows;
}

function printRows(rows) {
  const headers = ['No', 'Chain', 'Token Address', 'Amount', 'Total', 'Mulai Boost', 'Akhir Boost (estimasi)', 'URL'];
  const widths = [4, 10, 44, 10, 10, 24, 44, 28];

  const formatLine = (cells) =>
    cells
      .map((cell, index) => pad(truncate(cell, widths[index]), widths[index]))
      .join(' | ');

  console.log(formatLine(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('-|-'));

  rows.forEach((row, index) => {
    console.log(
      formatLine([
        String(index + 1),
        row.chainId,
        row.tokenAddress,
        row.amount,
        row.totalAmount,
        row.start,
        row.end,
        row.url,
      ])
    );
  });
}

async function runOnce(limit, timeZone) {
  const rows = await loadLatestBoosts(limit, timeZone);
  const now = toDate(Date.now(), timeZone);
  console.log(`Dexscreener latest boosts - ${now}`);
  console.log(`Catatan: waktu akhir adalah estimasi ${BOOST_MIN_HOURS}-${BOOST_MAX_HOURS} jam dari start karena API publik tidak memberi timestamp end langsung.`);
  printRows(rows);
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(helpText().trim());
    return;
  }

  if (!args.watch) {
    await runOnce(args.limit, args.timezone);
    return;
  }

  for (;;) {
    try {
      console.clear();
      await runOnce(args.limit, args.timezone);
    } catch (error) {
      console.error(`Gagal mengambil boost: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, args.intervalSec * 1000));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
