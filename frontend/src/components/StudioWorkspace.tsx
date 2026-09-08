import React from 'react';
import { MixerPanel } from './MixerPanel';
import { TimelineWaveform } from './TimelineWaveform';
import type { MultiTrackEngine } from '../audio/MultiTrackEngine';
import type { ChordSegment } from '../audio/types';
import type { UserPreferences } from '../firebase/firestore';

interface StudioWorkspaceProps {
  engine: MultiTrackEngine | null;
  stems: Record<string, string>;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  beatGrid: number[];
  chords: ChordSegment[];
  loopA: number | null;
  loopB: number | null;
  onSeek: (seconds: number) => void;
  onSaveMixPreferences?: (prefs: UserPreferences) => void;
  initialPreferences?: UserPreferences | null;
}

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  engine,
  stems,
  isPlaying,
  duration,
  currentTime,
  beatGrid,
  chords,
  loopA,
  loopB,
  onSeek,
  onSaveMixPreferences,
  initialPreferences,
}) => {
  return (
    <div className="glass-panel studio-workspace-panel">
      {/* Lado A: Consola Mixer Compacta Acoplada */}
      <div className="workspace-mixer-column">
        <MixerPanel
          engine={engine}
          stems={stems}
          isPlaying={isPlaying}
          onSaveMixPreferences={onSaveMixPreferences}
          initialPreferences={initialPreferences}
        />
      </div>

      {/* Separador sutil */}
      <div className="workspace-divider" />

      {/* Lado B: Línea de Tiempo & Forma de Onda Multi-pista */}
      <div className="workspace-timeline-column">
        <TimelineWaveform
          duration={duration}
          currentTime={currentTime}
          beatGrid={beatGrid}
          chords={chords}
          loopA={loopA}
          loopB={loopB}
          onSeek={onSeek}
        />
      </div>
    </div>
  );
};
