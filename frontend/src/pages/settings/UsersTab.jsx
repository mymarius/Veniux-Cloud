import DialogShell from '../../components/ui/DialogShell';
import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../components/Toast';
import { StatusBadge, Input } from '../../components/ui';
import { Users, Plus, Search, Trash2, Edit3, Shield, Mail, Phone, Loader2, X, CheckCircle2, KeyRound } from 'lucide-react';
import AccessScopeEditor from './AccessScopeEditor';

export default function UsersTab({embedded=false}) {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [scopeUser,setScopeUser]=useState(null);
  const [mfaUser,setMfaUser]=useState(null);
  const [mfaPassword,setMfaPassword]=useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'viewer'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/settings/users');
      setUsers(res.data);
    } catch (err) {
      showToast('Kullanıcı listesi alınamadı.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/settings/users', formData);
      showToast('Yeni kullanıcı başarıyla oluşturuldu.', 'success');
      setShowAddModal(false);
      setFormData({ email: '', password: '', fullName: '', phone: '', role: 'viewer' });
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Kullanıcı eklenirken hata oluştu.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await apiClient.put(`/settings/users/${editingUser.id}`, {
        fullName: editingUser.fullName,
        phone: editingUser.phone,
        role: editingUser.role,
        status: editingUser.status,
        newPassword: editingUser.newPassword || undefined
      });
      showToast('Kullanıcı bilgileri güncellendi.', 'success');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Güncelleme başarısız.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaReset = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiClient.post(`/settings/users/${mfaUser.id}/mfa-reset`, { password: mfaPassword });
      showToast(res.data.reset ? 'İki aşamalı doğrulama kapatıldı; kullanıcı yeniden giriş yapmalı.' : 'Bu kullanıcıda iki aşamalı doğrulama açık değil.', res.data.reset ? 'success' : 'info');
      setMfaUser(null);
      setMfaPassword('');
    } catch (err) {
      showToast(err.response?.data?.error || 'İki aşamalı doğrulama sıfırlanamadı.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`${userEmail} kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
      await apiClient.delete(`/settings/users/${userId}`);
      showToast('Kullanıcı silindi.', 'success');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Kullanıcı silinemedi.', 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          {embedded?<h3 className="text-xl font-bold text-gray-900">Kullanıcılar</h3>:<h1 className="text-xl font-bold text-gray-900">Kullanıcılar</h1>}
          <p className="text-sm text-gray-500 mt-1">Sisteme erişebilen çalışma alanı personellerini ve hesap yetkilerini yönetin.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Kullanıcı Ekle</span>
        </button>
      </div>

      {!loading && users.some(user=>user.status==='active'&&user.accessMode!=='company'&&!user.assignedWarehouses) && <div className="veniux-card p-4 border-amber-200 bg-amber-50 text-sm text-amber-900" role="status">{users.filter(user=>user.status==='active'&&user.accessMode!=='company'&&!user.assignedWarehouses).length} aktif kullanıcının depo erişimi atanmamış. Bu kullanıcıların operasyon erişimi kapalıdır. Kullanıcı satırındaki kalkan düğmesinden depo veya firma genelinde erişim atayın.</div>}
      {/* Filter and Search Bar */}
      <div className="veniux-card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="İsim veya e-posta ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 focus:border-brand-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-gray-500 font-mono uppercase">Rol:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 font-medium outline-none focus:border-brand-500"
          >
            <option value="ALL">Tümü ({users.length})</option>
            <option value="admin">Yöneticiler (Admin)</option>
            <option value="manager">Müdürler (Manager)</option>
            <option value="cashier">Kasiyer (Kasa)</option>
                  <option value="operator">Operatörler</option>
            <option value="pharmacist">Kayıt görevlileri</option>
            <option value="viewer">İzleyiciler (Viewer)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="veniux-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Kriterlere uygun kullanıcı bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                <tr>
                  <th className="p-4">Kullanıcı</th>
                  <th className="p-4">İletişim</th>
                  <th className="p-4">Rol / Yetki</th>
                  <th className="p-4">Durum</th>
                  <th className="p-4">Kayıt Tarihi</th>
                  <th className="p-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 font-bold flex items-center justify-center text-xs">
                          {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.fullName}</p>
                          <p className="text-xs text-gray-500 font-mono">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-gray-600">
                      {user.phone || '-'}
                    </td>
                    <td className="p-4">
                      <StatusBadge
                        status={user.role === 'admin' ? 'active' : user.role === 'manager' ? 'warning' : 'info'}
                        text={user.role?.toUpperCase()}
                      />
                      <div className="text-xs text-gray-500 mt-1">{user.accessMode==='company'?'Firma genelinde erişim':user.assignedWarehouses?`${user.assignedWarehouses} depo erişimi`:'Depo atanmamış · operasyon kapalı'}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Aktif
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-500 font-mono">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={()=>setScopeUser(user)} className="icon-btn" title="Depo erişim kapsamı" aria-label={`${user.email} depo erişimi`}><Shield className="w-4 h-4"/></button>
                        <button onClick={()=>{setMfaPassword('');setMfaUser(user);}} className="icon-btn" title="İki aşamalı doğrulamayı sıfırla" aria-label={`${user.email} iki aşamalı doğrulamasını sıfırla`}><KeyRound className="w-4 h-4"/></button>
                        <button
                          onClick={() => setEditingUser({ ...user, newPassword: '' })}
                          className="icon-btn"
                          title="Düzenle"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="icon-btn" data-tone="danger"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mfaUser && (
        <DialogShell isOpen={Boolean(mfaUser)} onClose={() => setMfaUser(null)} title="İki aşamalı doğrulamayı sıfırla">
            <form onSubmit={handleMfaReset} className="space-y-4">
              <p className="text-sm text-gray-600">{mfaUser.email} hesabında iki aşamalı doğrulama kapatılır ve açık oturumları sonlanır. Bunu yalnızca kullanıcının kimliğini doğruladıktan sonra yapın.</p>
              <Input
                label="Mevcut Şifreniz"
                type="password"
                autoComplete="current-password"
                value={mfaPassword}
                onChange={(e) => setMfaPassword(e.target.value)}
                required
              />
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button type="button" onClick={() => setMfaUser(null)} className="btn-secondary">Vazgeç</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>Sıfırla</span>
                </button>
              </div>
            </form>
        </DialogShell>
      )}

      {/* Modal: Add User */}
      {scopeUser&&<AccessScopeEditor user={scopeUser} onClose={()=>{setScopeUser(null);fetchUsers();}}/>}
      {showAddModal && (
        <DialogShell isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Yeni kullanıcı">
            <form onSubmit={handleCreateUser} className="space-y-4">
              <Input
                label="Ad Soyad"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
              <Input
                label="E-Posta Adresi"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <Input
                label="İlk Giriş Şifresi"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="En az 8 karakter, en fazla 72 bayt"
                required
              />
              <Input
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+90 5XX XXX XX XX"
              />
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                  Kullanıcı Rolü & Yetki Seviyesi
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500"
                >
                  <option value="admin">Sistem Yöneticisi (Admin)</option>
                  <option value="manager">Depo & Operasyon Müdürü (Manager)</option>
                  <option value="cashier">Kasiyer (Kasa)</option>
                  <option value="operator">Depo operatörü (yalnızca görüntüleme)</option>
                  <option value="pharmacist">Kayıt görevlisi</option>
                  <option value="viewer">İzleyici (Viewer - Salt Okunur)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Kullanıcıyı Kaydet</span>
                </button>
              </div>
            </form>
        </DialogShell>
      )}

      {/* Modal: Edit User */}
      {editingUser && (
        <DialogShell isOpen={Boolean(editingUser)} onClose={() => setEditingUser(null)} title="Kullanıcıyı düzenle">
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <Input
                label="Ad Soyad"
                value={editingUser.fullName || ''}
                onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                required
              />
              <Input
                label="Telefon"
                value={editingUser.phone || ''}
                onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
              />
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                  Rol & Yetki
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500"
                >
                  <option value="admin">Sistem Yöneticisi (Admin)</option>
                  <option value="manager">Depo & Operasyon Müdürü (Manager)</option>
                  <option value="cashier">Kasiyer (Kasa)</option>
                  <option value="operator">Depo operatörü (yalnızca görüntüleme)</option>
                  <option value="pharmacist">Kayıt görevlisi</option>
                  <option value="viewer">İzleyici (Viewer - Salt Okunur)</option>
                </select>
              </div>
              <Input
                label="Şifre Sıfırla (İsteğe Bağlı)"
                type="password"
                placeholder="Değiştirmek istemiyorsanız boş bırakın"
                value={editingUser.newPassword || ''}
                onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value })}
              />

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn-secondary"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Güncelle</span>
                </button>
              </div>
            </form>
        </DialogShell>
      )}
    </div>
  );
}
