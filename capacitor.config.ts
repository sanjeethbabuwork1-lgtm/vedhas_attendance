import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vedhasattendance.app',
  appName: 'Vedhas HR',
  webDir: 'out',
  backgroundColor: '#FFFFFF',
  plugins: {
    CapacitorUpdater: {
      autoUpdate: 'off',
      statsUrl: '',
    },
  },
};

export default config;