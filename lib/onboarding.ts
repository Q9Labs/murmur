import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = 'murmur_onboarding_completed';

export const onboardingStorage = {
  async isCompleted(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      return value === 'true';
    } catch {
      return false;
    }
  },

  async markAsCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch {
      // Silently fail if storage is unavailable
    }
  },

  async reset(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    } catch {
      // Silently fail if storage is unavailable
    }
  },
};
