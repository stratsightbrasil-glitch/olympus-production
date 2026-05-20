const fs = require('fs');
const path = require('path');

const root = 'D:\\Pessoais\\DEV\\Olympus_v4';

console.log('🚀 Iniciando a implantação da Autenticação JWT (Fase B5)...\\n');

// 1. .env
const envFile = path.join(root, '.env');
let env = fs.readFileSync(envFile, 'utf8');
if (!env.includes('JWT_SECRET')) {
  fs.appendFileSync(envFile, '\\nJWT_SECRET="olympus_super_secret_key_2026"\\n');
  console.log('✅ Chave JWT_SECRET adicionada ao .env');
}

// 2. package.json API
const pkgFile = path.join(root, 'apps', 'api', 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
if (!pkg.dependencies['bcryptjs']) {
  pkg.dependencies['bcryptjs'] = '^2.4.3';
  pkg.devDependencies['@types/bcryptjs'] = '^2.4.6';
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
  console.log('✅ bcryptjs adicionado às dependências da API');
}

// 3. auth.ts
const authFile = path.join(root, 'apps', 'api', 'src', 'routes', 'auth.ts');
const authCode = `import { Hono } from 'hono';
import { db, users } from '@olympus/db';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import bcrypt from 'bcryptjs';

const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.passwordHash) return c.json({ error: 'Credenciais inválidas' }, 401);

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return c.json({ error: 'Credenciais inválidas' }, 401);

  const payload = { id: user.id, name: user.name, role: user.role, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 };
  const token = await sign(payload, process.env.JWT_SECRET || 'olympus_super_secret_key_2026');
  return c.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

authRoutes.post('/register', async (c) => {
  const { name, email, password, role } = await c.req.json();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return c.json({ error: 'Email já cadastrado' }, 400);
  
  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db.insert(users).values({ name, email, passwordHash, role: role || 'analista' }).returning();
  return c.json({ user: { id: newUser.id, name: newUser.name, role: newUser.role } });
});

export default authRoutes;`;
fs.writeFileSync(authFile, authCode, 'utf8');
console.log('✅ Rota de Autenticação criada (auth.ts)');

// 4. index.ts
const indexFile = path.join(root, 'apps', 'api', 'src', 'index.ts');
let indexCode = fs.readFileSync(indexFile, 'utf8');
if (!indexCode.includes('import authRoutes')) {
  indexCode = indexCode.replace("import { config } from 'dotenv';", "import { config } from 'dotenv';\\nimport { jwt } from 'hono/jwt';");
  indexCode = indexCode.replace("import painelRoutes from './routes/painel';", "import painelRoutes from './routes/painel';\\nimport authRoutes from './routes/auth';");
  indexCode = indexCode.replace("app.route('/api/v1/chat', chatRoutes);", `app.route('/api/v1/auth', authRoutes);

// Proteção JWT nas rotas privadas
app.use('/api/v1/chat/*', jwt({ secret: process.env.JWT_SECRET || 'olympus_super_secret_key_2026' }));
app.use('/api/v1/sessions/*', jwt({ secret: process.env.JWT_SECRET || 'olympus_super_secret_key_2026' }));
app.use('/api/v1/extract/*', jwt({ secret: process.env.JWT_SECRET || 'olympus_super_secret_key_2026' }));
app.use('/api/v1/export/*', jwt({ secret: process.env.JWT_SECRET || 'olympus_super_secret_key_2026' }));

app.route('/api/v1/chat', chatRoutes);`);
  fs.writeFileSync(indexFile, indexCode, 'utf8');
  console.log('✅ Middlewares JWT aplicados no index.ts');
}

// 5. chat.ts
const chatFile = path.join(root, 'apps', 'api', 'src', 'routes', 'chat.ts');
let chatCode = fs.readFileSync(chatFile, 'utf8');
if (!chatCode.includes("jwtPayload")) {
  chatCode = chatCode.replace("const projectName = body.projectName || 'Novo Projeto';", "const projectName = body.projectName || 'Novo Projeto';\\n    const jwtPayload = c.get('jwtPayload') || { name: 'Sistema' };");
  chatCode = chatCode.replace(/createdBy: 'Analista Responsável'(.*)/g, "createdBy: jwtPayload.name,");
  chatCode = chatCode.replace(/updatedBy: 'Analista Responsável'/g, "updatedBy: jwtPayload.name");
  fs.writeFileSync(chatFile, chatCode, 'utf8');
  console.log('✅ Auditoria JWT integrada no chat.ts');
}

// 6. sessions.ts
const sessFile = path.join(root, 'apps', 'api', 'src', 'routes', 'sessions.ts');
let sessCode = fs.readFileSync(sessFile, 'utf8');
if (!sessCode.includes("jwtPayload")) {
  sessCode = sessCode.replace("const body = await c.req.json();", "const body = await c.req.json();\\n    const jwtPayload = c.get('jwtPayload') || { name: 'Sistema' };");
  sessCode = sessCode.replace("await db.update(projects).set({ deletedAt: new Date(), deletedBy: 'Analista Responsável' })", "const jwtPayload = c.get('jwtPayload') || { name: 'Sistema' };\\n    await db.update(projects).set({ deletedAt: new Date(), deletedBy: jwtPayload.name })");
  sessCode = sessCode.replace(/'Analista Responsável'/g, "jwtPayload.name");
  fs.writeFileSync(sessFile, sessCode, 'utf8');
  console.log('✅ Auditoria JWT integrada no sessions.ts');
}

// 7. App.tsx
const appFile = path.join(root, 'apps', 'web', 'src', 'App.tsx');
let appCode = fs.readFileSync(appFile, 'utf8');
if (!appCode.includes('setToken')) {
  appCode = appCode.replace(
    "const [sidebarOpen, setSidebarOpen] = useState(true);",
    `const [sidebarOpen, setSidebarOpen] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('olympus_token'));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('olympus_user') || 'null'));
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  
  const authHeader = { 'Authorization': \`Bearer \${token}\` };
  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` };`
  );

  appCode = appCode.replace("fetch('/api/v1/sessions?t=' + Date.now());", "fetch('/api/v1/sessions?t=' + Date.now(), { headers: authHeader });");
  appCode = appCode.replace("fetch('/api/v1/sessions/' + id + '?t=' + Date.now());", "fetch('/api/v1/sessions/' + id + '?t=' + Date.now(), { headers: authHeader });");
  appCode = appCode.replace("fetch('/api/v1/sessions/' + id, { method: 'DELETE' });", "fetch('/api/v1/sessions/' + id, { method: 'DELETE', headers: authHeader });");
  appCode = appCode.split("headers: { 'Content-Type': 'application/json' }").join("headers: reqHeaders");
  appCode = appCode.replace("fetch('/api/v1/extract', { method: 'POST', body: fd });", "fetch('/api/v1/extract', { method: 'POST', headers: authHeader, body: fd });");
  
  const loginJSX = `
  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-stratsight-dark font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-stratsight-gold to-stratsight-medium"></div>
          <div className="flex justify-center mb-6 mt-2">
            <div className="w-16 h-16 rounded-full bg-stratsight-medium flex items-center justify-center text-white text-3xl font-bold shadow-inner">⚡</div>
          </div>
          <h2 className="text-center text-2xl font-bold text-stratsight-dark tracking-widest mb-1">OLYMPUS v4.0</h2>
          <p className="text-center text-xs text-stratsight-medium mb-6 uppercase tracking-wider">{authMode === 'login' ? 'Acesso Restrito' : 'Cadastro de Usuário'}</p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const url = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) });
            const data = await res.json();
            if (!res.ok) return alert(data.error || 'Erro na autenticação');
            if (authMode === 'register') { alert('Cadastro realizado! Faça login.'); setAuthMode('login'); setAuthForm({...authForm, password: ''}); } 
            else { localStorage.setItem('olympus_token', data.token); localStorage.setItem('olympus_user', JSON.stringify(data.user)); setToken(data.token); setUser(data.user); }
          }} className="space-y-4">
            {authMode === 'register' && <input type="text" placeholder="Nome Completo" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors" />}
            <input type="email" placeholder="E-mail corporativo" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors" />
            <input type="password" placeholder="Senha" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors" />
            <button type="submit" className="w-full bg-stratsight-dark text-white font-bold py-3.5 rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20">{authMode === 'login' ? 'Entrar no Sistema' : 'Cadastrar'}</button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-gray-500 hover:text-stratsight-medium font-bold transition-colors">{authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}</button>
          </div>
        </div>
      </div>
    );
  }`;
  appCode = appCode.replace("return (\\n    <div className=\\"flex h-screen", loginJSX + "\\n\\n  return (\\n    <div className=\\"flex h-screen");

  const logoutJSX = `
          {/* Perfil e Logout */}
          <div className="p-4 mt-auto border-t border-white/10 flex justify-between items-center bg-black/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-stratsight-medium flex items-center justify-center text-xs text-white font-bold shadow-inner">{user?.name?.slice(0,2).toUpperCase()}</div>
              <div>
                <div className="text-xs text-white font-bold truncate w-28">{user?.name}</div>
                <div className="text-[9px] text-stratsight-gold uppercase tracking-wider">{user?.role}</div>
              </div>
            </div>
            <button onClick={() => { localStorage.removeItem('olympus_token'); localStorage.removeItem('olympus_user'); setToken(null); setUser(null); setMessages([]); setSessoes([]); }} className="text-xs font-bold text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-400/10 transition-colors">SAIR</button>
          </div>
        </div>
      </div>`;
  appCode = appCode.replace("        </div>\\n      </div>\\n\\n      {/* MAIN CONTENT */}", logoutJSX + "\\n\\n      {/* MAIN CONTENT */}");

  fs.writeFileSync(appFile, appCode, 'utf8');
  console.log('✅ Tela de Login e lógica de Token injetadas no App.tsx');
}

console.log('\\n🎉 Autenticação JWT injetada com Sucesso em todo o Monorepo!');
