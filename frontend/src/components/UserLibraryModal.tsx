import React, { useState } from 'react';
import { Music, X, Trash2, Play, Calendar, Activity, KeyRound, Clock, AlertCircle } from 'lucide-react';
import type { SavedTrackItem } from '../firebase/firestore';
import type { SessionData } from '../audio/types';

interface UserLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: SavedTrackItem[];
  onSelectTrack: (session: SessionData) => void;
  onDeleteTrack: (trackId: string) => void;
  userName?: string | null;
}

export const UserLibraryModal: React.FC<UserLibraryModalProps> = ({
  isOpen,
  onClose,
  tracks,
  onSelectTrack,
  onDeleteTrack,
  userName,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filtered = tracks.filter((t) =>
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog library-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Music size={20} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Mi Biblioteca de Canciones</h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {userName ? `Canciones guardadas en el perfil de ${userName}` : 'Canciones separadas en la nube'} ({tracks.length})
            </p>
          </div>
          <button onClick={onClose} className="btn btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Buscador */}
        {tracks.length > 0 && (
          <div className="library-search-wrap">
            <input
              type="text"
              placeholder="Buscar por título o tonalidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="library-search-input"
            />
          </div>
        )}

        {/* Lista de Canciones */}
        <div className="library-track-list">
          {tracks.length === 0 ? (
            <div className="library-empty-state">
              <AlertCircle size={32} color="var(--accent-cyan)" style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>Aún no tienes canciones guardadas</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '340px' }}>
                Sube un archivo de audio con el botón "Subir Canción" o guarda la pista Demo para acceder a ella desde cualquier dispositivo.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="library-empty-state">
              <p style={{ color: 'var(--text-muted)' }}>No se encontraron canciones que coincidan con "{searchTerm}".</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div key={item.track_id} className="library-track-card">
                <div className="library-track-main">
                  <span className="library-track-title" title={item.title}>
                    {item.title}
                  </span>

                  <div className="library-track-chips">
                    <span className="chip-badge">
                      <Clock size={11} /> {formatSecs(item.duration_seconds)}
                    </span>
                    <span className="chip-badge chip-bpm">
                      <Activity size={11} /> {Math.round(item.bpm)} BPM
                    </span>
                    <span className="chip-badge chip-key">
                      <KeyRound size={11} /> {item.key}
                    </span>
                    {item.saved_at && (
                      <span className="chip-badge" style={{ color: 'var(--text-muted)' }}>
                        <Calendar size={11} /> {formatDate(item.saved_at)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="library-card-actions">
                  <button
                    onClick={() => {
                      onSelectTrack(item.session_data);
                      onClose();
                    }}
                    className="btn btn-primary btn-sm"
                    title="Cargar esta canción en el estudio"
                  >
                    <Play size={13} fill="#fff" />
                    <span>Cargar</span>
                  </button>

                  <button
                    onClick={() => onDeleteTrack(item.track_id)}
                    className="btn btn-icon btn-danger-icon"
                    title="Eliminar de mi biblioteca"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
