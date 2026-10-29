import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, BookOpen, CheckCheck, LoaderCircle } from 'lucide-react';
import {
  getListAdminNotificationsQueryKey,
  useMarkAdminNotificationRead,
  useMarkAllAdminNotificationsRead,
} from '@workspace/api-client-react';
import type { AdminNotification } from '@workspace/api-client-react';

type Props = {
  items: AdminNotification[];
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenSubmissions: () => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function AdminNotificationsPanel({
  items,
  unreadCount,
  isLoading,
  isError,
  onRetry,
  onOpenSubmissions,
}: Props) {
  const qc = useQueryClient();
  const markRead = useMarkAdminNotificationRead();
  const markAllRead = useMarkAllAdminNotificationsRead();
  const [error, setError] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: getListAdminNotificationsQueryKey() });

  const openNotification = (item: AdminNotification) => {
    setError('');
    if (item.readAt) {
      onOpenSubmissions();
      return;
    }
    markRead.mutate({ notificationId: item.id }, {
      onSuccess: () => {
        void refresh();
        onOpenSubmissions();
      },
      onError: () => setError('تعذّر تحديث الإشعار. حاول مرة أخرى.'),
    });
  };

  return <section aria-labelledby="adm-notifications-heading">
    <div className="adm-section-head">
      <div>
        <h2 id="adm-notifications-heading">إشعارات الإدارة</h2>
        <p className="adm-note">ستظهر هنا المشاركات الجديدة التي تنتظر مراجعتك.</p>
      </div>
      <button
        type="button"
        className="button button-outline button-compact"
        disabled={!unreadCount || markAllRead.isPending || isLoading}
        onClick={() => {
          setError('');
          markAllRead.mutate(undefined, {
            onSuccess: () => void refresh(),
            onError: () => setError('تعذّر تحديث الإشعارات. حاول مرة أخرى.'),
          });
        }}
      >
        {markAllRead.isPending ? <LoaderCircle className="adm-notification-spin" size={14}/> : <CheckCheck size={14}/>}
        تحديد الكل كمقروء
      </button>
    </div>
    {error && <p className="adm-form-error" role="alert">{error}</p>}
    {isLoading
      ? <div className="adm-skeleton" role="status" aria-label="جارٍ تحميل الإشعارات"><span/><span/><span/></div>
      : isError
        ? <div className="adm-state adm-error" role="alert"><p>تعذّر تحميل الإشعارات.</p><button type="button" className="button button-outline button-compact" onClick={onRetry}>إعادة المحاولة</button></div>
        : items.length === 0
          ? <div className="adm-state"><b>لا توجد إشعارات جديدة</b><p>ستصل إلى هنا تنبيهات المحتوى المرسل للمراجعة.</p></div>
          : <div className="adm-notification-list">
            {items.map(item => <article className={`adm-notification ${item.readAt ? '' : 'is-unread'}`} key={item.id}>
              <span className="adm-notification-icon"><Bell size={17}/></span>
              <div className="adm-notification-copy">
                <div className="adm-notification-heading"><b>{item.title}</b>{!item.readAt && <span className="adm-unread-label">جديد</span>}</div>
                <p>{item.message}</p>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </div>
              <button type="button" className="button button-outline button-compact" disabled={markRead.isPending} onClick={() => openNotification(item)}>
                <BookOpen size={14}/> فتح المراجعة
              </button>
            </article>)}
          </div>}
  </section>;
}
