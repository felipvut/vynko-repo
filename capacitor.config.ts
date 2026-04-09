import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.company.example',
  appName: 'Vynko',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      backgroundColor: '#7acc29',
      style: 'LIGHT',
    },
    SocialLogin: {
      providers: {
        google: true,
        apple: true,
      }
    }
  },
};

export default config;
