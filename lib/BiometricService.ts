import * as LocalAuthentication from 'expo-local-authentication';

export async function hasBiometricHardware(): Promise<boolean> {
  try {
    return await LocalAuthentication.hasHardwareAsync();
  } catch (e) {
    console.error('Error checking biometric hardware:', e);
    return false;
  }
}

export async function isBiometricEnrolled(): Promise<boolean> {
  try {
    return await LocalAuthentication.isEnrolledAsync();
  } catch (e) {
    console.error('Error checking biometric enrollment:', e);
    return false;
  }
}

export async function getSupportedBiometrics(): Promise<LocalAuthentication.AuthenticationType[]> {
  try {
    return await LocalAuthentication.supportedAuthenticationTypesAsync();
  } catch (e) {
    return [];
  }
}

export async function authenticateWithBiometrics(
  promptMessage: string = 'فتح تطبيق ميزان'
): Promise<boolean> {
  try {
    const hasHardware = await hasBiometricHardware();
    const isEnrolled = await isBiometricEnrolled();

    if (!hasHardware || !isEnrolled) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'رمز PIN',
      disableDeviceFallback: false,
      cancelLabel: 'إلغاء',
    });

    return result.success;
  } catch (e) {
    console.error('Biometric authentication failed:', e);
    return false;
  }
}
