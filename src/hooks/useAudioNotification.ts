import { useCallback } from 'react';
import { PREDEFINED_SOUNDS, SoundType } from './useCustomSounds';
import { playPredefinedSound, getPredefinedSoundUrl } from '@/utils/generateTone';
import { usePersistentSettings } from './usePersistentSettings';

interface NotificationSettings {
  enabled: boolean;
  volume: number;
  enabledSounds: Record<SoundType, boolean>;
  selectedSounds: Record<SoundType, string>; // ID of selected sound
  customSoundUrls: Record<SoundType, string>; // URL of the sound to play
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  volume: 0.7,
  enabledSounds: {
    newOrder: true,
    newReservation: true,
    orderReady: true,
    kdsNewOrder: true,
    maxWaitAlert: true,
    tableWaitAlert: true,
    idleTableAlert: true,
    orderCancelled: true,
    bottleneckAlert: true,
    stationChange: true,
    itemDelayAlert: true,
  },
  selectedSounds: {
    newOrder: 'beepClassic',
    newReservation: 'bell',
    orderReady: 'dingDong',
    kdsNewOrder: 'urgentAlert',
    maxWaitAlert: 'urgentAlert',
    tableWaitAlert: 'bell',
    idleTableAlert: 'dingDong',
    orderCancelled: 'urgentAlert',
    bottleneckAlert: 'urgentAlert',
    stationChange: 'bell',
    itemDelayAlert: 'urgentAlert',
  },
  customSoundUrls: {
    newOrder: PREDEFINED_SOUNDS.beepClassic.data,
    newReservation: PREDEFINED_SOUNDS.bell.data,
    orderReady: PREDEFINED_SOUNDS.dingDong.data,
    kdsNewOrder: PREDEFINED_SOUNDS.urgentAlert.data,
    maxWaitAlert: PREDEFINED_SOUNDS.urgentAlert.data,
    tableWaitAlert: PREDEFINED_SOUNDS.bell.data,
    idleTableAlert: PREDEFINED_SOUNDS.dingDong.data,
    orderCancelled: PREDEFINED_SOUNDS.urgentAlert.data,
    bottleneckAlert: PREDEFINED_SOUNDS.urgentAlert.data,
    stationChange: PREDEFINED_SOUNDS.bell.data,
    itemDelayAlert: PREDEFINED_SOUNDS.urgentAlert.data,
  },
};

export function useAudioNotification() {
  // Usar persistência no banco de dados para configurações de áudio
  const { 
    settings, 
    updateSettings: updateSettingsDb,
    setSettings,
  } = usePersistentSettings<NotificationSettings>({
    settingsKey: 'notification_settings',
    defaults: defaultSettings,
    localStorageKey: 'pdv-notification-settings',
  });

  const playSound = useCallback(async (type: SoundType) => {
    if (!settings.enabled || !settings.enabledSounds[type]) return;

    try {
      const selectedSoundId = settings.selectedSounds[type];
      const isPredefined = selectedSoundId in PREDEFINED_SOUNDS;

      if (isPredefined) {
        // playPredefinedSound already has 500ms debounce built in
        await playPredefinedSound(selectedSoundId, settings.volume);
      } else {
        // Custom sound — try URL first, fallback to predefined if it fails
        const soundUrl = settings.customSoundUrls[type];
        if (soundUrl) {
          try {
            const audio = new Audio(soundUrl);
            audio.volume = settings.volume;
            // audio.play() resolves when playback starts; if it throws (e.g. autoplay
            // blocked, file not found), we catch below and use the predefined fallback.
            await audio.play();
          } catch (customErr) {
            console.warn('[sound] Custom sound failed, using predefined fallback:', customErr);
            // Fallback to the default predefined sound for this type
            const fallbackId = defaultSettings.selectedSounds[type] || 'beepClassic';
            await playPredefinedSound(fallbackId, settings.volume);
          }
        } else {
          // No URL — use predefined fallback
          const fallbackId = defaultSettings.selectedSounds[type] || 'beepClassic';
          await playPredefinedSound(fallbackId, settings.volume);
        }
      }
    } catch (error) {
      console.warn('[sound] Could not play notification sound:', type, error);
    }
  }, [settings]);

  const playNewOrderSound = useCallback(() => playSound('newOrder'), [playSound]);
  const playNewReservationSound = useCallback(() => playSound('newReservation'), [playSound]);
  const playOrderReadySound = useCallback(() => playSound('orderReady'), [playSound]);
  const playKdsNewOrderSound = useCallback(() => playSound('kdsNewOrder'), [playSound]);
  const playMaxWaitAlertSound = useCallback(() => playSound('maxWaitAlert'), [playSound]);
  const playTableWaitAlertSound = useCallback(() => playSound('tableWaitAlert'), [playSound]);
  const playIdleTableAlertSound = useCallback(() => playSound('idleTableAlert'), [playSound]);
  const playOrderCancelledSound = useCallback(() => playSound('orderCancelled'), [playSound]);
  const playBottleneckAlertSound = useCallback(() => playSound('bottleneckAlert'), [playSound]);
  const playStationChangeSound = useCallback(() => playSound('stationChange'), [playSound]);
  const playItemDelayAlertSound = useCallback(() => playSound('itemDelayAlert'), [playSound]);

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    updateSettingsDb(updates);
  }, [updateSettingsDb]);

  const toggleSound = useCallback((type: SoundType) => {
    setSettings({
      ...settings,
      enabledSounds: {
        ...settings.enabledSounds,
        [type]: !settings.enabledSounds[type],
      },
    });
  }, [settings, setSettings]);

  const setSelectedSound = useCallback((type: SoundType, soundId: string, soundUrl: string) => {
    setSettings({
      ...settings,
      selectedSounds: {
        ...settings.selectedSounds,
        [type]: soundId,
      },
      customSoundUrls: {
        ...settings.customSoundUrls,
        [type]: soundUrl,
      },
    });
  }, [settings, setSettings]);

  const testSound = useCallback(async (type: SoundType) => {
    const selectedSoundId = settings.selectedSounds[type];
    const isPredefined = selectedSoundId in PREDEFINED_SOUNDS;

    try {
      if (isPredefined) {
        await playPredefinedSound(selectedSoundId, settings.volume);
      } else {
        const soundUrl = settings.customSoundUrls[type];
        if (soundUrl) {
          const audio = new Audio(soundUrl);
          audio.volume = settings.volume;
          await audio.play();
        }
      }
    } catch (error) {
      console.warn('Could not play test sound:', error);
    }
  }, [settings.selectedSounds, settings.customSoundUrls, settings.volume]);

  const getSoundUrl = useCallback(async (type: SoundType): Promise<string | null> => {
    const selectedSoundId = settings.selectedSounds[type];
    const isPredefined = selectedSoundId in PREDEFINED_SOUNDS;
    if (isPredefined) {
      return await getPredefinedSoundUrl(selectedSoundId);
    }
    return settings.customSoundUrls[type] || null;
  }, [settings.selectedSounds, settings.customSoundUrls]);

  return {
    settings,
    updateSettings,
    toggleSound,
    setSelectedSound,
    testSound,
    playSound,
    getSoundUrl,
    playNewOrderSound,
    playNewReservationSound,
    playOrderReadySound,
    playKdsNewOrderSound,
    playMaxWaitAlertSound,
    playTableWaitAlertSound,
    playIdleTableAlertSound,
    playOrderCancelledSound,
    playBottleneckAlertSound,
    playStationChangeSound,
    playItemDelayAlertSound,
  };
}
