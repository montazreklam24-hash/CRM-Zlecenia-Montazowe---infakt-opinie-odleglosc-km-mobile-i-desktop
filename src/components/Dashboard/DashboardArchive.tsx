import React from 'react';
import { Archive, Image as ImageIcon, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { Job, PaymentStatus } from '../../types';
import PaymentStatusBadge, { PaymentStatusMiniMenu } from '../PaymentStatusBadge';

interface DashboardArchiveProps {
  jobs: Job[];
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  handleToggleReviewRequest: (e: React.MouseEvent, jobId: string) => void;
  handlePaymentStatusChange: (jobId: string, status: PaymentStatus) => Promise<void>;
  handleDelete: (id: string, e: React.MouseEvent) => void;
  isAdmin: boolean;
  archivePaymentMenuOpen: string | null;
  setArchivePaymentMenuOpen: (id: string | null) => void;
}

export const DashboardArchive: React.FC<DashboardArchiveProps> = ({
  jobs,
  onSelectJob,
  handleToggleReviewRequest,
  handlePaymentStatusChange,
  handleDelete,
  isAdmin,
  archivePaymentMenuOpen,
  setArchivePaymentMenuOpen
}) => {
  if (jobs.length === 0) {
    return (
      <div className="theme-card p-12 text-center" style={{ borderRadius: 'var(--radius-lg)' }}>
        <Archive className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Archiwum jest puste</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zakończone zlecenia pojawią się tutaj</p>
      </div>
    );
  }

  const jobsByDate = jobs
    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
    .reduce((acc, job) => {
      const date = new Date(job.completedAt || job.createdAt);
      const dayOfWeek = date.toLocaleDateString('pl-PL', { weekday: 'long' });
      const dayAndMonth = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
      const dateKey = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${dayAndMonth}`;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(job);
      return acc;
    }, {} as Record<string, Job[]>);

  return (
    <div className="space-y-6">
      {Object.entries(jobsByDate).map(([dateKey, dayJobs]) => (
        <div key={dateKey}>
          <h3 className="text-lg font-bold mb-3 px-2" style={{ color: 'var(--text-primary)' }}>
            {dateKey}
          </h3>
          
          <div className="space-y-2">
            {dayJobs.map(job => {
              const imgUrl = job.projectImages?.[0] || job.completionImages?.[0];
              const reviewRequestSent = !!job.reviewRequestSentAt;
              const paymentStatus = job.paymentStatus || PaymentStatus.NONE;
              
              return (
                <div 
                  key={job.id}
                  className="theme-card flex gap-4 p-4 hover:shadow-lg transition-all group w-full"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  <div 
                    className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border cursor-pointer"
                    style={{ borderColor: 'var(--border-light)', background: 'var(--bg-surface)' }}
                    onClick={() => onSelectJob(job, true)}
                  >
                    {imgUrl ? (
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectJob(job, true)}>
                    <h4 className="font-bold text-sm mb-1 group-hover:text-blue-600 transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {job.data.jobTitle || 'Bez nazwy'}
                    </h4>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      <strong>Klient:</strong> {job.data.clientName || 'Brak'}
                    </p>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      <strong>Adres:</strong> {job.data.address || 'Brak'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {job.friendlyId}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleReviewRequest(e, job.id); }}
                      className={`p-2 rounded-lg transition-all hover:scale-110 ${
                        reviewRequestSent 
                          ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                      title={reviewRequestSent ? 'Prośba o opinię wysłana (kliknij aby odznaczyć)' : 'Prośba o opinię nie wysłana (kliknij aby oznaczyć)'}
                    >
                      {reviewRequestSent ? (
                        <ThumbsUp className="w-5 h-5 fill-current" />
                      ) : (
                        <ThumbsDown className="w-5 h-5 fill-current text-red-600" />
                      )}
                    </button>
                    
                    <div className="relative" style={{ zIndex: archivePaymentMenuOpen === job.id ? 1000 : 'auto' }}>
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setArchivePaymentMenuOpen(archivePaymentMenuOpen === job.id ? null : job.id);
                        }}
                        className="transition-all hover:scale-105"
                      >
                        <PaymentStatusBadge status={paymentStatus} size="sm" />
                      </button>
                      
                      {archivePaymentMenuOpen === job.id && (
                        <div className="absolute right-0 top-full mt-1" style={{ zIndex: 1001 }}>
                          <PaymentStatusMiniMenu
                            currentStatus={paymentStatus}
                            onSelect={async (newStatus) => {
                              await handlePaymentStatusChange(job.id, newStatus);
                              setArchivePaymentMenuOpen(null);
                            }}
                            onClose={() => setArchivePaymentMenuOpen(null)}
                            position="bottom"
                          />
                        </div>
                      )}
                    </div>
                    
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const jobName = job.data.jobTitle || job.friendlyId || 'to zlecenie';
                          if (window.confirm(`🗑️ Czy na pewno chcesz TRWALE USUNĄĆ zlecenie z archiwum?\n\n"${jobName}"\n\nTej operacji nie można cofnąć!`)) {
                            handleDelete(job.id, e);
                          }
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all hover:scale-110"
                        title="Trwale usuń z archiwum"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

