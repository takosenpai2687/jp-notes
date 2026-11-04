"use client";

import { createContext, useCallback, useContext, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { AlertCircle, Check, Eye, EyeOff, LoaderCircle, LogOut, ShieldCheck, X } from "lucide-react";
import { z } from "zod";
import {
  attemptSchema, credentialsSchema, emptyProgress, mergeProgress, progressSchema, readSchema,
} from "@/lib/models";
import type { Attempt, Level, NoteRead, Progress, User } from "@/lib/models";
import { CloudFriend, Modal } from "./ui";

const storageKey = "tako-jp:guest:v1";
const userSchema = z.object({ id: z.string(), username: z.string() });
export async function api<T>(url: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST", cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.string() }).safeParse(data);
    throw new Error(parsed.success ? parsed.data.error : "请求没有成功，请稍后重试。");
  }
  return schema.parse(data);
}
function readGuest(): Progress {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return emptyProgress();
  const parsed = progressSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("本机游客记录格式异常，原数据未被覆盖。请先备份浏览器数据。");
  return parsed.data;
}
function writeGuest(progress: Progress) {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); window.dispatchEvent(new Event("tako-progress")); }
  catch { throw new Error("浏览器未能保存记录，可能空间已满或禁用了本地存储。请调整设置后重试。"); }
}
const serverGuest = { progress: emptyProgress(), error: "", ready: false };
let guestSnapshot = serverGuest;
let cachedGuestRaw: string | null | undefined;
function getGuestSnapshot() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (guestSnapshot.ready && raw === cachedGuestRaw && !guestSnapshot.error) return guestSnapshot;
    const progress = readGuest();
    cachedGuestRaw = raw;
    guestSnapshot = { progress, error: "", ready: true };
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "无法读取浏览器存储，请检查浏览器设置。";
    if (guestSnapshot.error !== message) guestSnapshot = { progress: emptyProgress(), error: message, ready: true };
  }
  return guestSnapshot;
}
function subscribeGuest(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("tako-progress", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("tako-progress", callback); };
}

interface AppContextValue {
  user: User | null;
  progress: Progress;
  loading: boolean;
  error: string;
  preferredLevel: Level;
  setPreferredLevel: (level: Level) => void;
  openAuth: () => void;
  notify: (message: string, error?: boolean) => void;
  retrySync: () => Promise<void>;
  recordAttempt: (attempt: Attempt) => Promise<void>;
  markRead: (noteId: string) => Promise<void>;
  authenticate: (action: "login" | "register", username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider is required.");
  return value;
}

export function AppProvider({ initialUser, initialProgress, children }: {
  initialUser: User | null; initialProgress: Progress; children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const userRef = useRef(user);
  const guest = useSyncExternalStore(subscribeGuest, getGuestSnapshot, () => serverGuest);
  const [accountProgress, setProgress] = useState<Progress>(initialProgress);
  const progress = user ? accountProgress : guest.progress;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preferredLevel, setPreferredLevel] = useState<Level>("N5");
  const [authOpen, setAuthOpen] = useState(false);
  const [notices, setNotices] = useState<{ id: string; message: string; error: boolean }[]>([]);
  const notify = useCallback((message: string, isError = false) => {
    const id = crypto.randomUUID();
    setNotices((items) => [...items.slice(-2), { id, message, error: isError }]);
  }, []);

  const refresh = useCallback(async (account: User) => {
    try {
      const baseline = await api("/api/progress", progressSchema);
      if (userRef.current?.id !== account.id) return;
      setProgress(baseline);
      let guest = emptyProgress();
      let warning = "";
      try { guest = readGuest(); }
      catch (failure) {
        warning = `游客记录未能读取：${failure instanceof Error ? failure.message : "存储不可用"}`;
      }
      if (account) {
        let imported = 0;
        let rejected = 0;
        const batches = Math.ceil(Math.max(guest.attempts.length, guest.reads.length) / 200);
        for (let batch = 0; batch < batches; batch++) {
          const result = await api("/api/progress", z.object({ imported: z.number(), rejected: z.array(z.string()) }), {
            type: "import", attempts: guest.attempts.slice(batch * 200, (batch + 1) * 200),
            reads: guest.reads.slice(batch * 200, (batch + 1) * 200),
          });
          imported += result.imported;
          rejected += result.rejected.length;
        }
        const remote = await api("/api/progress", progressSchema);
        if (userRef.current?.id === account.id) setProgress(remote);
        if (imported) notify(`已合并 ${imported} 次游客测验记录，本机副本依然保留。`);
        if (rejected) warning = `${rejected} 条游客记录因题库更新或时间异常未能合并，仍保留在本机。`;
      }
      if (userRef.current?.id === account.id) setError(warning);
    } catch (failure) {
      if (userRef.current?.id === account.id) setError(failure instanceof Error ? failure.message : "学习记录加载失败，请重试。");
    } finally { if (userRef.current?.id === account.id) setLoading(false); }
  }, [notify]);

  async function recordAttempt(attempt: Attempt) {
    const scope = userRef.current?.id;
    if (scope) {
      const saved = await api("/api/progress", z.object({ attempt: attemptSchema }), { type: "attempt", attempt });
      if (userRef.current?.id === scope) setProgress((previous) => mergeProgress(previous, { attempts: [saved.attempt], reads: [] }));
    } else {
      const next = mergeProgress(readGuest(), { attempts: [attempt], reads: [] });
      writeGuest(next);
    }
  }
  async function markRead(noteId: string) {
    const read: NoteRead = { noteId, readAt: new Date().toISOString() };
    const scope = userRef.current?.id;
    if (scope) {
      const saved = await api("/api/progress", z.object({ read: readSchema }), { type: "read", read });
      if (userRef.current?.id === scope) setProgress((previous) => mergeProgress(previous, { attempts: [], reads: [saved.read] }));
    } else {
      const next = mergeProgress(readGuest(), { attempts: [], reads: [read] });
      writeGuest(next);
    }
  }
  async function authenticate(action: "login" | "register", username: string, password: string) {
    const result = await api(`/api/auth/${action}`, z.object({ user: userSchema }), { username, password });
    userRef.current = result.user;
    setUser(result.user);
    setProgress(emptyProgress());
    setLoading(true);
    await refresh(result.user);
    setAuthOpen(false);
    notify(action === "register" ? "护照准备好啦，欢迎来到 tako-jp。" : "欢迎回来，继续你的探索吧。");
  }
  async function logout() {
    await api("/api/auth/logout", z.object({ user: z.null() }), {});
    userRef.current = null;
    setUser(null);
    setProgress(emptyProgress());
    setLoading(false);
    setError("");
    setAuthOpen(false);
    notify("已切换为游客，账号记录仍安全保存在数据库中。");
  }
  return (
    <MotionConfig reducedMotion="user">
      <AppContext.Provider value={{
        user, progress, loading: user ? loading : !guest.ready, error: user ? error : guest.error, preferredLevel, setPreferredLevel,
        openAuth: () => setAuthOpen(true), notify, retrySync: async () => {
          if (userRef.current) { setLoading(true); await refresh(userRef.current); }
          else window.dispatchEvent(new Event("tako-progress"));
        },
        recordAttempt, markRead, authenticate, logout,
      }}>
        {children}
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        <div className="toast-stack" aria-live="polite">
          <AnimatePresence>
            {notices.map((notice) => (
              <motion.div key={notice.id} className={`toast ${notice.error ? "toast-error" : ""}`}
                role={notice.error ? "alert" : "status"} initial={{ opacity: 0, y: 16, scale: .96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 24 }}>
                {notice.error ? <AlertCircle size={19} /> : <Check size={19} />}
                <span>{notice.message}</span>
                <button aria-label="关闭提示" onClick={() => setNotices((items) => items.filter((item) => item.id !== notice.id))}>
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </AppContext.Provider>
    </MotionConfig>
  );
}

function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, authenticate, logout } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ username, password });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (mode === "register" && password !== confirmPassword) {
      setError("两次输入的密码不一致，请重新确认。");
      return;
    }
    setBusy(true); setError("");
    try { await authenticate(mode, parsed.data.username, password); setPassword(""); setConfirmPassword(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "登录失败，请重试。"); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError("");
    try { await logout(); setMode("login"); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "退出失败，请重试。"); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onOpenChange={(value) => {
      if (!busy) { onOpenChange(value); setError(""); setPassword(""); setConfirmPassword(""); }
    }} title={user ? "你的学习护照" : mode === "login" ? "带上护照，继续出发" : "领取你的空岛护照"}
      description={user ? "账号记录保存在本站 SQLite 数据库中。" : "不登录也能自由探索；登录后，足迹就有了自己的家。"}>
      <div className="auth-mascot"><CloudFriend /></div>
      {user ? (
        <div className="account-details">
          <h3>{user.username}</h3><p><ShieldCheck size={17} /> 已开启账号记录保存</p>
          <p className="muted">游客记录已自动尝试合并，本机副本不会被删除。</p>
          <button className="button secondary full" onClick={signOut} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <LogOut size={17} />} 退出账号，切换游客
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="auth-username">用户名</label>
          <input id="auth-username" value={username} onChange={(event) => setUsername(event.target.value)}
            autoComplete="username" minLength={3} maxLength={24} required placeholder="给自己起个名字吧" disabled={busy} />
          <label htmlFor="auth-password">密码 <span>至少 8 个字符</span></label>
          <div className="password-field">
            <input id="auth-password" type={showPassword ? "text" : "password"} value={password}
              onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128}
              autoComplete={mode === "register" ? "new-password" : "current-password"} required disabled={busy} />
            <button type="button" className="icon-button" aria-label={showPassword ? "隐藏密码" : "显示密码"}
              onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {mode === "register" && <>
            <label htmlFor="auth-confirm-password">确认密码</label>
            <input id="auth-confirm-password" type={showPassword ? "text" : "password"} value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128}
              autoComplete="new-password" required disabled={busy}
              aria-invalid={!!error && password !== confirmPassword}
              aria-describedby={error ? "auth-error" : undefined} />
          </>}
          <button className="button primary full" disabled={busy} type="submit">
            {busy ? <LoaderCircle size={18} className="spin" /> : <ShieldCheck size={18} />}
            {busy ? "正在准备你的护照…" : mode === "login" ? "登录，继续探索" : "创建账号，开启旅程"}
          </button>
          <button type="button" className="text-button auth-switch" disabled={busy}
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setConfirmPassword(""); }}>
            {mode === "login" ? "还没有护照？免费注册" : "已经有护照？返回登录"}
          </button>
          <p className="auth-footnote"><ShieldCheck size={14} /> 密码加密保存 · 自动合并游客记录</p>
        </form>
      )}
      {error && <p id="auth-error" className="inline-error" role="alert">{error}</p>}
    </Modal>
  );
}
