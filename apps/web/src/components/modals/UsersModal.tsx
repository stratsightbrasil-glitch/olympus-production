import React, { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  reqHeaders: Record<string, string>;
}

export function UsersModal({ onClose, reqHeaders }: Props) {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'analista' });

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/v1/users', { headers: reqHeaders });
      if (res.ok) setUsersList(await res.json());
      else console.error('Erro ao carregar usuários:', await res.text());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/users', { method: 'POST', headers: reqHeaders, body: JSON.stringify(form) });
      if (res.ok) { setForm({ name: '', email: '', password: '', role: 'analista' }); loadUsers(); }
      else alert((await res.json()).error || 'Erro ao criar usuário');
    } catch { alert('Erro na requisição'); }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await fetch(`/api/v1/users/${id}`, { method: 'PATCH', headers: reqHeaders, body: JSON.stringify({ role: newRole }) });
      loadUsers();
    } catch { alert('Erro ao atualizar'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário do sistema?')) return;
    try {
      const res = await fetch(`/api/v1/users/${id}`, { method: 'DELETE', headers: reqHeaders });
      if (res.ok) loadUsers(); else alert((await res.json()).error || 'Erro ao excluir');
    } catch { alert('Erro ao excluir'); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-stratsight-dark text-xl">Gestão de Usuários</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">✕</button>
        </div>
        <form onSubmit={handleCreate} autoComplete="off" className="flex gap-2 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <input type="text" autoComplete="new-password" placeholder="Nome" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border outline-none focus:border-stratsight-medium" />
          <input type="email" autoComplete="new-password" placeholder="E-mail" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border outline-none focus:border-stratsight-medium" />
          <input type="password" autoComplete="new-password" placeholder="Senha" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border outline-none focus:border-stratsight-medium" />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="px-3 py-2 rounded-lg border outline-none focus:border-stratsight-medium bg-white">
            <option value="admin">Admin</option><option value="analista">Analista</option><option value="cliente">Cliente</option>
          </select>
          <button type="submit" className="bg-stratsight-dark text-white px-4 py-2 rounded-lg font-bold hover:bg-stratsight-medium">Criar</button>
        </form>
        <div className="overflow-y-auto flex-1 border rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-stratsight-dark text-white sticky top-0">
              <tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">2FA</th><th className="p-3">Perfil</th><th className="p-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {usersList.map(u => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-gray-600">{u.email}</td>
                  <td className="p-3">{u.isTwoFactorEnabled ? '✅ Ativo' : '❌ Não'}</td>
                  <td className="p-3">
                    <select value={u.role} onChange={e => handleUpdateRole(u.id, e.target.value)} className="bg-transparent font-bold outline-none cursor-pointer border-b border-dashed border-gray-400">
                      <option value="admin">Admin</option><option value="analista">Analista</option><option value="cliente">Cliente</option>
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
