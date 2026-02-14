/**
 * Media Session API Manager
 * Provides iOS lock screen controls and system media integration
 * Coordinates with audio elements for proper mute/volume control
 */

interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
}

interface MediaSessionState {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: MediaImage[];
  position?: number;
  duration?: number;
  playbackState?: MediaSessionPlaybackState;
}

/**
 * Setup Media Session API with handlers
 */
export function setupMediaSession(handlers: MediaSessionHandlers & { title?: string }) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return; // Media Session API not supported
  }

  const { mediaSession } = navigator;

  // Set initial metadata
  if (handlers.title) {
    mediaSession.metadata = new MediaMetadata({
      title: handlers.title,
    });
  }

  // Setup action handlers
  if (handlers.onPlay) {
    mediaSession.setActionHandler('play', () => {
      handlers.onPlay?.();
    });
  }

  if (handlers.onPause) {
    mediaSession.setActionHandler('pause', () => {
      handlers.onPause?.();
    });
  }

  if (handlers.onSeekBackward) {
    mediaSession.setActionHandler('seekbackward', () => {
      handlers.onSeekBackward?.();
    });
  }

  if (handlers.onSeekForward) {
    mediaSession.setActionHandler('seekforward', () => {
      handlers.onSeekForward?.();
    });
  }

  if (handlers.onPreviousTrack) {
    mediaSession.setActionHandler('previoustrack', () => {
      handlers.onPreviousTrack?.();
    });
  }

  if (handlers.onNextTrack) {
    mediaSession.setActionHandler('nexttrack', () => {
      handlers.onNextTrack?.();
    });
  }

  // Set initial playback state
  if ('setPositionState' in mediaSession) {
    try {
      (mediaSession as MediaSession & { setPositionState: (state: MediaPositionState) => void }).setPositionState({
        duration: 0,
        playbackRate: 1.0,
        position: 0,
      });
    } catch (e) {
      // Position state may not be supported on all browsers
      console.log('[Media Session] Position state not supported:', e);
    }
  }
}

/**
 * Update Media Session metadata and state
 */
export function updateMediaSession(state: MediaSessionState) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  const { mediaSession } = navigator;

  // Update metadata if provided
  if (state.title || state.artist || state.album || state.artwork) {
    const metadata: MediaMetadataInit = {};
    if (state.title) metadata.title = state.title;
    if (state.artist) metadata.artist = state.artist;
    if (state.album) metadata.album = state.album;
    if (state.artwork) metadata.artwork = state.artwork;

    mediaSession.metadata = new MediaMetadata(metadata);
  }

  // Update playback state
  if (state.playbackState) {
    mediaSession.playbackState = state.playbackState;
  }

  // Update position state (iOS lock screen progress)
  if ('setPositionState' in mediaSession && (state.position !== undefined || state.duration !== undefined)) {
    try {
      const currentState = (mediaSession as MediaSession & { setPositionState: (state: MediaPositionState) => void }).setPositionState;
      if (currentState) {
        (mediaSession as MediaSession & { setPositionState: (state: MediaPositionState) => void }).setPositionState({
          duration: state.duration ?? 0,
          playbackRate: 1.0,
          position: state.position ?? 0,
        });
      }
    } catch (e) {
      // Position state update may fail if not supported
      console.log('[Media Session] Position state update failed:', e);
    }
  }
}

/**
 * Clear Media Session
 */
export function clearMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  const { mediaSession } = navigator;

  // Clear all action handlers
  mediaSession.setActionHandler('play', null);
  mediaSession.setActionHandler('pause', null);
  mediaSession.setActionHandler('seekbackward', null);
  mediaSession.setActionHandler('seekforward', null);
  mediaSession.setActionHandler('previoustrack', null);
  mediaSession.setActionHandler('nexttrack', null);

  // Clear metadata
  mediaSession.metadata = null;

  // Clear playback state
  mediaSession.playbackState = 'none';

}
