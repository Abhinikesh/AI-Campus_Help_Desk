/**
 * client/src/pages/Notifications/index.jsx
 * Centralized Notification Center Page supporting category filters, read/unread states, and preferences.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import notificationService from '../../services/notification.service';
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Filter,
  Settings,
  CalendarCheck,
  Megaphone,
  AlertTriangle,
  Info,
  Clock,
  CheckCircle,
  X,
  RefreshCw,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Alerts' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'academic', label: 'Academic & Exams' },
  { id: 'administrative', label: 'Administrative' },
  { id: 'system', label: 'System' },
];

function getCategoryIcon(category) {
  switch (category) {
    case 'attendance':
      return <CalendarCheck size={18} className="text-blue-600" />;
    case 'announcement':
      return <Megaphone size={18} className="text-amber-600" />;
    case 'administrative':
      return <AlertTriangle size={18} className="text-purple-600" />;
    case 'examination':
    case 'academic':
      return <Info size={18} className="text-emerald-600" />;
    default:
      return <Bell size={18} className="text-gray-500" />;
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case 'urgent':
      return <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 rounded">Urgent</span>;
    case 'high':
      return <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 rounded">High</span>;
    case 'low':
      return <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded">Low</span>;
    default:
      return <span className="px-2 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 rounded">Normal</span>;
  }
}

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast() || {};
  const { unreadCount, refreshUnread } = useNotifications();

  const [activeTab, setActiveTab] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Preferences Modal state
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Fetch paginated notifications
  const fetchList = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        category: activeTab === 'all' ? undefined : activeTab,
        isRead: unreadOnly ? false : undefined,
      };

      const res = await notificationService.getNotifications(params);
      setNotifications(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      if (showToast) showToast('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, unreadOnly, showToast]);

  useEffect(() => {
    fetchList(1);
  }, [fetchList]);

  // Load preferences
  const loadPreferences = async () => {
    try {
      const res = await notificationService.getPreferences();
      setPreferences(res.data?.categories || {});
      setPrefModalOpen(true);
    } catch (err) {
      if (showToast) showToast('Could not load preferences', 'error');
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await notificationService.updatePreferences({ categories: preferences });
      if (showToast) showToast('Preferences updated successfully', 'success');
      setPrefModalOpen(false);
      refreshUnread();
    } catch (err) {
      if (showToast) showToast('Failed to update preferences', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      await notificationService.markAsRead(id);
      refreshUnread();
    } catch (err) {
      fetchList(pagination.page);
    }
  };

  const handleMarkAsUnread = async (id) => {
    try {
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: false } : n));
      await notificationService.markAsUnread(id);
      refreshUnread();
    } catch (err) {
      fetchList(pagination.page);
    }
  };

  const handleDelete = async (id) => {
    try {
      setNotifications(prev => prev.filter(n => n._id !== id));
      await notificationService.deleteNotification(id);
      refreshUnread();
      if (showToast) showToast('Notification removed', 'info');
    } catch (err) {
      fetchList(pagination.page);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      await notificationService.markAllAsRead(activeTab === 'all' ? null : activeTab);
      refreshUnread();
      if (showToast) showToast('All notifications marked as read', 'success');
    } catch (err) {
      fetchList(pagination.page);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto mt-16">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Bell className="text-blue-600" size={26} />
                Notification Center
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Real-time academic alerts, attendance records, campus announcements, and administrative updates.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50"
              >
                <CheckCheck size={16} /> Mark All Read
              </button>

              <button
                type="button"
                onClick={loadPreferences}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 shadow-sm transition-colors"
              >
                <Sliders size={16} /> Preferences
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-3">
            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveTab(cat.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === cat.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Unread Only Toggle */}
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer pr-2 select-none">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={e => setUnreadOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              Show Unread Only ({unreadCount})
            </label>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <RefreshCw size={28} className="mx-auto mb-3 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Fetching notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={30} />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">All Caught Up!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No notifications match your current filters. You will be automatically notified here when new academic or attendance events occur.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map(notif => (
                <div
                  key={notif._id}
                  className={`bg-white rounded-xl border p-4 sm:p-5 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    !notif.isRead ? 'border-blue-200 bg-blue-50/20 shadow-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 bg-slate-100 rounded-lg flex-shrink-0 mt-0.5">
                      {getCategoryIcon(notif.category)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className={`text-sm font-semibold truncate ${!notif.isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                          {notif.title}
                        </h3>
                        {getPriorityBadge(notif.priority)}
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" title="Unread" />
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mb-2">
                        {notif.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(notif.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        {notif.actorRole && notif.actorRole !== 'system' && (
                          <span>Issued by: <strong>{notif.actorName || notif.actorRole}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-end">
                    {notif.targetRoute && (
                      <button
                        type="button"
                        onClick={() => navigate(notif.targetRoute)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Open <ExternalLink size={12} />
                      </button>
                    )}

                    {!notif.isRead ? (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notif._id)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        Mark Read
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMarkAsUnread(notif._id)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Mark as unread"
                      >
                        Unread
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(notif._id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 px-2 text-xs text-slate-500">
                  <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} notifications)</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchList(pagination.page - 1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchList(pagination.page + 1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Preferences Modal */}
      {prefModalOpen && preferences && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sliders size={18} className="text-blue-600" />
                Notification Preferences
              </h3>
              <button
                type="button"
                onClick={() => setPrefModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">
                Select which categories you wish to receive in-app alerts for. Mandatory system and security notices cannot be disabled.
              </p>

              {[
                { key: 'attendance', label: 'Attendance Alerts', desc: 'Session absences, manual corrections, biometric status.' },
                { key: 'announcement', label: 'Campus Announcements', desc: 'Institutional broadcasts and faculty communications.' },
                { key: 'academic', label: 'Academic Notifications', desc: 'Course assignments, syllabi updates, academic drive notes.' },
                { key: 'examination', label: 'Exams & Results', desc: 'Timetables, seat hall allocations, grade releases.' },
                { key: 'administrative', label: 'Administrative & Complaints', desc: 'Help desk replies, grievance resolutions, fee notices.' },
                { key: 'system', label: 'System & Security', desc: 'Password resets, biometric consent audit, login alerts.', locked: true },
              ].map(item => (
                <div key={item.key} className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 last:border-0">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800">{item.label}</h4>
                    <p className="text-[11px] text-slate-500 leading-normal">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      disabled={item.locked}
                      checked={item.locked ? true : Boolean(preferences[item.key])}
                      onChange={e => setPreferences({ ...preferences, [item.key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPrefModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingPrefs}
                onClick={handleSavePreferences}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;

