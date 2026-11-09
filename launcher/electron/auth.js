/* POISON CLIENT — Microsoft account login (Microsoft -> Xbox Live -> Minecraft services) via msmc.
 *
 * - Login opens Microsoft's own sign-in page in a popup window. POISON never sees the password.
 * - Only the refresh token is persisted, encrypted with the OS keychain (DPAPI on Windows)
 *   through Electron's safeStorage. If encryption is unavailable we keep it in memory only.
 * - Supports several accounts; one is active.
 */
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const { Auth } = require('msmc');

const STORE = () => path.join(app.getPath('userData'), 'accounts.bin');
let accounts = []; // { uuid, name, skin, refresh }
let activeUuid = null;
const live = new Map(); // uuid -> msmc Minecraft token (session cache)

function load() {
  try {
    if (!fs.existsSync(STORE()) || !safeStorage.isEncryptionAvailable()) return;
    const data = JSON.parse(safeStorage.decryptString(fs.readFileSync(STORE())));
    accounts = data.accounts || [];
    activeUuid = data.active || (accounts[0] && accounts[0].uuid) || null;
  } catch (e) {
    console.error('[auth] could not read account store:', e.message);
    accounts = []; activeUuid = null;
  }
}
function save() {
  if (!safeStorage.isEncryptionAvailable()) return; // never write tokens in plain text
  fs.mkdirSync(path.dirname(STORE()), { recursive: true });
  fs.writeFileSync(STORE(), safeStorage.encryptString(JSON.stringify({ accounts, active: activeUuid })));
}

function publicView() {
  return {
    active: activeUuid,
    accounts: accounts.map(({ uuid, name, skin }) => ({ uuid, name, skin })),
  };
}

function skinUrl(profile) {
  const s = profile && profile.skins && (profile.skins.find((x) => x.state === 'ACTIVE') || profile.skins[0]);
  return s ? s.url : null;
}

function friendly(err) {
  const code = typeof err === 'string' ? err : (err && (err.ts || err.message)) || String(err);
  const map = {
    'error.gui.closed': 'Sign-in window was closed.',
    'error.auth.xsts.userNotFound': 'This Microsoft account has no Xbox profile yet. Sign in once at xbox.com, then try again.',
    'error.auth.xsts.bannedCountry': 'Xbox Live is not available in your country.',
    'error.auth.xsts.child': 'This is a child account. An adult must add it to a Microsoft family first.',
    'error.auth.xsts.child.SK': 'This is a child account. An adult must add it to a Microsoft family first.',
    'error.auth.minecraft.profile': 'This account does not own Minecraft: Java Edition.',
    'error.auth.minecraft.entitlements': 'This account does not own Minecraft: Java Edition.',
  };
  return map[code] || `Sign-in failed (${code}).`;
}

async function finish(xbox) {
  const mc = await xbox.getMinecraft();
  if (mc.isDemo() || !mc.profile) throw 'error.auth.minecraft.profile';
  const acc = { uuid: mc.profile.id, name: mc.profile.name, skin: skinUrl(mc.profile), refresh: xbox.save() };
  accounts = accounts.filter((a) => a.uuid !== acc.uuid).concat(acc);
  activeUuid = acc.uuid;
  live.set(acc.uuid, mc);
  save();
  return acc;
}

async function login() {
  const auth = new Auth('select_account');
  try {
    const xbox = await auth.launch('electron', {
      width: 520, height: 680, resizable: false, title: 'Sign in with Microsoft', backgroundColor: '#ffffff', autoHideMenuBar: true,
    });
    await finish(xbox);
    return { ok: true, ...publicView() };
  } catch (e) {
    return { ok: false, message: friendly(e), ...publicView() };
  }
}

function logout(uuid) {
  accounts = accounts.filter((a) => a.uuid !== uuid);
  live.delete(uuid);
  if (activeUuid === uuid) activeUuid = accounts[0] ? accounts[0].uuid : null;
  save();
  return publicView();
}

function select(uuid) {
  if (accounts.some((a) => a.uuid === uuid)) { activeUuid = uuid; save(); }
  return publicView();
}

/** MCLC authorization object for the active account, refreshing tokens as needed. */
async function getLaunchAuth() {
  const acc = accounts.find((a) => a.uuid === activeUuid);
  if (!acc) throw new Error('Sign in with your Microsoft account first.');
  let mc = live.get(acc.uuid);
  if (!mc || !mc.validate()) {
    try {
      const xbox = await new Auth('select_account').refresh(acc.refresh);
      const fresh = await finish(xbox);
      mc = live.get(fresh.uuid);
    } catch (e) {
      throw new Error(`Your session for ${acc.name} expired: ${friendly(e)} Please sign in again.`);
    }
  }
  return mc.mclc();
}

module.exports = { load, login, logout, select, getLaunchAuth, publicView };
